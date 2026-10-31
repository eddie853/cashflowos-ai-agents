import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkPassword, logActivity } from '@/lib/auth'
import { SESSION_COOKIE, signSession, sessionCookieOptions } from '@/lib/session'

// 🔒 Don't edit — this keeps your robot safe.
// Email + password login. Supabase Auth checks the password (it stores only a
// hash). Then we check the person has an ACTIVE profile, and hand back a signed
// cookie holding just their id (lib/session.ts). One vague error for every
// failure, so the form never reveals which emails have accounts.

export const runtime = 'nodejs'

const NOPE = { ok: false, reason: 'Wrong email or password, or this account is switched off.' }

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password) return NextResponse.json(NOPE, { status: 401 })

  const uid = await checkPassword(email, password)
  if (!uid) return NextResponse.json(NOPE, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, email, active')
    .eq('user_id', uid)
    .maybeSingle()
  if (!profile || !profile.active) return NextResponse.json(NOPE, { status: 401 })

  await logActivity({ id: profile.user_id, email: profile.email }, 'logged in')

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, signSession(uid), sessionCookieOptions)
  return res
}
