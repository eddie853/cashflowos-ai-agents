'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

// Where an invite / reset link lands. The person chooses their own password, then
// they're logged straight in. The link works once and expires (7 days for an
// invite, 24 hours for a reset).
function SetPasswordForm() {
  const token = useSearchParams().get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError("The two passwords don't match.")
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.ok) {
        window.location.href = '/'
        return
      }
      setError(body.reason || "That didn't work. Try again.")
    } catch {
      setError('Something went wrong reaching the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand" style={{ marginBottom: 8 }}>
          <img className="logo" src="/icons/logo.png" alt="" /> LuxeVow Weddings
        </div>
        <h1 className="ph" style={{ fontSize: 18 }}>Choose your password</h1>
        {!token ? (
          <p className="login-error">This link is incomplete. Ask your admin to send it again.</p>
        ) : (
          <>
            <p className="cap" style={{ margin: '4px 0 16px' }}>At least 8 characters. Only you will know it.</p>
            <input
              className="login-input"
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            <input
              className="login-input"
              type="password"
              autoComplete="new-password"
              placeholder="Type it again"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              style={{ marginTop: 10 }}
            />
            {error ? <p className="login-error">{error}</p> : null}
            <button
              className="btn"
              type="submit"
              disabled={busy || password.length < 8 || !confirm}
              style={{ width: '100%', marginTop: 12 }}
            >
              {busy ? 'Saving…' : 'Save password & log in'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}

export default function SetPassword() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  )
}
