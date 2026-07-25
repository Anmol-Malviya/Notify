import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Notify — Smart Todo & Push Alerts',
    short_name: 'Notify',
    description:
      'A beautiful PWA to manage your todos and receive push notifications',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f0c29',
    theme_color: '#8b5cf6',
    categories: ['productivity', 'utilities'],
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
