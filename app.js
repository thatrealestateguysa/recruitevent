(function(){
  'use strict';

  const VERSION = "v4.0";
  const STATUS_OPTIONS = [
    "To Contact","Whatsapp","Reply","Keen to meet","Cultivate",
    "Invite to events","Not interested","No Whatsapp",
    "Unsubscribe","Referred",
    "Event Invite Sent","Event Invite Accepted"
  ];

  const el = {
    version: document.getElementById('version'),
    apiUrl: document.getElementById('apiUrl'),
    totalBadge: document.getElementById('totalBadge'),
    filteredBadge: document.getElementById('filteredBadge'),
    statusTabs: document.getElementById('statusTabs'),
    statusFilter: document.getElementById('statusFilter'),
    bulkStatusSelect: document.getElementById('bulkStatusSelect'),
    searchInput: document.getElementById('searchInput'),
    pageSize: document.getElementById('pageSize'),
    tbody: document.getElementById('tbody'),
    pageInfo: document.getElementById('pageInfo'),
    prev: document.getElementById('prevPage'),
    next: document.getElementById('nextPage'),
    refresh: document.getElementById('btnRefresh'),
    syncInfo: document.getElementById('syncInfo'),
    bulkApply: document.getElementById('bulkApply'),
    bulkSelectAll: document.getElementById('bulkSelectAll'),
    checkAll: document.getElementById('checkAll'),
  };

  const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "";

  // State
  let statTotal = 0;
  let allRows = [];
  let filtered = [];
  let page = 1;
  let perPage = parseInt(el.pageSize.value, 10) || 15;
  let currentStatus = ""; // All

  const normalize = s => String(s ?? '').trim();
  const eqStatus = (a,b) => normalize(a).toLowerCase() === normalize(b).toLowerCase();

  function setVersion(){
    if (el.version) el.version.textContent = VERSION;
    if (el.apiUrl) el.apiUrl.textContent = API_BASE;
  }

  function formatTime(d){
    const pad = n => String(n).padStart(2, "0");
    return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+" "+pad(d.getHours())+":"+pad(d.getMinutes());
  }
  function setSynced(){
    if (el.syncInfo) el.syncInfo.textContent = "Last sync: " + formatTime(new Date());
  }

  function buildStatusSelect(selectEl, includeBlank=true){
    selectEl.innerHTML = "";
    if (includeBlank){
      const opt = document.createElement('option');
      opt.value = "";
      opt.textContent = "All";
      selectEl.appendChild(opt);
    }
    STATUS_OPTIONS.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      selectEl.appendChild(o);
    });
  }

  buildStatusSelect(el.statusFilter, true);
  buildStatusSelect(el.bulkStatusSelect, false);

  // Tabs
  function renderTabs(byStatus){
    let total = 0;
    Object.keys(byStatus||{}).forEach(k => total += byStatus[k] || 0);
    statTotal = total;
    updateBadges();
    const frag = document.createDocumentFragment();
    function tab(label, value, count){
      const b = document.createElement('button');
      b.className = "tab"+(eqStatus(currentStatus, value) ? " active": "");
      b.dataset.value = value;
      b.innerHTML = `<span>${label}</span><span class="count">${count||0}</span>`;
      b.addEventListener('click', () => {
        currentStatus = value;
        el.statusFilter.value = value;
        loadRecipients(); // server-side filter
      });
      return b;
    }
    frag.appendChild(tab("All", "", total));
    STATUS_OPTIONS.forEach(s => frag.appendChild(tab(s, s, (byStatus&&byStatus[s])||0)));
    el.statusTabs.innerHTML = "";
    el.statusTabs.appendChild(frag);
  }

  function updateBadges(){
    if (el.totalBadge) el.totalBadge.textContent = "Total " + statTotal;
    if (el.filteredBadge) el.filteredBadge.textContent = "Filtered " + filtered.length;
  }

  // Fetch helpers (no-cache + cache-buster)
  async function apiGet(params={}){
    params.ts = Date.now();
    const qs = new URLSearchParams(params).toString();
    const url = API_BASE + (qs ? ("?" + qs) : "");
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });
    return res.json();
  }
  async function apiPost(body){
    body.ts = Date.now();
    const res = await fetch(API_BASE, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  // Data load
  async function loadRecipients(){
    el.tbody.innerHTML = `<tr><td colspan="9" class="muted">Loading…</td></tr>`;
    const status = currentStatus || el.statusFilter.value || "";
    const data = await apiGet({ action: "recipients", status });
    if (data.result !== "success"){
      el.tbody.innerHTML = `<tr><td colspan="9" class="muted">Error loading data</td></tr>`;
      console.error(data);
      return;
    }
    allRows = (data.recipients || []).map(r => ({ ...r, status: normalize(r.status) }));
    applyFilters();
    setSynced();

    const stat = await apiGet({ action: "stats" });
    if (stat && stat.result === "success"){
      renderTabs(stat.byStatus || {});
      Array.from(el.statusTabs.querySelectorAll('.tab')).forEach(t => {
        t.classList.toggle('active', eqStatus(t.dataset.value, (currentStatus||"")));
      });
    }
  }

  // Filters & pagination
  function applyFilters(){
    const q = normalize(el.searchInput.value).toLowerCase();
    filtered = allRows.filter(r => {
      if (!q) return true;
      const parts = [r.name, r.surname, r.agency, r.cell].map(x => normalize(x).toLowerCase());
      return parts.some(p => p.includes(q));
    });
    page = 1;
    renderPage();
    updateBadges();
  }

  function renderPage(){
    perPage = parseInt(el.pageSize.value, 10) || 15;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * perPage;
    const slice = filtered.slice(start, start + perPage);

    const rows = slice.map((r) => {
      const checkedId = `chk-${r.rowNumber}`;
      const safeUrl = r.waLink || "";
      const statusSel = statusSelectHtml(r);
      return `<tr data-row="${r.rowNumber}">
        <td><input type="checkbox" class="row-check" id="${checkedId}" /></td>
        <td>${r.rowNumber}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.surname)}</td>
        <td>${escapeHtml(r.cell)}</td>
        <td>${escapeHtml(r.agency)}</td>
        <td>${statusSel}</td>
        <td>
          <div class="note-cell">
            <input class="note-input" type="text" value="${escapeAttr(r.notes||"")}" placeholder="Type note and press ⏎" />
          </div>
        </td>
        <td>${safeUrl ? `<a href="${safeUrl}" class="whats-btn" onclick="return openWhats('${encodeURIComponent(safeUrl)}')">WhatsApp</a>` : '<span class="muted">No link</span>'}</td>
      </tr>`;
    }).join("");

    el.tbody.innerHTML = rows || `<tr><td colspan="9" class="muted">No rows</td></tr>`;
    el.pageInfo.textContent = `Page ${page} / ${Math.max(1, Math.ceil(total / perPage))} • ${total} rows`;
    el.prev.disabled = page <= 1;
    el.next.disabled = page >= Math.max(1, Math.ceil(total / perPage));
    el.checkAll.checked = false;
  }

  // Helpers
  function escapeHtml(s){
    return String(s||"").replace(/[&<>"']/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[m]||m));
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g, "&quot;"); }

  function statusSelectHtml(r){
    const opts = STATUS_OPTIONS.map(s => `<option value="${s}" ${eqStatus(r.status, s)?'selected':''}>${s}</option>`).join("");
    return `<select class="status-select">${opts}</select>`;
  }

  // Open WhatsApp (desktop-friendly: app protocol first, then web fallback; mobile uses wa.me)
  window.openWhats = function(urlEncoded){
    try{
      const url = decodeURIComponent(urlEncoded);
      let phone = "", text = "";
      try {
        const u = new URL(url);
        if (u.protocol === "whatsapp:") {
          const win = window.open(url, "_blank", "noopener,noreferrer");
          if (!win) alert("Popup blocked. Please allow popups for this site.");
          return false;
        }
        if (u.hostname.includes("wa.me")) {
          phone = (u.pathname || "").replace(/\//g, "");
          text  = u.searchParams.get("text") || "";
        } else if (u.hostname.includes("web.whatsapp.com")) {
          phone = u.searchParams.get("phone") || "";
          text  = u.searchParams.get("text") || "";
        }
      } catch (_){}

      if (!phone) {
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win) alert("Popup blocked. Please allow popups for this site.");
        return false;
      }

      const encText = encodeURIComponent(decodeURIComponent(text || "")).replace(/%20/g, "+");
      const appLink  = `whatsapp://send?phone=${phone}&text=${encText}`;
      const webLink  = `https://web.whatsapp.com/send?phone=${phone}&text=${encText}`;
      const waLink   = `https://wa.me/${phone}?text=${encText}`;

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (!isMobile) {
        const winApp = window.open(appLink, "_blank", "noopener,noreferrer");
        if (!winApp) {
          const winWeb = window.open(webLink, "_blank", "noopener,noreferrer");
          if (!winWeb) alert("Popup blocked. Please allow popups for this site.");
        }
      } else {
        const winWa = window.open(waLink, "_blank", "noopener,noreferrer");
        if (!winWa) alert("Popup blocked. Please allow popups for this site.");
      }
      return false;
    }catch(_){ return true; }
  };

  // Events
  el.refresh.addEventListener('click', loadRecipients);
  el.statusFilter.addEventListener('change', () => { currentStatus = el.statusFilter.value || ""; loadRecipients(); });
  el.pageSize.addEventListener('change', renderPage);
  el.searchInput.addEventListener('input', () => { page=1; applyFilters(); });
  el.prev.addEventListener('click', () => { page=Math.max(1,page-1); renderPage(); });
  el.next.addEventListener('click', () => { page=page+1; renderPage(); });

  el.tbody.addEventListener('change', async (evt) => {
    const target = evt.target;
    const tr = target.closest('tr[data-row]');
    if (!tr) return;
    const rowNumber = Number(tr.getAttribute('data-row'));
    if (target.classList.contains('status-select')){
      target.disabled = true;
      const newStatus = target.value;
      await apiPost({ action: "updateSingleStatus", payload: { rowNumber, newStatus } });
      target.disabled = false;
      await loadRecipients(); // pull truth from backend
    }
  });

  el.tbody.addEventListener('keydown', async (evt) => {
    if (evt.key !== 'Enter') return;
    const target = evt.target;
    if (!target.classList.contains('note-input')) return;
    const tr = target.closest('tr[data-row]'); if (!tr) return;
    const rowNumber = Number(tr.getAttribute('data-row'));
    target.disabled = true;
    await apiPost({ action: "updateNote", payload: { rowNumber, note: target.value } });
    target.disabled = false;
    await loadRecipients();
  });

  el.bulkApply.addEventListener('click', async () => {
    const newStatus = el.bulkStatusSelect.value;
    if (!newStatus){ alert("Pick a bulk status first."); return; }
    const checks = Array.from(document.querySelectorAll('.row-check')).filter(x => x.checked);
    if (checks.length === 0){ alert("Select at least one row."); return; }
    for (const c of checks){
      const tr = c.closest('tr[data-row]');
      const rowNumber = Number(tr.getAttribute('data-row'));
      await apiPost({ action: "updateSingleStatus", payload: { rowNumber, newStatus } });
    }
    await loadRecipients();
  });

  el.bulkSelectAll.addEventListener('click', () => {
    document.querySelectorAll('.row-check').forEach(x => x.checked = true);
  });

  el.checkAll.addEventListener('change', (e) => {
    const val = e.target.checked;
    document.querySelectorAll('.row-check').forEach(x => x.checked = val);
  });

  // Copy API URL pill (with fallback prompt for HTTP pages)
  el.apiUrl.addEventListener('click', async () => {
    try{
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(API_BASE);
        el.apiUrl.textContent = "Copied! " + API_BASE;
        setTimeout(() => el.apiUrl.textContent = API_BASE, 1500);
      } else {
        prompt("Copy this API URL:", API_BASE);
      }
    }catch(_){
      prompt("Copy this API URL:", API_BASE);
    }
  });

  // Init
  window.addEventListener('DOMContentLoaded', async () => {
    setVersion();
    if (API_BASE) { await loadRecipients(); }
  });
})();