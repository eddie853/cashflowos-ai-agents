import './globals.css'
import type { Metadata, Viewport } from 'next'
import Nav from './_components/Nav'
import BottomNav from './_components/BottomNav'
import ConnStatus from './_components/ConnStatus'
import { TABS } from './_components/tabs'
import { getPendingCount } from '@/lib/records'
import { getUser } from '@/lib/auth'
import { canApprove, canSeeTab, roleLabel } from '@/lib/access'

export const metadata: Metadata = {
  title: 'LuxeVow Weddings',
  description: 'Your Money Robot — one AI HQ for the whole business.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'LuxeVow', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
}

// theme-color drives the phone status-bar tint when installed to the home screen.
export const viewport: Viewport = {
  themeColor: '#FAF7F2',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Only used to SHOW the right menu. Layouts don't re-run on every click, so the
  // real lock is requireTab() at the top of each page (lib/auth.ts).
  const user = await getUser()

  // Logged out (login + set-password screens): no sidebar, no bottom bar.
  if (!user) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    )
  }

  const allowed = TABS.map(t => t.href).filter(href => canSeeTab(user.role, href))
  const pending = canApprove(user.role) ? await getPendingCount() : 0
  return (
    <html lang="en">
      <body>
        <div className="app">
          {/* Desktop sidebar — hidden on phones (BottomNav takes over ≤768px). */}
          <aside className="side">
            <div className="brand"><img className="logo" src="/icons/logo.png" alt="" /> LuxeVow Weddings</div>
            <Nav pendingCount={pending} allowed={allowed} />
            <div className="userbar">
              <p className="who">{user.name || user.email}</p>
              <p className="role">{roleLabel(user.role)} · <a href="/api/logout">Log out</a></p>
            </div>
          </aside>
          <main className="main"><ConnStatus />{children}</main>
        </div>
        {/* Phone bottom bar — hidden on desktop. */}
        <BottomNav allowed={allowed} />
      </body>
    </html>
  )
}
