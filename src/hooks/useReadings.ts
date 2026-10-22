import { useEffect, useRef, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../lib/firebase'
import { Reading, parseReading, deviceTimeMs } from '../lib/data'
export type Status = 'LIVE' | 'CONNECTING' | 'OFFLINE' | 'STALE DATA' | 'CONFIGURATION REQUIRED'
const STALE_MS = 60_000
export interface HistoryPoint extends Reading { t: number }
export function useReadings() {
  const [reading, setReading] = useState<Reading | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [now, setNow] = useState(Date.now())
  const lastChange = useRef<number | null>(null)
  const lastJson = useRef('')
  useEffect(() => {
    if (!db) return
    const offs = [
      onValue(ref(db, '.info/connected'), s => setConnected(!!s.val())),
      onValue(ref(db, '/readings'), s => {
        setError(null)
        const { history: _h, ...rest } = (s.val() ?? {}) as any
        const j = JSON.stringify(rest)
        if (j !== lastJson.current) { lastJson.current = j; lastChange.current = Date.now() }
        setReading(parseReading(rest))
      }, e => setError(/permission/i.test(e.message) ? 'Permission denied by database rules. Sign in with an authorised account; rules are not modified by this app.' : e.message)),
      onValue(ref(db, '/readings/history'), s => {
        const v = s.val()
        if (!v || typeof v !== 'object') return setHistory([])
        const pts: HistoryPoint[] = []
        for (const r of Object.values(v)) { const p = parseReading(r); const t = deviceTimeMs(p?.timestamp); if (p && t) pts.push({ ...p, t }) }
        setHistory(pts.sort((a, b) => a.t - b.t))
      }, () => setHistory([])),
    ]
    const tick = setInterval(() => setNow(Date.now()), 5000)
    return () => { offs.forEach(o => o()); clearInterval(tick) }
  }, [])
  const devMs = deviceTimeMs(reading?.timestamp)
  // Freshness: device timestamp if it is a real epoch, otherwise the last time the snapshot changed.
  const freshBasis = devMs ?? lastChange.current
  const basisLabel = devMs ? 'device timestamp' : 'last change observed in this browser'
  let status: Status = 'CONNECTING'
  if (!db) status = 'CONFIGURATION REQUIRED'
  else if (error || connected === false) status = 'OFFLINE'
  else if (reading && freshBasis) status = now - freshBasis > STALE_MS ? 'STALE DATA' : 'LIVE'
  return { reading, history, error, status, freshBasis, basisLabel }
}
