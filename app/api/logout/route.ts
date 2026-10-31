import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

// Log out: clear the cookie and go to /login. Also where requireTab() sends a
// deactivated or stale session, so the cookie never outlives the account.
export function GET(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url))
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
