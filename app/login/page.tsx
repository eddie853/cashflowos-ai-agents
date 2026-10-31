'use client'
import { useState } from 'react'

// The lock screen: email + password. On success the server sets the login cookie
// and we send you to your HQ. Excluded from the gate in proxy.ts (you can't log in
// through a locked login page). No sign-up here — an Admin invites you.
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
        <h1 className="ph" style={{ fontSize: 18 }}>Log in</h1>
        <p className="cap" style={{ margin: '4px 0 16px' }}>
          No account? Ask your admin for an invite link.
        </p>
        <input
          className="login-input"
          type="email"
          autoComplete="username"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoFocus
        />
        <input
          className="login-input"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ marginTop: 10 }}
        />
        {error ? <p className="login-error">{error}</p> : null}
        <button className="btn" type="submit" disabled={busy || !email || !password} style={{ width: '100%', marginTop: 12 }}>
          {busy ? 'Checking…' : 'Log in'}
        </button>
        <p className="cap" style={{ margin: '12px 0 0', fontSize: 12 }}>
          Forgot your password? Your admin can send you a reset link.
        </p>
      </form>
    </div>
  )
}
