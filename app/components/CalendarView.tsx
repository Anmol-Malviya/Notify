'use client'

import { useState } from 'react'
import { Todo, Category } from '../types'

interface CalendarViewProps {
  todos: Todo[]
  categories: Category[]
  onToggleTodo: (id: string) => void
  onDeleteTodo: (id: string) => void
  onEditTodo: (todo: Todo) => void
  onAddTaskForDate: (dateStr: string) => void
}

export function CalendarView({
  todos,
  categories,
  onToggleTodo,
  onDeleteTodo,
  onEditTodo,
  onAddTaskForDate,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }
  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)
  }

  // Days in current month
  const firstDayIndex = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Map tasks by date YYYY-MM-DD
  const tasksByDate = todos.reduce<Record<string, Todo[]>>((acc, todo) => {
    if (todo.dueDate) {
      if (!acc[todo.dueDate]) acc[todo.dueDate] = []
      acc[todo.dueDate].push(todo)
    }
    return acc
  }, {})

  const selectedDateTasks = tasksByDate[selectedDate] || []

  // Formatting selected date title
  const formattedSelectedDate = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : ''

  const getCategory = (catId: string) => categories.find((c) => c.id === catId)

  return (
    <div className="calendar-view">
      {/* Calendar Header Controls */}
      <div className="calendar-header-card">
        <div className="calendar-month-selector">
          <button className="cal-nav-btn" onClick={prevMonth} type="button" aria-label="Previous Month">‹</button>
          <div className="cal-month-title">
            <span className="cal-month-name">{monthNames[month]}</span>
            <span className="cal-year-name">{year}</span>
          </div>
          <button className="cal-nav-btn" onClick={nextMonth} type="button" aria-label="Next Month">›</button>
        </div>
        <button className="cal-today-btn" onClick={goToToday} type="button">Today</button>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid-card">
        {/* Days of week */}
        <div className="cal-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="cal-weekday">{day}</div>
          ))}
        </div>

        {/* Days matrix */}
        <div className="cal-days-matrix">
          {/* Leading blank slots */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`blank-${i}`} className="cal-day empty" />
          ))}

          {/* Days of month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
            const dayTasks = tasksByDate[dateStr] || []
            const isSelected = selectedDate === dateStr
            const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
            const isToday = todayStr === dateStr

            const hasOverdue = dayTasks.some((t) => !t.completed && new Date(`${t.dueDate}T${t.dueTime || '23:59'}`) < new Date())
            const hasPending = dayTasks.some((t) => !t.completed)
            const allCompleted = dayTasks.length > 0 && dayTasks.every((t) => t.completed)

            return (
              <button
                key={dateStr}
                type="button"
                className={`cal-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => setSelectedDate(dateStr)}
              >
                <span className="cal-day-num">{dayNum}</span>
                {dayTasks.length > 0 && (
                  <div className="cal-day-dots">
                    {hasOverdue ? (
                      <span className="cal-dot red" />
                    ) : hasPending ? (
                      <span className="cal-dot purple" />
                    ) : allCompleted ? (
                      <span className="cal-dot green" />
                    ) : null}
                    <span className="cal-count-badge">{dayTasks.length}</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Day Agenda */}
      <div className="calendar-agenda">
        <div className="agenda-header">
          <div>
            <h3 className="agenda-title">📅 {formattedSelectedDate}</h3>
            <p className="agenda-subtitle">{selectedDateTasks.length} task(s) scheduled</p>
          </div>
          <button
            className="btn-add-cal-task"
            onClick={() => onAddTaskForDate(selectedDate)}
            type="button"
          >
            + Add Task
          </button>
        </div>

        {selectedDateTasks.length === 0 ? (
          <div className="agenda-empty">
            <span className="agenda-empty-icon">🌱</span>
            <p>No tasks scheduled for this day</p>
            <button
              className="btn-link"
              onClick={() => onAddTaskForDate(selectedDate)}
              type="button"
            >
              + Create task for {formattedSelectedDate}
            </button>
          </div>
        ) : (
          <div className="agenda-list">
            {selectedDateTasks.map((todo) => {
              const cat = getCategory(todo.category)
              return (
                <div
                  key={todo.id}
                  className={`agenda-item priority-${todo.priority} ${todo.completed ? 'completed' : ''}`}
                  onClick={() => onEditTodo(todo)}
                >
                  <button
                    className={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onToggleTodo(todo.id) }}
                    type="button"
                  />
                  <div className="agenda-item-body">
                    <div className="agenda-item-title">{todo.title}</div>
                    <div className="agenda-item-meta">
                      {cat && (
                        <span className="cat-chip-sm" style={{ background: cat.bgColor, color: cat.color }}>
                          {cat.icon} {cat.name}
                        </span>
                      )}
                      {todo.dueTime && <span className="time-badge">⏰ {todo.dueTime}</span>}
                    </div>
                  </div>
                  <button
                    className="agenda-delete-btn"
                    onClick={(e) => { e.stopPropagation(); onDeleteTodo(todo.id) }}
                    type="button"
                  >
                    🗑️
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
