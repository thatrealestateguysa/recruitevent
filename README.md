# Recruit 101 — Front-end v1.1

A robust front-end that fetches rows from **Google Apps Script** and updates **Status** with an automatic re-sync. Includes **diagnostics** and an optional **Netlify proxy** to avoid CORS.

## Files

- `index.html` — UI (dark, minimal) + a Diagnostics toggle.
- `styles.css` — styling.
- `config.js` — set `API_BASE` (proxy or direct) and options.
- `app.js` — load → render → update → re-sync with multi-format support.
- `netlify.toml` — proxy `/api` to your Apps Script URL (edit target).
- `README.md` — this.

## 2-minute Setup (Netlify, recommended)

1. Edit **`netlify.toml`** and set the `to = "https://script.google.com/macros/s/…/exec"` to **your** Apps Script URL.
2. Leave `API_BASE` in **`config.js`** as `"/api"` (already set).
3. Deploy the folder to Netlify (drag & drop or from a repo), then open the site.
4. Click **Refresh** — you should see your rows. Change **Status**, hit **Save** → it re-syncs.

### Direct (no proxy)

If you must call Apps Script directly, set `API_BASE` in `config.js` to your `/exec` URL. Your Apps Script must return JSON and allow CORS. The app tries `GET ?action=list`, JSON `POST`, form `POST`, fallback `GET`, and `GET ?mode=list` — so it works with a lot of backends.

## Expected Backend (flexible)

**List** — Any of these is fine:
- `{ "data": [{obj}, ...] }` (array of objects)
- `{ "rows": [{obj}, ...] }`
- `{ "values": [[...headers], [...row1], ...] }` (2D array with headers in the first row)
- or just `[ {obj}, ... ]`

**Update** — The app sends a POST (with fallbacks) including:
```
{ "action": "update",
  "id": "...",
  "rowIndex": 2,               // also sends "row"
  "status": "In Progress",     // also sends "Status" and "STATUS"
  "<StatusHeaderName>": "...",
  "headers": [...] }
```
Return any JSON (HTTP 200) on success.

## Diagnostics

Click **Diagnostics** in the footer to see the last request method, URL, status, content-type, and a short preview of responses. This helps spot an HTML response (e.g., not deployed / not public) vs proper JSON.

## Tips

- In Apps Script, deploy the Web App with **"Anyone with the link"** access.
- If your status column isn't literally "Status", set `STATUS_HEADER_NAME` in `config.js`.
- If your backend uses a different param (e.g., `mode=list`), the app already tries it.

Built: 2025-10-30.