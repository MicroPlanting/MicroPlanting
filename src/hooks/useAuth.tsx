import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '../lib/firebase'
const Ctx = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true })
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!auth)
  useEffect(() => auth ? onAuthStateChanged(auth, u => { setUser(u); setLoading(false) }) : undefined, [])
  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>
}
export const useAuth = () => useContext(Ctx)
