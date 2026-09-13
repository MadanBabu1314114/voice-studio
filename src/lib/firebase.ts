import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || '',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || '',
  databaseURL: (import.meta.env.VITE_FIREBASE_DATABASE_URL as string) || '',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || '',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || '',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || '',
}

export const firebaseConfigError =
  !firebaseConfig.apiKey || !firebaseConfig.databaseURL
    ? 'Missing VITE_FIREBASE_* env vars. For npm: copy .env.example to .env. For Docker: rebuild with build-args (see COMMANDS.txt).'
    : null

if (firebaseConfigError) console.error(firebaseConfigError)

const app = firebaseConfigError ? null : initializeApp(firebaseConfig)
export const auth = app ? getAuth(app) : (null as unknown as ReturnType<typeof getAuth>)
export const db = app ? getDatabase(app) : (null as unknown as ReturnType<typeof getDatabase>)
export default app
