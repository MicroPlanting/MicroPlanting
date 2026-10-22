import { initializeApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import { getDatabase, Database } from 'firebase/database'
const env = import.meta.env
const cfg = {
  apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || 'https://microplanting-default-rtdb.asia-southeast1.firebasedatabase.app',
}
export let initError: string | null = null
export let auth: Auth | null = null
export let db: Database | null = null
export const isConfigured = Boolean(cfg.apiKey && cfg.authDomain && cfg.appId)
if (isConfigured) {
  try { const app = initializeApp(cfg); auth = getAuth(app); db = getDatabase(app) }
  catch (e: any) { initError = e?.message ?? 'Firebase failed to initialise'; auth = null; db = null; console.error(e) }
}
