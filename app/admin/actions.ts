'use server'

// 🔒 Don't edit — this keeps your robot safe.
// The admin panel's buttons. Every one re-checks that the caller is an ACTIVE
// Admin (a hidden button is not a lock), writes one activity_log line, and never
// deletes anyone — deactivating keeps their history. Admins can't demote or
// deactivate THEMSELVES, which also guarantees there is always one Admin left.

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { actionUser, createToken, logActivity, setPasswordLink } from '@/lib/auth'
import { isRole, roleLabel } from '@/lib/access'

export type AdminResult = { ok: boolean; message: string; link?: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NOT_ADMIN: AdminResult = { ok: false, message: 'Only an Admin can do that.' }

const admin = () => actionUser(['admin'])

async function profileOf(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('user_id, email, role, active')
    .eq('user_id', userId)
    .maybeSingle()
  return data as { user_id: string; email: string; role: string; active: boolean } | null
}

// A login that exists in Supabase Auth but has no profile yet (e.g. a half-finished
// earlier invite). Small teams → one page of results is plenty, but we page anyway.
async function findAuthUserId(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data.users.length) return null
    const hit = data.users.find(u => (u.email ?? '').toLowerCase() === email)
    if (hit) return hit.id
  }
  return null
}

export async function inviteUser(_prev: AdminResult | null, form: FormData): Promise<AdminResult> {
  const me = await admin()
  if (!me) return NOT_ADMIN

  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const name = String(form.get('name') ?? '').trim().slice(0, 80) || null
  const role = form.get('role')
  if (!EMAIL.test(email)) return { ok: false, message: 'That email doesn’t look right.' }
  if (!isRole(role)) return { ok: false, message: 'Pick a role.' }

  const { data: existing } = await supabase.from('profiles').select('user_id').eq('email', email).maybeSingle()
  if (existing) return { ok: false, message: `${email} already has an account. Use “Reset link” on their row instead.` }

  // Create the login with a long random password nobody knows — the invite link
  // is how they set their own.
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomBytes(32).toString('base64url'),
    email_confirm: true,
  })
  const uid = data.user?.id ?? (error ? await findAuthUserId(email) : null)
  if (!uid) return { ok: false, message: `Couldn’t create the login: ${error?.message ?? 'unknown error'}` }

  const { error: pErr } = await supabase
    .from('profiles')
    .insert({ user_id: uid, email, name, role, created_by: me.id })
  if (pErr) return { ok: false, message: `Couldn’t save the profile: ${pErr.message}` }

  const link = await setPasswordLink(await createToken(uid, 'invite', me.id))
  await logActivity(me, 'invited user', 'user', uid, { email, role })
  revalidatePath('/admin')
  return {
    ok: true,
    message: `Invite ready for ${email} (${roleLabel(role)}). Send them this link — it works once and expires in 7 days.`,
    link,
  }
}

export async function setRole(userId: string, role: string): Promise<AdminResult> {
  const me = await admin()
  if (!me) return NOT_ADMIN
  if (userId === me.id) return { ok: false, message: 'You can’t change your own role — ask another Admin.' }
  if (!isRole(role)) return { ok: false, message: 'Unknown role.' }
  const target = await profileOf(userId)
  if (!target) return { ok: false, message: 'User not found.' }
  if (target.role === role) return { ok: true, message: 'No change.' }

  const { error } = await supabase.from('profiles').update({ role }).eq('user_id', userId)
  if (error) return { ok: false, message: error.message }
  await logActivity(me, 'changed role', 'user', userId, { email: target.email, from: target.role, to: role })
  revalidatePath('/admin')
  return { ok: true, message: `${target.email} is now ${roleLabel(role)}.` }
}

export async function setActive(userId: string, active: boolean): Promise<AdminResult> {
  const me = await admin()
  if (!me) return NOT_ADMIN
  if (userId === me.id) return { ok: false, message: 'You can’t switch yourself off — ask another Admin.' }
  const target = await profileOf(userId)
  if (!target) return { ok: false, message: 'User not found.' }

  const { error } = await supabase.from('profiles').update({ active }).eq('user_id', userId)
  if (error) return { ok: false, message: error.message }
  // Kill any unused invite / reset link so a switched-off person can't sneak back in.
  if (!active) {
    await supabase.from('auth_tokens').update({ used_at: new Date().toISOString() }).eq('user_id', userId).is('used_at', null)
  }
  await logActivity(me, active ? 'reactivated user' : 'deactivated user', 'user', userId, { email: target.email })
  revalidatePath('/admin')
  return { ok: true, message: active ? `${target.email} can log in again.` : `${target.email} is locked out.` }
}

export async function resetLink(userId: string): Promise<AdminResult> {
  const me = await admin()
  if (!me) return NOT_ADMIN
  const target = await profileOf(userId)
  if (!target) return { ok: false, message: 'User not found.' }
  if (!target.active) return { ok: false, message: 'Reactivate them first.' }

  const link = await setPasswordLink(await createToken(userId, 'reset', me.id))
  await logActivity(me, 'made reset link', 'user', userId, { email: target.email })
  revalidatePath('/admin')
  return { ok: true, message: `Reset link for ${target.email} — works once, expires in 24 hours.`, link }
}
