
# Recruit 101 — Frontend (wired to GAS URL)

**BASE_URL**
```
https://script.google.com/macros/s/AKfycbzMBtSXNTotcNIK5wX2oFM5JuoNMoIZwY07LiOSdYZ2_vEo92KuA4fL5RXIzB-YA6_naw/exec
```

The frontend uses REST-style GET endpoints:
- `GET https://script.google.com/macros/s/AKfycbzMBtSXNTotcNIK5wX2oFM5JuoNMoIZwY07LiOSdYZ2_vEo92KuA4fL5RXIzB-YA6_naw/exec?action=getDashboardData` → returns JSON payload with stats + contacts.
- `GET https://script.google.com/macros/s/AKfycbzMBtSXNTotcNIK5wX2oFM5JuoNMoIZwY07LiOSdYZ2_vEo92KuA4fL5RXIzB-YA6_naw/exec?action=updateContactStatus&rowNumber=R&newStatus=...&newNotes=...` → updates a row, returns `{success:true}`.

This avoids CORS preflights and works from any static host (GitHub Pages, Netlify, Vercel, etc.).
