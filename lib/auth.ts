import 'server-only'
import crypto from 'crypto'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabase, supabaseConfigured, freshAuthClient } from './supabase'
import { SESSION_COOKIE, verifySession } from './session'
import { canSeeTab, isRole, type Role } from './access'

// 🔒 Don't edit — this keeps your robot safe.
// The data-access layer for logins. proxy.ts only checks that the cookie is
// genuine; THIS file decides who you are and what you may open, straight from the
// database, on every page and every action. Deactivate someone or change their
// role and the very next click reflects it.

export type User = { id: string; email: string; name: string | null; role: Role; active: boolean }

// Who is logged in right now (or null). Cached per request, so the layout and the
// page share one database read.
export const getUser = cache(async (): Promise<User | null> => {
  if (!supabaseConfigured) return null
  const uid = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!uid) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, email, name, role, active')
    .eq('user_id', uid)
    .maybeSingle()
  // A slow / unreachable database is NOT "logged out" — show an error and let
  // them retry, instead of bouncing a perfectly good login to /login.
  if (error) throw new Error(`Couldn't check your login right now (${error.message}). Refresh to try again.`)
  if (!data || !data.active || !isRole(data.role)) return null
  return { id: data.user_id, email: data.email, name: data.name, role: data.role, active: data.active }
})

// Every page calls this with its own path. Not logged in (or deactivated) →
// /api/logout clears the cookie and sends them to /login. Logged in but the role
// doesn't include this tab → back to the Dashboard.
export async function requireTab(href: string): Promise<User> {
  const user = await getUser()
  if (!user) redirect('/api/logout')
  if (!canSeeTab(user.role, href)) redirect('/')
  return user
}

// For server actions: returns the user, or null when they may not do this.
export async function actionUser(allowed?: Role[]): Promise<User | null> {
  const user = await getUser()
  if (!user) return null
  if (allowed && !allowed.includes(user.role)) return null
  return user
}

// Check an email + password against Supabase Auth. Returns the user id or null.
// Uses a throwaway client so the shared service_role client is never touched.
export async function checkPassword(email: string, password: string): Promise<string | null> {
  if (!supabaseConfigured || !email || !password) return null
  const client = freshAuthClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.user) return null
  await client.auth.signOut({ scope: 'local' }).catch(() => {})
  return data.user.id
}

// ------------------------------------------------------------
// The activity log — "who did what". Never throws: a failed log line must never
// take down the action it was recording.
// ------------------------------------------------------------
export async function logActivity(
  user: Pick<User, 'id' | 'email'> | null,
  action: string,
  entity?: string,
  entityId?: string | number | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  if (!supabaseConfigured) return
  const { error } = await supabase.from('activity_log').insert({
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    action,
    entity: entity ?? null,
    entity_id: entityId == null ? null : String(entityId),
    detail,
  })
  if (error) console.error('[CFO] logActivity failed:', error.message)
}

// ------------------------------------------------------------
// One-time links (invite + reset password). The link carries a random token;
// only its SHA-256 hash is stored. A new link for the same person cancels any
// older unused one.
// ------------------------------------------------------------
export type TokenPurpose = 'invite' | 'reset'
const TOKEN_HOURS: Record<TokenPurpose, number> = { invite: 24 * 7, reset: 24 }

export const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex')

export async function createToken(userId: string, purpose: TokenPurpose, createdBy: string | null): Promise<string> {
  const nowISO = new Date().toISOString()
  await supabase.from('auth_tokens').update({ used_at: nowISO }).eq('user_id', userId).is('used_at', null)
  const raw = crypto.randomBytes(32).toString('base64url')
  const { error } = await supabase.from('auth_tokens').insert({
    token_hash: hashToken(raw),
    user_id: userId,
    purpose,
    expires_at: new Date(Date.now() + TOKEN_HOURS[purpose] * 3600 * 1000).toISOString(),
    created_by: createdBy,
  })
  if (error) throw new Error(error.message)
  return raw
}

// The full link to send, built from the address the admin is using right now.
export async function setPasswordLink(raw: string): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}/set-password?token=${encodeURIComponent(raw)}`
}

// Look up a still-valid token (unused, unexpired). Does NOT use it up.
export async function findToken(raw: string) {
  if (!supabaseConfigured || !raw) return null
  const { data } = await supabase
    .from('auth_tokens')
    .select('id, user_id, purpose')
    .eq('token_hash', hashToken(raw))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  return data as { id: number; user_id: string; purpose: TokenPurpose } | null
}

// Use a token up. Conditional on used_at still being null, so it works once only.
export async function useToken(id: number): Promise<boolean> {
  const { data } = await supabase
    .from('auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', id)
    .is('used_at', null)
    .select('id')
  return (data ?? []).length === 1
}
