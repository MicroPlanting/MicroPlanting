import { signOut } from 'firebase/auth'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { auth } from '../lib/firebase'
import { useReadings } from '../hooks/useReadings'
import { evaluateAlerts, fmtTime } from '../lib/data'
const cls = (s: string) => s === 'STALE DATA' ? 'STALE' : s === 'CONFIGURATION REQUIRED' ? 'CONFIG' : s
const show = (v: unknown, unit = '') => (v === undefined || v === null ? '--' : `${v}${unit}`)
export default function Dashboard() {
  const { reading: r, history, error, status, freshBasis, basisLabel } = useReadings()
  const alerts = evaluateAlerts(r)
  const calibrated = r?.soil !== undefined
  const cards: [string, string, string][] = [
    ['Temperature', show(r?.temperature?.toFixed(1), ' °C'), 'Latest reported value'],
    ['Air humidity', show(r?.humidity?.toFixed(0), ' %'), 'Relative humidity'],
    ['Soil moisture', calibrated ? show(r?.soil, ' %') : `ADC ${show(r?.soil_raw)}`, calibrated ? `Raw ADC ${show(r?.soil_raw)} · ${show(r?.soil_status)}` : 'Calibration required for a percentage. Showing raw ADC only.'],
    ['Gas sensor', `ADC ${show(r?.gas)}`, 'Raw reading, not ppm. Alert at ≥ 1000'],
    ['Water pump', r?.pump === undefined ? '--' : r.pump ? 'ON' : 'OFF', 'Last reported state'],
    ['Servo / window', show(r?.servo_angle, '°'), `Window: ${show(r?.window)}`],
    ['Buzzer', r?.buzzer === undefined ? '--' : r.buzzer ? 'Active' : 'Inactive', r?.alert ? `Reason: ${r.alert}` : 'No reason reported'],
  ]
  return <div className="wrap">
    <nav className="nav"><strong>MicroPlanting</strong>
      <span className="row"><span className={`pill ${cls(status)}`} role="status">{status}</span><button className="btn" onClick={() => auth && signOut(auth)}>Sign out</button></span></nav>
    <h1 style={{ fontSize: '2.2rem' }}>Your plant environment, intelligently monitored.</h1>
    <p className="sub">{freshBasis ? `Last update ${fmtTime(freshBasis)} (${basisLabel})` : 'No reading received yet.'}</p>
    {error && <div className="notice err" role="alert">{error}</div>}
    {alerts.map(a => <div key={a.id} className={`notice ${a.severity === 'critical' ? 'err' : ''}`}><strong>{a.title}</strong>: {a.reading} (threshold {a.threshold}). {a.action}</div>)}
    <div className="grid">{cards.map(([t, v, s]) => <div className="card" key={t}><h3>{t}</h3><div className="val">{v}</div><div className="sub">{s}</div></div>)}</div>
    <section className="sect"><h2>Temperature history</h2>
      {history.length < 2 ? <div className="notice">No historical records found at <code>/readings/history</code>. The latest snapshot above is live, but charts need timestamped records written by the firmware or a backend. See README, “Enable history”.</div>
        : <div className="card" style={{ height: 300 }}><ResponsiveContainer><AreaChart data={history}>
          <CartesianGrid stroke="rgba(166,244,197,.08)" /><XAxis dataKey="t" tickFormatter={fmtTime} stroke="#91A79A" /><YAxis unit="°C" stroke="#91A79A" />
          <Tooltip labelFormatter={v => fmtTime(v as number)} contentStyle={{ background: '#14251B', border: '1px solid rgba(166,244,197,.2)' }} />
          <Area type="monotone" dataKey="temperature" stroke="#20E68A" fill="rgba(32,230,138,.15)" name="Temperature" /></AreaChart></ResponsiveContainer></div>}
    </section></div>
}
