'use client'

import { useState, useRef } from 'react'
import { UserProfile, Theme, Todo } from '../types'

interface ProfileViewProps {
  userProfile: UserProfile
  theme: Theme
  onUpdateProfile: (profile: UserProfile) => void
  onChangeTheme: (theme: Theme) => void
  onOpenNotifSheet: () => void
  todos: Todo[]
  onExportData: () => void
  onImportData: (todos: Todo[]) => void
  onClearCompleted: () => void
  onResetData: () => void
}

export function ProfileView({
  userProfile,
  theme,
  onUpdateProfile,
  onChangeTheme,
  onOpenNotifSheet,
  todos,
  onExportData,
  onImportData,
  onClearCompleted,
  onResetData,
}: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(userProfile.name)
  const [title, setTitle] = useState(userProfile.title)
  const [avatar, setAvatar] = useState(userProfile.avatar)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const avatars = ['🧑‍💻', '👩‍🎨', '🚀', '⚡', '👑', '🦸‍♂️', '🧘‍♀️', '🦁', '🌟', '🦄']

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdateProfile({ name: name.trim() || 'User', title: title.trim() || 'Productivity Master', avatar })
    setIsEditing(false)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string)
        if (Array.isArray(parsed)) {
          onImportData(parsed)
          alert(`Successfully imported ${parsed.length} tasks!`)
        } else {
          alert('Invalid backup format. Expected JSON array of tasks.')
        }
      } catch (err) {
        alert('Failed to parse backup file.')
      }
    }
    reader.readAsText(file)
  }

  const completedCount = todos.filter((t) => t.completed).length

  return (
    <div className="profile-view">
      {/* Profile Header Card */}
      <div className="profile-hero-card">
        <div className="profile-avatar-wrap">
          <span className="profile-avatar">{userProfile.avatar}</span>
          <button className="btn-edit-avatar" onClick={() => setIsEditing(true)} type="button" aria-label="Edit Profile">
            ✏️
          </button>
        </div>

        <div className="profile-info">
          <h2 className="profile-name">{userProfile.name}</h2>
          <p className="profile-user-title">{userProfile.title}</p>
        </div>

        <div className="profile-quick-stats">
          <div className="p-stat">
            <span className="p-stat-val">{todos.length}</span>
            <span className="p-stat-lbl">Tasks</span>
          </div>
          <div className="p-stat">
            <span className="p-stat-val">{completedCount}</span>
            <span className="p-stat-lbl">Completed</span>
          </div>
          <div className="p-stat">
            <span className="p-stat-val">{todos.length ? Math.round((completedCount / todos.length) * 100) : 100}%</span>
            <span className="p-stat-lbl">Accuracy</span>
          </div>
        </div>
      </div>

      {/* Settings Section: Appearance */}
      <div className="settings-card">
        <h3 className="settings-section-title">🎨 Appearance & Theme</h3>
        <p className="settings-section-sub">Choose interface color mode</p>

        <div className="theme-toggle-grid">
          {(['light', 'dark', 'system'] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`theme-option-btn ${theme === t ? 'active' : ''}`}
              onClick={() => onChangeTheme(t)}
            >
              <span className="theme-icon">
                {t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '💻'}
              </span>
              <span className="theme-label">
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Settings Section: Notifications */}
      <div className="settings-card">
        <h3 className="settings-section-title">🔔 Notifications</h3>
        <p className="settings-section-sub">Manage alerts for tasks and timers</p>

        <button
          className="btn-settings-action"
          onClick={onOpenNotifSheet}
          type="button"
        >
          <span>🔔 Configure Push Notifications</span>
          <span className="arrow-right">›</span>
        </button>
      </div>

      {/* Settings Section: Data & Backup */}
      <div className="settings-card">
        <h3 className="settings-section-title">💾 Data Backup & Restore</h3>
        <p className="settings-section-sub">Export or import your tasks anytime</p>

        <div className="data-actions-row">
          <button className="btn-secondary-action" onClick={onExportData} type="button">
            📤 Export JSON
          </button>

          <button
            className="btn-secondary-action"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            📥 Import JSON
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            style={{ display: 'none' }}
          />
        </div>

        {completedCount > 0 && (
          <button
            className="btn-danger-action"
            onClick={onClearCompleted}
            type="button"
            style={{ marginTop: 12 }}
          >
            🧹 Clear {completedCount} Completed Task(s)
          </button>
        )}

        <button
          className="btn-danger-action reset-btn"
          onClick={onResetData}
          type="button"
          style={{ marginTop: 8 }}
        >
          ⚠️ Reset All Data
        </button>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsEditing(false)}>
          <div className="modal">
            <div className="modal-drag" />
            <div className="modal-header">
              <h2 className="modal-title">✏️ Edit Profile</h2>
              <button className="modal-close" onClick={() => setIsEditing(false)}>×</button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label className="form-label">Avatar</label>
                <div className="icon-selector-grid">
                  {avatars.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={`icon-choice ${avatar === a ? 'active' : ''}`}
                      onClick={() => setAvatar(a)}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  className="form-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Title / Role</label>
                <input
                  className="form-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary">
                Save Profile
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
