const STORAGE_KEYS = {
  tasks: 'aikiyara-tasks',
  notes: 'aikiyara-notes'
};

const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const notesInput = document.getElementById('notesInput');
const clearAllBtn = document.getElementById('clearAllBtn');
const totalTasksEl = document.getElementById('totalTasks');
const doneTasksEl = document.getElementById('doneTasks');
const focusScoreEl = document.getElementById('focusScore');
const taskBadgeEl = document.getElementById('taskBadge');
const greetingEl = document.getElementById('greeting');

const defaultTasks = [
  { id: crypto.randomUUID(), text: 'Review project goals', done: false },
  { id: crypto.randomUUID(), text: 'Finish the next milestone', done: false },
  { id: crypto.randomUUID(), text: 'Write a short update note', done: true }
];

function getTasks() {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) || 'null');
  return Array.isArray(stored) && stored.length ? stored : defaultTasks;
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
}

function updateGreeting() {
  const hour = new Date().getHours();
  let text = 'Let’s get productive';

  if (hour < 12) text = 'Good morning';
  else if (hour < 18) text = 'Good afternoon';
  else text = 'Good evening';

  greetingEl.textContent = text;
}

function renderTasks() {
  const tasks = getTasks();
  taskList.innerHTML = '';

  tasks.forEach(task => {
    const item = document.createElement('li');
    item.className = `task-item ${task.done ? 'completed' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.setAttribute('aria-label', `Mark ${task.text} as done`);
    checkbox.addEventListener('change', () => {
      const allTasks = getTasks().map(t => (
        t.id === task.id ? { ...t, done: !t.done } : t
      ));
      saveTasks(allTasks);
      renderTasks();
    });

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'task-action';
    delBtn.textContent = '×';
    delBtn.title = 'Delete task';
    delBtn.setAttribute('aria-label', `Delete ${task.text}`);
    delBtn.addEventListener('click', () => {
      const filtered = getTasks().filter(t => t.id !== task.id);
      saveTasks(filtered);
      renderTasks();
    });

    item.appendChild(checkbox);
    item.appendChild(text);
    item.appendChild(delBtn);
    taskList.appendChild(item);
  });

  const total = tasks.length;
  const done = tasks.filter(task => task.done).length;
  const focus = total ? Math.round((done / total) * 100) : 0;

  totalTasksEl.textContent = String(total);
  doneTasksEl.textContent = String(done);
  focusScoreEl.textContent = `${focus}%`;
  taskBadgeEl.textContent = `${total} task${total === 1 ? '' : 's'}`;
}

function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const tasks = getTasks();
  tasks.unshift({ id: crypto.randomUUID(), text: trimmed, done: false });
  saveTasks(tasks);
  renderTasks();
}

taskForm.addEventListener('submit', event => {
  event.preventDefault();
  addTask(taskInput.value);
  taskInput.value = '';
  taskInput.focus();
});

notesInput.addEventListener('input', event => {
  localStorage.setItem(STORAGE_KEYS.notes, event.target.value);
});

document.querySelectorAll('.idea').forEach(button => {
  button.addEventListener('click', () => {
    const value = button.dataset.idea || '';
    if (!value) return;
    taskInput.value = value;
    taskInput.focus();
  });
});

clearAllBtn.addEventListener('click', () => {
  const shouldClear = window.confirm('Clear all tasks?');
  if (!shouldClear) return;

  saveTasks([]);
  renderTasks();
});

function initialize() {
  const storedNotes = localStorage.getItem(STORAGE_KEYS.notes) || '';
  notesInput.value = storedNotes;
  updateGreeting();
  renderTasks();
}

initialize();
