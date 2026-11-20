
import './style.css'

const API = 'https://secure-note-backend-ikfv.onrender.com/api'

let token = localStorage.getItem('token')
let currentUser = JSON.parse(localStorage.getItem('user') || 'null')
let notes = []
let page = 1
let totalPages = 1

const app = document.querySelector('#app')

function render() {
  if (!token) {
    renderAuth()
  } else {
    renderDashboard()
  }
}

function renderAuth() {
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="logo">🔐</div>
        <h1>Secure Notes</h1>
        <p class="subtitle">Your personal notes, secured.</p>

        <div class="tabs">
          <button id="loginTab" class="active">Login</button>
          <button id="registerTab">Register</button>
        </div>

        <form id="authForm">
          <div id="nameField" class="hidden">
            <label>Name</label>
            <input name="name" placeholder="Your name" />
          </div>

          <label>Email</label>
          <input name="email" type="email" placeholder="you@example.com" required />

          <label>Password</label>
          <input name="password" type="password" placeholder="Password" required />

          <button class="primary-btn" type="submit" id="authButton">Login</button>
        </form>

        <p id="authMessage" class="message"></p>
      </div>
    </div>
  `

  let mode = 'login'

  const loginTab = document.querySelector('#loginTab')
  const registerTab = document.querySelector('#registerTab')
  const nameField = document.querySelector('#nameField')
  const authButton = document.querySelector('#authButton')

  loginTab.onclick = () => {
    mode = 'login'
    loginTab.classList.add('active')
    registerTab.classList.remove('active')
    nameField.classList.add('hidden')
    authButton.textContent = 'Login'
  }

  registerTab.onclick = () => {
    mode = 'register'
    registerTab.classList.add('active')
    loginTab.classList.remove('active')
    nameField.classList.remove('hidden')
    authButton.textContent = 'Create Account'
  }

  document.querySelector('#authForm').onsubmit = async (e) => {
    e.preventDefault()

    const form = new FormData(e.target)
    const data = Object.fromEntries(form.entries())

    try {
      const response = await fetch(`${API}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Request failed')
      }

      if (mode === 'register') {
        document.querySelector('#authMessage').textContent =
          'Registration successful! Please login.'
        document.querySelector('#authMessage').className = 'message success'
        loginTab.click()
        return
      }

token = result.token
currentUser = result.user

localStorage.setItem('token', token)
localStorage.setItem('user', JSON.stringify(currentUser))

page = 1
notes = []

render()
await loadNotes()
    } catch (error) {
      document.querySelector('#authMessage').textContent = error.message
      document.querySelector('#authMessage').className = 'message error'
    }
  }
}

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Request failed')
  }

  return result
}

async function loadNotes() {
  try {
    const result = await apiRequest(`/notes?page=${page}&limit=5`)
    notes = result.notes || []
    totalPages = result.totalPages || 1
    renderDashboard()
  } catch (error) {
    alert(error.message)
  }
}

function renderDashboard() {
  app.innerHTML = `
    <div class="dashboard">
      <header class="header">
        <div>
          <h1>🔐 Secure Notes</h1>
          <p>Welcome, ${escapeHTML(currentUser?.name || 'User')}</p>
        </div>
        <button id="logoutBtn" class="logout-btn">Logout</button>
      </header>

      <main>
        <section class="create-card">
          <h2>Create a New Note</h2>
          <form id="noteForm">
            <input id="noteTitle" placeholder="Note title" required />
            <textarea id="noteContent" placeholder="Write your note..." required></textarea>
            <button class="primary-btn">Save Note</button>
          </form>
        </section>

        <section class="notes-section">
          <div class="section-header">
            <h2>Your Notes</h2>
            <span>${notes.length} notes on this page</span>
          </div>

          <div id="notesList">
            ${
              notes.length
                ? notes.map(note => `
                  <article class="note-card">
                    <div class="note-content">
                      <h3>${escapeHTML(note.title)}</h3>
                      <p>${escapeHTML(note.content)}</p>
                      <small>Created: ${new Date(note.createdAt).toLocaleString()}</small>
                    </div>
                    <div class="note-actions">
                      <button class="edit-btn" data-id="${note._id}">Edit</button>
                      <button class="delete-btn" data-id="${note._id}">Delete</button>
                    </div>
                  </article>
                `).join('')
                : '<div class="empty-state">No notes yet. Create your first note above!</div>'
            }
          </div>

          <div class="pagination">
            <button id="prevBtn" ${page <= 1 ? 'disabled' : ''}>Previous</button>
            <span>Page ${page} of ${totalPages}</span>
            <button id="nextBtn" ${page >= totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </section>

        ${
          currentUser?.role === 'admin'
            ? `<section class="admin-card">
                <h2>Admin Panel</h2>
                <button id="loadUsersBtn" class="secondary-btn">View Users</button>
                <button id="interestBtn" class="secondary-btn">Users by Interests</button>
                <div id="adminResults"></div>
              </section>`
            : ''
        }
      </main>
    </div>
  `

  document.querySelector('#logoutBtn').onclick = logout

  document.querySelector('#noteForm').onsubmit = createNote

  document.querySelector('#prevBtn').onclick = () => {
    if (page > 1) {
      page--
      loadNotes()
    }
  }

  document.querySelector('#nextBtn').onclick = () => {
    if (page < totalPages) {
      page++
      loadNotes()
    }
  }

  document.querySelectorAll('.edit-btn').forEach(button => {
    button.onclick = () => editNote(button.dataset.id)
  })

  document.querySelectorAll('.delete-btn').forEach(button => {
    button.onclick = () => deleteNote(button.dataset.id)
  })

  if (currentUser?.role === 'admin') {
    document.querySelector('#loadUsersBtn').onclick = loadUsers
    document.querySelector('#interestBtn').onclick = loadInterests
  }
}

async function createNote(e) {
  e.preventDefault()

  const title = document.querySelector('#noteTitle').value
  const content = document.querySelector('#noteContent').value

  try {
    await apiRequest('/notes', {
      method: 'POST',
      body: JSON.stringify({ title, content })
    })

    page = 1
    await loadNotes()
  } catch (error) {
    alert(error.message)
  }
}

async function editNote(id) {
  const note = notes.find(n => n._id === id)

  const title = prompt('Enter new title:', note.title)
  if (title === null) return

  const content = prompt('Enter new content:', note.content)
  if (content === null) return

  try {
    await apiRequest(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, content })
    })

    await loadNotes()
  } catch (error) {
    alert(error.message)
  }
}

async function deleteNote(id) {
  if (!confirm('Are you sure you want to delete this note?')) return

  try {
    await apiRequest(`/notes/${id}`, {
      method: 'DELETE'
    })

    await loadNotes()
  } catch (error) {
    alert(error.message)
  }
}

async function loadUsers() {
  try {
    const result = await apiRequest('/admin/users?page=1&limit=10')

    document.querySelector('#adminResults').innerHTML = `
      <h3>Users</h3>
      <div class="admin-results">
        ${result.users.map(user => `
          <div class="user-row">
            <strong>${escapeHTML(user.name)}</strong>
            <span>${escapeHTML(user.email)}</span>
            <span class="role">${escapeHTML(user.role)}</span>
          </div>
        `).join('')}
      </div>
    `
  } catch (error) {
    alert(error.message)
  }
}

async function loadInterests() {
  try {
    const result = await apiRequest('/admin/users-by-interests')

    document.querySelector('#adminResults').innerHTML = `
      <h3>Users Grouped by Interests</h3>
      <pre>${JSON.stringify(result, null, 2)}</pre>
    `
  } catch (error) {
    alert(error.message)
  }
}

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')

  token = null
  currentUser = null
  notes = []

  render()
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

render()

if (token) {
  loadNotes()
}
