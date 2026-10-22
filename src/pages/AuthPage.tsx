import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../lib/firebase'
const msgs: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is incorrect.', 'auth/user-not-found': 'No account uses that email.',
  'auth/wrong-password': 'Email or password is incorrect.', 'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Use a password of at least 6 characters.', 'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.', 'auth/network-request-failed': 'Network error. Check your connection.' }
export default function AuthPage({ mode }: { mode: 'signin' | 'register' | 'forgot' }) {
  const nav = useNavigate()
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false)
  const [err, setErr] = useState(''); const [info, setInfo] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setInfo('')
    if (!auth) return setErr('Firebase is not configured. Copy .env.example to .env and add your Firebase web app settings.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address.')
    setBusy(true)
    try {
      if (mode === 'forgot') { await sendPasswordResetEmail(auth, email); setInfo('If an account exists for that email, a reset link has been sent.') }
      else { await (mode === 'signin' ? signInWithEmailAndPassword : createUserWithEmailAndPassword)(auth, email, pw); nav('/dashboard') }
    } catch (x: any) { setErr(msgs[x.code] ?? 'Something went wrong. Try again.') } finally { setBusy(false) }
  }
  const title = { signin: 'Sign in', register: 'Create account', forgot: 'Reset password' }[mode]
  return <form className="card authbox" onSubmit={submit} noValidate>
    <h1 style={{ fontSize: '2rem', margin: 0 }}>{title}</h1>
    <label htmlFor="e">Email address</label><input id="e" type="email" autoComplete="email" value={email} onChange={x => setEmail(x.target.value)} required />
    {mode !== 'forgot' && <><label htmlFor="p">Password</label>
      <input id="p" type={show ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={pw} onChange={x => setPw(x.target.value)} required />
      <label><input type="checkbox" style={{ width: 'auto' }} checked={show} onChange={x => setShow(x.target.checked)} /> Show password</label></>}
    {err && <div className="notice err" role="alert">{err}</div>}{info && <div className="notice" role="status">{info}</div>}
    <button className="btn pri" disabled={busy} style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>{busy ? 'Please wait…' : title}</button>
    <p className="sub row"><Link to={mode === 'signin' ? '/register' : '/signin'}>{mode === 'signin' ? 'Create account' : 'Sign in'}</Link>{mode === 'signin' && <Link to="/forgot">Forgot password</Link>}</p>
  </form>
}
