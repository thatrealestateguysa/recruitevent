# Recruit 101 — Front-end

A tiny, robust front-end that **fetches your rows from Google Apps Script** and **updates status** without breaking your backend.

## Files

- `index.html` — UI (open this in a browser).
- `styles.css` — minimal dark theme.
- `config.js` — set your Apps Script Web App URL here.
- `app.js` — all logic: load → render → update → re-sync.

## Setup (2 minutes)

1. **Edit `config.js`** and set `API_BASE` to your Apps Script Web App `/exec` URL.
2. If your script expects extras (like a sheet name or key), add them under `EXTRA_PARAMS`.
3. Open `index.html`. Click **Refresh** to pull data.

### Expected Backend API (flexible)

This UI tries the following automatically:

- **List**:
  - `GET  {API_BASE}?action=list&...` → returns either:
    - `{ "data": [{obj}, ...] }` **or**
    - `{ "data": [[...headers], [...row1], ...] }`
  - (fallback) `POST JSON { "action": "list", ... }`

- **Update** (status):
  - `POST JSON { "action": "update", "id": "...", "rowIndex": 2, "status": "In Progress", "headers": [...] }`
    (fallbacks to urlencoded POST or GET if needed)

Return `200` on success (any JSON).

> The app sends **both** `status` and `<StatusHeaderName>` keys, plus `rowIndex` and `id` so your script can choose what it prefers.

## Tips

- Deploy the Apps Script Web App with access: **Anyone with the link**.
- Make sure CORS is allowed (Apps Script web apps allow it by default).
- If your sheet’s status column isn’t called `Status`, set `STATUS_HEADER_NAME` in `config.js`.

## Troubleshooting

- **“resets on refresh”**: The app re-fetches after each save to stay in sync.
- **Wrong columns**: The app auto-detects headers; it also works with a 2D array format.
- **Still stuck?** Send me a sample of your list response (minus private data) so I can map exact fields.

Built: 2025-10-30.