import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
const env = import.meta.env
const cfg = {
  apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || 'https://microplanting-default-rtdb.asia-southeast1.firebasedatabase.app',
}
export const isConfigured = Boolean(cfg.apiKey && cfg.authDomain && cfg.appId)
const app = isConfigured ? initializeApp(cfg) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getDatabase(app) : null
