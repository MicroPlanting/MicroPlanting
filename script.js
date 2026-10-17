import { firebaseConfig, THRESH, STALE_S, OFFLINE_S } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, onValue } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const prefs = Object.assign({ vol: .5, music: false, alertSnd: true, mute: false }, JSON.parse(localStorage.getItem('mp-prefs') || '{}'));
const savePrefs = () => localStorage.setItem('mp-prefs', JSON.stringify(prefs)); // preferences only, never credentials

/* ---------- Firebase init ---------- */
let auth, db, unsub = null, fbState = 'connecting';
const missing = Object.values(firebaseConfig).some(v => String(v).startsWith('REPLACE'));
try { const app = initializeApp(firebaseConfig); auth = getAuth(app); db = getDatabase(app); }
catch (e) { $('authMsg').textContent = 'Firebase failed to initialise: ' + e.message; }
if (missing) $('authMsg').textContent = 'firebase-config.js still has REPLACE_ values. Paste your real Web app config from Firebase Console.';
const friendly = c => ({ 'auth/invalid-credential': 'Wrong email or password.', 'auth/invalid-email': 'That email address is not valid.', 'auth/weak-password': 'Password must be at least 6 characters.', 'auth/email-already-in-use': 'That email is already registered.', 'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Invalid Firebase API key — check firebase-config.js.', 'auth/invalid-api-key': 'Invalid Firebase API key — check firebase-config.js.', 'auth/operation-not-allowed': 'Enable Email/Password sign-in in Firebase Console.', 'auth/network-request-failed': 'Network error. Check your internet connection.', 'auth/too-many-requests': 'Too many attempts. Wait and try again.' }[c] || 'Authentication failed (' + c + ').');

/* ---------- Auth UI ---------- */
let register = false;
$('toggleMode').onclick = () => { register = !register; $('authGo').textContent = register ? 'Create account' : 'Sign in'; $('toggleMode').textContent = register ? 'I have an account' : 'Create an account'; $('authMode').textContent = register ? 'Create your account' : 'Sign in to your dashboard'; $('authMsg').textContent = ''; };
$('showpw').onclick = () => { const p = $('pw'); p.type = p.type === 'password' ? 'text' : 'password'; $('showpw').textContent = p.type === 'password' ? 'Show' : 'Hide'; };
$('authForm').onsubmit = async e => {
  e.preventDefault(); const m = $('authMsg'), b = $('authGo'); m.style.color = ''; m.textContent = '';
  if (!auth) { m.textContent = 'Firebase is not available.'; return; }
  if (!$('email').validity.valid || $('pw').value.length < 6) { m.textContent = 'Enter a valid email and a password of at least 6 characters.'; return; }
  b.disabled = true; b.textContent = 'Please wait…';
  try { await (register ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth, $('email').value.trim(), $('pw').value); }
  catch (er) { m.textContent = friendly(er.code); }
  b.disabled = false; b.textContent = register ? 'Create account' : 'Sign in';
};
$('forgot').onclick = async () => { const m = $('authMsg'); if (!$('email').validity.valid || !$('email').value) { m.textContent = 'Type your email first.'; return; } try { await sendPasswordResetEmail(auth, $('email').value.trim()); m.style.color = 'var(--ok)'; m.textContent = 'Reset email requested. Check your inbox.'; } catch (er) { m.style.color = ''; m.textContent = friendly(er.code); } };
$('logout').onclick = () => { if (confirm('Sign out?')) signOut(auth); };
if (auth) onAuthStateChanged(auth, u => {
  $('auth').hidden = !!u; $('app').hidden = !u;
  if (u) { logEvent('system', 'Signed in'); startListener(); } else { stopListener(); stopAudio(); }
}, er => { $('authMsg').textContent = friendly(er.code); });

/* ---------- Normalisation ---------- */
const num = v => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const pick = (o, ...k) => { for (const x of k) if (o[x] !== undefined && o[x] !== null) return o[x]; return null; };
const bool = v => v === true || v === 1 || v === 'true' || v === 'ON' ? true : (v === false || v === 0 || v === 'false' || v === 'OFF' ? false : null);
function normalize(r) {
  if (!r || typeof r !== 'object') return null;
  const raw = num(pick(r, 'soil_raw', 'soilRaw', 'soil_adc'));
  let st = String(pick(r, 'soil_status', 'soilStatus') ?? '').toUpperCase();
  if (st !== 'DRY' && st !== 'WET') st = 'UNKNOWN';
  let pct = num(pick(r, 'soil_moisture', 'soilMoisture'));
  if (pct === null && raw !== null) pct = Math.round((4095 - raw) / 4095 * 100); // approximate, inverse of raw
  const ang = num(pick(r, 'servo_angle', 'servoAngle'));
  let win = String(pick(r, 'window') ?? '').toUpperCase();
  if (win !== 'OPEN' && win !== 'CLOSED') win = ang === 90 ? 'OPEN' : ang === 0 ? 'CLOSED' : 'UNKNOWN';
  return { temp: num(pick(r, 'temperature', 'temp')), hum: num(pick(r, 'humidity', 'hum')), soilRaw: raw, soilPct: pct, soil: st, gas: num(pick(r, 'gas', 'gas_raw')), pump: bool(r.pump), angle: ang, win, buzzer: bool(pick(r, 'buzzer')), alarm: bool(pick(r, 'alarm')), wifi: bool(pick(r, 'wifi_connected')) };
}

/* ---------- State ---------- */
let cur = null, lastSig = null, lastSeen = 0, prev = {}, paused = false, hist = [], events = [], alertLog = [];
const MAXH = 2000, MAXE = 200;
const tOf = () => new Date().toLocaleTimeString();
function logEvent(kind, msg) { events.unshift({ kind, msg, t: tOf() }); if (events.length > MAXE) events.pop(); renderEvents(); }
function renderEvents() { const f = $('evf').value, l = events.filter(e => !f || e.kind === f); $('events').innerHTML = l.length ? l.map(e => `<li><span class="badge">${e.kind}</span> ${esc(e.msg)} <span class="muted small">(browser time ${e.t})</span></li>`).join('') : '<li class="muted">No events yet.</li>'; }
$('evf').onchange = renderEvents;

function startListener() {
  if (unsub || !db) return;
  const timeout = setTimeout(() => { if (fbState === 'connecting') setFb('error', 'No response from Firebase yet. Check API key, rules and internet.'); }, 10000);
  unsub = onValue(ref(db, 'readings'), snap => { clearTimeout(timeout); setFb('ok'); onData(snap.val()); },
    er => { clearTimeout(timeout); setFb('error', er.code === 'PERMISSION_DENIED' || /permission/i.test(er.message) ? 'permission_denied: set Realtime Database rules so signed-in users can read /readings (see README).' : 'Database error: ' + er.message); });
}
function stopListener() { if (unsub) { unsub(); unsub = null; } cur = null; lastSig = null; prev = {}; fbState = 'connecting'; }
function setFb(s, msg) { if (s !== fbState) logEvent('system', 'Firebase ' + (s === 'ok' ? 'listener active' : 'error')); fbState = s; $('fbErr').hidden = s === 'ok'; $('fbErr').textContent = msg || ''; const p = $('pFb'); p.textContent = 'Firebase: ' + (s === 'ok' ? 'listening' : s === 'error' ? 'error' : 'connecting'); p.className = 'pill ' + (s === 'ok' ? 'ok' : s === 'error' ? 'bad' : 'warn'); }

function onData(v) {
  const sig = JSON.stringify(v);
  if (sig === lastSig) return; // same object again: no duplicate point
  lastSig = sig; lastSeen = Date.now(); cur = normalize(v);
  if (cur && !paused) {
    hist.push({ t: lastSeen, temp: cur.temp, hum: cur.hum, soil: cur.soilPct, gas: cur.gas }); if (hist.length > MAXH) hist.shift(); drawChart();
  }
  transitions(); render();
}
const emergency = d => { if (!d) return null; const t = d.temp !== null && d.temp > THRESH.temp, g = d.gas !== null && d.gas > THRESH.gas; return { t, g, any: t || g, valid: d.temp !== null || d.gas !== null }; };
function transitions() {
  if (!cur) return; const e = emergency(cur), n = { tempA: e.t, gasA: e.g, soil: cur.soil, pump: cur.pump, win: cur.win };
  const chg = (k, msg, kind) => { if (k in prev && prev[k] !== n[k]) logEvent(kind, msg(n[k])); };
  chg('tempA', v => v ? `High temperature ${cur.temp} °C` : 'Temperature emergency cleared', 'warning');
  chg('gasA', v => v ? `High gas ADC ${cur.gas}` : 'Gas alert cleared', 'warning');
  chg('soil', v => 'Soil state: ' + v, 'device'); chg('pump', v => 'Pump reported ' + (v === null ? 'unknown' : v ? 'ON' : 'OFF'), 'device'); chg('win', v => 'Window reported ' + v, 'device');
  if ((n.tempA && !prev.tempA) || (n.gasA && !prev.gasA)) alertLog.unshift(tOf());
  prev = n;
}

/* ---------- Render ---------- */
const fmt = (v, d = 0) => v === null ? '—' : v.toFixed(d);
function freshness() { if (!lastSeen) return 'none'; const s = (Date.now() - lastSeen) / 1000; return s > OFFLINE_S ? 'offline' : s > STALE_S ? 'stale' : 'online'; }
function card(title, val, unit, extra, cls = '') { return `<div class="card ${cls}"><h3>${title}</h3><div class="val">${val}<small> ${unit}</small></div>${extra}</div>`; }
const badge = (t, c = '') => `<span class="badge ${c}">${t}</span>`;
function render() {
  const f = freshness(), d = cur, st = f === 'stale' || f === 'offline' ? 'stale' : '';
  const pd = $('pDev'); pd.textContent = 'ESP32: ' + (f === 'none' ? 'no data' : f); pd.className = 'pill ' + (f === 'online' ? 'ok' : f === 'stale' ? 'warn' : 'bad');
  $('pLast').textContent = 'Last update: ' + (lastSeen ? new Date(lastSeen).toLocaleTimeString() + ' (browser-observed)' : '—');
  if (f !== prevF) { if (prevF) logEvent('device', 'ESP32 data ' + f); prevF = f; }
  if (!d) { $('cards').innerHTML = [1, 2, 3, 4].map(() => '<div class="card"><h3>Waiting</h3><div class="val">—</div><p class="muted small">No valid /readings data yet.</p></div>').join(''); renderEmerg(null); renderCare(null); return; }
  const e = emergency(d), win = d.win;
  $('cards').innerHTML =
    card('Temperature', fmt(d.temp, 1), '°C', d.temp === null ? badge('SENSOR UNAVAILABLE', 'warn') : badge(e.t ? 'EMERGENCY &gt; 35 °C' : 'Normal', e.t ? 'bad' : 'ok'), st + (e.t ? ' bad' : '')) +
    card('Air humidity', fmt(d.hum), '%', `<div class="bar"><i style="width:${d.hum ?? 0}%"></i></div><p class="muted small">Air, not soil.</p>`, st) +
    card('Soil moisture', fmt(d.soilPct), '% approx', `${badge(d.soil, d.soil === 'DRY' ? 'warn' : d.soil === 'WET' ? 'ok' : 'bad')} <span class="muted small">Raw ADC ${d.soilRaw ?? '—'}</span><div class="bar"><i style="width:${d.soilPct ?? 0}%"></i></div><p class="muted small">Uncalibrated estimate.${d.soil === 'UNKNOWN' ? ' Check soil sensor wiring.' : ''}</p>`, st) +
    card('Gas sensor ADC', fmt(d.gas), 'ADC', `<div class="bar"><i style="width:${Math.min(100, (d.gas ?? 0) / 40.95)}%;background:${e.g ? 'var(--bad)' : 'var(--ok)'}"></i><b style="left:${1000 / 40.95}%"></b></div><p class="muted small">Raw ADC reading, not ppm. Threshold 1000.</p>`, st + (e.g ? ' bad' : '')) +
    card('Water pump', d.pump === null ? '—' : d.pump ? 'ON' : 'OFF', '', `<p class="muted small">Reported by ESP32. Status only.${d.soil === 'UNKNOWN' ? ' ⚠ Soil UNKNOWN: verify sensor before trusting watering.' : ''}</p>`, st) +
    card('Window / servo', win, '', `<p class="muted small">Angle: ${d.angle === null ? '—' : d.angle + '°'}</p>`, st) +
    card('ESP32 buzzer', d.buzzer === null ? 'UNKNOWN' : d.buzzer ? 'ACTIVE' : 'OFF', '', `<p class="muted small">Reported by firmware. Dashboard sound: ${!aud.on ? 'audio not enabled' : prefs.mute ? 'muted' : 'on'}</p>`, st) +
    card('Device', f, '', `<p class="muted small">Wi-Fi: ${d.wifi === null ? 'not reported' : d.wifi ? 'connected' : 'disconnected'}<br>Freshness = when this browser last saw new data.</p>`);
  renderEmerg(e); renderCare(d); syncAlertSound(e && e.any && f === 'online');
}
let prevF = null, dismissed = false;
function renderEmerg(e) {
  const el = $('emerg'); if (!e || !e.valid) { el.innerHTML = '<div class="wait"><b>WAITING FOR VALID READINGS</b></div>'; return; }
  if (!e.any) { dismissed = false; el.innerHTML = '<div><b>SYSTEM NORMAL</b> — temperature and gas within limits.</div>'; return; }
  const why = [e.t && `<b>HIGH TEMPERATURE DETECTED</b>: ${cur.temp} °C exceeds 35 °C.`, e.g && `<b>HIGH GAS SENSOR READING</b>: ADC ${cur.gas} exceeds 1000.`].filter(Boolean).join('<br>');
  el.innerHTML = `<div class="bad" role="alert">⚠ ${why}<p class="small">ESP32 buzzer: ${cur.buzzer === null ? 'unknown' : cur.buzzer ? 'ACTIVE' : 'OFF'}. SMS is sent by the ESP32; delivery cannot be verified here.</p><p class="small muted">Alerts this session: ${alertLog.length}</p></div>`;
}
function renderCare(d) {
  const L = []; if (!d) L.push('Waiting for sensor data.'); else {
    L.push(d.soil === 'UNKNOWN' ? 'Soil sensor state is UNKNOWN. Check wiring before relying on automatic watering.' : `Soil sensor reports ${d.soil}. Pump reported ${d.pump === null ? 'unknown' : d.pump ? 'ON' : 'OFF'}.`);
    if (d.temp !== null) L.push(d.temp > THRESH.temp ? 'Temperature exceeds the alert threshold (35 °C).' : `Temperature ${d.temp} °C is within the alert limit.`);
    if (d.hum !== null) L.push(`Air humidity ${d.hum}%${d.hum > 80 ? ' — above 80%, firmware may open the window.' : '.'}`);
    L.push('Simple rule-based suggestions from current readings, not a plant diagnosis.');
  } $('care').innerHTML = L.map(x => `<li>${esc(x)}</li>`).join('');
}

/* ---------- Chart ---------- */
let chart = null;
const META = { temp: ['Temperature (°C)', '#ff9b54'], hum: ['Air humidity (%)', '#5ec8ff'], soil: ['Soil moisture (% approx)', '#3ddc97'], gas: ['Gas sensor (ADC)', '#ff5d5d'] };
function drawChart() {
  if (!window.Chart) return; const m = $('metric').value, cut = Date.now() - $('range').value * 60000, pts = hist.filter(h => h.t >= cut && h[m] !== null);
  $('chartEmpty').hidden = pts.length > 0;
  if (!chart) chart = new Chart($('chart'), { type: 'line', data: { labels: [], datasets: [{ data: [], tension: .35, pointRadius: 2, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, plugins: { legend: { labels: { color: '#9db3a6' } } }, scales: { x: { ticks: { color: '#9db3a6', maxTicksLimit: 6 }, grid: { color: '#ffffff14' } }, y: { ticks: { color: '#9db3a6' }, grid: { color: '#ffffff14' } } } } });
  const ds = chart.data.datasets[0]; ds.label = META[m][0]; ds.borderColor = META[m][1]; ds.backgroundColor = META[m][1] + '22';
  chart.data.labels = pts.map(p => new Date(p.t).toLocaleTimeString()); ds.data = pts.map(p => p[m]); chart.update();
}
$('metric').onchange = $('range').onchange = drawChart;
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; };
$('clearH').onclick = () => { if (confirm('Clear the chart history in this browser? Firebase data is not affected.')) { hist = []; drawChart(); } };
addEventListener('load', () => setTimeout(drawChart, 300));

/* ---------- Audio (single context, no files) ---------- */
const aud = { ctx: null, on: false, master: null, music: null, alertTimer: null, lastAlert: 0 };
function enableAudio() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { alert('This browser does not support Web Audio.'); return; }
  if (!aud.ctx) { aud.ctx = new AC(); aud.master = aud.ctx.createGain(); aud.master.connect(aud.ctx.destination); }
  aud.ctx.resume(); aud.on = true; applyVol(); syncMusic(); $('audioOn').textContent = 'Audio enabled'; render();
}
const applyVol = () => { if (aud.master) aud.master.gain.value = prefs.mute ? 0 : prefs.vol; };
function syncMusic() {
  if (!aud.on) return;
  if (prefs.music && !aud.music) {
    const g = aud.ctx.createGain(); g.gain.value = .08; g.connect(aud.master);
    const oscs = [130.8, 196, 261.6, 329.6].map((f, i) => { const o = aud.ctx.createOscillator(), l = aud.ctx.createOscillator(), lg = aud.ctx.createGain(); o.type = 'sine'; o.frequency.value = f; l.frequency.value = .05 + i * .03; lg.gain.value = 1.5; l.connect(lg); lg.connect(o.frequency); o.connect(g); o.start(); l.start(); return [o, l]; });
    aud.music = { g, oscs };
  } else if (!prefs.music && aud.music) { aud.music.oscs.flat().forEach(o => o.stop()); aud.music.g.disconnect(); aud.music = null; }
}
function beep(f, dur, vol = .3) { if (!aud.on) return; const o = aud.ctx.createOscillator(), g = aud.ctx.createGain(), t = aud.ctx.currentTime; o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(aud.master); o.start(t); o.stop(t + dur); o.onended = () => g.disconnect(); }
function syncAlertSound(active) {
  if (active && prefs.alertSnd && aud.on && !aud.alertTimer) { const go = () => { beep(880, .25); setTimeout(() => beep(660, .25), 300); }; go(); aud.alertTimer = setInterval(go, 1500); }
  if ((!active || !prefs.alertSnd) && aud.alertTimer) { clearInterval(aud.alertTimer); aud.alertTimer = null; }
}
function stopAudio() { syncAlertSound(false); if (aud.music) { prefs.music && 0; aud.music.oscs.flat().forEach(o => o.stop()); aud.music = null; } }
$('audioOn').onclick = enableAudio;
$('vol').value = prefs.vol; $('music').checked = prefs.music; $('alertSnd').checked = prefs.alertSnd; $('mute').checked = prefs.mute;
$('vol').oninput = e => { prefs.vol = +e.target.value; applyVol(); savePrefs(); };
$('music').onchange = e => { prefs.music = e.target.checked; syncMusic(); savePrefs(); };
$('alertSnd').onchange = e => { prefs.alertSnd = e.target.checked; savePrefs(); render(); };
$('mute').onchange = e => { prefs.mute = e.target.checked; applyVol(); savePrefs(); render(); };

/* ---------- Settings, PWA, timers ---------- */
$('tabSet').onclick = () => { $('diag').textContent = `Firebase: ${fbState}\nOnline: ${navigator.onLine}\nDB: ${firebaseConfig.databaseURL}\nHistory points: ${hist.length}\nLast data seen: ${lastSeen ? new Date(lastSeen).toLocaleString() : 'never'}`; $('settings').showModal(); };
let deferred; addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('install').hidden = false; });
$('install').onclick = async () => { if (deferred) { deferred.prompt(); deferred = null; $('install').hidden = true; } };
const net = () => { $('offline').hidden = navigator.onLine; if (!navigator.onLine) logEvent('system', 'Browser went offline'); }; addEventListener('offline', net); addEventListener('online', () => { $('offline').hidden = true; logEvent('system', 'Browser back online'); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').then(r => r.addEventListener('updatefound', () => { const w = r.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { $('update').hidden = false; $('reload').onclick = () => { w.postMessage('skip'); location.reload(); }; } }); })).catch(() => { });
setInterval(() => { $('clock').textContent = new Date().toLocaleString(); if (cur) render(); }, 5000);
$('clock').textContent = new Date().toLocaleString(); render();
