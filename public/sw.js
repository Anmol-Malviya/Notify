// Notify PWA Service Worker — v2 (with scheduled timer notifications)

// ── Scheduled Notifications Map ───────────────────────────
// Stores { timeoutId } keyed by todo id
const scheduledNotifications = new Map()

// ── Message Handler (from page) ───────────────────────────
self.addEventListener('message', function (event) {
  const { type } = event.data || {}

  if (type === 'SCHEDULE_NOTIFICATION') {
    const { id, title, body, timestamp } = event.data
    const delay = timestamp - Date.now()

    // Cancel any existing timer for this todo
    if (scheduledNotifications.has(id)) {
      clearTimeout(scheduledNotifications.get(id))
      scheduledNotifications.delete(id)
    }

    if (delay <= 0) {
      // Already past due — fire immediately
      self.registration.showNotification(title, {
        body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'todo-' + id,
        renotify: true,
        data: { url: '/', todoId: id },
        actions: [
          { action: 'open', title: '📋 Open App' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      })
      return
    }

    // Schedule for the future
    const timeoutId = setTimeout(function () {
      self.registration.showNotification(title, {
        body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'todo-' + id,
        renotify: true,
        data: { url: '/', todoId: id },
        actions: [
          { action: 'open', title: '📋 Open App' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      })
      scheduledNotifications.delete(id)
    }, delay)

    scheduledNotifications.set(id, timeoutId)
  }

  if (type === 'CANCEL_NOTIFICATION') {
    const { id } = event.data
    if (scheduledNotifications.has(id)) {
      clearTimeout(scheduledNotifications.get(id))
      scheduledNotifications.delete(id)
    }
  }

  if (type === 'CANCEL_ALL_NOTIFICATIONS') {
    scheduledNotifications.forEach(function (timeoutId) {
      clearTimeout(timeoutId)
    })
    scheduledNotifications.clear()
  }
})

// ── Push Event (from VAPID / server) ─────────────────────
self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        url: data.url || '/',
      },
      actions: [
        { action: 'open', title: '📋 Open App' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

// ── Notification Click ────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  if (event.action === 'dismiss') return

  const urlToOpen = event.notification.data?.url || '/'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

// ── Cache Static Assets ───────────────────────────────────
const CACHE_NAME = 'notify-v2'
const urlsToCache = ['/', '/icon-192x192.png', '/icon-512x512.png']

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(urlsToCache)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then(function (response) {
      return response || fetch(event.request)
    })
  )
})
