'use client'

// The interactive bits of the admin panel. They only call the 'use server'
// actions in ./actions.ts — every permission check happens there, not here.
import { useActionState, useState, useTransition } from 'react'
import { ROLES } from '@/lib/access'
import { inviteUser, resetLink, setActive, setRole, type AdminResult } from './actions'

// A one-time link with a Copy button, to paste into WhatsApp / Telegram.
function LinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="linkbox">
      <input readOnly value={link} onFocus={e => e.currentTarget.select()} aria-label="One-time link" />
      <button
        type="button"
        className="btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link)
            setCopied(true)
          } catch {
            setCopied(false)
          }
        }}
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  )
}

function Result({ r }: { r: AdminResult | null }) {
  if (!r) return null
  return (
    <div className={r.ok ? 'form-msg ok' : 'form-msg err'}>
      <p>{r.message}</p>
      {r.link ? <LinkBox link={r.link} /> : null}
    </div>
  )
}

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteUser, null)
  return (
    <form action={action} className="card form">
      <h3>Invite someone</h3>
      <div className="form-grid">
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required placeholder="name@company.com" />
        </label>
        <label className="field">
          <span>Name (optional)</span>
          <input name="name" type="text" maxLength={80} placeholder="Aisha" />
        </label>
        <label className="field">
          <span>Role</span>
          <select name="role" defaultValue="staff">
            {ROLES.map(r => (
              <option key={r.key} value={r.key}>{r.label} — {r.blurb}</option>
            ))}
          </select>
        </label>
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create invite link'}</button>
      <Result r={state} />
    </form>
  )
}

export function UserControls({ userId, role, active, isMe }: { userId: string; role: string; active: boolean; isMe: boolean }) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<AdminResult | null>(null)
  const run = (fn: () => Promise<AdminResult>) =>
    start(async () => {
      try {
        setResult(await fn())
      } catch {
        setResult({ ok: false, message: 'Something went wrong — refresh and try again.' })
      }
    })

  return (
    <div className="userctl">
      <div className="btnrow">
        <select
          aria-label="Role"
          value={role}
          disabled={pending || isMe || !active}
          onChange={e => run(() => setRole(userId, e.target.value))}
        >
          {ROLES.map(r => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
        <button className="btn ghost" type="button" disabled={pending || !active} onClick={() => run(() => resetLink(userId))}>
          Reset link
        </button>
        {isMe ? null : (
          <button
            className={active ? 'btn danger' : 'btn ghost'}
            type="button"
            disabled={pending}
            onClick={() => run(() => setActive(userId, !active))}
          >
            {active ? 'Deactivate' : 'Reactivate'}
          </button>
        )}
      </div>
      <Result r={result} />
    </div>
  )
}
