
# Recruit 101 — Front-End (Final)

**Backend URL**  
https://script.google.com/macros/s/AKfycbzUMvPLB58Q6ixXnLgVSkG2B-D8oBarloY68sPvnJMqUOATYdNSgMKdr2BZX3DN49359Q/exec

## How it works
- Loads rows via `?action=list`.
- Saves status + BuDate via `?action=update&id=...&status=...&budate=...`.
- Works inside Apps Script (same-origin) **or** from any static host via **JSONP**.

## Files
- `index.html`  — grayscale UI; tabs wrap; no horizontal slider
- `styles.css`  — neutral styling
- `config.js`   — set `BASE_URL` here
- `app.js`      — data wiring (list / update / WhatsApp link)

Just unzip and open `index.html` or host these files anywhere.
