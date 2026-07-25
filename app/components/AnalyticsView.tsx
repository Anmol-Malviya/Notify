'use client'

import { Todo, Category } from '../types'

interface AnalyticsViewProps {
  todos: Todo[]
  categories: Category[]
}

export function AnalyticsView({ todos, categories }: AnalyticsViewProps) {
  const total = todos.length
  const completed = todos.filter((t) => t.completed).length
  const active = total - completed
  const pct = total === 0 ? 100 : Math.round((completed / total) * 100)

  // Calculate overdue count
  const overdueCount = todos.filter((t) => {
    if (t.completed || !t.dueDate) return false
    const dueTs = t.dueTime
      ? new Date(`${t.dueDate}T${t.dueTime}`).getTime()
      : new Date(`${t.dueDate}T23:59:59`).getTime()
    return dueTs < Date.now()
  }).length

  // Priority breakdown
  const highPriority = todos.filter((t) => t.priority === 'high').length
  const medPriority = todos.filter((t) => t.priority === 'medium').length
  const lowPriority = todos.filter((t) => t.priority === 'low').length

  // Weekly breakdown mock/calc based on createdAt
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const todayIdx = new Date().getDay()
  // Generate last 7 days metrics
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dayLabel = daysOfWeek[d.getDay()]
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const countCompletedOnDay = todos.filter((t) => {
      if (!t.completed) return false
      const cd = new Date(t.createdAt)
      const cdStr = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`
      return cdStr === dateStr
    }).length

    return { label: dayLabel, count: countCompletedOnDay, isToday: d.getDay() === todayIdx }
  })

  const maxWeeklyCount = Math.max(...last7Days.map((d) => d.count), 1)

  return (
    <div className="analytics-view">
      <div className="analytics-header">
        <h2 className="analytics-title">📊 Productivity Analytics</h2>
        <p className="analytics-subtitle">Insights into your completed tasks and focus metrics</p>
      </div>

      {/* Main Score Hero Card */}
      <div className="analytics-hero-card">
        <div className="hero-ring-wrap">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="8"
              strokeDasharray={2 * Math.PI * 42}
              strokeDashoffset={2 * Math.PI * 42 * (1 - pct / 100)}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px', transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="hero-ring-content">
            <span className="hero-ring-pct">{pct}%</span>
            <span className="hero-ring-label">Done</span>
          </div>
        </div>

        <div className="hero-metrics">
          <div className="hero-metric-item">
            <span className="hero-metric-num">{total}</span>
            <span className="hero-metric-lbl">Total Tasks</span>
          </div>
          <div className="hero-metric-item">
            <span className="hero-metric-num">{completed}</span>
            <span className="hero-metric-lbl">Completed</span>
          </div>
          <div className="hero-metric-item">
            <span className="hero-metric-num">{active}</span>
            <span className="hero-metric-lbl">In Progress</span>
          </div>
        </div>
      </div>

      {/* Weekly Activity Bar Chart */}
      <div className="analytics-card">
        <h3 className="analytics-card-title">📅 Weekly Task Activity</h3>
        <p className="analytics-card-sub">Tasks completed over the past 7 days</p>

        <div className="weekly-chart">
          {last7Days.map((day, idx) => {
            const heightPct = Math.round((day.count / maxWeeklyCount) * 100)
            return (
              <div key={idx} className="chart-col">
                <div className="chart-bar-wrap">
                  <div
                    className={`chart-bar ${day.isToday ? 'today-bar' : ''}`}
                    style={{ height: `${Math.max(heightPct, 12)}%` }}
                  >
                    <span className="bar-val">{day.count}</span>
                  </div>
                </div>
                <span className={`chart-label ${day.isToday ? 'today' : ''}`}>{day.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Priority Breakdown & Overdue status */}
      <div className="analytics-grid-2">
        <div className="analytics-card">
          <h3 className="analytics-card-title">🎯 Priority Distribution</h3>
          <div className="priority-bars">
            <div className="p-bar-row">
              <span className="p-lbl red">🔴 High ({highPriority})</span>
              <div className="p-track">
                <div className="p-fill red" style={{ width: `${total ? (highPriority / total) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="p-bar-row">
              <span className="p-lbl orange">🟠 Medium ({medPriority})</span>
              <div className="p-track">
                <div className="p-fill orange" style={{ width: `${total ? (medPriority / total) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="p-bar-row">
              <span className="p-lbl green">🟢 Low ({lowPriority})</span>
              <div className="p-track">
                <div className="p-fill green" style={{ width: `${total ? (lowPriority / total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <h3 className="analytics-card-title">⚡ Focus Health</h3>
          <div className="health-metrics">
            <div className="health-item">
              <span className="health-icon">⚠️</span>
              <div>
                <strong className="health-num">{overdueCount}</strong>
                <span className="health-text">Overdue Tasks</span>
              </div>
            </div>
            <div className="health-item">
              <span className="health-icon">🔥</span>
              <div>
                <strong className="health-num">{completed > 0 ? 'Active' : 'Get Started'}</strong>
                <span className="health-text">Streak Status</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="analytics-card">
        <h3 className="analytics-card-title">🗂️ Category Breakdown</h3>
        <div className="cat-breakdown-list">
          {categories.map((cat) => {
            const catTodos = todos.filter((t) => (t.category || 'personal') === cat.id)
            const catCompleted = catTodos.filter((t) => t.completed).length
            const catPct = catTodos.length === 0 ? 0 : Math.round((catCompleted / catTodos.length) * 100)

            return (
              <div key={cat.id} className="cat-breakdown-item">
                <div className="cat-bd-meta">
                  <span>{cat.icon} {cat.name}</span>
                  <span>{catCompleted}/{catTodos.length} ({catPct}%)</span>
                </div>
                <div className="cat-bd-track">
                  <div
                    className="cat-bd-fill"
                    style={{ width: `${catPct}%`, background: cat.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
