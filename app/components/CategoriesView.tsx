'use client'

import { useState } from 'react'
import { Category, Todo } from '../types'

interface CategoriesViewProps {
  categories: Category[]
  todos: Todo[]
  onSelectCategory: (catId: string) => void
  onAddCategory: (cat: Omit<Category, 'id'>) => void
}

export function CategoriesView({
  categories,
  todos,
  onSelectCategory,
  onAddCategory,
}: CategoriesViewProps) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📌')
  const [color, setColor] = useState('#7B61FF')

  const availableIcons = ['💼', '👤', '❤️', '🛒', '💰', '💡', '🎓', '✈️', '🎯', '🎨', '🏋️', '🎧', '🏡', '📌']
  const availableColors = ['#7B61FF', '#4FC3F7', '#00D68F', '#FF8C42', '#FFD700', '#FF3D71', '#AB47BC', '#EC407A']

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16) || 123
      const g = parseInt(hex.slice(3, 5), 16) || 97
      const b = parseInt(hex.slice(5, 7), 16) || 255
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
    onAddCategory({
      name: name.trim(),
      icon,
      color,
      bgColor: hexToRgba(color, 0.12),
    })
    setName('')
    setShowAddModal(false)
  }

  return (
    <div className="categories-view">
      {/* Overview Card */}
      <div className="categories-header">
        <div>
          <h2 className="cat-page-title">🗂️ Categories</h2>
          <p className="cat-page-subtitle">Organize your tasks by life area</p>
        </div>
        <button
          className="btn-primary-sm"
          onClick={() => setShowAddModal(true)}
          type="button"
        >
          + New Category
        </button>
      </div>

      {/* Grid of Categories */}
      <div className="categories-grid">
        {categories.map((cat) => {
          const catTodos = todos.filter((t) => (t.category || 'personal') === cat.id)
          const total = catTodos.length
          const completed = catTodos.filter((t) => t.completed).length
          const pct = total === 0 ? 0 : Math.round((completed / total) * 100)

          return (
            <div
              key={cat.id}
              className="category-card"
              style={{ borderLeftColor: cat.color }}
              onClick={() => onSelectCategory(cat.id)}
            >
              <div className="cat-card-top">
                <div className="cat-icon-wrap" style={{ background: cat.bgColor, color: cat.color }}>
                  {cat.icon}
                </div>
                <div className="cat-count-pill">{total} tasks</div>
              </div>

              <div className="cat-card-info">
                <h3 className="cat-name">{cat.name}</h3>
                <div className="cat-subtext">{completed} of {total} completed</div>
              </div>

              {/* Progress bar */}
              <div className="cat-progress-bar-track">
                <div
                  className="cat-progress-bar-fill"
                  style={{ width: `${pct}%`, background: cat.color }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Custom Category Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal">
            <div className="modal-drag" />
            <div className="modal-header">
              <h2 className="modal-title">✨ Create Category</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Side Project"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Choose Icon</label>
                <div className="icon-selector-grid">
                  {availableIcons.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      className={`icon-choice ${icon === ic ? 'active' : ''}`}
                      onClick={() => setIcon(ic)}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Choose Theme Color</label>
                <div className="color-selector-grid">
                  {availableColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-choice ${color === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-primary">
                Create Category
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
