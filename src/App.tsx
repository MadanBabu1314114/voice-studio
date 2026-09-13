import { useEffect, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { firebaseConfigError } from './lib/firebase'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Studio from './pages/Studio'
import './theme.css'

function ThemeInit() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0a0f' : '#f4f2ec')
    localStorage.setItem('theme', theme)
  }, [theme])
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} title="Toggle theme">
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  )
}

function Nav() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  return (
    <div className="wrap">
      <div className="topbar">
        <div className="logo">🎙️</div>
        <div>
          <h1>Voice Studio — AI Text to Audio</h1>
          <div className="sub">Fish S2.1 · Batch · {user ? user.email : 'not signed in'}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <ThemeInit />
          {user ? (
            <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); nav('/login') }}>Logout</button>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" to="/login" style={{ textDecoration: 'none' }}>Login</Link>
              <Link className="btn btn-ghost btn-sm" to="/signup" style={{ textDecoration: 'none' }}>Signup</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const nav = useNavigate()
  useEffect(() => {
    if (!loading && !user) nav('/login')
  }, [user, loading, nav])
  if (loading) return <div className="wrap"><div className="glass">Loading…</div></div>
  if (!user) return null
  return <>{children}</>
}

export default function App() {
  if (firebaseConfigError) {
    return (
      <div className="wrap">
        <div className="glass" style={{ maxWidth: 560, margin: '10vh auto' }}>
          <h1>Firebase not configured</h1>
          <p className="err">{firebaseConfigError}</p>
          <p className="kbd">Docker: run <code>docker compose up --build</code> (defaults are now baked in). To override: set VITE_FIREBASE_* in .env or compose args and rebuild — Vite bakes env at build time, so a restart alone is not enough.</p>
        </div>
      </div>
    )
  }
  return (
    <AuthProvider>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Guard><Studio /></Guard>} />
      </Routes>
    </AuthProvider>
  )
}
