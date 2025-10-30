
/* Recruit 101 — Dark Frontend (tabs + desktop WA + resilient sync) */
const BASE_URL = "https://script.google.com/macros/s/AKfycbw2w6oTqx8m2OB9qeHmNLy2C2JSdP3B3SGVDJvsLQaCI8RoQfL9qKIW2Kcu88lf2gI1OQ/exec";

let ALL = { stats: {}, contacts: [], statusOptions: [] };
let FILTER = { q:'', status:'' };
let REFRESH_TIMER = null;

const $ = (q, all=false) => all ? Array.from(document.querySelectorAll(q)) : document.querySelector(q);
const nowFmt = () => new Date().toLocaleString('en-ZA');
const fmt = n => Intl.NumberFormat('en-ZA').format(n);

function toast(msg, color){ const t=$('#toast'); t.textContent=msg||'Saved'; t.style.background=color||'var(--success)'; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 1400); }
function setSyncState(text){ $('#syncState').textContent = text; }

function render(){ renderTabs(); renderTable(); }

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
  container.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', e => { FILTER.status = e.currentTarget.dataset.status || ''; $('#q').value=''; FILTER.q=''; renderTable(); }));
}

function contactMatches(c){
  const q = (FILTER.q||'').toLowerCase();
  const hit = !q || [c.name,c.surname,c.agency,c.cell,c.notes].some(x => String(x||'').toLowerCase().includes(q));
  const byStatus = !FILTER.status || c.status === FILTER.status;
  return hit && byStatus;
}

function renderTable(){
  const rows = (ALL.contacts||[]).filter(contactMatches);
  const tbody = $('#tbody');
  if(!rows.length){ tbody.innerHTML = `<tr><td colspan="10" class="muted" style="padding:16px">No results.</td></tr>`; return; }
  tbody.innerHTML = rows.map(c => `
    <tr data-row="${c.rowNumber}">
      <td>${esc(c.messageType||'')}</td>
      <td>
        <select class="status">${optionize(ALL.statusOptions, c.status)}</select>
      </td>
      <td class="nowrap">${renderWaButtons(c)}</td>
      <td class="nowrap"><strong>${esc(c.name||'')}</strong></td>
      <td class="nowrap">${esc(c.surname||'')}</td>
      <td class="nowrap">${esc(c.cell||'')}</td>
      <td>${esc(c.agency||'')}</td>
      <td><textarea class="notes" placeholder="Add notes…">${esc(c.notes||'')}</textarea></td>
      <td class="nowrap">${esc(c.lastContact||'')}</td>
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
      ${desktop?`<a class="link" href="${desktop}" onclick="setTimeout(()=>window.open('${web}','_blank'),600)">Open</a>`:''}
      ${(!desktop&&web)?`<a class="link" href="${web}" target="_blank" rel="noopener">Open</a>`:''}
    </div>`;
}

function esc(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[m]); }
function optionize(list, selected){ return (list||[]).map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join(''); }

/* REST I/O */
async function refreshData(){
  setSyncState('Syncing…');
  try {
    const res = await fetch(BASE_URL + '?action=getDashboardData', { method:'GET', cache:'no-store' });
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
  document.querySelector('#q').addEventListener('input', d(e=>{ FILTER.q=e.target.value; renderTable(); },180));
  document.querySelector('#refreshBtn').addEventListener('click', ()=>refreshData());
  refreshData();
  REFRESH_TIMER = setInterval(refreshData, 60000);
});
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) refreshData(); });
const d = (fn, wait)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),wait); }; };
