'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import MoreSheet from './MoreSheet'
import { TABS } from './tabs'

// 👉 The phone bottom bar (shown ≤768px). Four thumb-size primary tabs + a
//    "More" button that opens the slide-up sheet with everything else, so every
//    section this person may open stays reachable on a phone. PRIMARY is the
//    preferred bar order; tabs a role can't see drop out and the next ones move up.
const PRIMARY = ['/', '/cash-in', '/cash-out', '/approvals']

export default function BottomNav({ allowed }: { allowed: string[] }) {
  const path = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const mine = TABS.filter(t => allowed.includes(t.href))
  const ordered = [
    ...PRIMARY.map(href => mine.find(t => t.href === href)).filter(t => t !== undefined),
    ...mine.filter(t => !PRIMARY.includes(t.href)),
  ]
  const bar = ordered.slice(0, 4)
  const more = ordered.slice(4)
  const moreActive = more.some(t => t.href === path)

  return (
    <>
      <nav className="bottomnav">
        {bar.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={path === t.href ? 'active' : ''}
            onClick={() => setMoreOpen(false)}
          >
            <span className="ico" aria-hidden="true">{t.ico}</span>
            {t.label}
          </Link>
        ))}
        <button
          type="button"
          className={`bn-more${moreActive ? ' active' : ''}`}
          onClick={() => setMoreOpen(v => !v)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <span className="ico" aria-hidden="true">⋯</span>
          More
        </button>
      </nav>
      <MoreSheet tabs={more} open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
