(function () {
  const cfg = window.APP_CONFIG || {};
  const API = cfg.API_BASE;
  const EXTRA = cfg.EXTRA_PARAMS || {};
  const STATUS_HEADER_NAME = (cfg.STATUS_HEADER_NAME || "Status").toLowerCase();
  const KNOWN_STATUSES = Array.isArray(cfg.KNOWN_STATUSES) && cfg.KNOWN_STATUSES.length
    ? cfg.KNOWN_STATUSES : ["New", "In Progress", "On Hold", "Done"];

  // Elements
  const noticeEl = document.getElementById("notice");
  const loadingEl = document.getElementById("loading");
  const tableWrap = document.getElementById("tableWrap");
  const refreshBtn = document.getElementById("refreshBtn");
  const searchInput = document.getElementById("searchInput");

  // State
  let rows = [];           // Array of objects
  let headers = [];        // Array of header strings
  let statusKey = "status";// resolved status column key
  let idKey = "id";        // resolved id column key (fallbacks to "rowIndex")
  let rowIndexKey = "rowIndex";

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

  // Robust fetch JSON with graceful fallbacks (GET ?action=list or POST {action:"list"})
  async function apiList() {
    const withExtra = { ...EXTRA, action: "list" };
    // Try GET first
    let url = API;
    const sep = API.includes("?") ? "&" : "?";
    url += sep + encodeParams(withExtra).toString();

    try {
      const res = await fetch(url, { method: "GET", mode: "cors" });
      const data = await res.json();
      return data;
    } catch (e) {
      // Retry POST JSON
      const res = await fetch(API, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withExtra),
      });
      try {
        const data = await res.json();
        return data;
      } catch {
        const txt = await res.text();
        throw new Error("Unexpected response: " + txt.slice(0, 200));
      }
    }
  }

  // Robust update call (POST preferred; falls back to form POST or GET)
  async function apiUpdate(payload) {
    const body = { ...EXTRA, action: "update", ...payload };
    // POST JSON first
    try {
      const res = await fetch(API, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(async () => ({ text: await res.text() }));
      if (!res.ok) throw new Error(typeof data === "string" ? data : (data.error || "Update failed"));
      return data;
    } catch (e1) {
      // Try x-www-form-urlencoded
      try {
        const res = await fetch(API, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: encodeParams(body),
        });
        const data = await res.json().catch(async () => ({ text: await res.text() }));
        if (!res.ok) throw new Error(typeof data === "string" ? data : (data.error || "Update failed"));
        return data;
      } catch (e2) {
        // Try GET as a last resort
        const sep = API.includes("?") ? "&" : "?";
        const url = API + sep + encodeParams(body).toString();
        const res = await fetch(url, { method: "GET", mode: "cors" });
        if (!res.ok) throw new Error("Update failed: " + res.status);
        const data = await res.json().catch(async () => ({ text: await res.text() }));
        return data;
      }
    }
  }

  // Normalize various possible responses into [{}, {}, ...] object rows + headers
  function normalizeListResponse(raw) {
    // Accept either {data:[...]} or [...]
    const data = Array.isArray(raw) ? raw : (raw && raw.data) ? raw.data : [];
    if (!Array.isArray(data)) throw new Error("Bad data format");

    // Case 1: array of objects
    if (data.length && typeof data[0] === "object" && !Array.isArray(data[0])) {
      const hdrs = Object.keys(data[0]);
      return { rows: data, headers: hdrs };
    }

    // Case 2: 2D array with first row headers
    if (data.length && Array.isArray(data[0])) {
      const hdrs = (data[0] || []).map(String);
      const objects = data.slice(1).map((arr, idx) => {
        const obj = {};
        hdrs.forEach((h, i) => (obj[h] = arr[i]));
        // Provide a default rowIndex starting from 2 (header is row 1 in Sheets)
        obj.rowIndex = (idx + 2);
        return obj;
      });
      return { rows: objects, headers: hdrs };
    }

    // Fallback: empty set
    return { rows: [], headers: [] };
  }

  function resolveKeys(hdrs) {
    // status
    const statusK = hdrs.find(h => String(h).toLowerCase() === STATUS_HEADER_NAME)
      || hdrs.find(h => /status/i.test(String(h)))
      || "status";
    // id
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
      const rowIndexV = r[rowIndexKey] ?? r.rowIndex ?? ""; // Sheets row #
      const payload = {
        id: rid,
        [statusKey]: newStatus,
        // Provide multiple hints so the backend can choose:
        status: newStatus,
        rowIndex: rowIndexV,
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

      // Resolve keys based on headers
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
