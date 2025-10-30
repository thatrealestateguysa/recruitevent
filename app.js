
/* Recruit 101 — Frontend (REST mode) */
const BASE_URL = "https://script.google.com/macros/s/AKfycbzMBtSXNTotcNIK5wX2oFM5JuoNMoIZwY07LiOSdYZ2_vEo92KuA4fL5RXIzB-YA6_naw/exec";

let ALL = { stats: {}, contacts: [], statusOptions: [] };
let FILTER = { q:'', status:'' };
let REFRESH_TIMER = null;

const $ = (q, all=false) => all ? Array.from(document.querySelectorAll(q)) : document.querySelector(q);
const fmt = n => Intl.NumberFormat('en-ZA').format(n);
const nowFmt = () => new Date().toLocaleString('en-ZA');

function toast(msg, color){ const t=$('#toast'); t.textContent=msg||'Saved'; t.style.background=color||'var(--success)'; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1400);}
function setSyncState(text){ $('#syncState').textContent=text; }

function render(){ renderTabs(); renderStats(); renderTable(); if(!$('#statusFilter').dataset.bound) populateStatusFilter(); }

function renderTabs(){
  const s = ALL.stats || {};
  const container = $('#tabs');
  const order = ['All','To Contact','Whatsapp','Reply','Keen to meet','Cultivate','Invite to events','Event Invite Sent','Event Invite Accepted','Referred','No Whatsapp','Not interested','Unsubscribe'];
  container.innerHTML = order.map(label => {
    const key = label === 'All' ? 'total' : label;
    const count = s[key] || 0;
    const active = (label === 'All' && !FILTER.status) || (FILTER.status === label);
    return `<button class="tab ${active?'active':''}" data-status="${label==='All'?'':label}">${label} <span class="count">${fmt(count)}</span></button>`;
  }).join('');
  container.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', e => { FILTER.status = e.currentTarget.dataset.status || ''; $('#q').value=''; FILTER.q=''; render(); });
  });
}

function renderStats(){
  const s = ALL.stats || {};
  const rows = [
    {label:'Total', key:'total'},
    {label:'To Contact', key:'To Contact'},
    {label:'Whatsapp', key:'Whatsapp'},
    {label:'Reply', key:'Reply'},
    {label:'Keen to meet', key:'Keen to meet'},
    {label:'Cultivate', key:'Cultivate'},
    {label:'Invite to events', key:'Invite to events'},
    {label:'Event Invite Sent', key:'Event Invite Sent'},
  ];
  const container = $('#stats');
  container.innerHTML = rows.filter(r=>r.key in s).map(r => `
    <div class="card stat">
      <div class="label">${r.label}</div>
      <div class="value">${fmt(s[r.key]||0)}</div>
    </div>
  `).join('');
}

function populateStatusFilter(){
  const sel = $('#statusFilter');
  (ALL.statusOptions || []).forEach(opt => { const o=document.createElement('option'); o.value=opt; o.textContent=opt; sel.appendChild(o); });
  sel.dataset.bound='1';
}

function contactMatches(c){
  const q = FILTER.q.toLowerCase();
  const hit = !q || [c.name,c.surname,c.agency,c.cell,c.notes].some(x => String(x||'').toLowerCase().includes(q));
  const byStatus = !FILTER.status || c.status === FILTER.status;
  return hit && byStatus;
}

function renderTable(){
  const rows = (ALL.contacts||[]).filter(contactMatches);
  const tbody = $('#tbody');
  if(!rows.length){ tbody.innerHTML = `<tr><td colspan="7" class="muted" style="padding:16px">No results.</td></tr>`; return; }
  tbody.innerHTML = rows.map(c => `
    <tr data-row="${c.rowNumber}">
      <td class="nowrap"><strong>${esc(c.name||'')} ${esc(c.surname||'')}</strong><br><span class="muted">${esc(c.cell||'')}</span></td>
      <td>${esc(c.agency||'')}</td>
      <td><select class="status">${optionize(ALL.statusOptions, c.status)}</select></td>
      <td><textarea class="notes" placeholder="Add notes…">${esc(c.notes||'')}</textarea></td>
      <td class="nowrap">${esc(c.lastContact||'')}</td>
      <td class="nowrap">${renderWaButtons(c)}</td>
      <td class="nowrap"><button class="btn" onclick="saveRow(${c.rowNumber}, this)">Save</button></td>
    </tr>
  `).join('');
}

function renderWaButtons(c){
  const intl = c.intlPhone || '';
  const msg = encodeURIComponent(c.waMsg || '');
  const desktop = intl ? `whatsapp://send?phone=${intl}&text=${msg}` : '';
  const web = c.waLink || (intl ? `https://web.whatsapp.com/send?phone=${intl}&text=${msg}` : '');
  if(!intl && !web) return `<span class="muted">—</span>`;
  return `
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
      ${desktop?`<a class="link" href="${desktop}" onclick="setTimeout(()=>window.open('${web}','_blank'),800)">Open WhatsApp</a>`:''}
      ${(!desktop&&web)?`<a class="link" href="${web}" target="_blank" rel="noopener">Open WhatsApp</a>`:''}
      <button class="btn" onclick="copyMsg(\`${escapeBackticks(c.waMsg||'')}\`)">Copy Msg</button>
    </div>`;
}

function copyMsg(text){ navigator.clipboard.writeText(text||'').then(()=>toast('Message copied')).catch(()=>toast('Copy failed','var(--error)')); }

function esc(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[m]); }
function escapeBackticks(s){ return String(s).replace(/`/g,'\\`'); }
function optionize(list, selected){ return (list||[]).map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join(''); }

/* REST I/O (GET to avoid CORS preflight) */
async function refreshData(){
  setSyncState('Syncing…');
  try {
    const res = await fetch(BASE_URL + '?action=getDashboardData', { method:'GET' });
    const payload = await res.json();
    ALL = payload || { stats: {}, contacts: [], statusOptions: [] };
    render();
    $('#lastUpdated').textContent = 'Updated ' + nowFmt();
    setSyncState('Up to date');
  } catch(err) {
    console.error(err); setSyncState('Sync failed'); toast('Sync failed','var(--error)');
  }
}

async function saveRow(rowNumber, btn){
  const tr = document.querySelector(`tr[data-row="${rowNumber}"]`);
  if(!tr) return;
  const newStatus = tr.querySelector('select.status').value;
  const newNotes  = tr.querySelector('textarea.notes').value;

  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const url = BASE_URL + '?action=updateContactStatus&rowNumber=' + encodeURIComponent(rowNumber) +
                '&newStatus=' + encodeURIComponent(newStatus) +
                '&newNotes=' + encodeURIComponent(newNotes);
    const res = await fetch(url, { method:'GET' });
    const data = await res.json();
    btn.disabled = false; btn.textContent = 'Save';
    if(data && data.success){ toast('Saved'); refreshData(); } else { toast(data && data.message ? data.message : 'Save failed', 'var(--error)'); }
  } catch(err) { btn.disabled=false; btn.textContent='Save'; console.error(err); toast('Save failed','var(--error)'); }
}

/* Events */
document.addEventListener('DOMContentLoaded', () => {
  $('#q').addEventListener('input', debounce(e=>{ FILTER.q=e.target.value; renderTable(); },180));
  $('#statusFilter').addEventListener('change', e=>{ FILTER.status=e.target.value; renderTable(); });
  $('#refreshBtn').addEventListener('click', ()=>refreshData());
  refreshData();
  REFRESH_TIMER = setInterval(refreshData, 60000);
});
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) refreshData(); });
function debounce(fn, wait){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(null,args),wait); }; }
