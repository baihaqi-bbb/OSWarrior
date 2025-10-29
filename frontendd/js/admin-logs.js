// Safe renderer for admin logs page

(function(){
  const REL = ['/api/logs','/api/admin/logs','/api/v1/logs'];
  const ABS = [window.BACKEND_BASE || null, 'http://localhost:4000','http://127.0.0.1:4000'].filter(Boolean);
  const CANDIDATES = [...ABS.flatMap(h=>REL.map(p=>`${h}${p}`)), ...REL];

  async function tryFetch(url){
    try {
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { ok:true, data: await r.json() };
    } catch (e) { return { ok:false, error: e }; }
  }

  function fmtTime(ts){
    try { return ts ? new Date(ts).toLocaleString() : '-'; } catch(e){ return '-'; }
  }

  function renderTable(rows){
    const tbody = document.querySelector('#adminLogsTable tbody');
    const status = document.getElementById('logs-status');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:18px;color:#94a3b8">No logs</td></tr>';
      if (status) status.textContent = 'No logs';
      return;
    }
    rows.forEach((r)=>{
      const tr = document.createElement('tr');
      const time = document.createElement('td'); time.textContent = fmtTime(r.ts || r.time || r.createdAt);
      const lvl = document.createElement('td'); lvl.textContent = (r.level||'').toUpperCase();
      const user = document.createElement('td');
      user.textContent = r.user || r.actor || r.username || r.userId || (r.meta && (r.meta.user || r.meta.actor)) || '-';
      const action = document.createElement('td'); action.textContent = r.action || r.msg || '-';
      const meta = document.createElement('td'); meta.textContent = (typeof r.meta === 'object') ? JSON.stringify(r.meta) : (r.meta||'');
      tr.appendChild(time); tr.appendChild(lvl); tr.appendChild(user); tr.appendChild(action); tr.appendChild(meta);
      tbody.appendChild(tr);
    });
    if (status) status.textContent = `Loaded ${rows.length} logs`;
    setTimeout(()=>{ if (status) status.textContent = ''; }, 1600);
  }

  async function loadLogs(){
    const status = document.getElementById('logs-status');
    if (status) status.textContent = 'Loading logs…';
    for (const url of CANDIDATES) {
      const r = await tryFetch(url);
      if (r.ok) { renderTable(r.data); return; }
      console.warn('logs candidate failed', url, r.error && r.error.message);
    }
    // fallback sample
    renderTable([
      { ts: new Date().toISOString(), level: 'info', user: 'sample', action: 'no-backend', meta: {} }
    ]);
    if (status) status.textContent = 'No backend; showing sample log';
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('logs-refresh');
    btn?.addEventListener('click', async ()=>{
      btn.disabled = true; const prev = btn.textContent; btn.textContent = 'Refreshing…';
      await loadLogs();
      btn.textContent = prev; btn.disabled = false;
    });
    loadLogs();
  });
})();