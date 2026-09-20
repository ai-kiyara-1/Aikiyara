import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBf07alINlpQxnvV-EP_KIMFxyJwYbrwKU",
  authDomain: "aikiyara-5bb4b.firebaseapp.com",
  projectId: "aikiyara-5bb4b",
  storageBucket: "aikiyara-5bb4b.firebasestorage.app",
  messagingSenderId: "367532191724",
  appId: "1:367532191724:web:74990c4f3bf86b9f1b5ac9",
  measurementId: "G-JL9SHN4PTX"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const $ = (id) => document.getElementById(id);
const makeId = () => crypto.randomUUID();

const defaultTasks = [
  { id: makeId(), text: "Review today's goals", done: false },
  { id: makeId(), text: "Complete one high-impact task", done: true },
  { id: makeId(), text: "Write a quick update note", done: false }
];

const authScreen = $("authScreen");
const appShell = $("appShell");
const authForm = $("authForm");
const authTitle = $("authTitle");
const authModeToggle = $("authModeToggle");
const authMessage = $("authMessage");
const authSubmit = $("authSubmit");
const emailInput = $("emailInput");
const passwordInput = $("passwordInput");
const googleSignInBtn = $("googleSignInBtn");
const userEmail = $("userEmail");
const signOutBtn = $("signOutBtn");
const taskForm = $("taskForm");
const taskInput = $("taskInput");
const taskList = $("taskList");
const notesInput = $("notesInput");
const saveStatus = $("saveStatus");
const clearAllBtn = $("clearAllBtn");
const totalTasksEl = $("totalTasks");
const doneTasksEl = $("doneTasks");
const focusScoreEl = $("focusScore");
const taskCountBadge = $("taskCountBadge");
const greeting = $("greeting");
const insightText = $("insightText");
const timerDisplay = $("timerDisplay");
const startTimerBtn = $("startTimerBtn");
const resetTimerBtn = $("resetTimerBtn");
const themeToggle = $("themeToggle");
const aiKeyInput = $("aiKeyInput");
const saveApiKeyBtn = $("saveApiKeyBtn");
const aiMessages = $("aiMessages");
const aiInput = $("aiInput");
const aiSendBtn = $("aiSendBtn");

let createMode = false;
let currentUser = null;
let tasks = [];
let saveTimer = null;
let remainingSeconds = 1500;
let timerId = null;

const userRef = () => currentUser && doc(db, "users", currentUser.uid);

function setAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#f87171" : "var(--muted)";
}

function addAIMessage(text, isUser = false) {
  const node = document.createElement("div");
  node.className = `ai-message ${isUser ? "ai-user" : "ai-bot"}`;
  node.textContent = text;
  aiMessages.appendChild(node);
  aiMessages.scrollTop = aiMessages.scrollHeight;
  return node;
}

function getGeminiKey() {
  return localStorage.getItem("aikiyara-gemini-key") || "";
}

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveUserData().catch((error) => {
      console.error(error);
      saveStatus.textContent = "Save failed";
    });
  }, 500);
}

async function saveUserData() {
  if (!currentUser) return;
  saveStatus.textContent = "Saving...";
  await setDoc(userRef(), {
    tasks,
    notes: notesInput.value,
    theme: document.body.classList.contains("light-mode") ? "light" : "dark",
    updatedAt: serverTimestamp()
  }, { merge: true });
  saveStatus.textContent = "Saved to cloud";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveStatus.textContent = "Ready"; }, 1400);
}

async function loadUserData() {
  const snapshot = await getDoc(userRef());
  const data = snapshot.exists() ? snapshot.data() : {};
  tasks = Array.isArray(data.tasks) ? data.tasks : defaultTasks;
  notesInput.value = data.notes || "";
  applyTheme(data.theme || "dark");
  renderTasks();
}

function renderTasks() {
  taskList.replaceChildren();
  tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item ${task.done ? "done" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", `Complete ${task.text}`);
    checkbox.addEventListener("change", () => {
      tasks = tasks.map((entry) => entry.id === task.id ? { ...entry, done: checkbox.checked } : entry);
      renderTasks();
      queueSave();
    });

    const label = document.createElement("span");
    label.className = "task-text";
    label.textContent = task.text;

    const remove = document.createElement("button");
    remove.className = "task-action";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Delete ${task.text}`);
    remove.addEventListener("click", () => {
      tasks = tasks.filter((entry) => entry.id !== task.id);
      renderTasks();
      queueSave();
    });

    item.append(checkbox, label, remove);
    taskList.appendChild(item);
  });

  const total = tasks.length;
  const done = tasks.filter((task) => task.done).length;
  totalTasksEl.textContent = total;
  doneTasksEl.textContent = done;
  focusScoreEl.textContent = `${total ? Math.round((done / total) * 100) : 0}%`;
  taskCountBadge.textContent = `${total} task${total === 1 ? "" : "s"}`;
  insightText.textContent = !total
    ? "Add one important task and begin with the hardest thing first."
    : done === total
      ? "Everything is complete. Take a short breath and plan your next win."
      : `${total - done} task${total - done > 1 ? "s are" : " is"} still open. Focus on one meaningful step at a time.`;
}

function applyTheme(theme) {
  const light = theme === "light";
  document.body.classList.toggle("light-mode", light);
  themeToggle.textContent = light ? "🌙" : "☀️";
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function updateTimer() {
  timerDisplay.textContent = formatTime(remainingSeconds);
}

function resetTimer() {
  clearInterval(timerId);
  timerId = null;
  remainingSeconds = 1500;
  startTimerBtn.textContent = "Start";
  updateTimer();
}

function toggleTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    startTimerBtn.textContent = "Resume";
    return;
  }

  startTimerBtn.textContent = "Pause";
  timerId = setInterval(() => {
    if (remainingSeconds <= 0) {
      resetTimer();
      alert("Focus session complete. Great work!");
      return;
    }
    remainingSeconds -= 1;
    updateTimer();
  }, 1000);
}

function updateGreeting() {
  const hour = new Date().getHours();
  greeting.textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function installAIShortcuts() {
  if (document.getElementById("aiShortcuts")) return;
  const shortcuts = document.createElement("div");
  shortcuts.id = "aiShortcuts";
  shortcuts.className = "ai-shortcuts";
  [
    ["Plan my day", "Create a realistic priority plan from my tasks and notes."],
    ["Break down a task", "Break my first unfinished task into small actionable steps."],
    ["Review progress", "Review my progress and tell me what I should do next."],
    ["Clean my notes", "Turn my notes into a concise list of decisions and next actions."]
  ].forEach(([label, prompt]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ai-chip";
    button.textContent = label;
    button.addEventListener("click", () => { aiInput.value = prompt; handleAIRequest(); });
    shortcuts.appendChild(button);
  });
  aiMessages.parentElement.insertBefore(shortcuts, aiMessages);
}

async function askGemini(prompt) {
  const key = getGeminiKey();
  if (!key) return "Pehle Gemini API key save karo. Key sirf isi browser ke local storage me rahegi.";

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "You are Aikiyara, a practical personal productivity partner. Do not imitate any other assistant. Be warm, concise, specific, and action-oriented. Prefer numbered steps and realistic priorities. Never claim to have completed an action unless the user did it." }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.65, maxOutputTokens: 700 }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "AI request failed.");
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "No response generated.";
}

async function handleAIRequest() {
  const request = aiInput.value.trim();
  if (!request) return;
  addAIMessage(request, true);
  aiInput.value = "";
  const thinking = addAIMessage("Aikiyara soch raha hai...", false);

  const taskContext = tasks.length
    ? tasks.map((task, index) => `${index + 1}. ${task.done ? "DONE" : "OPEN"}: ${task.text}`).join("\n")
    : "No tasks available.";
  const prompt = `Current tasks:\n${taskContext}\n\nPersonal notes:\n${notesInput.value || "No notes."}\n\nUser request:\n${request}`;

  try {
    thinking.textContent = await askGemini(prompt);
  } catch (error) {
    console.error(error);
    thinking.textContent = `AI error: ${error.message}`;
  }
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    authScreen.classList.remove("hidden");
    appShell.classList.add("hidden");
    return;
  }

  userEmail.textContent = user.email || "Signed in";
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  installAIShortcuts();

  try {
    const existing = await getDoc(userRef());
    if (!existing.exists()) {
      await setDoc(userRef(), { tasks: defaultTasks, notes: "", theme: "dark", updatedAt: serverTimestamp() });
    }
    await loadUserData();
  } catch (error) {
    console.error(error);
    saveStatus.textContent = "Cloud connection failed";
  }
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthMessage("Working...");
  try {
    if (createMode) await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    else await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    authForm.reset();
  } catch (error) {
    const messages = {
      "auth/invalid-credential": "Email ya password galat hai.",
      "auth/email-already-in-use": "Yeh email already registered hai.",
      "auth/weak-password": "Password kam se kam 6 characters ka hona chahiye."
    };
    setAuthMessage(messages[error.code] || error.message || "Authentication failed.", true);
  }
});

authModeToggle.addEventListener("click", () => {
  createMode = !createMode;
  authTitle.textContent = createMode ? "Create account" : "Welcome back";
  authSubmit.textContent = createMode ? "Create account" : "Sign in";
  authModeToggle.textContent = createMode ? "Already have an account? Sign in" : "New here? Create an account";
});

googleSignInBtn.addEventListener("click", async () => {
  try {
    setAuthMessage("Google se connect ho raha hai...");
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error(error);
    setAuthMessage(error.message || "Google sign-in failed.", true);
  }
});

signOutBtn.addEventListener("click", () => signOut(auth));
taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  tasks.unshift({ id: makeId(), text, done: false });
  taskInput.value = "";
  renderTasks();
  queueSave();
});
notesInput.addEventListener("input", queueSave);
clearAllBtn.addEventListener("click", () => {
  if (window.confirm("Clear all tasks?")) {
    tasks = [];
    renderTasks();
    queueSave();
  }
});
document.querySelectorAll(".quick-action").forEach((button) => button.addEventListener("click", () => {
  taskInput.value = button.dataset.task || "";
  taskInput.focus();
}));
startTimerBtn.addEventListener("click", toggleTimer);
resetTimerBtn.addEventListener("click", resetTimer);
themeToggle.addEventListener("click", () => {
  applyTheme(document.body.classList.contains("light-mode") ? "dark" : "light");
  queueSave();
});
saveApiKeyBtn.addEventListener("click", () => {
  const key = aiKeyInput.value.trim();
  if (!key) return addAIMessage("Gemini API key paste karo.");
  localStorage.setItem("aikiyara-gemini-key", key);
  addAIMessage("Key save ho gayi. Ab Aikiyara se apne style me baat karo.");
});
aiSendBtn.addEventListener("click", handleAIRequest);
aiInput.addEventListener("keydown", (event) => { if (event.key === "Enter") handleAIRequest(); });

if (getGeminiKey()) aiKeyInput.value = getGeminiKey();
updateGreeting();
updateTimer();
renderTasks();
