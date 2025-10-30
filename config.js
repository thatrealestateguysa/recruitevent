/* Set your Apps Script Web App endpoint here.
 * Example: https://script.google.com/macros/s/AKfycbw3htODYprb9WCj1qKeWA7xHNwi_5m7BY_ta7FQF0llaBcR15kQr6Ee7SXOIGZNE5yj9Q/exec
 */
window.APP_CONFIG = {
  API_BASE: "https://script.google.com/macros/s/AKfycbw3htODYprb9WCj1qKeWA7xHNwi_5m7BY_ta7FQF0llaBcR15kQr6Ee7SXOIGZNE5yj9Q/exec",
  // If your script requires a key or sheet name, add here and the frontend will pass it along.
  EXTRA_PARAMS: {
    // "sheet": "Status",
    // "key": "YOUR_KEY"
  },
  // The column header used for status, case-insensitive (fallbacks apply).
  STATUS_HEADER_NAME: "Status",
  // Known statuses to show in the picker. The current value is always shown even if not in this list.
  KNOWN_STATUSES: ["New", "In Progress", "On Hold", "Done", "Cancelled"]
};
