# MicroPlanting — Smart plants. A greener tomorrow.
ESP32 smart-agriculture dashboard (Firebase Realtime Database + Auth, Chart.js, Web Audio, PWA). Status-only: it never sends commands to the pump, servo or buzzer.

## Files
index.html, style.css, script.js, firebase-config.js, manifest.json, sw.js, icon.svg, README.md (all in one folder, relative paths).

## 1. Firebase config (required)
Firebase Console → Project settings → Your apps → Web app → copy the config into `firebase-config.js`. Replace every `REPLACE_` value (apiKey, appId, messagingSenderId). Verify `authDomain` (normally `microplanting.firebaseapp.com`).

## 2. Authentication
Console → Authentication → Sign-in method → enable Email/Password. Then register in the app or add a user in the console. Also add your GitHub Pages domain (`YOURNAME.github.io`) under Authentication → Settings → Authorized domains.

## 3. Database rules (never make the DB public-write)
```json
{ "rules": { "readings": { ".read": "auth != null", ".write": "auth != null" } } }
```
The ESP32 must write with an authenticated method (e.g. database secret/auth token in firmware, or a dedicated Firebase user). If it currently writes some other way, keep that and only tighten `.read`. Never put secrets in the website.

## 4. GitHub Pages
Put all files in the repo root (or a folder) → Settings → Pages → Deploy from branch → `main` / `/ (root)`. Open `https://YOURNAME.github.io/REPO/`. Install via browser menu → Install app (iOS: Share → Add to Home Screen).

## 5. Test
Sign in, then edit `/readings` in the Firebase console: temperature 34 (normal) → 36 (emergency); gas 999 → 1001; `soil_raw` 0 with `soil_status` "UNKNOWN" (shows UNKNOWN, no emergency); delete `/readings` (waiting state); stop the ESP32 for 45 s+ (stale) / 120 s+ (offline). Press Enable audio in Settings to hear alerts.

## Notes
- Emergency = temperature > 35 OR gas > 1000. Dry soil never alarms.
- Gas is raw ADC, not ppm. Soil % = (4095 − raw)/4095, approximate/uncalibrated.
- `timestamp_ms` is a device tick counter, so freshness is "when this browser last saw changed data". Add a server timestamp in firmware for true device time.
- Charts use in-browser session history only (lost on refresh).
- SMS: sent by the ESP32 to SMSGate Local Server (`http://PHONE_IP:8080/message`, Basic Auth kept in firmware). The site can't verify delivery.
- Dashboard sound ≠ the physical ESP32 buzzer; both are shown separately.

## Troubleshooting
- `permission_denied`: signed in? Rules above published?
- `auth/api-key-not-valid`: wrong apiKey in firebase-config.js.
- Stale data: ESP32 not writing, or writing to a different path/DB.
- Soil raw 0: wiring/power on GPIO 34 (use 3.3 V sensor, check ground).
