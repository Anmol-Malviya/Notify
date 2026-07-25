'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { subscribeUser, unsubscribeUser, sendNotification } from './actions'
import {
  Todo,
  Category,
  Priority,
  Filter,
  NavTab,
  Theme,
  UserProfile,
  DEFAULT_CATEGORIES,
  SubTask,
  SortOption,
} from './types'
import { CalendarView } from './components/CalendarView'
import { CategoriesView } from './components/CategoriesView'
import { AnalyticsView } from './components/AnalyticsView'
import { ProfileView } from './components/ProfileView'
import { SideDrawer } from './components/SideDrawer'

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
const STORAGE_CATS_KEY = 'notify-categories-v1'
const STORAGE_THEME_KEY = 'notify-theme-v1'
const STORAGE_PROFILE_KEY = 'notify-user-profile-v1'

// ── Service Worker Scheduling ─────────────────────────────
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
  const C = 2 * Math.PI * R
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
      <div className="focus-ring-wrap">
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle cx="46" cy="46" r={R} fill="none" stroke="var(--border)" strokeWidth="8" />
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
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--blue)" />
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
function QuickActions({
  onAddClick,
  onTodayClick,
  onAnalyticsClick,
}: {
  onAddClick: () => void
  onTodayClick: () => void
  onAnalyticsClick: () => void
}) {
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
          onClick={onTodayClick}
        >
          <div className="qa-icon-wrap qa-blue-bg">📅</div>
          <div className="qa-title">Today View</div>
          <div className="qa-subtitle">Focus on today</div>
        </button>
        <button
          id="qa-analytics"
          className="qa-card qa-green"
          type="button"
          onClick={onAnalyticsClick}
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
            Push notifications are not supported in this browser. Use Chrome or supported PWA browser.
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
  categories: Category[]
  initialDueDate?: string
}

function TodoModal({ onClose, onSave, editing, categories, initialDueDate }: ModalProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? 'medium')
  const [category, setCategory] = useState<string>(editing?.category ?? 'personal')
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? initialDueDate ?? '')
  const [dueTime, setDueTime] = useState(editing?.dueTime ?? '')
  const [subtasks, setSubtasks] = useState<SubTask[]>(editing?.subtasks ?? [])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

  function handleAddSubtask() {
    if (!newSubtaskTitle.trim()) return
    const st: SubTask = { id: crypto.randomUUID(), title: newSubtaskTitle.trim(), completed: false }
    setSubtasks((prev) => [...prev, st])
    setNewSubtaskTitle('')
  }

  function handleRemoveSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id))
  }

  function handleToggleSubtaskInModal(id: string) {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      category,
      dueDate,
      dueTime,
      subtasks,
    })
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
            <textarea id="todo-desc" className="form-textarea" placeholder="Add details or notes…"
              value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <div className="category-select-grid">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cat-select-btn ${category === c.id ? 'active' : ''}`}
                  onClick={() => setCategory(c.id)}
                  style={{
                    borderColor: category === c.id ? c.color : 'var(--border)',
                    background: category === c.id ? c.bgColor : 'var(--bg)',
                    color: category === c.id ? c.color : 'var(--text-dark)',
                  }}
                >
                  <span>{c.icon}</span>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Priority</label>
            <div className="priority-grid">
              {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                <button key={p} type="button" id={`priority-${p}`}
                  className={`priority-option ${priority === p ? `selected-${p}` : ''}`}
                  onClick={() => setPriority(p)}>
                  {p === 'high' ? '🔴 High' : p === 'medium' ? '🟠 Med' : '🟢 Low'}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Due Date & Time ⏰</label>
            <div className="date-time-row">
              <input id="todo-due" className="form-input" type="date"
                value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <input id="todo-time" className="form-input" type="time"
                value={dueTime} onChange={(e) => setDueTime(e.target.value)}
                disabled={!dueDate} title="Set time for push notification" />
            </div>
            {dueDate && dueTime && (
              <p className="time-hint">🔔 Push notification scheduled for {dueTime} on {dueDate}</p>
            )}
          </div>

          {/* Subtasks Builder */}
          <div className="form-group">
            <label className="form-label">Sub-tasks / Checklist</label>
            <div className="subtasks-input-row">
              <input
                className="form-input"
                type="text"
                placeholder="Add sub-task steps..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddSubtask()
                  }
                }}
              />
              <button
                type="button"
                className="btn-add-subtask"
                onClick={handleAddSubtask}
              >
                + Add
              </button>
            </div>

            {subtasks.length > 0 && (
              <div className="modal-subtasks-list">
                {subtasks.map((st) => (
                  <div key={st.id} className="modal-subtask-item">
                    <button
                      type="button"
                      className={`todo-checkbox ${st.completed ? 'checked' : ''}`}
                      onClick={() => handleToggleSubtaskInModal(st.id)}
                    />
                    <span className={`subtask-title-text ${st.completed ? 'completed' : ''}`}>
                      {st.title}
                    </span>
                    <button
                      type="button"
                      className="btn-remove-subtask"
                      onClick={() => handleRemoveSubtask(st.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button id="btn-save-todo" type="submit" className="btn-primary">
            {editing ? 'Save Changes' : '+ Create Task'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Todo Card ─────────────────────────────────────────────
function TodoCard({ todo, categories, onToggle, onDelete, onEdit, onToggleSubtask }: {
  todo: Todo
  categories: Category[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (todo: Todo) => void
  onToggleSubtask: (todoId: string, subtaskId: string) => void
}) {
  const [showSubtasks, setShowSubtasks] = useState(false)
  const overdue = !todo.completed && isOverdue(todo.dueDate, todo.dueTime)
  const hasTimer = !!(todo.dueDate && todo.dueTime && !todo.completed)
  const cat = categories.find((c) => c.id === (todo.category || 'personal'))

  const subtasks = todo.subtasks || []
  const completedSubtasks = subtasks.filter((s) => s.completed).length

  return (
    <article id={`todo-${todo.id}`}
      className={`todo-card priority-${todo.priority} ${todo.completed ? 'completed' : ''} ${overdue ? 'overdue-card' : ''}`}
      aria-label={`Task: ${todo.title}`}>
      <button id={`checkbox-${todo.id}`}
        className={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
        onClick={() => onToggle(todo.id)}
        aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'} type="button" />
      <div className="todo-content" onClick={() => onEdit(todo)}>
        <div className="todo-title-row">
          <div className="todo-title">{todo.title}</div>
          {cat && (
            <span className="cat-badge" style={{ background: cat.bgColor, color: cat.color }}>
              {cat.icon} {cat.name}
            </span>
          )}
        </div>

        {todo.description && <div className="todo-desc">{todo.description}</div>}

        {/* Subtask Summary */}
        {subtasks.length > 0 && (
          <div className="subtasks-summary-box" onClick={(e) => { e.stopPropagation(); setShowSubtasks(!showSubtasks) }}>
            <div className="subtasks-progress-info">
              <span>📋 {completedSubtasks}/{subtasks.length} subtasks</span>
              <span className="toggle-subtask-icon">{showSubtasks ? '▲' : '▼'}</span>
            </div>
            <div className="subtasks-progress-track">
              <div
                className="subtasks-progress-fill"
                style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Expanded Subtasks Checklist */}
        {showSubtasks && subtasks.length > 0 && (
          <div className="card-subtasks-list" onClick={(e) => e.stopPropagation()}>
            {subtasks.map((st) => (
              <div key={st.id} className="card-subtask-item">
                <button
                  type="button"
                  className={`todo-checkbox ${st.completed ? 'checked' : ''}`}
                  onClick={() => onToggleSubtask(todo.id, st.id)}
                />
                <span className={`subtask-label ${st.completed ? 'completed' : ''}`}>
                  {st.title}
                </span>
              </div>
            ))}
          </div>
        )}

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
        <button id="fab-add" className="nav-fab" onClick={onAddClick} type="button" aria-label="Add task">
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
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [theme, setTheme] = useState<Theme>('system')
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Pro User',
    avatar: '🧑‍💻',
    title: 'Task Conqueror',
  })

  const [filter, setFilter] = useState<Filter>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortOption>('createdAt')

  const [showModal, setShowModal] = useState(false)
  const [showNotifSheet, setShowNotifSheet] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [initialModalDate, setInitialModalDate] = useState<string>('')

  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<NavTab>('home')
  const editingRef = useRef<Todo | null>(null)

  // Initial Load + LocalStorage Sync
  useEffect(() => {
    setMounted(true)
    try {
      const savedTodos = localStorage.getItem(STORAGE_KEY)
      if (savedTodos) {
        const parsed: Todo[] = JSON.parse(savedTodos)
        setTodos(parsed.map((t) => ({
          ...t,
          category: t.category || 'personal',
          subtasks: t.subtasks || [],
        })))
      }

      const savedCats = localStorage.getItem(STORAGE_CATS_KEY)
      if (savedCats) {
        setCategories(JSON.parse(savedCats))
      }

      const savedTheme = localStorage.getItem(STORAGE_THEME_KEY) as Theme
      if (savedTheme) setTheme(savedTheme)

      const savedProf = localStorage.getItem(STORAGE_PROFILE_KEY)
      if (savedProf) setUserProfile(JSON.parse(savedProf))

      // Register SW
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/', updateViaCache: 'none' })
          .then(async () => {
            if (savedTodos) {
              const parsed: Todo[] = JSON.parse(savedTodos)
              for (const todo of parsed) {
                if (!todo.completed && todo.dueDate && todo.dueTime) {
                  const ts = getDueTimestamp(todo.dueDate, todo.dueTime)
                  if (ts > Date.now()) await scheduleNotificationInSW(todo)
                }
              }
            }
          }).catch(console.error)
      }
    } catch { /* ignore */ }
  }, [])

  // Sync Theme to HTML Root
  useEffect(() => {
    if (!mounted) return
    localStorage.setItem(STORAGE_THEME_KEY, theme)
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    }
  }, [theme, mounted])

  // Sync Todos to LocalStorage
  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos, mounted])

  // Sync Categories
  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_CATS_KEY, JSON.stringify(categories))
  }, [categories, mounted])

  // Sync Profile
  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(userProfile))
  }, [userProfile, mounted])

  // Handlers
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
    if ('vibrate' in navigator) navigator.vibrate([25])
    setTodos((prev) => prev.map((t) => {
      if (t.id !== id) return t
      const updated = { ...t, completed: !t.completed }
      if (updated.completed) cancelNotificationInSW(id)
      else scheduleNotificationInSW(updated)
      return updated
    }))
  }, [])

  const toggleSubtask = useCallback((todoId: string, subtaskId: string) => {
    if ('vibrate' in navigator) navigator.vibrate([15])
    setTodos((prev) => prev.map((t) => {
      if (t.id !== todoId) return t
      const updatedSubtasks = (t.subtasks || []).map((st) => (st.id === subtaskId ? { ...st, completed: !st.completed } : st))
      return { ...t, subtasks: updatedSubtasks }
    }))
  }, [])

  const deleteTodo = useCallback((id: string) => {
    cancelNotificationInSW(id)
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addCategory = useCallback((newCat: Omit<Category, 'id'>) => {
    const cat: Category = { ...newCat, id: newCat.name.toLowerCase().replace(/\s+/g, '-') }
    setCategories((prev) => [...prev, cat])
  }, [])

  const openAddModal = (dateStr?: string) => {
    editingRef.current = null
    setEditingTodo(null)
    setInitialModalDate(dateStr || '')
    setShowModal(true)
  }

  const openEditModal = (todo: Todo) => {
    editingRef.current = todo
    setEditingTodo(todo)
    setInitialModalDate('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingTodo(null)
    editingRef.current = null
    setInitialModalDate('')
  }

  // Quick Action: Today View
  const handleTodayClick = () => {
    setActiveTab('home')
    setFilter('all')
    const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    setSearchQuery(todayStr)
  }

  // Data Actions
  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(todos, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `notify-backup-${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const handleImportData = (importedTodos: Todo[]) => {
    setTodos(importedTodos)
  }

  const handleClearCompleted = () => {
    if (confirm('Clear all completed tasks?')) {
      setTodos((prev) => prev.filter((t) => !t.completed))
    }
  }

  const handleResetData = () => {
    if (confirm('Are you sure you want to reset all tasks and categories? This cannot be undone.')) {
      setTodos([])
      setCategories(DEFAULT_CATEGORIES)
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(STORAGE_CATS_KEY)
    }
  }

  // Filtering & Sorting
  const total = todos.length
  const completed = todos.filter((t) => t.completed).length
  const active = total - completed

  const filtered = todos.filter((t) => {
    // Status Filter
    if (filter === 'active' && t.completed) return false
    if (filter === 'completed' && !t.completed) return false
    if (filter === 'overdue' && (t.completed || !isOverdue(t.dueDate, t.dueTime))) return false

    // Category Filter
    if (selectedCategory !== 'all' && (t.category || 'personal') !== selectedCategory) return false

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const titleMatch = t.title.toLowerCase().includes(q)
      const descMatch = t.description.toLowerCase().includes(q)
      const dateMatch = t.dueDate?.includes(q)
      if (!titleMatch && !descMatch && !dateMatch) return false
    }

    return true
  }).sort((a, b) => {
    if (sortBy === 'dueDate') {
      const tsA = getDueTimestamp(a.dueDate, a.dueTime) || Infinity
      const tsB = getDueTimestamp(b.dueDate, b.dueTime) || Infinity
      return tsA - tsB
    }
    if (sortBy === 'priority') {
      const pMap = { high: 1, medium: 2, low: 3 }
      return pMap[a.priority] - pMap[b.priority]
    }
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title)
    }
    return b.createdAt - a.createdAt
  })

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <button
          className="header-icon-btn"
          aria-label="Menu"
          type="button"
          onClick={() => setShowDrawer(true)}
        >
          ☰
        </button>
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

      {/* Main Content Router */}
      <main className="content">
        {mounted && <InstallPrompt />}

        {activeTab === 'home' && (
          <>
            {/* Stats Bar */}
            <section className="stats-bar" aria-label="Task statistics">
              <div className="stat-card" onClick={() => setFilter('all')}>
                <div className="stat-icon-wrap total-icon">📋</div>
                <div className="stat-number n-total">{total}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-card" onClick={() => setFilter('active')}>
                <div className="stat-icon-wrap active-icon">⚡</div>
                <div className="stat-number n-active">{active}</div>
                <div className="stat-label">Active</div>
              </div>
              <div className="stat-card" onClick={() => setFilter('completed')}>
                <div className="stat-icon-wrap done-icon">✅</div>
                <div className="stat-number n-done">{completed}</div>
                <div className="stat-label">Done</div>
              </div>
            </section>

            {/* Search & Filter Bar */}
            <div className="search-filter-section">
              <div className="search-input-wrap">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search tasks or date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="search-clear-btn" onClick={() => setSearchQuery('')}>×</button>
                )}
              </div>

              {/* Category Pills */}
              <div className="cat-pills-row">
                <button
                  type="button"
                  className={`cat-pill ${selectedCategory === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('all')}
                >
                  All Categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`cat-pill ${selectedCategory === c.id ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(c.id)}
                    style={{
                      borderColor: selectedCategory === c.id ? c.color : 'var(--border)',
                      background: selectedCategory === c.id ? c.bgColor : 'var(--card)',
                      color: selectedCategory === c.id ? c.color : 'var(--text-mid)',
                    }}
                  >
                    <span>{c.icon}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>

              <div className="filter-sort-row">
                {/* Status Filter Tabs */}
                <nav className="filter-tabs" aria-label="Filter tasks">
                  {([
                    { id: 'all', label: 'All' },
                    { id: 'active', label: 'Active' },
                    { id: 'completed', label: 'Done' },
                    { id: 'overdue', label: 'Overdue' },
                  ] as { id: Filter; label: string }[]).map((f) => (
                    <button key={f.id} id={`filter-${f.id}`}
                      className={`filter-tab ${filter === f.id ? 'active' : ''}`}
                      onClick={() => setFilter(f.id)}>
                      {f.label}
                    </button>
                  ))}
                </nav>

                {/* Sort Selector */}
                <select
                  className="sort-dropdown"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                >
                  <option value="createdAt">Sort: Latest</option>
                  <option value="dueDate">Sort: Due Date</option>
                  <option value="priority">Sort: Priority</option>
                  <option value="title">Sort: Title</option>
                </select>
              </div>
            </div>

            {/* Todo List */}
            <section aria-label="Task list" aria-live="polite">
              {filtered.length === 0 ? (
                <div className="empty-state" role="status">
                  <div className="empty-icon">
                    {filter === 'completed' ? '🏆' : filter === 'active' ? '🎯' : '🌟'}
                  </div>
                  <h3>
                    {filter === 'completed' ? 'No completed tasks yet'
                      : filter === 'active' ? 'All caught up!'
                      : searchQuery ? 'No matching tasks found' : 'No tasks yet'}
                  </h3>
                  <p>
                    {searchQuery ? 'Try clearing your search query or filters' : 'Tap + below to add your first task'}
                  </p>
                </div>
              ) : (
                <div className="todos-list" role="list">
                  {filtered.map((todo) => (
                    <TodoCard key={todo.id} todo={todo} categories={categories}
                      onToggle={toggleTodo} onDelete={deleteTodo} onEdit={openEditModal} onToggleSubtask={toggleSubtask} />
                  ))}
                </div>
              )}
            </section>

            {/* Focus Ring Card */}
            <FocusCard todos={todos} />

            {/* Quick Actions */}
            <QuickActions
              onAddClick={() => openAddModal()}
              onTodayClick={handleTodayClick}
              onAnalyticsClick={() => setActiveTab('analytics')}
            />
          </>
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            todos={todos}
            categories={categories}
            onToggleTodo={toggleTodo}
            onDeleteTodo={deleteTodo}
            onEditTodo={openEditModal}
            onAddTaskForDate={(dateStr) => openAddModal(dateStr)}
          />
        )}

        {activeTab === 'categories' && (
          <CategoriesView
            categories={categories}
            todos={todos}
            onSelectCategory={(catId) => {
              setSelectedCategory(catId)
              setActiveTab('home')
            }}
            onAddCategory={addCategory}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView todos={todos} categories={categories} />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            userProfile={userProfile}
            theme={theme}
            onUpdateProfile={setUserProfile}
            onChangeTheme={setTheme}
            onOpenNotifSheet={() => setShowNotifSheet(true)}
            todos={todos}
            onExportData={handleExportData}
            onImportData={handleImportData}
            onClearCompleted={handleClearCompleted}
            onResetData={handleResetData}
          />
        )}
      </main>

      {/* Side Drawer Menu */}
      <SideDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        userProfile={userProfile}
        theme={theme}
        onChangeTheme={setTheme}
        onOpenNotifSheet={() => setShowNotifSheet(true)}
      />

      {/* Bottom Navigation */}
      <BottomNav onAddClick={() => openAddModal()} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Notification Sheet */}
      {showNotifSheet && mounted && <NotificationSheet onClose={() => setShowNotifSheet(false)} />}

      {/* Todo Modal */}
      {showModal && (
        <TodoModal
          onClose={closeModal}
          onSave={editingTodo ? editTodo : addTodo}
          editing={editingTodo}
          categories={categories}
          initialDueDate={initialModalDate}
        />
      )}
    </div>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
