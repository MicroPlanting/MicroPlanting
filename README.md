# MicroPlanting (core build)
Implemented: landing page, Firebase email/password auth (sign in, register, reset, sign out, protected route), live `/readings` subscription with LIVE / CONNECTING / OFFLINE / STALE / CONFIGURATION REQUIRED status, metric cards, alert evaluation (temp > 35 °C, gas ≥ 1000), temperature history chart that only renders from real `/readings/history` records.
Not yet built: analytics page with the other 11 charts, time filters, CSV export, device/diagnostics/settings pages, demo mode, sidebar shell, PWA service worker and icons, light theme.

1. `npm install`  2. `cp .env.example .env` and fill the Firebase web config  3. `npm run dev`
Verify live data: sign in, then change a value in the Firebase console under `/readings`; status shows LIVE and cards update.
GitHub Pages: add the VITE_FIREBASE_* values as repository secrets, set Settings > Pages > Source to GitHub Actions, push to `main`. The workflow sets `VITE_BASE` to the repo name. HashRouter avoids 404s on refresh.
## Enable history
`/readings` is a snapshot if the ESP32 uses PUT. To keep history, the firmware (or a trusted backend) must also POST/push each reading, with an epoch `timestamp`, to `/readings/history`. This app never writes to Firebase and never changes your rules.
