import { supabase, supabaseConfigured } from '@/lib/supabase'
import { requireTab } from '@/lib/auth'
import { isRole, roleLabel } from '@/lib/access'
import { InviteForm, UserControls } from './AdminControls'

export const dynamic = 'force-dynamic'

// Users & Activity — Admins only. Invite people, set their role, switch them off,
// make reset links, and see who did what. Nobody is ever deleted.

type Profile = { user_id: string; email: string; name: string | null; role: string; active: boolean; created_at: string }
type Activity = {
  id: number
  at: string
  user_email: string | null
  action: string
  entity: string | null
  entity_id: string | null
  detail: Record<string, any>
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' })

// One calm line describing an activity row's details.
function describe(a: Activity): string {
  const d = a.detail ?? {}
  if (a.entity === 'user') {
    if (d.from && d.to) return `${d.email}: ${roleLabel(d.from)} → ${roleLabel(d.to)}`
    return [d.email, d.role ? roleLabel(d.role) : null].filter(Boolean).join(' · ')
  }
  if (d.title) {
    const changes = d.changes && typeof d.changes === 'object' ? Object.keys(d.changes) : []
    return changes.length ? `${d.title} — changed ${changes.join(', ')}` : String(d.title)
  }
  if (a.entity) return `${a.entity}${a.entity_id ? ` #${a.entity_id}` : ''}`
  return ''
}

async function load() {
  if (!supabaseConfigured) return { users: [] as Profile[], activity: [] as Activity[], error: null as string | null }
  const [u, a] = await Promise.all([
    supabase.from('profiles').select('user_id, email, name, role, active, created_at').order('created_at'),
    supabase.from('activity_log').select('id, at, user_email, action, entity, entity_id, detail').order('at', { ascending: false }).limit(100),
  ])
  return {
    users: (u.data ?? []) as Profile[],
    activity: (a.data ?? []) as Activity[],
    error: u.error?.message ?? a.error?.message ?? null,
  }
}

export default async function Admin() {
  const me = await requireTab('/admin')
  const { users, activity, error } = await load()

  return (
    <>
      <h1 className="ph">Users &amp; Activity 👥</h1>
      <p className="cap">Who can log in, what they can open, and who did what.</p>

      {error ? (
        <div className="banner">
          ⚠️ Couldn’t read the users tables: <b>{error}</b>. Run <code>supabase/users.sql</code> in the Supabase SQL Editor.
        </div>
      ) : null}

      <InviteForm />

      <p className="rowlabel">Team ({users.length})</p>
      {users.length === 0 ? (
        <div className="empty">No one has a login yet.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Status</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.user_id}>
                <td data-label="Person">
                  {u.name ? <><b>{u.name}</b><br /></> : null}
                  <span style={{ color: 'var(--dim)' }}>{u.email}</span>
                  {u.user_id === me.id ? <span className="pill" style={{ marginLeft: 6 }}>you</span> : null}
                </td>
                <td data-label="Role">{isRole(u.role) ? roleLabel(u.role) : u.role}</td>
                <td data-label="Status">
                  <span className={`pill ${u.active ? 'active' : 'rejected'}`}>{u.active ? 'active' : 'switched off'}</span>
                </td>
                <td data-label="Manage">
                  <UserControls userId={u.user_id} role={u.role} active={u.active} isMe={u.user_id === me.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="rowlabel">Activity (latest 100)</p>
      {activity.length === 0 ? (
        <div className="empty">Nothing logged yet.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {activity.map(a => (
              <tr key={a.id}>
                <td data-label="When">{when(a.at)}</td>
                <td data-label="Who">{a.user_email ?? '—'}</td>
                <td data-label="What">{a.action}</td>
                <td data-label="Details">{describe(a) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
