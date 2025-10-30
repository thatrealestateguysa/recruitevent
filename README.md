
# Recruit 101 — Static Front End (JSONP)

This is a **pure static** front end wired to your Apps Script backend using **JSONP**, so it works from any origin (no CORS config needed).

**Backend URL**  
`https://script.google.com/macros/s/AKfycbw3htODYprb9WCj1qKeWA7xHNwi_5m7BY_ta7FQF0llaBcR15kQr6Ee7SXOIGZNE5yj9Q/exec`

## Files
- `index.html` — UI (grey background, white text, tabs wrap)
- `styles.css` — styles
- `config.js` — set `BASE_URL` here
- `app.js` — JSONP wiring, table rendering, search/filter, update

## Run locally
Just open `index.html` in a browser, or serve with any static server.
