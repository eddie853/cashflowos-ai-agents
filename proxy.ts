import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/session'

// 🔒 Don't edit — this keeps your robot safe.
// The front door. In Next 16 this file is called `proxy.ts`.
// It does ONE quick check on every request: is there a genuine, unexpired login
// cookie? No → /login. It never touches the database (it runs on every prefetch
// too); the real "who are you and may you open this tab" check happens on each
// page via requireTab() in lib/auth.ts.
export function proxy(req: NextRequest) {
  if (verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

// The matcher protects every page EXCEPT the ones below, which must stay reachable
// without a login:
//   • /login, /api/login               — you can't log in through a locked login page
//   • /set-password, /api/set-password — the one-time invite / reset links
//   • /api/logout                      — clears a stale cookie, then goes to /login
//   • /api/telegram                    — Telegram's webhook (has its own secret-header guard)
//   • /api/cron-daily                  — the daily cron (has its own fail-closed Bearer guard)
//   • /manifest.webmanifest, /manifest.json, /icons/*, /favicon.ico, /_next/* — install + static assets
// A single missed exclusion here = a locked webhook, so keep this list exact.
export const config = {
  matcher: [
    '/((?!login|api/login|set-password|api/set-password|api/logout|api/telegram|api/cron-daily|manifest\\.webmanifest|manifest\\.json|icons|_next|favicon\\.ico).*)',
  ],
}
