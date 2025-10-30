
# Recruit 101 — Front-end v1.2

Focused fixes based on your screenshot:
- **Autosave** the Status on change (no Save buttons needed).
- Render **WhatsApp link** as a clean **Open WhatsApp** button (+ Copy).
- **Truncate** long text so rows stay compact.
- Still supports multiple backend response shapes and update methods.
- Diagnostics toggle stays for quick debugging.

## Netlify Proxy (recommended)
- Keep `API_BASE` as `/api` in `config.js`.
- Edit `netlify.toml` → set `to = "https://script.google.com/macros/s/…/exec"` to your Apps Script URL.
- Deploy to Netlify.

## Direct (no proxy)
- Set `API_BASE` in `config.js` to your `/exec` URL, make sure your web app is deployed public and returns JSON.
