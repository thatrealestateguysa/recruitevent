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
  let rows = [];
  let headers = [];
  let statusKey = "status";
  let idKey = "id";
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
    setTimeout(() => (noticeEl.hidden = true), 2500);
  };
  const showLoading = (show) => {
    loadingEl.style.display = show ? "block" : "none";
  };

  const encodeParams = (obj) =>
    new URLSearchParams(Object.entries(obj).reduce((acc, [k, v]) => {
      acc[k] = typeof v === "object" ? JSON.stringify(v) : (v ?? "");
      return acc;
    }, {}));

  function isUrl(v) {
    try { return /^https?:\/\//i.test(String(v || "")); } catch { return false; }
  }

  async function apiList() {
    const withExtra = { ...EXTRA, action: "list" };
    const attempts = [
      async () => {
        const sep = API.includes("?") ? "&" : "?";
        const url = API + sep + encodeParams(withExtra).toString();
        const res = await fetch(url, { method: "GET" });
        return await parseResponse(res, "GET?action=list", url);
      },
      async () => {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(withExtra),
        });
        return await parseResponse(res, "POST json {action:list}", API);
      },
      async () => {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: encodeParams(withExtra),
        });
        return await parseResponse(res, "POST form {action:list}", API);
      },
      async () => {
        const res = await fetch(API, { method: "GET" });
        return await parseResponse(res, "GET (no params)", API);
      },
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
    try {
      const data = await res.clone().json();
      setDebug(diagBase + "\nParsed as JSON ✅");
      return data;
    } catch {
      bodyText = await res.clone().text();
      setDebug(diagBase + "\nParsed as TEXT ⚠️\nPreview: " + bodyText.slice(0, 400));
      const maybe = bodyText.trim();
      if (maybe.startsWith("{") || maybe.startsWith("[")) {
        try { return JSON.parse(maybe); } catch {}
      }
      return null;
    }
  }

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

  function normalizeListResponse(raw) {
    let data = Array.isArray(raw) ? raw : raw && (raw.data || raw.rows || raw.values || raw.result || raw.items);
    if (!data && raw && raw.sheetData && (raw.sheetData.rows || raw.sheetData.values)) {
      data = raw.sheetData.rows || raw.sheetData.values;
    }
    if (!data) data = [];

    if (Array.isArray(data) && data.length && typeof data[0] === "object" && !Array.isArray(data[0])) {
      const hdrs = Object.keys(data[0]);
      return { rows: data, headers: hdrs };
    }

    if (Array.isArray(data) && data.length && Array.isArray(data[0])) {
      const hdrs = (data[0] || []).map(String);
      const objects = data.slice(1).map((arr, idx) => {
        const obj = {};
        hdrs.forEach((h, i) => (obj[h] = arr[i]));
        obj.rowIndex = (idx + 2);
        return obj;
      });
      return { rows: objects, headers: hdrs };
    }

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

  function renderWhatsAppCell(h, v) {
    const isWAHeader = /whats\s*app|whatsapp|wa\s*link/i.test(String(h));
    if (isWAHeader && isUrl(v)) {
      const href = String(v);
      return `<div class="btn-group">
        <a class="btn btn-mini linkish" href="${href}" target="_blank" rel="noopener">Open WhatsApp</a>
        <button class="btn btn-mini copy-btn" data-copy="${escapeAttr(href)}">Copy</button>
      </div>`;
    }
    if (isUrl(v)) {
      const href = String(v);
      return `<a class="btn btn-mini linkish" href="${href}" target="_blank" rel="noopener">Open</a>`;
    }
    // Non-URL fallback
    return `<div class="truncate">${escapeHtml(v)}</div>`;
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

    const cols = headers;
    const headHtml = cols.map(h => `<th>${escapeHtml(h)}</th>`).join("");

    const bodyHtml = filtered.map((r, idx) => {
      const rid = r[idKey] ?? "";
      const rowIndexV = r[rowIndexKey] ?? r.rowIndex ?? "";
      const currentStatus = String(r[statusKey] ?? "").trim();

      const uniqueStatuses = Array.from(new Set([currentStatus, ...KNOWN_STATUSES].filter(Boolean)));
      const options = uniqueStatuses
        .map(s => `<option value="${escapeAttr(s)}"${s === currentStatus ? " selected" : ""}>${escapeHtml(s)}</option>`)
        .join("");
      const statusCell = `<select class="status" data-rid="${escapeAttr(rid)}" data-rowindex="${escapeAttr(rowIndexV)}">${options}</select>`;

      const tds = cols.map(h => {
        const key = String(h);
        const v = r[key];
        if (String(h).toLowerCase() === statusKey.toLowerCase()) {
          return `<td>${statusCell}</td>`;
        }
        // Special render for WhatsApp/link columns
        if (/whats\s*app|whatsapp|link/i.test(key)) {
          return `<td>${renderWhatsAppCell(h, v)}</td>`;
        }
        return `<td><div class="truncate">${escapeHtml(v)}</div></td>`;
      }).join("");

      return `<tr data-i="${idx}">${tds}</tr>`;
    }).join("");

    tableWrap.innerHTML = `
      <table>
        <thead><tr>${headHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    `;
    tableWrap.hidden = false;

    // Autosave on change
    tableWrap.querySelectorAll("select.status").forEach(sel => {
      sel.addEventListener("change", async (e) => {
        const tr = e.target.closest("tr");
        const idx = parseInt(tr.getAttribute("data-i"), 10);
        await onSave(idx, e.target);
      });
    });

    // Copy buttons
    tableWrap.querySelectorAll(".copy-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const txt = e.currentTarget.getAttribute("data-copy") || "";
        try {
          await navigator.clipboard.writeText(txt);
          showNotice("Link copied");
        } catch {
          // fallback
          const ta = document.createElement("textarea");
          ta.value = txt; document.body.appendChild(ta);
          ta.select(); document.execCommand("copy"); ta.remove();
          showNotice("Link copied");
        }
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

  async function onSave(rowIdx, controlEl) {
    try {
      controlEl.disabled = true;
      const tr = tableWrap.querySelector(`tr[data-i="${rowIdx}"]`);
      const select = tr.querySelector("select.status");
      const newStatus = select.value;

      const r = rows[rowIdx];
      const rid = r[idKey] ?? "";
      const rowIndexV = r[rowIndexKey] ?? r.rowIndex ?? "";
      const payload = {
        id: rid,
        [statusKey]: newStatus,
        status: newStatus,
        Status: newStatus,
        STATUS: newStatus,
        rowIndex: rowIndexV,
        row: rowIndexV,
        headers,
      };

      await apiUpdate(payload);
      showNotice("Saved");
      await loadAndRender(); // ensure front/back stay aligned
    } catch (err) {
      console.error(err);
      showNotice("Save failed: " + (err.message || err), true);
    } finally {
      controlEl.disabled = false;
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

  refreshBtn.addEventListener("click", loadAndRender);
  searchInput.addEventListener("input", renderTable);

  if (!API) {
    tableWrap.innerHTML = "<div class='loading error'>Missing API_BASE in config.js</div>";
    loadingEl.style.display = "none";
  } else {
    loadAndRender();
  }
})();
