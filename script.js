import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
const uid = () => crypto.randomUUID();
const defaultTasks = [
  { id: uid(), text: "Review today's goals", done: false },
  { id: uid(), text: "Complete one high-impact task", done: true },
  { id: uid(), text: "Write a quick update note", done: false }
];

const $ = id => document.getElementById(id);
const authScreen = $("authScreen");
const appShell = $("appShell");
const authForm = $("authForm");
const authTitle = $("authTitle");
const authModeToggle = $("authModeToggle");
const authMessage = $("authMessage");
const authSubmit = $("authSubmit");
const emailInput = $("emailInput");
const passwordInput = $("passwordInput");
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

let createMode = false;
let currentUser = null;
let tasks = [];
let saveTimer = null;
let remainingSeconds = 1500;
let timerId = null;

const userRef = () => currentUser && doc(db, "users", currentUser.uid);
const setAuthMessage = (message, error = false) => { authMessage.textContent = message; authMessage.style.color = error ? "#f87171" : "var(--muted)"; };

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

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveUserData().catch(error => { console.error(error); saveStatus.textContent = "Save failed"; }), 450);
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
  tasks.forEach(task => {
    const item = document.createElement("li");
    item.className = `task-item ${task.done ? "done" : ""}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", `Complete ${task.text}`);
    checkbox.addEventListener("change", () => {
      tasks = tasks.map(entry => entry.id === task.id ? { ...entry, done: checkbox.checked } : entry);
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
      tasks = tasks.filter(entry => entry.id !== task.id);
      renderTasks();
      queueSave();
    });
    item.append(checkbox, label, remove);
    taskList.appendChild(item);
  });
  const total = tasks.length;
  const done = tasks.filter(task => task.done).length;
  totalTasksEl.textContent = total;
  doneTasksEl.textContent = done;
  focusScoreEl.textContent = `${total ? Math.round(done / total * 100) : 0}%`;
  taskCountBadge.textContent = `${total} task${total === 1 ? "" : "s"}`;
  insightText.textContent = !total ? "Add one important task and begin with the hardest thing first." : done === total ? "Everything is complete. Plan your next win." : `${total - done} task${total - done > 1 ? "s are" : " is"} still open. Focus on one meaningful step at a time.`;
}

function applyTheme(theme) {
  const light = theme === "light";
  document.body.classList.toggle("light-mode", light);
  themeToggle.textContent = light ? "🌙" : "☀️";
}

function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function updateTimer() { timerDisplay.textContent = formatTime(remainingSeconds); }
function resetTimer() { clearInterval(timerId); timerId = null; remainingSeconds = 1500; startTimerBtn.textContent = "Start"; updateTimer(); }
function toggleTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; startTimerBtn.textContent = "Resume"; return; }
  startTimerBtn.textContent = "Pause";
  timerId = setInterval(() => {
    if (remainingSeconds <= 0) { resetTimer(); alert("Focus session complete. Great work!"); return; }
    remainingSeconds -= 1;
    updateTimer();
  }, 1000);
}

function updateGreeting() { const hour = new Date().getHours(); greeting.textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"; }

let unsubscribeAuth = onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!user) {
    authScreen.classList.remove("hidden");
    appShell.classList.add("hidden");
    return;
  }
  userEmail.textContent = user.email || "Signed in";
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  try {
    const existing = await getDoc(userRef());
    if (!existing.exists()) await setDoc(userRef(), { tasks: defaultTasks, notes: "", theme: "dark", updatedAt: serverTimestamp() });
    await loadUserData();
  } catch (error) { console.error(error); saveStatus.textContent = "Cloud connection failed"; }
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  setAuthMessage("Working...");
  try {
    if (createMode) await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    else await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    authForm.reset();
  } catch (error) {
    const messages = { "auth/invalid-credential": "Email ya password galat hai.", "auth/email-already-in-use": "Yeh email already registered hai.", "auth/weak-password": "Password kam se kam 6 characters ka hona chahiye." };
    setAuthMessage(messages[error.code] || error.message, true);
  }
});

authModeToggle.addEventListener("click", () => { createMode = !createMode; authTitle.textContent = createMode ? "Create account" : "Welcome back"; authSubmit.textContent = createMode ? "Create account" : "Sign in"; authModeToggle.textContent = createMode ? "Already have an account? Sign in" : "New here? Create an account"; });
signOutBtn.addEventListener("click", () => signOut(auth));
taskForm.addEventListener("submit", event => { event.preventDefault(); const text = taskInput.value.trim(); if (!text) return; tasks.unshift({ id: uid(), text, done: false }); taskInput.value = ""; renderTasks(); queueSave(); });
notesInput.addEventListener("input", queueSave);
clearAllBtn.addEventListener("click", () => { if (confirm("Clear all tasks?")) { tasks = []; renderTasks(); queueSave(); } });
document.querySelectorAll(".quick-action").forEach(button => button.addEventListener("click", () => { taskInput.value = button.dataset.task || ""; taskInput.focus(); }));
startTimerBtn.addEventListener("click", toggleTimer);
resetTimerBtn.addEventListener("click", resetTimer);
themeToggle.addEventListener("click", () => { applyTheme(document.body.classList.contains("light-mode") ? "dark" : "light"); queueSave(); });

updateGreeting();
updateTimer();
