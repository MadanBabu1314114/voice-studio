import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { ref, set } from 'firebase/database'
import { auth, db, firebaseConfigError } from '../lib/firebase'

type AuthCtx = {
  user: User | null
  loading: boolean
  signup: (email: string, pass: string, name: string) => Promise<void>
  login: (email: string, pass: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth || firebaseConfigError) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const signup: AuthCtx['signup'] = async (email, pass, name) => {
    if (!auth || !db) throw new Error(firebaseConfigError || 'Firebase not configured')
    const cred = await createUserWithEmailAndPassword(auth, email, pass)
    if (name) await updateProfile(cred.user, { displayName: name })
    await set(ref(db, `users/${cred.user.uid}/profile`), {
      email,
      displayName: name || '',
      createdAt: new Date().toISOString(),
      theme: 'dark',
    })
  }
  const login: AuthCtx['login'] = async (email, pass) => {
    if (!auth) throw new Error(firebaseConfigError || 'Firebase not configured')
    await signInWithEmailAndPassword(auth, email, pass)
  }
  const logout = () => {
    if (!auth) return Promise.resolve()
    return signOut(auth)
  }

  return <Ctx.Provider value={{ user, loading, signup, login, logout }}>{children}</Ctx.Provider>
}
