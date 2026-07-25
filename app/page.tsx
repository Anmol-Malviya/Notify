'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { subscribeUser, unsubscribeUser, sendNotification } from './actions'

// ── Types ─────────────────────────────────────────────────
type Priority = 'high' | 'medium' | 'low'
type Filter = 'all' | 'active' | 'completed'
type NavTab = 'home' | 'calendar' | 'categories' | 'profile'

interface Todo {
  id: string
  title: string
  description: string
  priority: Priority
  dueDate: string
  dueTime: string
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
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
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
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function isOverdue(dueDate: string, dueTime: string): boolean {
  if (!dueDate) return false
  const dt = dueTime
    ? new Date(`${dueDate}T${dueTime}`)
    : (() => { const d = new Date(dueDate); d.setHours(23, 59, 59); return d })()
  return dt < new Date()
}

function getDueTimestamp(dueDate: string, dueTime: string): number {
  if (!dueDate) return 0
  if (dueTime) return new Date(`${dueDate}T${dueTime}`).getTime()
  const d = new Date(dueDate); d.setHours(23, 59, 0, 0); return d.getTime()
}

function formatDatePart(dueDate: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dueDate); target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  return new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDueDateTime(dueDate: string, dueTime: string): string {
  if (!dueDate) return ''
  const datePart = formatDatePart(dueDate)
  if (!dueTime) return datePart
  const [h, m] = dueTime.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${datePart} ${h12}:${String(m).padStart(2, '0')} ${period}`
}

function getCountdown(dueDate: string, dueTime: string): string {
  const ts = getDueTimestamp(dueDate, dueTime)
  if (!ts) return ''
  const diff = ts - Date.now()
  if (diff <= 0) return '⏰ Time up!'
  const totalMins = Math.floor(diff / 60000)
  const days = Math.floor(totalMins / 1440)
  const hours = Math.floor((totalMins % 1440) / 60)
  const mins = totalMins % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

const STORAGE_KEY = 'notify-todos-v2'

// ── SW Scheduling ─────────────────────────────────────────
async function scheduleNotificationInSW(todo: Todo) {
  if (!('serviceWorker' in navigator) || !todo.dueDate || todo.completed) return
  const timestamp = getDueTimestamp(todo.dueDate, todo.dueTime)
  if (!timestamp || timestamp <= Date.now()) return
  try {
    const reg = await navigator.serviceWorker.ready
    reg.active?.postMessage({
      type: 'SCHEDULE_NOTIFICATION',
      id: todo.id,
      title: `⏰ Task Due: ${todo.title}`,
      body: todo.dueTime ? `"${todo.title}" is due now!` : `"${todo.title}" is due today!`,
      timestamp,
    })
  } catch (err) { console.error('SW schedule failed:', err) }
}

async function cancelNotificationInSW(id: string) {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    reg.active?.postMessage({ type: 'CANCEL_NOTIFICATION', id })
  } catch { /* ignore */ }
}

// ── Countdown Badge ───────────────────────────────────────
function CountdownBadge({ dueDate, dueTime }: { dueDate: string; dueTime: string }) {
  const [label, setLabel] = useState(() => getCountdown(dueDate, dueTime))
  useEffect(() => {
    setLabel(getCountdown(dueDate, dueTime))
    const iv = setInterval(() => setLabel(getCountdown(dueDate, dueTime)), 30000)
    return () => clearInterval(iv)
  }, [dueDate, dueTime])
  if (!label) return null
  const isUp = label === '⏰ Time up!'
  return (
    <span className={`countdown-badge ${isUp ? 'time-up' : ''}`} aria-label={`Time: ${label}`}>
      {isUp ? label : `⏱ ${label}`}
    </span>
  )
}

// ── Focus Ring Card ───────────────────────────────────────
function FocusCard({ todos }: { todos: Todo[] }) {
  const total = todos.length
  const completed = todos.filter((t) => t.completed).length
  const pct = total === 0 ? 100 : Math.round((completed / total) * 100)

  const R = 40
  const C = 2 * Math.PI * R // ≈ 251.3
  const offset = C * (1 - pct / 100)

  const msg =
    pct === 100
      ? "You're all set for today!"
      : pct >= 50
      ? 'Great progress, keep going!'
      : 'Stay focused, you can do it!'

  const sub =
    pct === 100
      ? 'Great job! You have completed all tasks for today.'
      : `You've completed ${completed} of ${total} tasks.`

  return (
    <div className="focus-card" role="region" aria-label="Today's focus">
      {/* Circular Ring */}
      <div className="focus-ring-wrap">
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle cx="46" cy="46" r={R} fill="none" stroke="#EAEAF4" strokeWidth="8" />
          <circle
            cx="46" cy="46" r={R}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="8"
            strokeDasharray={C}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '46px 46px', transition: 'stroke-dashoffset 0.6s ease' }}
          />
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7B61FF" />
              <stop offset="100%" stopColor="#4FC3F7" />
            </linearGradient>
          </defs>
        </svg>
        <div className="focus-ring-inner">
          <span className="focus-pct">{pct}%</span>
          <span className="focus-pct-label">Today Focus</span>
        </div>
      </div>
      <div className="focus-info">
        <div className="focus-title">{msg}</div>
        <div className="focus-subtitle">{sub}</div>
      </div>
      <div className="focus-arrow-btn" aria-hidden="true">›</div>
    </div>
  )
}

// ── Quick Actions ─────────────────────────────────────────
function QuickActions({ onAddClick }: { onAddClick: () => void }) {
  return (
    <>
      <div className="section-title">Quick Actions</div>
      <div className="quick-actions-grid">
        <button
          id="qa-add"
          className="qa-card qa-purple"
          onClick={onAddClick}
          type="button"
        >
          <div className="qa-icon-wrap qa-purple-bg">➕</div>
          <div className="qa-title">Add Task</div>
          <div className="qa-subtitle">Create new task</div>
        </button>
        <button
          id="qa-today"
          className="qa-card qa-blue"
          type="button"
          onClick={onAddClick}
        >
          <div className="qa-icon-wrap qa-blue-bg">📅</div>
          <div className="qa-title">Today View</div>
          <div className="qa-subtitle">Focus on today</div>
        </button>
        <button
          id="qa-analytics"
          className="qa-card qa-green"
          type="button"
        >
          <div className="qa-icon-wrap qa-green-bg">📊</div>
          <div className="qa-title">Analytics</div>
          <div className="qa-subtitle">View progress</div>
        </button>
      </div>
    </>
  )
}

// ── Notification Sheet ────────────────────────────────────
function NotificationSheet({ onClose }: { onClose: () => void }) {
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [msg, setMsg] = useState('')

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

  async function subscribe() {
    setIsBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      setSubscription(sub)
      await subscribeUser(JSON.parse(JSON.stringify(sub)))
    } catch (err) { console.error(err) }
    finally { setIsBusy(false) }
  }

  async function unsubscribe() {
    setIsBusy(true)
    try { await subscription?.unsubscribe(); setSubscription(null); await unsubscribeUser() }
    catch (err) { console.error(err) }
    finally { setIsBusy(false) }
  }

  async function sendTest() {
    setIsBusy(true)
    try { await sendNotification('Notify', msg.trim() || 'Your Notify app is working! 🎉'); setMsg('') }
    catch (err) { console.error(err) }
    finally { setIsBusy(false) }
  }

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Push Notifications">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span className="sheet-title">🔔 Notifications</span>
          <button className="sheet-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {!isSupported ? (
          <p className="notif-not-supported">
            Push notifications are not supported in this browser. Use Chrome on Android.
          </p>
        ) : (
          <>
            <div className="notif-status-row">
              <span className="notif-status-label">Push Notifications</span>
              <span className={`notif-status-badge ${subscription ? 'on' : 'off'}`}>
                <span className="dot" />
                {subscription ? 'Active' : 'Off'}
              </span>
            </div>

            {!subscription ? (
              <>
                <p className="notif-hint">
                  Enable push notifications to receive alerts when your task timers expire — even when the app is closed.
                </p>
                <button id="btn-subscribe" className="btn-notif subscribe" onClick={subscribe} disabled={isBusy}>
                  🔔 Enable Push Notifications
                </button>
              </>
            ) : (
              <>
                <p className="notif-hint">
                  ✅ Timer alerts are active. You&apos;ll be notified when any task&apos;s due time arrives.
                </p>
                <input
                  id="notif-msg-input"
                  className="form-input"
                  type="text"
                  placeholder="Send a test notification…"
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendTest()}
                  style={{ marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button id="btn-send-notif" className="btn-notif send" onClick={sendTest} disabled={isBusy} style={{ flex: 1 }}>
                    📤 Send Test
                  </button>
                  <button id="btn-unsubscribe" className="btn-notif unsubscribe" onClick={unsubscribe} disabled={isBusy}>
                    🔕 Disable
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ── Install Prompt ────────────────────────────────────────
function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent))
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) setShow(true)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    ;(deferredPrompt as BeforeInstallPromptEvent).prompt()
    const { outcome } = await (deferredPrompt as BeforeInstallPromptEvent).userChoice
    if (outcome === 'accepted') setShow(false)
  }

  if (!show) return null
  return (
    <div className="install-prompt" role="banner">
      <span className="install-prompt-icon">📲</span>
      <div className="install-prompt-text">
        <strong>Install Notify on your device</strong>
        {isIOS ? 'Tap share ⎋ → "Add to Home Screen" ➕' : 'Add to home screen for the full app experience'}
      </div>
      {!isIOS && deferredPrompt && (
        <button id="btn-install" className="btn-notif subscribe" onClick={handleInstall}
          style={{ flex: 'none', padding: '8px 14px', fontSize: '12px', marginBottom: 0 }}>
          Install
        </button>
      )}
    </div>
  )
}

// ── Todo Modal ────────────────────────────────────────────
interface ModalProps {
  onClose: () => void
  onSave: (data: Omit<Todo, 'id' | 'createdAt' | 'completed'>) => void
  editing?: Todo | null
}

function TodoModal({ onClose, onSave, editing }: ModalProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? '')
  const [dueTime, setDueTime] = useState(editing?.dueTime ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ title: title.trim(), description: description.trim(), priority, dueDate, dueTime })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-drag" />
        <div className="modal-header">
          <h2 className="modal-title">{editing ? '✏️ Edit Task' : '✨ New Task'}</h2>
          <button id="btn-modal-close" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="todo-title">Task Title *</label>
            <input id="todo-title" className="form-input" type="text"
              placeholder="What needs to be done?" value={title}
              onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="todo-desc">Description</label>
            <textarea id="todo-desc" className="form-textarea" placeholder="Add more details…"
              value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <div className="priority-grid">
              {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                <button key={p} type="button" id={`priority-${p}`}
                  className={`priority-option ${priority === p ? `selected-${p}` : ''}`}
                  onClick={() => setPriority(p)}>
                  {p === 'high' ? '🔴' : p === 'medium' ? '🟠' : '🟢'}{' '}
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Due Date & Time ⏰</label>
            <div className="date-time-row">
              <input id="todo-due" className="form-input" type="date"
                value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                style={{ colorScheme: 'light' }} />
              <input id="todo-time" className="form-input" type="time"
                value={dueTime} onChange={(e) => setDueTime(e.target.value)}
                disabled={!dueDate} style={{ colorScheme: 'light' }}
                title="Set time for push notification" />
            </div>
            {dueDate && dueTime && (
              <p className="time-hint">🔔 Push notification scheduled for {dueTime} on {dueDate}</p>
            )}
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
function TodoCard({ todo, onToggle, onDelete, onEdit }: {
  todo: Todo; onToggle: (id: string) => void
  onDelete: (id: string) => void; onEdit: (todo: Todo) => void
}) {
  const overdue = !todo.completed && isOverdue(todo.dueDate, todo.dueTime)
  const hasTimer = !!(todo.dueDate && todo.dueTime && !todo.completed)

  return (
    <article id={`todo-${todo.id}`}
      className={`todo-card priority-${todo.priority} ${todo.completed ? 'completed' : ''} ${overdue ? 'overdue-card' : ''}`}
      aria-label={`Task: ${todo.title}`}>
      <button id={`checkbox-${todo.id}`}
        className={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
        onClick={() => onToggle(todo.id)}
        aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'} type="button" />
      <div className="todo-content" onClick={() => onEdit(todo)}>
        <div className="todo-title">{todo.title}</div>
        {todo.description && <div className="todo-desc">{todo.description}</div>}
        <div className="todo-meta">
          <span className={`priority-badge ${todo.priority}`}>
            {todo.priority === 'high' ? '● HIGH' : todo.priority === 'medium' ? '● MED' : '● LOW'}
          </span>
          {todo.dueDate && (
            <span className={`due-date ${overdue ? 'overdue' : ''}`}>
              📅 {formatDueDateTime(todo.dueDate, todo.dueTime)}{overdue ? ' ⚠️' : ''}
            </span>
          )}
          {hasTimer && <CountdownBadge dueDate={todo.dueDate} dueTime={todo.dueTime} />}
        </div>
      </div>
      <div className="todo-actions" role="group">
        <button id={`edit-${todo.id}`} className="todo-action-btn"
          onClick={(e) => { e.stopPropagation(); onEdit(todo) }} type="button" aria-label="Edit">✏️</button>
        <button id={`delete-${todo.id}`} className="todo-action-btn delete"
          onClick={(e) => { e.stopPropagation(); onDelete(todo.id) }} type="button" aria-label="Delete">🗑️</button>
      </div>
    </article>
  )
}

// ── Bottom Navigation ─────────────────────────────────────
function BottomNav({ onAddClick, activeTab, onTabChange }: {
  onAddClick: () => void
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
}) {
  const tabs: Array<{ id: NavTab; icon: string; label: string }> = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'calendar', icon: '📆', label: 'Calendar' },
  ]
  const rightTabs: Array<{ id: NavTab; icon: string; label: string }> = [
    { id: 'categories', icon: '🗂️', label: 'Categories' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ]

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map((t) => (
        <button key={t.id} id={`nav-${t.id}`} className={`nav-item ${activeTab === t.id ? 'active' : ''}`}
          onClick={() => onTabChange(t.id)} type="button" aria-label={t.label}>
          <span className="nav-icon">{t.icon}</span>
          <span className="nav-label">{t.label}</span>
        </button>
      ))}
      <div className="nav-fab-wrap">
        <button id="fab-add" className={`nav-fab`} onClick={onAddClick} type="button" aria-label="Add task">
          +
        </button>
      </div>
      {rightTabs.map((t) => (
        <button key={t.id} id={`nav-${t.id}`} className={`nav-item ${activeTab === t.id ? 'active' : ''}`}
          onClick={() => onTabChange(t.id)} type="button" aria-label={t.label}>
          <span className="nav-icon">{t.icon}</span>
          <span className="nav-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function Page() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [showModal, setShowModal] = useState(false)
  const [showNotifSheet, setShowNotifSheet] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<NavTab>('home')
  const editingRef = useRef<Todo | null>(null)

  // Load + register SW
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: Todo[] = JSON.parse(saved)
        setTodos(parsed)
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker
            .register('/sw.js', { scope: '/', updateViaCache: 'none' })
            .then(async () => {
              for (const todo of parsed) {
                if (!todo.completed && todo.dueDate && todo.dueTime) {
                  const ts = getDueTimestamp(todo.dueDate, todo.dueTime)
                  if (ts > Date.now()) await scheduleNotificationInSW(todo)
                }
              }
            }).catch(console.error)
        }
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos, mounted])

  const addTodo = useCallback(async (data: Omit<Todo, 'id' | 'createdAt' | 'completed'>) => {
    const t: Todo = { ...data, id: crypto.randomUUID(), completed: false, createdAt: Date.now() }
    setTodos((prev) => [t, ...prev])
    await scheduleNotificationInSW(t)
  }, [])

  const editTodo = useCallback(async (data: Omit<Todo, 'id' | 'createdAt' | 'completed'>) => {
    const prev = editingRef.current
    if (!prev) return
    await cancelNotificationInSW(prev.id)
    const updated = { ...prev, ...data }
    setTodos((ts) => ts.map((t) => (t.id === prev.id ? updated : t)))
    await scheduleNotificationInSW(updated)
  }, [])

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => prev.map((t) => {
      if (t.id !== id) return t
      const updated = { ...t, completed: !t.completed }
      if (updated.completed) cancelNotificationInSW(id)
      else scheduleNotificationInSW(updated)
      return updated
    }))
  }, [])

  const deleteTodo = useCallback((id: string) => {
    cancelNotificationInSW(id)
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const openAddModal = () => { editingRef.current = null; setEditingTodo(null); setShowModal(true) }
  const openEditModal = (todo: Todo) => { editingRef.current = todo; setEditingTodo(todo); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditingTodo(null); editingRef.current = null }

  const total = todos.length
  const completed = todos.filter((t) => t.completed).length
  const active = total - completed

  const filtered = todos.filter((t) => {
    if (filter === 'active') return !t.completed
    if (filter === 'completed') return t.completed
    return true
  })

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <button className="header-icon-btn" aria-label="Menu" type="button">☰</button>
        <div className="header-center">
          <div className="header-greeting">{mounted ? getGreeting() : 'Welcome 👋'}</div>
          <div className="header-date">{mounted ? formatDate() : ''}</div>
        </div>
        <button
          className="header-icon-btn"
          aria-label="Notifications"
          type="button"
          id="btn-bell"
          onClick={() => setShowNotifSheet(true)}
        >
          🔔
          <span className="bell-dot" aria-hidden="true" />
        </button>
      </header>

      {/* Scrollable Content */}
      <main className="content">
        {mounted && <InstallPrompt />}

        {/* Stats Bar */}
        <section className="stats-bar" aria-label="Task statistics">
          <div className="stat-card">
            <div className="stat-icon-wrap total-icon">📋</div>
            <div className="stat-number n-total">{total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap active-icon">⚡</div>
            <div className="stat-number n-active">{active}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap done-icon">✅</div>
            <div className="stat-number n-done">{completed}</div>
            <div className="stat-label">Done</div>
          </div>
        </section>

        {/* Filter Tabs */}
        <nav className="filter-tabs" aria-label="Filter tasks" role="tablist">
          {([
            { id: 'all', label: '⊞ All Tasks' },
            { id: 'active', label: '⏳ Active' },
            { id: 'completed', label: '✓ Done' },
          ] as { id: Filter; label: string }[]).map((f) => (
            <button key={f.id} id={`filter-${f.id}`} role="tab"
              aria-selected={filter === f.id}
              className={`filter-tab ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}>
              {f.label}
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
                {filter === 'completed' ? 'No completed tasks yet'
                  : filter === 'active' ? 'All caught up!' : 'No tasks yet'}
              </h3>
              <p>
                {filter === 'completed' ? 'Complete tasks to see them here'
                  : 'Tap + below to add your first task'}
              </p>
            </div>
          ) : (
            <div className="todos-list" role="list">
              {filtered.map((todo) => (
                <TodoCard key={todo.id} todo={todo}
                  onToggle={toggleTodo} onDelete={deleteTodo} onEdit={openEditModal} />
              ))}
            </div>
          )}
        </section>

        {/* Focus Ring Card */}
        <FocusCard todos={todos} />

        {/* Quick Actions */}
        <QuickActions onAddClick={openAddModal} />
      </main>

      {/* Bottom Navigation */}
      <BottomNav onAddClick={openAddModal} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Notification Sheet */}
      {showNotifSheet && mounted && <NotificationSheet onClose={() => setShowNotifSheet(false)} />}

      {/* Todo Modal */}
      {showModal && (
        <TodoModal onClose={closeModal} onSave={editingTodo ? editTodo : addTodo} editing={editingTodo} />
      )}
    </div>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
