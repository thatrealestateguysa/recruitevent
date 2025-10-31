
/* Recruit 101 front-end (grayscale, tabs wrap, no sliders)
   Transport:
   - If running inside Apps Script (google.script.run) → use that (same-origin).
   - Else use JSONP (?callback=...) so it works from any static host.
*/
const STATUS_OPTIONS = ['To Contact','Whatsapp','Reply','Keen to meet','Cultivate','Invite to events','Not interested','No Whatsapp','Unsubscribe','Referred','Event Invite Sent','Event Invite Accepted'];
const DEFAULT_CC = '+27';
let DATA = [];

const { BASE_URL } = window.APP_CONFIG || { BASE_URL: '' };

function setStatus(message) { document.getElementById('statusMsg').textContent = message || ''; }

function normalizeKeyFinder(obj){
  const map={}; Object.keys(obj).forEach(k=>map[k.trim().toLowerCase().replace(/\s+/g,'')]=k);
  return (...variants)=>{ for(const v of variants){ const c=String(v).trim().toLowerCase().replace(/\s+/g,''); if(map[c]) return map[c]; } return null; };
}

function toDateInputValue(val){
  if(!val) return '';
  try{
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(val))) return String(val);
    const d=new Date(val); if(!isNaN(d)){ const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${m}-${day}`; }
  }catch(_){}
  return '';
}

function toWaNumber(raw){
  if(!raw) return '';
  let s=String(raw).replace(/[^\d+]/g,'');
  if(s.startsWith('00')) s = '+' + s.slice(2);
  if(s.startsWith('+')) return s.replace(/[^\d]/g,'');
  s = s.replace(/[^\d]/g,'');
  if(s.startsWith('0')) s = s.slice(1);
  return (DEFAULT_CC.replace('+','') + s);
}

// ---- Transport layer ----
function hasAppsScript(){ return !!(window.google && google.script && google.script.run); }

function jsonp(url, params={}, timeoutMs=15000){
  return new Promise((resolve, reject) => {
    const cb = 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const qs = new URLSearchParams(Object.assign({}, params, { callback: cb })).toString();
    const src = url + (url.includes('?') ? '&' : '?') + qs;
    const script = document.createElement('script');
    let done=false;
    window[cb] = (data)=>{ if(done) return; done=true; cleanup(); resolve(data); };
    function cleanup(){ delete window[cb]; if(script.parentNode) script.parentNode.removeChild(script); }
    script.src = src;
    script.onerror = ()=>{ if(done) return; done=true; cleanup(); reject(new Error('Network error')); };
    document.body.appendChild(script);
    setTimeout(()=>{ if(done) return; done=true; cleanup(); reject(new Error('Timeout')); }, timeoutMs);
  });
}

function runServer(method, payload){
  if(hasAppsScript()){
    return new Promise((resolve, reject)=>{
      google.script.run.withSuccessHandler(resolve).withFailureHandler(err=>reject(new Error(err?.message||String(err))))[method](payload||{});
    });
  }
  // Fallback to JSONP for external hosting
  if(method==='getAll' || method==='list') return jsonp(BASE_URL, { action:'list' });
  if(method==='updateStatus' || method==='update'){
    const params = Object.assign({ action:'update' }, payload||{});
    return jsonp(BASE_URL, params);
  }
  return Promise.reject(new Error('Unknown method: '+method));
}

// ---- UI ----
document.addEventListener('DOMContentLoaded', () => {
  const statusSel = document.getElementById('statusFilter');
  STATUS_OPTIONS.forEach(s => { const o=document.createElement('option'); o.value=s; o.textContent=s; statusSel.appendChild(o); });
  document.getElementById('search').addEventListener('input', filterRows);
  document.getElementById('statusFilter').addEventListener('change', filterRows);
  document.getElementById('refresh').addEventListener('click', refresh);
  refresh();
});

async function refresh(){
  try{
    setStatus('Loading…');
    const res = await runServer('getAll', {});
    const rows = (res && (res.rows || res)) || [];
    DATA = Array.isArray(rows) ? rows : [];
    render(DATA);
    setStatus(`Loaded ${DATA.length} records.`);
  }catch(e){
    setStatus('Load failed: ' + e.message);
  }
}

async function save(id){
  const btn = document.getElementById('save-'+id);
  const status = document.getElementById('status-'+id).value;
  const budate = document.getElementById('budate-'+id).value;
  try{
    btn.disabled=true; btn.textContent='Saving…'; setStatus(`Updating #${id}…`);
    const res = await runServer('updateStatus', { id, status, budate });
    if(res && (res.ok || res.row)){
      setStatus(`Updated #${id}.`);
      await refresh();
    } else {
      setStatus('Update failed: ' + (res && res.error ? res.error : 'Unknown error'));
      btn.disabled=false; btn.textContent='Save';
    }
  }catch(e){
    setStatus('Error: ' + e.message);
    btn.disabled=false; btn.textContent='Save';
  }
}

function render(rows){
  const tbody = document.getElementById('rows'); tbody.innerHTML='';

  rows.forEach(obj => {
    const find = normalizeKeyFinder(obj);
    const ID   = obj[find('ID','Id','id')] ?? '';
    const NAME = obj[find('NAME','Name','Candidate','Candidate Name','Full Name')] ?? '';
    const SUR  = obj[find('SURNAME','Surname','Last Name')] ?? '';
    const CELL = obj[find('CELL NR','Cell','Cell Nr','Cell Number','Mobile','Phone','WhatsApp','Whatsapp')] ?? '';
    const STAT = obj[find('STATUS','Status','status')] ?? '';
    const BUD  = obj[find('BUDATE','BuDate','BU Date','BUDate','Business Update Date')] ?? '';
    const WAM  = obj[find('WHATSAPP MESSAGE','Whatsapp Message','WA Message','Message')] ?? '';

    const waNum  = toWaNumber(CELL);
    const waHref = waNum ? ('https://wa.me/'+waNum + (WAM ? ('?text='+encodeURIComponent(String(WAM))) : '')) : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ID}</td>
      <td>${NAME}</td>
      <td>${SUR}</td>
      <td>${CELL}</td>
      <td>
        <select class="status-select" id="status-${ID}">
          ${STATUS_OPTIONS.map(s=>`<option value="${s}" ${String(STAT).trim()===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><input class="date-input" type="date" id="budate-${ID}" value="${toDateInputValue(BUD)}"></td>
      <td>${ waHref ? `<a class="wa-link" href="${waHref}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</td>
      <td><button class="btn" id="save-${ID}">Save</button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector(`#save-${CSS.escape(String(ID))}`).addEventListener('click', ()=>save(ID));
  });

  filterRows();
}

function filterRows(){
  const q = document.getElementById('search').value.trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const rows = Array.from(document.querySelectorAll('#rows tr'));
  let shown = 0;
  rows.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    const text = Array.from(tds).slice(0,7).map(td => td.textContent.toLowerCase()).join(' ');
    const sVal = tr.querySelector('.status-select')?.value || '';
    const match = (!q || text.includes(q)) && (!status || sVal === status);
    tr.style.display = match ? '' : 'none';
    if (match) shown++;
  });
  setStatus(`Showing ${shown} of ${rows.length}`);
}
