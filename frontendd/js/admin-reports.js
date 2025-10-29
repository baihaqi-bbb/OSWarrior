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
    "http://localhost:4000",
    "http://127.0.0.1:4000"
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
  status.textContent = "Generating…";
  try {
    const data = await fetchReportsAPI(from, to, type);
    if (data && data.error) {
      const sample = sampleData();
      document.getElementById("reports-title").textContent = sample.meta.title;
      renderTable(sample.meta, sample.rows);
      renderChart(sample.chart);
      status.textContent = "No backend: showing sample data";
      return { meta: sample.meta, rows: sample.rows, chart: sample.chart };
    }
    // expected shape: { meta: { title, columns }, rows: [...], chart: { labels, values } }
    const meta = data.meta || { title: "Report", columns: [] };
    const rows = data.rows || [];
    const chart = data.chart || null;
    document.getElementById("reports-title").textContent = meta.title || "Report";
    renderTable(meta, rows);
    if (chart) renderChart(chart);
    status.textContent = `Loaded ${rows.length} rows`;
    setTimeout(()=>{ if (status) status.textContent = ""; }, 1600);
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
  generateReports(null, null, "summary");

  g?.addEventListener("click", async () => {
    const res = await generateReports(fromEl?.value, toEl?.value, typeEl?.value);
    // store last for export
    window.__lastReport = res;
  });

  refresh?.addEventListener("click", async () => {
    const res = await generateReports(fromEl?.value, toEl?.value, typeEl?.value);
    window.__lastReport = res;
  });

  exportBtn?.addEventListener("click", () => {
    const last = window.__lastReport;
    if (!last || !last.meta || !last.rows) {
      // regenerate quickly then export
      generateReports(fromEl?.value, toEl?.value, typeEl?.value).then(res => {
        if (res && res.meta && res.rows) downloadCSV("report.csv", res.meta.columns || [], res.rows || []);
      });
      return;
    }
    downloadCSV("report.csv", last.meta.columns || [], last.rows || []);
  });
});