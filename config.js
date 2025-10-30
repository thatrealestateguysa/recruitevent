/* Configure your Apps Script Web App endpoint
 *
 * If you're deploying on Netlify and want to avoid CORS entirely, keep API_BASE="/api"
 * and set the proxy in netlify.toml (already included). Then edit the target URL below.
 */
window.APP_CONFIG = {
  // Option A (recommended on Netlify): call the local proxy path
  API_BASE: "/api",
  // Option B: call Apps Script directly (may hit CORS) — replace with your /exec URL:
  // API_BASE: "https://script.google.com/macros/s/AKfycbw3htODYprb9WCj1qKeWA7xHNwi_5m7BY_ta7FQF0llaBcR15kQr6Ee7SXOIGZNE5yj9Q/exec",

  EXTRA_PARAMS: {
    // "sheet": "Status",
    // "key": "YOUR_KEY"
  },

  STATUS_HEADER_NAME: "Status",
  KNOWN_STATUSES: ["New", "In Progress", "On Hold", "Done", "Cancelled"],

  // Set true to show diagnostics by default
  DEBUG: false,
};
