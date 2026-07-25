export type Priority = 'high' | 'medium' | 'low'
export type Filter = 'all' | 'active' | 'completed' | 'overdue'
export type NavTab = 'home' | 'calendar' | 'categories' | 'analytics' | 'profile'
export type Theme = 'light' | 'dark' | 'system'
export type SortOption = 'dueDate' | 'priority' | 'createdAt' | 'title'

export interface SubTask {
  id: string
  title: string
  completed: boolean
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  bgColor: string
}

export interface Todo {
  id: string
  title: string
  description: string
  priority: Priority
  category: string
  dueDate: string
  dueTime: string
  completed: boolean
  createdAt: number
  subtasks?: SubTask[]
}

export interface UserProfile {
  name: string
  avatar: string
  title: string
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work', name: 'Work', icon: '💼', color: '#7B61FF', bgColor: 'rgba(123, 97, 255, 0.12)' },
  { id: 'personal', name: 'Personal', icon: '👤', color: '#4FC3F7', bgColor: 'rgba(79, 195, 247, 0.12)' },
  { id: 'health', name: 'Health', icon: '❤️', color: '#00D68F', bgColor: 'rgba(0, 214, 143, 0.12)' },
  { id: 'shopping', name: 'Shopping', icon: '🛒', color: '#FF8C42', bgColor: 'rgba(255, 140, 66, 0.12)' },
  { id: 'finance', name: 'Finance', icon: '💰', color: '#FFD700', bgColor: 'rgba(255, 215, 0, 0.12)' },
  { id: 'ideas', name: 'Ideas', icon: '💡', color: '#FF3D71', bgColor: 'rgba(255, 61, 113, 0.12)' },
]
