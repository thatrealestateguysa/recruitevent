/* Configure your Apps Script Web App endpoint
 *
 * If you're deploying on Netlify, keep API_BASE="/api" and set the proxy in netlify.toml.
 * Otherwise, set API_BASE to your Apps Script /exec URL.
 */
window.APP_CONFIG = {
  // Option A (Netlify proxy)
  API_BASE: "/api",
  // Option B (direct Apps Script):
  // API_BASE: "https://script.google.com/macros/s/AKfycbw3htODYprb9WCj1qKeWA7xHNwi_5m7BY_ta7FQF0llaBcR15kQr6Ee7SXOIGZNE5yj9Q/exec",

  EXTRA_PARAMS: {
    // "sheet": "Status",
    // "key": "YOUR_KEY"
  },

  STATUS_HEADER_NAME: "Status",
  KNOWN_STATUSES: ["New", "Event Invite Sent", "RSVP Yes", "RSVP No", "On Hold", "Done", "Cancelled"],

  DEBUG: false,
};
