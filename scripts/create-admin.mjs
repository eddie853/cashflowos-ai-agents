// Make the FIRST Admin (or rescue a locked-out one). Run once after users.sql.
// Usage:  npm run admin:create -- you@company.com "Your Name" https://YOUR-APP.vercel.app
// Prints a one-time link (valid 7 days). Open it and choose your own password —
// this script never sees or sets a real password.
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const [emailArg, name, base] = process.argv.slice(2)
const email = (emailArg ?? '').trim().toLowerCase()
if (!email || !base) {
  console.error('Usage: npm run admin:create -- you@company.com "Your Name" https://YOUR-APP.vercel.app')
  process.exit(1)
}

const url = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '').replace(/\/rest\/v\d+$/i, '')
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// 1) The login (Supabase Auth). Reuse it if this email already has one.
let uid = null
const created = await supabase.auth.admin.createUser({
  email,
  password: crypto.randomBytes(32).toString('base64url'),
  email_confirm: true,
})
if (created.data.user) {
  uid = created.data.user.id
} else {
  for (let page = 1; page <= 20 && !uid; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (!data?.users.length) break
    uid = data.users.find(u => (u.email ?? '').toLowerCase() === email)?.id ?? null
  }
}
if (!uid) {
  console.error(`❌ Couldn't create or find the login: ${created.error?.message}`)
  process.exit(1)
}

// 2) The profile: Admin, switched on.
const { error: pErr } = await supabase
  .from('profiles')
  .upsert({ user_id: uid, email, name: name || null, role: 'admin', active: true }, { onConflict: 'user_id' })
if (pErr) {
  console.error(`❌ Couldn't save the profile: ${pErr.message}. Did you run supabase/users.sql?`)
  process.exit(1)
}

// 3) A one-time set-password link (only its hash is stored).
await supabase.from('auth_tokens').update({ used_at: new Date().toISOString() }).eq('user_id', uid).is('used_at', null)
const raw = crypto.randomBytes(32).toString('base64url')
const { error: tErr } = await supabase.from('auth_tokens').insert({
  token_hash: crypto.createHash('sha256').update(raw).digest('hex'),
  user_id: uid,
  purpose: 'invite',
  expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
})
if (tErr) {
  console.error(`❌ Couldn't make the link: ${tErr.message}`)
  process.exit(1)
}

await supabase.from('activity_log').insert({ user_email: email, action: 'admin created by script', entity: 'user', entity_id: uid })

console.log(`✅ ${email} is an Admin.`)
console.log(`Open this link to choose your password (works once, 7 days):`)
console.log(`${base.replace(/\/+$/, '')}/set-password?token=${raw}`)
