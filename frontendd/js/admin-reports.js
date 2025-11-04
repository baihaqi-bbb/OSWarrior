// --- Summary Card Functionality (GLOBAL SCOPE) ---
var availableReportsEl = document.getElementById("available-reports");
var recentExportsEl = document.getElementById("recent-exports");
let exportCount = Number(localStorage.getItem('reportExportCount') || 0);
function getTotalReports(reportData) {
  if (reportData && Array.isArray(reportData.rows)) return reportData.rows.length;
  return 0;
}
function updateSummaryStats(reportData) {
  if (availableReportsEl) availableReportsEl.textContent = getTotalReports(reportData);
  if (recentExportsEl) recentExportsEl.textContent = exportCount;
}

// === Notification System (EXACT COPY from home-admin.js) ===
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.admin-notification');
  existingNotifications.forEach(notification => notification.remove());
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `admin-notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${getNotificationIcon(type)}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;
  // Add styles (EXACT COPY from home-admin.js)
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--card-bg);
    border: 1px solid var(--border-glow);
    border-radius: 10px;
    padding: 15px 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    z-index: 10000;
    max-width: 400px;
    animation: slideInRight 0.3s ease;
    font-family: 'Orbitron', monospace;
    color: #ffffff;
  `;
  document.body.appendChild(notification);
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

function getNotificationIcon(type) {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  return icons[type] || '📢';
}

// Add notification animation CSS if not present
if (!document.querySelector('#notification-animations')) {
  const style = document.createElement('style');
  style.id = 'notification-animations';
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .notification-content { display: flex; align-items: center; gap: 10px; color: var(--text-primary); }
    .notification-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem; margin-left: auto; }
    .notification-close:hover { color: var(--text-primary); }
  `;
  document.head.appendChild(style);
}

// Simple reports page: fetch /api/reports?from=...&to=...&type=..., render chart & table, export CSV.
// If backend missing, shows sample data.

const STATUS = id => document.getElementById(id);

function safeText(s){ return String(s ?? ""); }

/* Replace existing fetchReportsAPI with this robust candidate-tryer */

async function tryFetchCandidate(url) {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, data: await res.json() };
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function fetchReportsAPI(from, to, type) {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  if (type) q.set("type", type);

  const RELATIVE = [
    `/api/reports?${q}`,
    `/api/admin/reports?${q}`,
    `/api/v1/reports?${q}`
  ];

  const ABS_HOSTS = [
    window.BACKEND_BASE || null,
    "https://oswarrior-backend.onrender.com"
  ].filter(Boolean);

  const CANDIDATES = [
    // try absolute hosts first (recommended for dev when frontend served on :5500)
    ...ABS_HOSTS.flatMap(h => RELATIVE.map(p => `${h}${p.startsWith('/')?p:''}${p}`)),
    // then try same-origin relative paths
    ...RELATIVE
  ].filter((v,i,a) => a.indexOf(v) === i);

  for (const url of CANDIDATES) {
    const r = await tryFetchCandidate(url);
    if (r.ok) return r.data;
    console.warn("reports candidate failed:", url, r.error && r.error.message);
  }

  return { error: "no-backend" };
}

function sampleData() {
  return {
    meta: { title: "Sample Summary", columns: ["User","Attempts","Avg Score"] },
    rows: [
      ["admin", 12, 88],
      ["user1", 9, 74],
      ["user2", 6, 66]
    ],
    chart: { labels: ["admin","user1","user2"], values: [88,74,66] }
  };
}

function renderTable(meta, rows) {
  const thead = document.querySelector("#reportsHead");
  const tbody = document.querySelector("#reportsTable tbody");
  if (!thead || !tbody) return;
  thead.innerHTML = "";
  (meta.columns || []).forEach(c => {
    const th = document.createElement("th");
    th.textContent = c;
    thead.appendChild(th);
  });
  tbody.innerHTML = "";
  (rows || []).forEach(r => {
    const tr = document.createElement("tr");
    r.forEach(cell => {
      const td = document.createElement("td");
      td.textContent = safeText(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function downloadCSV(filename, columns, rows) {
  const out = [columns.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))].join("\n");
  const blob = new Blob([out], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

let currentChart = null;
function renderChart(chartData) {
  const ctx = document.getElementById("reportsCanvas");
  if (!ctx) return;
  const labels = (chartData && chartData.labels) || [];
  const values = (chartData && chartData.values) || [];
  if (typeof Chart === "undefined") {
    console.warn("Chart.js not loaded");
    return;
  }
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
  currentChart = new Chart(ctx.getContext("2d"), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Score', data: values, backgroundColor: 'rgba(14,165,163,0.86)' }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });
}

async function generateReports(from, to, type) {
  const status = STATUS("r-status");
  status.textContent = "";
  try {
    const data = await fetchReportsAPI(from, to, type);
    if (data && data.error) {
      const sample = sampleData();
      document.getElementById("reports-title").textContent = sample.meta.title;
      renderTable(sample.meta, sample.rows);
      renderChart(sample.chart);
      status.textContent = "";
      // Force update summary after all DOM rendering
      requestAnimationFrame(() => updateSummaryStats({ meta: sample.meta, rows: sample.rows, chart: sample.chart }));
      return { meta: sample.meta, rows: sample.rows, chart: sample.chart };
    }
    // expected shape: { meta: { title, columns }, rows: [...], chart: { labels, values } }
    const meta = data.meta || { title: "Report", columns: [] };
    const rows = data.rows || [];
    const chart = data.chart || null;
    document.getElementById("reports-title").textContent = meta.title || "Report";
    renderTable(meta, rows);
    if (chart) renderChart(chart);
  status.textContent = "";
    // Force update summary after all DOM rendering
    requestAnimationFrame(() => updateSummaryStats({ meta, rows, chart }));
  // No status message after loading
    return { meta, rows, chart };
  } catch (err) {
    console.error(err);
    status.textContent = "Error generating report";
    return { meta: { title: "Error" }, rows: [], chart: null };
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const g = document.getElementById("r-generate");
  const exportBtn = document.getElementById("r-export");
  const refresh = document.getElementById("r-refresh");
  const fromEl = document.getElementById("r-from");
  const toEl = document.getElementById("r-to");
  const typeEl = document.getElementById("r-type");



  // initial sample render
  generateReports(null, null, "summary").then(res => {
    window.__lastReport = res;
    updateSummaryStats(window.__lastReport);
  });

  g?.addEventListener("click", async () => {
    const res = await generateReports(fromEl?.value, toEl?.value, typeEl?.value);
    window.__lastReport = res;
    updateSummaryStats(window.__lastReport);
  });

  refresh?.addEventListener("click", async () => {
    showNotification('🔄 Refreshing report data...', 'info');
    // Remove status message immediately
    const status = document.getElementById('r-status');
    if (status) status.textContent = '';
    // Actually refresh the report data
    const res = await generateReports(fromEl?.value, toEl?.value, typeEl?.value);
    window.__lastReport = res;
    updateSummaryStats(window.__lastReport);
    showNotification('✅ Report generated and ready for download', 'success');
  });

  exportBtn?.addEventListener("click", () => {
    const last = window.__lastReport;
    function incExport(res) {
      exportCount++;
      localStorage.setItem('reportExportCount', exportCount);
      updateSummaryStats(res);
    }
    if (!last || !last.meta || !last.rows) {
      generateReports(fromEl?.value, toEl?.value, typeEl?.value).then(res => {
        if (res && res.meta && res.rows) {
          downloadCSV("report.csv", res.meta.columns || [], res.rows || []);
          incExport(res);
        }
      });
      return;
    }
    downloadCSV("report.csv", last.meta.columns || [], last.rows || []);
    incExport(last);
  });

  // Make Generate New button download the report file
  const generateBtn = document.getElementById("generate-report");
  if (generateBtn) {
    generateBtn.addEventListener("click", () => {
      const last = window.__lastReport;
      if (!last || !last.meta || !last.rows) {
        generateReports(fromEl?.value, toEl?.value, typeEl?.value).then(res => {
          if (res && res.meta && res.rows) downloadCSV("report.csv", res.meta.columns || [], res.rows || []);
        });
        return;
      }
      downloadCSV("report.csv", last.meta.columns || [], last.rows || []);
    });
  }
});