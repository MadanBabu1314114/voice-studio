import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Signup() {
  const { signup } = useAuth()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="wrap">
      <form className="glass authbox" onSubmit={async (e) => {
        e.preventDefault(); setErr(''); setBusy(true)
        try { await signup(email.trim(), pass, name.trim()); nav('/') } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
      }}>
        <h1>Create account</h1>
        <p className="sub">Profile is saved to Realtime Database.</p>
        <label className="lbl">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
        <label className="lbl">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        <label className="lbl">Password (min 6 chars)</label>
        <input type="password" required minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        {err && <p className="err">{err}</p>}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn btn-gold" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
        </div>
        <p className="kbd">Have an account? <Link to="/login">Login</Link></p>
      </form>
    </div>
  )
}
