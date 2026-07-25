import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Notify — Smart Todo & Push Alerts',
  description:
    'A beautiful Progressive Web App to manage your tasks and receive push notifications. Install on Android for a native app experience.',
  keywords: ['todo', 'task manager', 'push notifications', 'PWA', 'productivity'],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Notify',
  },
  openGraph: {
    title: 'Notify — Smart Todo & Push Alerts',
    description: 'Manage todos and receive push notifications',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#F4F3FF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icon-512x512.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  )
}
