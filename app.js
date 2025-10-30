(function () {
  const cfg = window.APP_CONFIG || {};
  const API = cfg.API_BASE;
  const EXTRA = cfg.EXTRA_PARAMS || {};
  const STATUS_HEADER_NAME = (cfg.STATUS_HEADER_NAME || "Status").toLowerCase();
  const KNOWN_STATUSES = Array.isArray(cfg.KNOWN_STATUSES) && cfg.KNOWN_STATUSES.length
    ? cfg.KNOWN_STATUSES : ["New", "In Progress", "On Hold", "Done"];
  const DEBUG_DEFAULT = !!cfg.DEBUG;

  // Elements
  const noticeEl = document.getElementById("notice");
  const loadingEl = document.getElementById("loading");
  const tableWrap = document.getElementById("tableWrap");
  const refreshBtn = document.getElementById("refreshBtn");
  const searchInput = document.getElementById("searchInput");
  const debugEl = document.getElementById("debug");
  const toggleDebugBtn = document.getElementById("toggleDebug");

  // State
  let rows = [];           // Array of objects
  let headers = [];        // Array of header strings
  let statusKey = "status";// resolved status column key
  let idKey = "id";        // resolved id column key (fallbacks to "rowIndex")
  let rowIndexKey = "rowIndex";
  let debugOn = DEBUG_DEFAULT;
  let lastDiag = "";

  const setDebug = (txt) => {
    lastDiag = txt ?? lastDiag;
    if (!debugOn) { debugEl.hidden = true; return; }
    debugEl.hidden = false;
    debugEl.textContent = lastDiag || "(no diagnostics yet)";
  };
  toggleDebugBtn.addEventListener("click", () => {
    debugOn = !debugOn; setDebug();
  });
  setDebug();

  // Utils
  const showNotice = (msg, isError=false) => {
    noticeEl.textContent = msg;
    noticeEl.hidden = false;
    noticeEl.classList.toggle("error", isError);
    setTimeout(() => (noticeEl.hidden = true), 4000);
  };
  const showLoading = (show) => {
    loadingEl.style.display = show ? "block" : "none";
  };

  const encodeParams = (obj) =>
    new URLSearchParams(Object.entries(obj).reduce((acc, [k, v]) => {
      acc[k] = typeof v === "object" ? JSON.stringify(v) : (v ?? "");
      return acc;
    }, {}));

  // Try multiple "list" shapes: action=list, mode=list, get=list, or no query
  async function apiList() {
    const withExtra = { ...EXTRA, action: "list" };
    const attempts = [
      // GET with action=list
      async () => {
        const sep = API.includes("?") ? "&" : "?";
        const url = API + sep + encodeParams(withExtra).toString();
        const res = await fetch(url, { method: "GET" });
        return await parseResponse(res, "GET?action=list", url);
      },
      // POST JSON {action:"list"}
      async () => {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(withExtra),
        });
        return await parseResponse(res, "POST json {action:list}", API);
      },
      // POST form-encoded
      async () => {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: encodeParams(withExtra),
        });
        return await parseResponse(res, "POST form {action:list}", API);
      },
      // GET no query (some scripts decide by default)
      async () => {
        const res = await fetch(API, { method: "GET" });
        return await parseResponse(res, "GET (no params)", API);
      },
      // GET with mode=list
      async () => {
        const sep = API.includes("?") ? "&" : "?";
        const url = API + sep + "mode=list";
        const res = await fetch(url, { method: "GET" });
        return await parseResponse(res, "GET?mode=list", url);
      },
    ];

    const errors = [];
    for (const attempt of attempts) {
      try {
        const out = await attempt();
        if (out != null) return out;
      } catch (e) {
        errors.push(String(e && e.message || e));
      }
    }
    throw new Error("All list attempts failed.\n" + errors.join("\n"));
  }

  async function parseResponse(res, label, url) {
    const ct = res.headers.get("content-type") || "";
    let bodyText = "";
    let diagBase = `Request: ${label}\nURL: ${url}\nStatus: ${res.status}\nContent-Type: ${ct}`;
    // Prefer JSON; if parse fails, capture text for diagnostics
    try {
      const data = await res.clone().json();
      setDebug(diagBase + "\nParsed as JSON ✅");
      return data;
    } catch {
      bodyText = await res.clone().text();
      setDebug(diagBase + "\nParsed as TEXT ⚠️\nPreview: " + bodyText.slice(0, 400));
      // Try to salvage JSON from text if it actually contains JSON
      const maybe = bodyText.trim();
      if (maybe.startsWith("{") || maybe.startsWith("[")) {
        try {
          return JSON.parse(maybe);
        } catch { /* ignore */ }
      }
      // Not JSON; return null to try the next attempt
      return null;
    }
  }

  // Robust update call — tries variants for maximum compatibility
  async function apiUpdate(payload) {
    const body = { ...EXTRA, action: "update", ...payload };

    const attempts = [
      async () => {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return await parseUpdateResponse(res, "POST json {action:update}");
      },
      async () => {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: encodeParams(body),
        });
        return await parseUpdateResponse(res, "POST form {action:update}");
      },
      async () => {
        const sep = API.includes("?") ? "&" : "?";
        const url = API + sep + encodeParams(body).toString();
        const res = await fetch(url, { method: "GET" });
        return await parseUpdateResponse(res, "GET with params (update)");
      },
    ];

    const errors = [];
    for (const attempt of attempts) {
      try {
        const out = await attempt();
        if (out != null) return out;
      } catch (e) {
        errors.push(String(e && e.message || e));
      }
    }
    throw new Error("All update attempts failed.\n" + errors.join("\n"));
  }

  async function parseUpdateResponse(res, label) {
    const ct = res.headers.get("content-type") || "";
    const okish = res.ok || (res.status >= 200 && res.status < 400);
    let data = null;
    try {
      data = await res.clone().json();
    } catch {
      const txt = await res.clone().text();
      setDebug(`[Update] ${label}\nStatus: ${res.status}\nCT: ${ct}\nText: ${txt.slice(0, 300)}`);
      if (okish) return { ok: true, text: txt };
      return null;
    }
    setDebug(`[Update] ${label}\nStatus: ${res.status}\nCT: ${ct}\nJSON: ok`);
    return okish ? (data || { ok: true }) : null;
  }

  // Shape normalization
  function normalizeListResponse(raw) {
    // Accept common shapes
    // 1) {data:[...]} or [ ... ]
    let data = Array.isArray(raw) ? raw : raw && (raw.data || raw.rows || raw.values || raw.result || raw.items);
    if (!data && raw && raw.sheetData && (raw.sheetData.rows || raw.sheetData.values)) {
      data = raw.sheetData.rows || raw.sheetData.values;
    }
    if (!data) data = [];

    // Array of objects
    if (Array.isArray(data) && data.length && typeof data[0] === "object" && !Array.isArray(data[0])) {
      const hdrs = Object.keys(data[0]);
      return { rows: data, headers: hdrs };
    }

    // 2D array with first row = headers
    if (Array.isArray(data) && data.length && Array.isArray(data[0])) {
      const hdrs = (data[0] || []).map(String);
      const objects = data.slice(1).map((arr, idx) => {
        const obj = {};
        hdrs.forEach((h, i) => (obj[h] = arr[i]));
        obj.rowIndex = (idx + 2); // include default sheet row index
        return obj;
      });
      return { rows: objects, headers: hdrs };
    }

    // If it's a flat array of objects without explicit headers
    if (Array.isArray(data) && data.length && typeof data[0] === "object") {
      const hdrs = Object.keys(data[0]);
      return { rows: data, headers: hdrs };
    }

    return { rows: [], headers: [] };
  }

  function resolveKeys(hdrs) {
    const lc = (s)=>String(s||"").toLowerCase();
    const statusK = hdrs.find(h => lc(h) === STATUS_HEADER_NAME)
      || hdrs.find(h => /status/i.test(String(h)))
      || "status";
    const idK = hdrs.find(h => /^id$/i.test(String(h)))
      || hdrs.find(h => /(candidate.?id|record.?id|uid|key)/i.test(String(h)))
      || "id";
    return { statusK, idK };
  }

  function renderTable() {
    if (!headers.length) {
      tableWrap.innerHTML = "<div class='loading'>No data.</div>";
      tableWrap.hidden = false;
      return;
    }

    const q = (searchInput.value || "").toLowerCase().trim();
    const filtered = q
      ? rows.filter(r => Object.values(r).some(v => String(v ?? "").toLowerCase().includes(q)))
      : rows;

    const cols = headers; // show all headers
    const headHtml = cols.map(h => `<th>${escapeHtml(h)}</th>`).join("") + "<th>Actions</th>";

    const bodyHtml = filtered.map((r, idx) => {
      const rid = r[idKey] ?? "";
      const rowIndexV = r[rowIndexKey] ?? r.rowIndex ?? "";
      const currentStatus = String(r[statusKey] ?? "").trim();

      // Build status select
      const uniqueStatuses = Array.from(new Set([currentStatus, ...KNOWN_STATUSES].filter(Boolean)));
      const options = uniqueStatuses
        .map(s => `<option value="${escapeAttr(s)}"${s === currentStatus ? " selected" : ""}>${escapeHtml(s)}</option>`)
        .join("");
      const statusCell = `
        <select class="status" data-rid="${escapeAttr(rid)}" data-rowindex="${escapeAttr(rowIndexV)}">
          ${options}
        </select>
      `;

      const tds = cols.map(h => {
        const key = String(h);
        if (String(h).toLowerCase() === statusKey.toLowerCase()) {
          return `<td>${statusCell}</td>`;
        }
        const v = r[key];
        return `<td>${escapeHtml(v)}</td>`;
      }).join("");

      return `
        <tr data-i="${idx}">
          ${tds}
          <td class="row-actions">
            <button class="save-btn" data-save="${idx}">Save</button>
          </td>
        </tr>
      `;
    }).join("");

    tableWrap.innerHTML = `
      <table>
        <thead><tr>${headHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    `;
    tableWrap.hidden = false;

    // Attach events
    tableWrap.querySelectorAll("button[data-save]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-save"), 10);
        await onSave(idx, e.currentTarget);
      });
    });
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeAttr(v) { return escapeHtml(v); }

  async function onSave(rowIdx, btn) {
    try {
      btn.disabled = true;
      const tr = tableWrap.querySelector(`tr[data-i="${rowIdx}"]`);
      const select = tr.querySelector("select.status");
      const newStatus = select.value;

      // Determine the backing row
      const r = rows[rowIdx];
      const rid = r[idKey] ?? "";
      const rowIndexV = r[rowIndexKey] ?? r.rowIndex ?? "";
      const payload = {
        id: rid,
        [statusKey]: newStatus,
        // Multiple hints so the backend can choose its preferred key:
        status: newStatus,
        Status: newStatus,
        STATUS: newStatus,
        rowIndex: rowIndexV,
        row: rowIndexV,
        headers,
      };

      await apiUpdate(payload);
      showNotice("Saved. Refreshing…");
      await loadAndRender(); // Re-sync to avoid "resets on refresh"
    } catch (err) {
      console.error(err);
      showNotice("Save failed: " + (err.message || err), true);
    } finally {
      btn.disabled = false;
    }
  }

  async function loadAndRender() {
    showLoading(true);
    tableWrap.hidden = true;
    try {
      const raw = await apiList();
      const norm = normalizeListResponse(raw);
      rows = norm.rows;
      headers = norm.headers;

      const { statusK, idK } = resolveKeys(headers);
      statusKey = statusK;
      idKey = idK;
      rowIndexKey = "rowIndex";

      renderTable();
    } catch (err) {
      console.error(err);
      tableWrap.hidden = false;
      tableWrap.innerHTML = `<div class="loading error">Load failed: ${escapeHtml(err.message || err)}</div>`;
    } finally {
      showLoading(false);
    }
  }

  // Wire up
  refreshBtn.addEventListener("click", loadAndRender);
  searchInput.addEventListener("input", renderTable);

  // Initial load
  if (!API) {
    tableWrap.innerHTML = "<div class='loading error'>Missing API_BASE in config.js</div>";
    loadingEl.style.display = "none";
  } else {
    loadAndRender();
  }
})();
