export interface Reading {
  temperature?: number; humidity?: number; soil?: number; soil_raw?: number; soil_status?: string
  gas?: number; pump?: boolean; window?: string; servo_angle?: number; alert?: string; buzzer?: boolean; timestamp?: number
}
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : undefined)
const bool = (v: unknown) => (typeof v === 'boolean' ? v : typeof v === 'string' ? ['on', 'true', '1'].includes(v.toLowerCase()) : typeof v === 'number' ? v > 0 : undefined)
export function parseReading(raw: any): Reading | null {
  if (!raw || typeof raw !== 'object') return null
  return { temperature: num(raw.temperature), humidity: num(raw.humidity), soil: num(raw.soil), soil_raw: num(raw.soil_raw),
    soil_status: typeof raw.soil_status === 'string' ? raw.soil_status : undefined, gas: num(raw.gas), pump: bool(raw.pump),
    window: typeof raw.window === 'string' ? raw.window : undefined, servo_angle: num(raw.servo_angle),
    alert: typeof raw.alert === 'string' ? raw.alert : undefined, buzzer: bool(raw.buzzer), timestamp: num(raw.timestamp) }
}
// Device timestamps may be epoch seconds, epoch ms, or millis() uptime. Only trust plausible epochs.
export function deviceTimeMs(ts?: number): number | null {
  if (ts === undefined) return null
  const ms = ts < 1e11 ? ts * 1000 : ts
  return ms > 1.5e12 && ms < 4e12 ? ms : null
}
export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
export const THRESHOLDS = { temperature: 35, gas: 1000 } // project-configured; do not change
export interface Alert { id: string; title: string; severity: 'critical' | 'warning'; reading: string; threshold: string; action: string }
export function evaluateAlerts(r: Reading | null): Alert[] {
  if (!r) return []
  const a: Alert[] = []
  if (r.temperature !== undefined && r.temperature > THRESHOLDS.temperature)
    a.push({ id: 'temp', title: 'High temperature', severity: 'critical', reading: `${r.temperature.toFixed(1)} °C`, threshold: '> 35 °C', action: 'Ventilate the enclosure and check shading.' })
  if (r.gas !== undefined && r.gas >= THRESHOLDS.gas)
    a.push({ id: 'gas', title: 'High gas reading', severity: 'critical', reading: `ADC ${r.gas}`, threshold: 'ADC ≥ 1000', action: 'Ventilate and inspect the area near the sensor.' })
  if (r.soil_status && /dry/i.test(r.soil_status) && r.soil !== undefined)
    a.push({ id: 'dry', title: 'Dry soil', severity: 'warning', reading: `${r.soil}%`, threshold: 'Reported by device', action: 'Check irrigation. This does not trigger the buzzer.' })
  if (r.soil_status && /check/i.test(r.soil_status))
    a.push({ id: 'soil-sensor', title: 'Check soil sensor', severity: 'warning', reading: `ADC ${r.soil_raw ?? 'n/a'}`, threshold: 'Invalid reading', action: 'Inspect sensor wiring and placement.' })
  return a
}
