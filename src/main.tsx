import React, { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import './styles.css'
const Landing = lazy(() => import('./pages/Landing'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="center">Checking session…</p>
  return user ? children : <Navigate to="/signin" replace />
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AuthProvider><HashRouter><Suspense fallback={<p className="center">Loading…</p>}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<AuthPage mode="signin" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/forgot" element={<AuthPage mode="forgot" />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="*" element={<p className="center">Page not found. <a href="#/">Go home</a></p>} />
    </Routes></Suspense></HashRouter></AuthProvider></React.StrictMode>)
