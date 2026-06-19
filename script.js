/* ============================================================
   Task Manager — shared JS (landing + app)
   Fixed bugs:
   1. Removed dead formContainer event listener (crash on load)
   2. Added missing login() function
   3. Fixed logout() calling updateNavAuth() → showAuthButtons()
   4. Made handleSignup() global (was local inside scroll handler)
   5. Added null guards for landing-page-only elements
   6. Fixed confirm-password validation using signupConfirmPassword
   ============================================================ */

'use strict';

/* ---------- globals ---------- */
let currentUser  = null;
let projects     = [];
let tasks        = [];
let currentProjectId = null;
let statusChart  = null;
let priorityChart = null;

/* ---------- helpers ---------- */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function isAppPage() {
  return !!document.getElementById('dashboard');
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
function notify(msg, type = 'info') {
  const container = document.getElementById('notifications');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `notification ${type}`;
  el.innerHTML = `<span>${esc(msg)}</span><span class="notification-close" onclick="this.parentElement.remove()">&#x2715;</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ============================================================
   THEME
   ============================================================ */
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

/* ============================================================
   DATA PERSISTENCE
   ============================================================ */
function saveData() {
  localStorage.setItem('projects', JSON.stringify(projects));
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function loadData() {
  try { projects = JSON.parse(localStorage.getItem('projects')) || []; } catch { projects = []; }
  try { tasks    = JSON.parse(localStorage.getItem('tasks'))    || []; } catch { tasks = []; }
}

function saveUserData() {
  if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser));
  else localStorage.removeItem('currentUser');
}

function loadUserData() {
  try { currentUser = JSON.parse(localStorage.getItem('currentUser')); } catch { currentUser = null; }
}

/* ============================================================
   AUTH — UI helpers
   ============================================================ */
function checkAuthStatus() {
  if (currentUser) showProfile(); else showAuthButtons();
}

function showProfile() {
  const navAuth = document.getElementById('navAuth');
  const navProfileContainer = document.getElementById('navProfileContainer');
  const userName = document.getElementById('user-name');
  const dropdownUserName = document.getElementById('dropdown-user-name');
  if (navAuth) navAuth.style.display = 'none';
  if (navProfileContainer) navProfileContainer.style.display = 'flex';
  if (userName) userName.textContent = currentUser?.name || 'User';
  if (dropdownUserName) dropdownUserName.textContent = currentUser?.name || 'User';
}

function showAuthButtons() {
  const navAuth = document.getElementById('navAuth');
  const navProfileContainer = document.getElementById('navProfileContainer');
  if (navAuth) navAuth.style.display = 'flex';
  if (navProfileContainer) navProfileContainer.style.display = 'none';
}

/* ---------- modal helpers ---------- */
function showLogin() {
  showLoginForm();
  document.getElementById('authModal').classList.add('active');
}

function showSignup() {
  showSignupForm();
  document.getElementById('authModal').classList.add('active');
}

function showLoginForm() {
  document.getElementById('loginForm').style.display = 'block';
  const sf = document.getElementById('signupForm');
  if (sf) sf.style.display = 'none';
}

function showSignupForm() {
  document.getElementById('signupForm').style.display = 'block';
  const lf = document.getElementById('loginForm');
  if (lf) lf.style.display = 'none';
}

function closeModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('active');
  clearAuthErrors();
}

function clearAuthErrors() {
  ['signupNameError','signupEmailError','signupPasswordError','signupConfirmPasswordError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

/* ============================================================
   AUTH — login  (BUG FIX #2: function was missing entirely)
   ============================================================ */
function login(event) {
  event.preventDefault();
  const email    = (document.getElementById('loginEmail')?.value    || '').trim();
  const password = (document.getElementById('loginPassword')?.value || '');

  if (!email || !password) {
    notify('Please enter your email and password.', 'error');
    return;
  }

  // Look up stored users
  let users = [];
  try { users = JSON.parse(localStorage.getItem('users')) || []; } catch { users = []; }

  const found = users.find(u => u.email === email && u.password === password);
  if (!found) {
    notify('Invalid email or password.', 'error');
    return;
  }

  currentUser = { id: found.id, name: found.name, email: found.email };
  saveUserData();
  closeModal();
  notify('Logged in successfully!', 'success');
  window.location.href="app.html";
  if (!isAppPage()) {
    window.location.href="#loginForm";
  } else {
    showProfile();
    updateDashboard();
  }
}

/* ============================================================
   AUTH — signup  (BUG FIX #4/#6: confirm-password + redirect)
   ============================================================ */
function signup(event) {
  event.preventDefault();
  if (!validateAuthForm()) return;

  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;

  // Confirm password (landing page has this field; app page does not)
  const confirmEl = document.getElementById('signupConfirmPassword');
  if (confirmEl && confirmEl.value !== password) {
    const errEl = document.getElementById('signupConfirmPasswordError');
    if (errEl) errEl.textContent = 'Passwords do not match.';
    return;
  }

  let users = [];
  try { users = JSON.parse(localStorage.getItem('users')) || []; } catch { users = []; }

  if (users.find(u => u.email === email)) {
    const errEl = document.getElementById('signupEmailError');
    if (errEl) errEl.textContent = 'Email already registered.';
    notify('Email already registered.', 'error');
    return;
  }

  const newUser = { id: Date.now().toString(), name, email, password };
  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));

  closeModal();
notify('Account created successfully! Please login.', 'success');
window.location.href = "/index.html#loginForm";
if (!isAppPage()) {
   window.location.href = "/index.html#loginForm";
}else {
    showProfile();
    updateDashboard();
  }
}

function validateAuthForm() {
  let valid = true;
  clearAuthErrors();

  const name = document.getElementById('signupName')?.value.trim();
  if (name !== undefined && name.length < 2) {
    const el = document.getElementById('signupNameError');
    if (el) el.textContent = 'Name must be at least 2 characters.';
    valid = false;
  }

  const email = document.getElementById('signupEmail')?.value.trim();
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const el = document.getElementById('signupEmailError');
    if (el) el.textContent = 'Enter a valid email address.';
    valid = false;
  }

  const password = document.getElementById('signupPassword')?.value;
  if (password !== undefined && password.length < 6) {
    const el = document.getElementById('signupPasswordError');
    if (el) el.textContent = 'Password must be at least 6 characters.';
    valid = false;
  }

  return valid;
}

/* ============================================================
   AUTH — logout  (BUG FIX #3: was calling updateNavAuth())
   ============================================================ */
function logout() {
  currentUser = null;
  saveUserData();
  showAuthButtons();          // was: updateNavAuth() — fixed
  notify('Logged out successfully.', 'info');
  window.location.href = '/'; // was: 'index.html' — fixed to root path
}

/* ============================================================
   FORM VALIDATION (project / task modals)
   ============================================================ */
function validateForm(formId) {
  let valid = true;
  const form = document.getElementById(formId);
  if (!form) return false;

  form.querySelectorAll('[required]').forEach(field => {
    const errId = field.id + 'Error';
    const errEl = document.getElementById(errId);
    const val   = field.value.trim();

    if (!val) {
      if (errEl) errEl.textContent = 'This field is required.';
      field.style.borderColor = 'var(--accent-red)';
      valid = false;
    } else {
      if (errEl) errEl.textContent = '';
      field.style.borderColor = '';
    }
  });
  return valid;
}

/* ============================================================
   NAVIGATION (app)
   ============================================================ */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
}

function showDashboard() {
  showPage('dashboard');
  document.querySelectorAll('.nav-link')[0]?.classList.add('active');
  updateDashboard();
}

function showProjects() {
  showPage('projects');
  document.querySelectorAll('.nav-link')[1]?.classList.add('active');
  renderProjects();
}

function showTasks() {
  showPage('tasks');
  document.querySelectorAll('.nav-link')[2]?.classList.add('active');
  renderTasks();
}

function showKanban() {
  showPage('kanban');
  document.querySelectorAll('.nav-link')[3]?.classList.add('active');
  renderKanban();
}

function showProjectDetails(projectId) {
  currentProjectId = projectId;
  showPage('projectDetails');
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  document.getElementById('projectDetailTitle').textContent = project.name;
  document.getElementById('projectDetailDesc').textContent  = project.description || '';
  document.getElementById('projectOwner').textContent       = project.owner || '';
  document.getElementById('projectMembers').textContent     = project.members ? project.members.join(', ') : '';
  renderProjectTasks(projectId);
}

function showAccount() {
  notify('Account settings coming soon.', 'info');
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function updateDashboard() {
  if (!isAppPage()) return;

  const now        = new Date();
  const total      = tasks.length;
  const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const completed  = tasks.filter(t => t.status === 'COMPLETED').length;
  const overdue    = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED').length;

  setText('totalTasks', total);
  setText('inProgress', inProgress);
  setText('completed', completed);
  setText('overdue', overdue);

  initCharts();
  renderRecentTasks();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderRecentTasks() {
  const container = document.getElementById('recentTasks');
  if (!container) return;
  const recent = [...tasks].slice(-8).reverse();
  container.innerHTML = recent.length
    ? recent.map(t => taskCardHTML(t)).join('')
    : emptyState('clipboard', 'No tasks yet', 'Create your first task to get started.');
}

/* ============================================================
   CHARTS
   ============================================================ */
function initCharts() {
  if (typeof Chart === 'undefined') return;

  const statusCounts = {
    'Pending':     tasks.filter(t => t.status === 'PENDING').length,
    'In Progress': tasks.filter(t => t.status === 'IN_PROGRESS').length,
    'Completed':   tasks.filter(t => t.status === 'COMPLETED').length,
  };
  const priorityCounts = {
    'Low':    tasks.filter(t => t.priority === 'LOW').length,
    'Medium': tasks.filter(t => t.priority === 'MEDIUM').length,
    'High':   tasks.filter(t => t.priority === 'HIGH').length,
    'Urgent': tasks.filter(t => t.priority === 'URGENT').length,
  };

  const scCtx = document.getElementById('statusChart')?.getContext('2d');
  const pcCtx = document.getElementById('priorityChart')?.getContext('2d');
  if (!scCtx || !pcCtx) return;

  const chartDefaults = { responsive: true, plugins: { legend: { position: 'bottom' } } };

  if (statusChart) statusChart.destroy();
  statusChart = new Chart(scCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#f59e0b','#3b82f6','#10b981'], borderWidth: 0 }],
    },
    options: chartDefaults,
  });

  if (priorityChart) priorityChart.destroy();
  priorityChart = new Chart(pcCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(priorityCounts),
      datasets: [{ data: Object.values(priorityCounts), backgroundColor: ['#94a3b8','#f59e0b','#ef4444','#ec4899'], borderRadius: 6 }],
    },
    options: { ...chartDefaults, plugins: { legend: { display: false } } },
  });
}

/* ============================================================
   PROJECTS
   ============================================================ */
function renderProjects(filter = '') {
  const container = document.getElementById('projectsList');
  if (!container) return;
  const list = projects.filter(p => !filter || p.name.toLowerCase().includes(filter.toLowerCase()));
  container.innerHTML = list.length
    ? list.map(p => projectCardHTML(p)).join('')
    : emptyState('project-diagram', 'No projects yet', 'Create your first project.');
}

function projectCardHTML(p) {
  const count = tasks.filter(t => t.projectId === p.id).length;
  return `
    <div class="project-card" onclick="showProjectDetails('${p.id}')">
      <div class="project-card-header">
        <div class="project-card-title">${esc(p.name)}</div>
        <div class="project-actions-btn" onclick="event.stopPropagation()">
          <button class="icon-btn" onclick="editProject('${p.id}')" title="Edit" aria-label="Edit project">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button class="icon-btn delete" onclick="confirmDeleteProject('${p.id}')" title="Delete" aria-label="Delete project">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="project-card-desc">${esc(p.description || 'No description.')}</div>
      <div class="project-card-meta">
        <span class="project-task-count"><i class="fas fa-tasks"></i> ${count} task${count !== 1 ? 's' : ''}</span>
      </div>
    </div>`;
}

function showCreateProjectModal() {
  if (!currentUser) { showLogin(); return; }
  document.getElementById('projectModalTitle').textContent = 'Create Project';
  document.getElementById('projectId').value   = '';
  document.getElementById('projectName').value  = '';
  document.getElementById('projectDesc').value  = '';
  document.getElementById('projectSaveBtn').textContent = 'Create Project';
  document.getElementById('projectModal').classList.add('active');
}

function showEditProjectModal() { editProject(currentProjectId); }

function editProject(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  document.getElementById('projectModalTitle').textContent = 'Edit Project';
  document.getElementById('projectId').value   = p.id;
  document.getElementById('projectName').value  = p.name;
  document.getElementById('projectDesc').value  = p.description || '';
  document.getElementById('projectSaveBtn').textContent = 'Save Changes';
  document.getElementById('projectModal').classList.add('active');
}

function closeProjectModal() {
  document.getElementById('projectModal').classList.remove('active');
}

function saveProject(event) {
  event.preventDefault();
  if (!validateForm('projectForm')) return;

  const id   = document.getElementById('projectId').value;
  const name = document.getElementById('projectName').value.trim();
  const desc = document.getElementById('projectDesc').value.trim();

  if (id) {
    const idx = projects.findIndex(p => p.id === id);
    if (idx !== -1) { projects[idx].name = name; projects[idx].description = desc; }
    notify('Project updated.', 'success');
  } else {
    projects.push({ id: Date.now().toString(), name, description: desc, createdAt: new Date().toISOString() });
    notify('Project created.', 'success');
  }
  saveData();
  closeProjectModal();
  renderProjects(document.getElementById('projectsSearch')?.value || '');
}

function confirmDeleteProject(id) {
  const pid = id || currentProjectId;
  const p   = projects.find(x => x.id === pid);
  if (!p) return;
  document.getElementById('confirmMessage').textContent = `Delete project "${p.name}"? All its tasks will be removed.`;
  document.getElementById('confirmDeleteBtn').onclick = () => deleteProject(pid);
  document.getElementById('confirmModal').classList.add('active');
}

function deleteProject(id) {
  projects = projects.filter(p => p.id !== id);
  tasks    = tasks.filter(t => t.projectId !== id);
  saveData();
  closeConfirmModal();
  notify('Project deleted.', 'success');
  if (document.getElementById('projectDetails')?.classList.contains('active')) showProjects();
  else renderProjects(document.getElementById('projectsSearch')?.value || '');
}

/* ============================================================
   TASKS
   ============================================================ */
function renderTasks(filter = '') {
  const container   = document.getElementById('tasksList');
  if (!container) return;
  const statusFilter   = document.getElementById('tasksFilter')?.value   || '';
  const priorityFilter = document.getElementById('priorityFilter')?.value || '';

  const list = tasks.filter(t => {
    const matchText     = !filter     || t.title.toLowerCase().includes(filter.toLowerCase());
    const matchStatus   = !statusFilter   || t.status === statusFilter;
    const matchPriority = !priorityFilter || t.priority === priorityFilter;
    return matchText && matchStatus && matchPriority;
  });

  container.innerHTML = list.length
    ? list.map(t => taskCardHTML(t, true)).join('')
    : emptyState('list-check', 'No tasks found', 'Try adjusting your filters.');
}

function renderProjectTasks(projectId) {
  const container = document.getElementById('projectTasksList');
  if (!container) return;
  const list = tasks.filter(t => t.projectId === projectId);
  container.innerHTML = list.length
    ? list.map(t => taskCardHTML(t)).join('')
    : emptyState('list-check', 'No tasks in this project', 'Add a task to get started.');
}

function taskCardHTML(t, showProject = false) {
  const now      = new Date();
  const isOverdue = t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED';
  const project   = showProject && t.projectId ? projects.find(p => p.id === t.projectId) : null;
  const dueFmt    = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '';

  return `
    <div class="task-card">
      <div class="task-card-main">
        <div class="task-card-title">${esc(t.title)}</div>
        ${t.description ? `<div class="task-card-desc">${esc(t.description)}</div>` : ''}
        <div class="task-card-meta">
          <span class="badge ${statusBadgeClass(t.status)}">${statusLabel(t.status)}</span>
          <span class="badge ${priorityBadgeClass(t.priority)}">${t.priority}</span>
          ${dueFmt ? `<span class="task-due ${isOverdue ? 'overdue' : ''}"><i class="fas fa-calendar-alt"></i> ${dueFmt}${isOverdue ? ' (overdue)' : ''}</span>` : ''}
          ${project ? `<span class="task-project-badge">${esc(project.name)}</span>` : ''}
        </div>
      </div>
      <div class="task-card-actions">
        <button class="icon-btn" onclick="editTask('${t.id}')" title="Edit" aria-label="Edit task"><i class="fas fa-pencil-alt"></i></button>
        <button class="icon-btn delete" onclick="confirmDeleteTask('${t.id}')" title="Delete" aria-label="Delete task"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
}

function statusBadgeClass(s) {
  return { PENDING: 'badge-pending', IN_PROGRESS: 'badge-progress', COMPLETED: 'badge-completed' }[s] || 'badge-pending';
}
function statusLabel(s) {
  return { PENDING: 'Pending', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' }[s] || s;
}
function priorityBadgeClass(p) {
  return { LOW: 'badge-low', MEDIUM: 'badge-medium', HIGH: 'badge-high', URGENT: 'badge-urgent' }[p] || 'badge-low';
}

function showCreateTaskModal(projectId) {
  if (!currentUser) { showLogin(); return; }
  document.getElementById('taskModalTitle').textContent = 'Create Task';
  document.getElementById('taskId').value = '';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskPriority').value = '';
  document.getElementById('taskStatus').value = 'PENDING';
  document.getElementById('taskDueDate').value = '';
  document.getElementById('taskProjectId').value = projectId || '';
  populateProjectSelect(projectId);
  document.getElementById('taskSaveBtn').textContent = 'Create Task';
  document.getElementById('taskModal').classList.add('active');
}

function editTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  document.getElementById('taskModalTitle').textContent = 'Edit Task';
  document.getElementById('taskId').value = t.id;
  document.getElementById('taskTitle').value = t.title;
  document.getElementById('taskDesc').value = t.description || '';
  document.getElementById('taskPriority').value = t.priority;
  document.getElementById('taskStatus').value = t.status;
  document.getElementById('taskDueDate').value = t.dueDate || '';
  document.getElementById('taskProjectId').value = t.projectId || '';
  populateProjectSelect(t.projectId);
  document.getElementById('taskSaveBtn').textContent = 'Save Changes';
  document.getElementById('taskModal').classList.add('active');
}

function populateProjectSelect(selectedId) {
  const sel = document.getElementById('taskProject');
  if (!sel) return;
  sel.innerHTML = '<option value="">No Project</option>'
    + projects.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('active');
}

function saveTask(event) {
  event.preventDefault();
  if (!validateForm('taskForm')) return;

  const id     = document.getElementById('taskId').value;
  const title  = document.getElementById('taskTitle').value.trim();
  const desc   = document.getElementById('taskDesc').value.trim();
  const priority = document.getElementById('taskPriority').value;
  const status   = document.getElementById('taskStatus').value;
  const dueDate  = document.getElementById('taskDueDate').value;
  const projectId = document.getElementById('taskProject').value;

  if (id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) Object.assign(tasks[idx], { title, description: desc, priority, status, dueDate, projectId });
    notify('Task updated.', 'success');
  } else {
    tasks.push({ id: Date.now().toString(), title, description: desc, priority, status, dueDate, projectId, createdAt: new Date().toISOString() });
    notify('Task created.', 'success');
  }
  saveData();
  closeTaskModal();

  const activePage = document.querySelector('.page.active')?.id;
  if (activePage === 'tasks')          renderTasks(document.getElementById('tasksSearch')?.value || '');
  else if (activePage === 'kanban')    renderKanban();
  else if (activePage === 'dashboard') updateDashboard();
  else if (activePage === 'projectDetails') renderProjectTasks(currentProjectId);
}

function confirmDeleteTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  document.getElementById('confirmMessage').textContent = `Delete task "${t.title}"?`;
  document.getElementById('confirmDeleteBtn').onclick = () => deleteTask(id);
  document.getElementById('confirmModal').classList.add('active');
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveData();
  closeConfirmModal();
  notify('Task deleted.', 'success');

  const activePage = document.querySelector('.page.active')?.id;
  if (activePage === 'tasks')          renderTasks(document.getElementById('tasksSearch')?.value || '');
  else if (activePage === 'kanban')    renderKanban();
  else if (activePage === 'dashboard') updateDashboard();
  else if (activePage === 'projectDetails') renderProjectTasks(currentProjectId);
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.remove('active');
}

/* ============================================================
   KANBAN
   ============================================================ */
const KANBAN_COLS = [
  { key: 'PENDING',     label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED',   label: 'Done' },
];

function renderKanban() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;

  board.innerHTML = KANBAN_COLS.map(col => {
    const colTasks = tasks.filter(t => t.status === col.key);
    return `
      <div class="kanban-col">
        <div class="kanban-col-header">
          <span class="kanban-col-title">${col.label}</span>
          <span class="kanban-col-count">${colTasks.length}</span>
        </div>
        <div class="kanban-tasks kanban-drop-zone"
             id="kanban-${col.key}"
             ondragover="allowDrop(event)"
             ondrop="drop(event,'${col.key}')">
          ${colTasks.map(t => kanbanTaskHTML(t)).join('')}
        </div>
      </div>`;
  }).join('');
}

function kanbanTaskHTML(t) {
  return `
    <div class="kanban-task"
         draggable="true"
         id="ktask-${t.id}"
         ondragstart="drag(event,'${t.id}')"
         ondragend="dragEnd(event)">
      <div class="kanban-task-title">${esc(t.title)}</div>
      <div class="kanban-task-meta">
        <span class="badge ${priorityBadgeClass(t.priority)}">${t.priority}</span>
        ${t.dueDate ? `<span class="task-due"><i class="fas fa-calendar-alt"></i> ${new Date(t.dueDate).toLocaleDateString()}</span>` : ''}
      </div>
    </div>`;
}

function allowDrop(event) { event.preventDefault(); event.currentTarget.classList.add('drag-over'); }
function drag(event, id)   { event.dataTransfer.setData('taskId', id); }
function dragEnd(event)    { document.querySelectorAll('.kanban-drop-zone').forEach(z => z.classList.remove('drag-over')); }
function drop(event, status) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const id  = event.dataTransfer.getData('taskId');
  const idx = tasks.findIndex(t => t.id === id);
  if (idx !== -1) { tasks[idx].status = status; saveData(); renderKanban(); }
}

/* ============================================================
   PROFILE DROPDOWN
   ============================================================ */
function toggleProfileDropdown() {
  document.getElementById('profileDropdown')?.classList.toggle('show');
}
function closeDropdowns() {
  document.getElementById('profileDropdown')?.classList.remove('show');
}

/* ============================================================
   NAV MENU (app hamburger)
   ============================================================ */
function toggleNavMenu() {
  document.getElementById('navMenu')?.classList.toggle('open');
}
function closeNavMenu() {
  document.getElementById('navMenu')?.classList.remove('open');
}

/* ============================================================
   LANDING PAGE — CTA form
   (BUG FIX #5: was defined locally inside scroll handler)
   ============================================================ */
function handleSignup(event) {
  event.preventDefault();
  const emailInput = document.getElementById('email-input');
  if (!emailInput || !emailInput.value) return;
  const ctaForm  = document.getElementById('cta-form');
  const successMsg = document.getElementById('success-msg');
  if (ctaForm)    ctaForm.style.display    = 'none';
  if (successMsg) successMsg.style.display = 'block';
}

/* ============================================================
   EMPTY STATE helper
   ============================================================ */
function emptyState(icon, title, msg) {
  return `<div class="empty-state">
    <i class="fas fa-${icon}"></i>
    <h3>${title}</h3>
    <p>${msg}</p>
  </div>`;
}

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadUserData();
  loadData();
  checkAuthStatus();

  // ---- APP PAGE setup ----
  if (isAppPage()) {
    showDashboard();

    // Project search
    document.getElementById('projectsSearch')?.addEventListener('input', e => renderProjects(e.target.value));
    // Task search + filters
    document.getElementById('tasksSearch')?.addEventListener('input',  e => renderTasks(e.target.value));
    document.getElementById('tasksFilter')?.addEventListener('change', () => renderTasks(document.getElementById('tasksSearch')?.value || ''));
    document.getElementById('priorityFilter')?.addEventListener('change', () => renderTasks(document.getElementById('tasksSearch')?.value || ''));

    // Close dropdowns when clicking outside
    document.addEventListener('click', e => {
      const dropdown = document.getElementById('profileDropdown');
      const trigger  = document.getElementById('nav-profile');
      if (dropdown && !dropdown.contains(e.target) && !trigger?.contains(e.target)) {
        dropdown.classList.remove('show');
      }
      if (!e.target.closest('#navMenu') && !e.target.closest('.hamburger-btn')) {
        closeNavMenu();
      }
    });

    // Modal click-outside close
    document.getElementById('authModal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('projectModal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeProjectModal();
    });
    document.getElementById('taskModal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeTaskModal();
    });
    document.getElementById('confirmModal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeConfirmModal();
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeModal(); closeProjectModal(); closeTaskModal(); closeConfirmModal(); closeDropdowns();
      }
    });
  }

  // ---- LANDING PAGE setup ----
  if (!isAppPage()) {
    // Scroll: nav shadow (BUG FIX #5: null guard added)
    window.addEventListener('scroll', () => {
      document.getElementById('nav')?.classList.toggle('scrolled', window.scrollY > 10);
    });

    // Hamburger menu (BUG FIX #5: null guards added)
    const hamburger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobile-nav');
    if (hamburger && mobileNav) {
      hamburger.addEventListener('click', () => mobileNav.classList.toggle('open'));
      document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => mobileNav.classList.remove('open'));
      });
    }

    // Modal click-outside on landing page
    document.getElementById('authModal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });

    // Scroll-reveal with IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal, .feature-card, .step').forEach(el => observer.observe(el));

    // Stagger feature cards
    document.querySelectorAll('.feature-card').forEach((card, i) => {
      card.style.transitionDelay = `${i * 70}ms`;
    });

    // Stats counter animation
    const statObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el     = entry.target;
        const target = parseInt(el.dataset.target, 10);
        let current  = 0;
        const step   = Math.max(1, Math.floor(target / 40));
        const timer  = setInterval(() => {
          current = Math.min(current + step, target);
          el.childNodes[0].textContent = current;
          if (current >= target) clearInterval(timer);
        }, 40);
        statObserver.unobserve(el);
      });
    }, { threshold: 0.5 });

    document.querySelectorAll('.stat-number[data-target]').forEach(el => statObserver.observe(el));

    // Hero progress bar animation (BUG FIX #5: null guards added)
    setTimeout(() => {
      const fill = document.getElementById('progress-fill');
      const pct  = document.getElementById('prog-pct');
      if (fill) fill.style.width = '62%';
      if (pct)  pct.textContent  = '62%';
    }, 800);

  }
});
  function showLoginForm() {
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("signupForm").style.display = "none";
  }

  function showSignupForm() {
    document.getElementById("signupForm").style.display = "block";
    document.getElementById("loginForm").style.display = "none";
  }

  // ADD THIS HERE
  window.addEventListener("load", () => {
    if (window.location.hash === "#loginForm") {
      document.getElementById("authModal").style.display = "flex";
      showLoginForm();
    }

    if (window.location.hash === "#signupForm") {
      document.getElementById("authModal").style.display = "flex";
      showSignupForm();
    }
  });
/* expose globals needed by inline HTML handlers */
window.login                 = login;
window.signup                = signup;
window.logout                = logout;
window.showLogin             = showLogin;
window.showSignup            = showSignup;
window.showLoginForm         = showLoginForm;
window.showSignupForm        = showSignupForm;
window.closeModal            = closeModal;
window.toggleTheme           = toggleTheme;
window.showDashboard         = showDashboard;
window.showProjects          = showProjects;
window.showTasks             = showTasks;
window.showKanban            = showKanban;
window.showProjectDetails    = showProjectDetails;
window.showAccount           = showAccount;
window.showCreateProjectModal = showCreateProjectModal;
window.showEditProjectModal  = showEditProjectModal;
window.editProject           = editProject;
window.closeProjectModal     = closeProjectModal;
window.saveProject           = saveProject;
window.confirmDeleteProject  = confirmDeleteProject;
window.showCreateTaskModal   = showCreateTaskModal;
window.editTask              = editTask;
window.closeTaskModal        = closeTaskModal;
window.saveTask              = saveTask;
window.confirmDeleteTask     = confirmDeleteTask;
window.closeConfirmModal     = closeConfirmModal;
window.deleteTask            = deleteTask;
window.deleteProject         = deleteProject;
window.allowDrop             = allowDrop;
window.drag                  = drag;
window.dragEnd               = dragEnd;
window.drop                  = drop;
window.toggleProfileDropdown = toggleProfileDropdown;
window.closeDropdowns        = closeDropdowns;
window.toggleNavMenu         = toggleNavMenu;
window.closeNavMenu          = closeNavMenu;
window.handleSignup          = handleSignup;
