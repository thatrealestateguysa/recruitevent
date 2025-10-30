# Recruit 101 — Minimal Front End (Greyscale)

- Greyscale only (no blue), tabs wrap so nothing is cut off.
- Works **same-origin** (inside Apps Script web app) via `google.script.run`.
- Works **cross-origin** via **JSONP** if your backend supports `callback=`.

**Backend URL**: https://script.google.com/macros/s/AKfycbw3htODYprb9WCj1qKeWA7xHNwi_5m7BY_ta7FQF0llaBcR15kQr6Ee7SXOIGZNE5yj9Q/exec

If you embed this as `Index.html` inside the Apps Script project, `google.script.run` will be used automatically and no JSONP is required.
Otherwise, host these files anywhere and it will use JSONP.
