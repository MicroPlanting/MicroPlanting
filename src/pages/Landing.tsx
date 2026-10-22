import { Link } from 'react-router-dom'
import { Radio, Droplets, Thermometer, Wind, Bell, LineChart } from 'lucide-react'
const features = [
  [Radio, 'Real-time monitoring', 'Readings from the ESP32 appear as soon as Firebase receives them.'],
  [Droplets, 'Soil moisture', 'Calibrated percentage and raw ADC are always shown separately.'],
  [Thermometer, 'Temperature and humidity', 'Latest values with change since the previous reading.'],
  [Wind, 'Gas level', 'Raw ADC against the configured alert threshold, never relabelled as ppm.'],
  [Bell, 'Alerts', 'Temperature above 35 °C and gas at or above 1000 are flagged with the reading.'],
  [LineChart, 'History', 'Charts appear once timestamped records exist at /readings/history.'],
] as const
export default function Landing() {
  return <div className="wrap">
    <nav className="nav"><strong>MicroPlanting</strong><span><Link className="btn" to="/signin">Sign in</Link> <Link className="btn pri" to="/register">Get started</Link></span></nav>
    <header className="hero"><div>
      <p className="sub">Intelligent agriculture system</p>
      <h1>Grow smarter. Let nature thrive.</h1>
      <p>Real-time environmental intelligence for healthier plants, smarter irrigation, and a more sustainable future.</p>
      <Link className="btn pri" to="/dashboard">Explore dashboard</Link></div>
      <div className="card" aria-label="Illustrative preview"><p className="sub">Illustrative preview, not live data</p>
        <div className="grid"><div><span className="sub">Temperature</span><div className="val">-- °C</div></div><div><span className="sub">Humidity</span><div className="val">-- %</div></div></div></div>
    </header>
    <section className="sect"><h2>What it monitors</h2><div className="grid">
      {features.map(([Icon, t, d]) => <div className="card" key={t}><h3><Icon size={16} />{t}</h3><p className="sub">{d}</p></div>)}</div></section>
    <section className="sect"><h2>ESP32, sensors, Firebase, dashboard</h2>
      <p className="sub">The ESP32 reads its sensors and writes to Firebase Realtime Database. This site subscribes to that data and shows what the device actually reported.</p></section>
  </div>
}
