import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="wrap">
      <form className="glass authbox" onSubmit={async (e) => {
        e.preventDefault(); setErr(''); setBusy(true)
        try { await login(email.trim(), pass); nav('/') } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
      }}>
        <h1>Welcome back</h1>
        <p className="sub">Login with email + password (Firebase).</p>
        <label className="lbl">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        <label className="lbl">Password</label>
        <input type="password" required value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        {err && <p className="err">{err}</p>}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn btn-gold" disabled={busy}>{busy ? 'Logging in…' : 'Login'}</button>
        </div>
        <p className="kbd">No account? <Link to="/signup">Create one</Link></p>
      </form>
    </div>
  )
}
