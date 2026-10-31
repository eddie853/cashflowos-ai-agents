import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { findToken, useToken, logActivity } from '@/lib/auth'
import { SESSION_COOKIE, signSession, sessionCookieOptions } from '@/lib/session'

// 🔒 Don't edit — this keeps your robot safe.
// The other end of an invite / reset link: the person picks their own password.
// The token is used up FIRST (once-only), then the password is saved in Supabase
// Auth, then they're logged straight in.

export const runtime = 'nodejs'

const MIN_PASSWORD = 8

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const raw = typeof body?.token === 'string' ? body.token : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ ok: false, reason: `Use at least ${MIN_PASSWORD} characters.` }, { status: 400 })
  }

  const expired = { ok: false, reason: 'This link has expired or was already used. Ask your admin for a new one.' }
  const token = await findToken(raw)
  if (!token) return NextResponse.json(expired, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, email, active')
    .eq('user_id', token.user_id)
    .maybeSingle()
  if (!profile || !profile.active) {
    return NextResponse.json({ ok: false, reason: 'This account is switched off. Ask your admin.' }, { status: 403 })
  }

  if (!(await useToken(token.id))) return NextResponse.json(expired, { status: 400 })

  const { error } = await supabase.auth.admin.updateUserById(profile.user_id, { password })
  if (error) {
    console.error('[CFO] set password failed:', error.message)
    return NextResponse.json(
      { ok: false, reason: `Couldn't save that password (${error.message}). Ask your admin for a new link.` },
      { status: 400 },
    )
  }

  const who = { id: profile.user_id, email: profile.email }
  await logActivity(who, token.purpose === 'invite' ? 'accepted invite' : 'reset password')

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, signSession(profile.user_id), sessionCookieOptions)
  return res
}
