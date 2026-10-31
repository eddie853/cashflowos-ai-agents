import crypto from 'crypto'

// 🔒 Don't edit — this keeps your robot safe.
// The login cookie. It holds ONLY the user's id + an expiry, signed with an HMAC
// so it can't be forged or edited. No password, no role: the role and the
// active/inactive switch are re-read from the database on every page (lib/auth.ts),
// so a role change or a deactivation takes effect immediately.
//
// The signing key is derived from SUPABASE_SERVICE_ROLE_KEY (already a server-only
// secret), so there's no extra env var to set. Rotating that key logs everyone out.
// This file has no 'server-only' import because proxy.ts uses it too — but it must
// never be imported by a 'use client' component.

export const SESSION_COOKIE = 'cfo_session'
export const SESSION_DAYS = 14

type Claims = { uid: string; exp: number }

function signingKey(): Buffer | null {
  const secret = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!secret) return null
  return crypto.createHmac('sha256', secret).update('cfo-session-v1').digest()
}

export function signSession(uid: string): string {
  const key = signingKey()
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  const claims: Claims = { uid, exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 }
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const sig = crypto.createHmac('sha256', key).update(body).digest('base64url')
  return `${body}.${sig}`
}

// Returns the user id if the cookie is genuine and unexpired, else null. Never throws.
export function verifySession(token: string | undefined): string | null {
  const key = signingKey()
  if (!key || !token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const want = crypto.createHmac('sha256', key).update(body).digest()
  const got = Buffer.from(sig, 'base64url')
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Claims
    if (typeof claims.uid !== 'string' || typeof claims.exp !== 'number' || claims.exp < Date.now()) return null
    return claims.uid
  } catch {
    return null
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DAYS * 24 * 60 * 60,
}
