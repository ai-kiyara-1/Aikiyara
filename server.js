import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { rateLimit } from "express-rate-limit";

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => { res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin"); next(); });
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(root, "public")));
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 240, standardHeaders: "draft-8", legacyHeaders: false });
app.use("/api/", limiter);
let db = null;
let firebaseReady = false;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const service = JSON.parse(raw);
    if (service.project_id !== "aikiyara-554e2") throw new Error("Wrong Firebase project");
    if (!getApps().length) initializeApp({ credential: cert(service), storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "aikiyara-554e2.firebasestorage.app" });
    db = getFirestore(); firebaseReady = true;
  } else console.warn("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
} catch (error) { console.error("Firebase initialization failed:", error.message); }

const validId = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const cleanMessages = value => Array.isArray(value) ? value.filter(x => x && ["user", "model"].includes(x.role) && typeof x.text === "string").slice(-100).map(x => ({ role: x.role, text: x.text.slice(0, 12000) })) : [];
function security(req, res, next) {
  if (!firebaseReady) return res.status(503).json({ error: "Firebase backend is not configured." });
  const bearer = (req.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  const appCheck = req.get("X-Firebase-AppCheck");
  if (!bearer || !appCheck) return res.status(401).json({ error: "Authentication and App Check are required." });
  Promise.all([getAuth().verifyIdToken(bearer[1]), getAppCheck().verifyToken(appCheck)]).then(([user, check]) => {
    if (check.appId !== "1:1034106862384:web:ef4ba576c2b936f132a6f5") throw new Error("Invalid App Check app");
    req.uid = user.uid; req.email = user.email || ""; next();
  }).catch(error => { console.warn("Security check rejected:", error.message); res.status(401).json({ error: "Invalid authentication or App Check token." }); });
}
const userCollection = (uid, name) => db.collection("users").doc(uid).collection(name);
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Aikiyara", firebaseConfigured: firebaseReady, geminiConfigured: Boolean(process.env.GEMINI_API_KEY) }));
app.get("/api/profile", security, async (req, res) => { const snap = await db.collection("users").doc(req.uid).get(); res.json({ profile: { email: req.email, ...(snap.data() || {}) } }); });
app.get("/api/chats", security, async (req, res) => { const snap = await userCollection(req.uid, "chats").orderBy("updatedAt", "desc").limit(100).get(); res.json({ chats: snap.docs.map(x => ({ id: x.id, ...x.data() })) }); });
app.get("/api/chats/:id", security, async (req, res) => { if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid chat id." }); const x = await userCollection(req.uid, "chats").doc(req.params.id).get(); if (!x.exists) return res.status(404).json({ error: "Chat not found." }); res.json({ chat: { id: x.id, ...x.data() } }); });
app.post("/api/chats", security, async (req, res) => { const title = String(req.body?.title || "New chat").trim().slice(0, 120) || "New chat"; const ref = await userCollection(req.uid, "chats").add({ title, messages: cleanMessages(req.body?.messages), summary: "", pinned: false, archived: false, onHome: false, projectId: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); res.status(201).json({ id: ref.id }); });
app.patch("/api/chats/:id", security, async (req, res) => { if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid chat id." }); const patch = { updatedAt: FieldValue.serverTimestamp() }; if (typeof req.body?.title === "string") patch.title = req.body.title.trim().slice(0, 120) || "New chat"; if (Array.isArray(req.body?.messages)) patch.messages = cleanMessages(req.body.messages); for (const key of ["pinned", "archived", "onHome"]) if (typeof req.body?.[key] === "boolean") patch[key] = req.body[key]; await userCollection(req.uid, "chats").doc(req.params.id).update(patch); res.json({ ok: true }); });
app.delete("/api/chats/:id", security, async (req, res) => { await userCollection(req.uid, "chats").doc(req.params.id).delete(); res.json({ ok: true }); });
async function gemini(messages, options = {}) {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error("GEMINI_API_KEY is not configured on the server."), { status: 503 });
  const model = options.model || process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash";
  const contents = messages.map(x => ({ role: x.role, parts: [{ text: x.text }] }));
  const body = { contents, generationConfig: { temperature: options.temperature ?? .7, maxOutputTokens: options.maxOutputTokens || 4096 } };
  if (options.web) body.tools = [{ google_search: {} }];
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw Object.assign(new Error(data?.error?.message || "Gemini request failed"), { status: response.status });
  return { text: data?.candidates?.[0]?.content?.parts?.map(x => x.text || "").join("").trim() || "Gemini returned no text.", raw: data, model };
}
app.post("/api/chat", security, async (req, res) => { try { const message = String(req.body?.message || "").trim(); if (!message || message.length > 12000) return res.status(400).json({ error: "Message is required and must be under 12,000 characters." }); const style = { concise: "Be concise.", detailed: "Give useful detail.", teacher: "Teach step by step.", balanced: "Use balanced detail." }[req.body?.responseStyle] || "Use balanced detail."; const prompt = `You are Aikiyara, a helpful AI assistant. Support Hindi, Hinglish and English and answer in the user's language. ${style} ${req.body?.studyMode ? "Study Mode is on: teach instead of blindly completing work." : ""}`; const result = await gemini([{ role: "user", text: prompt }, ...cleanMessages(req.body?.history).slice(-24), { role: "user", text: message }], { web: req.body?.webSearch === true || /\b(latest|today|current|news|recent|now)\b/i.test(message), model: req.body?.reasoning ? process.env.GEMINI_REASONING_MODEL || "gemini-2.5-pro" : undefined, maxOutputTokens: req.body?.reasoning ? 8192 : 4096 }); const chunks = result.raw?.groundingMetadata?.groundingChunks || []; const sources = [...new Map(chunks.map(x => x.web).filter(x => x?.uri).map(x => [x.uri, { url: x.uri, title: x.title || x.uri }])).values()]; res.json({ text: result.text, model: result.model, sources }); } catch (error) { console.error(error); res.status(error.status || 500).json({ error: error.message || "Unexpected server error." }); } });
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => res.sendFile(path.join(root, "index.html")));
app.listen(port, () => console.log(`Aikiyara listening on ${port}`));
