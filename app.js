
/* Minimal greyscale front-end with runtime that supports:
   - Same-origin Apps Script (google.script.run) if available
   - Cross-origin JSONP if not
*/
const STATUS_OPTIONS = ['New','Contacted','Interview','Offer','Hired','Rejected'];
let DATA = [];
const { BASE_URL } = window.APP_CONFIG || { BASE_URL: '' };

function setStatus(message) {
  document.getElementById('statusMsg').textContent = message || '';
}

function normalizeKeyMap(obj) {
  const map = {};
  Object.keys(obj).forEach(k => map[k.trim().toLowerCase().replace(/\s+/g,'')] = k);
  return key => map[key.trim().toLowerCase().replace(/\s+/g,'')] || null;
}

function toDateInputValue(val) {
  if (!val) return '';
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(val))) return String(val);
    const d = new Date(val);
    if (!isNaN(d)) {
      const m = String(d.getMonth()+1).padStart(2,'0');
      const day = String(d.getDate()).padStart(2,'0');
      return `${d.getFullYear()}-${m}-${day}`;
    }
  } catch(_) {}
  return '';
}

// ---------- Transport layer ----------
function hasAppsScript() { return !!(window.google && google.script && google.script.run); }

function runServer(methodName, payload) {
  if (hasAppsScript()) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(err => reject(new Error(err && err.message ? err.message : String(err))))
        [methodName](payload);
    });
  } else {
    // JSONP fallback
    if (!BASE_URL) return Promise.reject(new Error('No BASE_URL configured'));
    const params = Object.assign({ action: methodName === 'getAll' ? 'list' : 'update' }, payload || {});
    return jsonp(BASE_URL, params);
  }
}

// JSONP helper
function jsonp(url, params={}, timeoutMs=15000) {
  return new Promise((resolve, reject) => {
    const cb = 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const q = new URLSearchParams(Object.assign({}, params, { callback: cb })).toString();
    const src = url + (url.includes('?') ? '&' : '?') + q;
    const script = document.createElement('script');
    let done = false;
    window[cb] = (data) => { if (done) return; done = true; cleanup(); resolve(data); };
    function cleanup(){ delete window[cb]; if (script.parentNode) script.parentNode.removeChild(script); }
    script.src = src;
    script.onerror = () => { if (done) return; done = true; cleanup(); reject(new Error('Network error')); };
    document.body.appendChild(script);
    setTimeout(() => { if (done) return; done = true; cleanup(); reject(new Error('Timeout')); }, timeoutMs);
  });
}

// ---------- UI ----------
function render(rows) {
  const tbody = document.getElementById('rows');
  tbody.innerHTML = '';

  const statusSel = document.getElementById('statusFilter');
  if (statusSel.children.length === 1) {
    STATUS_OPTIONS.forEach(s => {
      const o = document.createElement('option'); o.value = s; o.textContent = s; statusSel.appendChild(o);
    });
  }

  rows.forEach(obj => {
    const norm = normalizeKeyMap(obj);
    const ID = obj[norm('id')] ?? '';
    const NAME = obj[norm('name')] ?? obj[norm('candidate')] ?? '';
    const ROLE = obj[norm('role')] ?? obj[norm('job')] ?? obj[norm('position')] ?? '';
    const STATUS = obj[norm('status')] ?? '';
    const BUDATE = obj[norm('budate')] ?? obj[norm('bu date')] ?? obj[norm('budate')] ?? '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ID}</td>
      <td>${NAME}</td>
      <td>${ROLE}</td>
      <td>
        <select class="status-select" id="status-${ID}">
          ${STATUS_OPTIONS.map(s => `<option value="${s}" ${String(STATUS).trim()===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><input class="date-input" type="date" id="budate-${ID}" value="${toDateInputValue(BUDATE)}"></td>
      <td><button class="btn" id="save-${ID}">Save</button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector(`#save-${CSS.escape(String(ID))}`).addEventListener('click', () => save(ID));
  });

  filterRows();
}

function filterRows() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const tbody = document.getElementById('rows');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  let shown = 0;
  rows.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    const text = Array.from(tds).slice(0,5).map(td => td.textContent.toLowerCase()).join(' ');
    const statusVal = tr.querySelector('.status-select')?.value || '';
    const match = (!q || text.includes(q)) && (!status || statusVal === status);
    tr.style.display = match ? '' : 'none';
    if (match) shown++;
  });
  setStatus(`Showing ${shown} of ${rows.length}`);
}

// ---------- Actions ----------
async function refresh() {
  try {
    setStatus('Loading…');
    const res = await runServer('getAll', {});
    const rows = (res && (res.rows || res)) || [];
    DATA = Array.isArray(rows) ? rows : [];
    render(DATA);
    setStatus(`Loaded ${DATA.length} records.`);
  } catch (e) {
    setStatus('Failed to load: ' + e.message);
  }
}

async function save(id) {
  const btn = document.getElementById(`save-${id}`);
  const status = document.getElementById(`status-${id}`).value;
  const budate = document.getElementById(`budate-${id}`).value;
  try {
    btn.disabled = true; btn.textContent = 'Saving…'; setStatus(`Updating #${id}…`);
    const res = await runServer('updateStatus', { id, status, budate });
    if (res && (res.ok || res.row)) {
      setStatus(`Updated #${id}.`);
      await refresh();
    } else {
      setStatus('Failed: ' + (res && res.error ? res.error : 'Unknown error'));
      btn.disabled = false; btn.textContent = 'Save';
    }
  } catch (e) {
    setStatus('Error: ' + e.message);
    btn.disabled = false; btn.textContent = 'Save';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('search').addEventListener('input', filterRows);
  document.getElementById('statusFilter').addEventListener('change', filterRows);
  document.getElementById('refresh').addEventListener('click', refresh);
  refresh();
});
