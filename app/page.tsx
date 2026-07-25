'use client'

import { useState, useEffect, useCallback } from 'react'
import { subscribeUser, unsubscribeUser, sendNotification } from './actions'

// ── Types ─────────────────────────────────────────────────
type Priority = 'high' | 'medium' | 'low'
type Filter = 'all' | 'active' | 'completed'

interface Todo {
  id: string
  title: string
  description: string
  priority: Priority
  dueDate: string
  completed: boolean
  createdAt: number
}

// ── Helpers ───────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning ☀️'
  if (h < 18) return 'Good afternoon 🌤️'
  return 'Good evening 🌙'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function isOverdue(dueDate: string): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date() && dueDate !== ''
}

function formatDueDate(dueDate: string): string {
  if (!dueDate) return ''
  const d = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dueDate)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STORAGE_KEY = 'notify-todos'

// ── Push Notification Manager ─────────────────────────────
function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [lastMsg, setLastMsg] = useState('')

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscription(sub))
        .catch(console.error)
    }
  }, [])

  async function subscribeToPush() {
    setIsBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })
      setSubscription(sub)
      const serialized = JSON.parse(JSON.stringify(sub))
      await subscribeUser(serialized)
    } catch (err) {
      console.error('Subscribe failed:', err)
    } finally {
      setIsBusy(false)
    }
  }

  async function unsubscribeFromPush() {
    setIsBusy(true)
    try {
      await subscription?.unsubscribe()
      setSubscription(null)
      await unsubscribeUser()
    } catch (err) {
      console.error('Unsubscribe failed:', err)
    } finally {
      setIsBusy(false)
    }
  }

  async function sendTest() {
    setIsBusy(true)
    try {
      const body = lastMsg.trim() || 'Your Notify app is working! 🎉'
      await sendNotification('Notify', body)
      setLastMsg('')
    } catch (err) {
      console.error('Send failed:', err)
    } finally {
      setIsBusy(false)
    }
  }

  if (!isSupported) {
    return (
      <div className="notif-panel">
        <div className="notif-panel-header">
          <span className="notif-panel-title">
            <span className="icon">🔔</span> Push Notifications
          </span>
        </div>
        <p className="notif-not-supported">
          Push notifications are not supported in this browser. Try Chrome on Android.
        </p>
      </div>
    )
  }

  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <span className="notif-panel-title">
          <span className="icon">🔔</span> Push Notifications
        </span>
        <span className={`notif-status ${subscription ? 'subscribed' : 'unsubscribed'}`}>
          <span className="dot" />
          {subscription ? 'Active' : 'Off'}
        </span>
      </div>
      <div className="notif-actions">
        {!subscription ? (
          <button
            id="btn-subscribe"
            className="btn-notif subscribe"
            onClick={subscribeToPush}
            disabled={isBusy}
          >
            🔔 Enable Push Notifications
          </button>
        ) : (
          <>
            <input
              id="notif-message-input"
              className="form-input"
              type="text"
              placeholder="Enter notification message…"
              value={lastMsg}
              onChange={(e) => setLastMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendTest()}
              style={{ marginBottom: 0 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                id="btn-send-notif"
                className="btn-notif send"
                onClick={sendTest}
                disabled={isBusy}
                style={{ flex: 1 }}
              >
                📤 Send Test
              </button>
              <button
                id="btn-unsubscribe"
                className="btn-notif unsubscribe"
                onClick={unsubscribeFromPush}
                disabled={isBusy}
              >
                🔕 Unsubscribe
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Install Prompt ────────────────────────────────────────
function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    if (standalone) return

    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent))

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Show on iOS even without beforeinstallprompt
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      setShow(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (deferredPrompt) {
      ;(deferredPrompt as BeforeInstallPromptEvent).prompt()
      const { outcome } = await (deferredPrompt as BeforeInstallPromptEvent).userChoice
      if (outcome === 'accepted') setShow(false)
    }
  }

  if (!show) return null

  return (
    <div className="install-prompt" role="banner" aria-label="Install app prompt">
      <span className="install-prompt-icon">📲</span>
      <div className="install-prompt-text">
        <strong>Install Notify on your device</strong>
        {isIOS
          ? 'Tap the share button ⎋ then "Add to Home Screen" ➕'
          : 'Add to your home screen for the full app experience'}
      </div>
      {!isIOS && deferredPrompt && (
        <button
          id="btn-install"
          className="btn-notif subscribe"
          onClick={handleInstall}
          style={{ flex: 'none', padding: '10px 14px', fontSize: '13px' }}
        >
          Install
        </button>
      )}
    </div>
  )
}

// ── Add / Edit Modal ──────────────────────────────────────
interface TodoModalProps {
  onClose: () => void
  onSave: (todo: Omit<Todo, 'id' | 'createdAt' | 'completed'>) => void
  editing?: Todo | null
}

function TodoModal({ onClose, onSave, editing }: TodoModalProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ title: title.trim(), description: description.trim(), priority, dueDate })
    onClose()
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={editing ? 'Edit task' : 'Add new task'}
    >
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{editing ? '✏️ Edit Task' : '✨ New Task'}</h2>
          <button
            id="btn-modal-close"
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="todo-title">Task Title *</label>
            <input
              id="todo-title"
              className="form-input"
              type="text"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="todo-desc">Description</label>
            <textarea
              id="todo-desc"
              className="form-textarea"
              placeholder="Add more details…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <div className="priority-grid">
              {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  id={`priority-${p}`}
                  className={`priority-option ${priority === p ? `selected-${p}` : ''}`}
                  onClick={() => setPriority(p)}
                >
                  {p === 'high' ? '🔴' : p === 'medium' ? '🟠' : '🟢'}{' '}
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="todo-due">Due Date</label>
            <input
              id="todo-due"
              className="form-input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <button id="btn-save-todo" type="submit" className="btn-primary">
            {editing ? 'Save Changes' : '+ Add Task'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Todo Card ─────────────────────────────────────────────
interface TodoCardProps {
  todo: Todo
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (todo: Todo) => void
}

function TodoCard({ todo, onToggle, onDelete, onEdit }: TodoCardProps) {
  const overdue = !todo.completed && isOverdue(todo.dueDate)

  return (
    <article
      id={`todo-${todo.id}`}
      className={`todo-card priority-${todo.priority} ${todo.completed ? 'completed' : ''}`}
      aria-label={`Task: ${todo.title}`}
    >
      <button
        id={`checkbox-${todo.id}`}
        className={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
        onClick={() => onToggle(todo.id)}
        aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
        type="button"
      />
      <div className="todo-content" onClick={() => onEdit(todo)}>
        <div className="todo-title">{todo.title}</div>
        {todo.description && (
          <div className="todo-desc">{todo.description}</div>
        )}
        <div className="todo-meta">
          <span className={`priority-badge ${todo.priority}`}>
            {todo.priority === 'high' ? '🔴' : todo.priority === 'medium' ? '🟠' : '🟢'}{' '}
            {todo.priority}
          </span>
          {todo.dueDate && (
            <span className={`due-date ${overdue ? 'overdue' : ''}`}>
              📅 {formatDueDate(todo.dueDate)}
              {overdue ? ' ⚠️' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="todo-actions" role="group" aria-label="Task actions">
        <button
          id={`edit-${todo.id}`}
          className="todo-action-btn"
          onClick={(e) => { e.stopPropagation(); onEdit(todo) }}
          aria-label="Edit task"
          type="button"
        >
          ✏️
        </button>
        <button
          id={`delete-${todo.id}`}
          className="todo-action-btn delete"
          onClick={(e) => { e.stopPropagation(); onDelete(todo.id) }}
          aria-label="Delete task"
          type="button"
        >
          🗑️
        </button>
      </div>
    </article>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function Page() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setTodos(JSON.parse(saved))
    } catch {
      // ignore
    }
  }, [])

  // Persist to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
    }
  }, [todos, mounted])

  const addTodo = useCallback(
    (data: Omit<Todo, 'id' | 'createdAt' | 'completed'>) => {
      setTodos((prev) => [
        {
          ...data,
          id: crypto.randomUUID(),
          completed: false,
          createdAt: Date.now(),
        },
        ...prev,
      ])
    },
    []
  )

  const editTodo = useCallback(
    (data: Omit<Todo, 'id' | 'createdAt' | 'completed'>) => {
      if (!editingTodo) return
      setTodos((prev) =>
        prev.map((t) => (t.id === editingTodo.id ? { ...t, ...data } : t))
      )
    },
    [editingTodo]
  )

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }, [])

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const openAddModal = () => {
    setEditingTodo(null)
    setShowModal(true)
  }

  const openEditModal = (todo: Todo) => {
    setEditingTodo(todo)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingTodo(null)
  }

  // Stats
  const total = todos.length
  const completed = todos.filter((t) => t.completed).length
  const active = total - completed

  // Filtered list
  const filtered = todos.filter((t) => {
    if (filter === 'active') return !t.completed
    if (filter === 'completed') return t.completed
    return true
  })

  return (
    <>
      <main className="app-container">
        {/* Header */}
        <header className="header">
          <div className="header-logo">
            <div className="logo-icon" aria-hidden="true">✓</div>
            <span className="logo-text">Notify</span>
          </div>
          <h1 className="greeting">{mounted ? getGreeting() : 'Welcome 👋'}</h1>
          <p className="date-str" aria-label="Today's date">{mounted ? formatDate() : ''}</p>
        </header>

        {/* Install Prompt */}
        {mounted && <InstallPrompt />}

        {/* Stats */}
        <section className="stats-bar" aria-label="Task statistics">
          <div className="stat-card">
            <div className="stat-number" aria-label={`${total} total tasks`}>{total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" aria-label={`${active} active tasks`}>{active}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" aria-label={`${completed} done tasks`}>{completed}</div>
            <div className="stat-label">Done</div>
          </div>
        </section>

        {/* Filter Tabs */}
        <nav className="filter-tabs" aria-label="Filter tasks" role="tablist">
          {(['all', 'active', 'completed'] as Filter[]).map((f) => (
            <button
              key={f}
              id={`filter-${f}`}
              role="tab"
              aria-selected={filter === f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '📋 All' : f === 'active' ? '⏳ Active' : '✅ Done'}
            </button>
          ))}
        </nav>

        {/* Todo List */}
        <section aria-label="Task list" aria-live="polite">
          {filtered.length === 0 ? (
            <div className="empty-state" role="status">
              <div className="empty-icon">
                {filter === 'completed' ? '🏆' : filter === 'active' ? '🎯' : '🌟'}
              </div>
              <h3>
                {filter === 'completed'
                  ? 'No completed tasks yet'
                  : filter === 'active'
                  ? 'All caught up!'
                  : 'No tasks yet'}
              </h3>
              <p>
                {filter === 'completed'
                  ? 'Complete some tasks to see them here'
                  : 'Tap the + button below to add your first task'}
              </p>
            </div>
          ) : (
            <div className="todos-list" role="list">
              {filtered.map((todo) => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  onToggle={toggleTodo}
                  onDelete={deleteTodo}
                  onEdit={openEditModal}
                />
              ))}
            </div>
          )}
        </section>

        {/* Push Notification Panel */}
        {mounted && (
          <>
            <div className="section-header" aria-hidden="true">Notifications</div>
            <PushNotificationManager />
          </>
        )}
      </main>

      {/* Floating Action Button */}
      <div className="fab" aria-label="Add new task">
        <button
          id="fab-add"
          className={`fab-btn ${showModal && !editingTodo ? 'open' : ''}`}
          onClick={openAddModal}
          aria-label="Add new task"
          type="button"
        >
          +
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <TodoModal
          onClose={closeModal}
          onSave={editingTodo ? editTodo : addTodo}
          editing={editingTodo}
        />
      )}
    </>
  )
}

// Type augmentation for BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
