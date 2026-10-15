# Same Sky — Love for Mena

Two places, one sky. Live clocks for Mena and me, each with today's sunrise and
sunset, plus the one thing that actually matters long-distance: **the hours we
are both awake**. Part of the **Love for Mena** collection.

**Live:** https://menaammarpro.github.io/love-timezone/

## What it does

- Two live clocks to the second — Karachi (Pakistan) and Bucharest (Romania)
- Correct timezone offsets, including daylight saving (via the browser's own
  time-zone data — nothing is hard-coded)
- Sunrise and sunset in each city, computed in the browser (SunCalc/NOAA maths)
- A day-long timeline (your time) marking the hours you are both awake
- A live "best time to call" banner, with the next shared window and how long
  it lasts
- Change both names and your usual awake hours — saved on the device only
- Installable PWA with offline support; no tracking, no analytics

## Set your details

Open the **Details** section to change the two names and the hours you are
usually awake. Everything is stored in `localStorage` on that device. To change
the defaults for a fresh visitor, edit the `CITIES` object at the top of
`js/app.js`.

## Files

- `index.html` — the page
- `css/theme.css` — shared love-theme (copied from `_love-theme/`)
- `css/app.css` — page-specific styles
- `js/theme-main.js`, `js/effects.js` — shared behaviour/effects
- `js/solar.js` — sunrise/sunset + timezone helpers (`window.MenaSolar`)
- `js/app.js` — clocks, the shared-awake timeline and settings
- `manifest.webmanifest`, `sw.js` — PWA
- `assets/` — favicon and icons

## Run locally

```powershell
py -m http.server 8000
```

Then visit http://localhost:8000.

## Deploy

Static site, deployed with GitHub Pages from `main`.

## License

Creative Commons BY-NC-ND 4.0 — see [`LICENSE`](LICENSE).
© 2026 Ammar (MenaAmmarPro). Made with care for Mena.
