'use client'

import { NavTab, Theme, UserProfile } from '../types'

interface SideDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeTab: NavTab
  onSelectTab: (tab: NavTab) => void
  userProfile: UserProfile
  theme: Theme
  onChangeTheme: (theme: Theme) => void
  onOpenNotifSheet: () => void
}

export function SideDrawer({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  userProfile,
  theme,
  onChangeTheme,
  onOpenNotifSheet,
}: SideDrawerProps) {
  if (!isOpen) return null

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab)
    onClose()
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="side-drawer" role="dialog" aria-label="Main Menu">
        <div className="drawer-header">
          <div className="drawer-user-info">
            <span className="drawer-avatar">{userProfile.avatar}</span>
            <div>
              <div className="drawer-user-name">{userProfile.name}</div>
              <div className="drawer-user-title">{userProfile.title}</div>
            </div>
          </div>
          <button className="drawer-close-btn" onClick={onClose} aria-label="Close menu">
            ×
          </button>
        </div>

        <div className="drawer-nav">
          <div className="drawer-section-title">MENU</div>
          <button
            className={`drawer-link ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => handleTabClick('home')}
            type="button"
          >
            <span className="drawer-link-icon">🏠</span>
            <span>Home</span>
          </button>

          <button
            className={`drawer-link ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => handleTabClick('calendar')}
            type="button"
          >
            <span className="drawer-link-icon">📆</span>
            <span>Calendar</span>
          </button>

          <button
            className={`drawer-link ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => handleTabClick('categories')}
            type="button"
          >
            <span className="drawer-link-icon">🗂️</span>
            <span>Categories</span>
          </button>

          <button
            className={`drawer-link ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => handleTabClick('analytics')}
            type="button"
          >
            <span className="drawer-link-icon">📊</span>
            <span>Analytics</span>
          </button>

          <button
            className={`drawer-link ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => handleTabClick('profile')}
            type="button"
          >
            <span className="drawer-link-icon">👤</span>
            <span>Profile & Settings</span>
          </button>
        </div>

        <div className="drawer-divider" />

        <div className="drawer-settings-preview">
          <div className="drawer-section-title">APPEARANCE</div>
          <div className="drawer-theme-buttons">
            {(['light', 'dark', 'system'] as Theme[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`drawer-theme-chip ${theme === t ? 'active' : ''}`}
                onClick={() => onChangeTheme(t)}
              >
                {t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : '💻 Auto'}
              </button>
            ))}
          </div>

          <button
            className="drawer-notif-btn"
            onClick={() => {
              onClose()
              onOpenNotifSheet()
            }}
            type="button"
          >
            🔔 Push Notification Settings
          </button>
        </div>

        <div className="drawer-footer">
          <div className="drawer-app-brand">Notify PWA v2.0</div>
          <div className="drawer-app-tagline">Mobile-First Task Companion</div>
        </div>
      </div>
    </>
  )
}
