'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_GROUPS } from './tabs'

// The desktop sidebar tabs, grouped under micro-cap section labels. The tab list
// lives in ./tabs.ts. `allowed` (from the layout) hides the tabs this person's
// role can't open; a group with nothing left in it disappears too.
//
// `pendingCount` is an optional seam: pass it (from a server component that
// already knows the number) to show the clay 🙋 badge on Approvals. We never
// fetch here — a client nav must stay free of its own server round-trips.
export default function Nav({ pendingCount, allowed }: { pendingCount?: number; allowed: string[] }) {
  const path = usePathname()
  return (
    <nav className="nav">
      {NAV_GROUPS.map(group => {
        const tabs = group.tabs.filter(t => allowed.includes(t.href))
        if (tabs.length === 0) return null
        return (
          <div className="nav-group" key={group.label}>
            <p className="nav-label">{group.label}</p>
            {tabs.map(t => (
              <Link key={t.href} href={t.href} className={path === t.href ? 'active' : ''}>
                <span>{t.label}</span>
                {t.href === '/approvals' && pendingCount ? (
                  <span className="nav-badge" aria-label={`${pendingCount} pending`}>{pendingCount}</span>
                ) : null}
              </Link>
            ))}
          </div>
        )
      })}
    </nav>
  )
}
