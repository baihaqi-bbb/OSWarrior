const API_BASE = "http://localhost:4000";

const totalBtn = document.getElementById("totalBtn");
const weekButtonsDiv = document.getElementById("weekButtons");
const boardTitle = document.querySelector("#board h2");
const tableBody = document.querySelector("#rankingTable tbody");

// generate week buttons 1–14
for (let i = 1; i <= 14; i++) {
  const btn = document.createElement("button");
  btn.textContent = `Week ${i}`;
  btn.addEventListener("click", () => loadWeek(i));
  weekButtonsDiv.appendChild(btn);
}

// initial load
loadTotal();

// load total aggregated leaderboard
async function loadTotal() {
  try {
    boardTitle.textContent = "Total Ranking";
    const res = await fetch(`${API_BASE}/api/leaderboard`);
    if (!res.ok) throw new Error("Gagal ambil data leaderboard total");
    const data = await res.json(); // array of { userId, username, totalScore, totalAttempts }
    renderTableTotal(data);
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `<tr><td colspan="3">❌ Gagal muat total leaderboard</td></tr>`;
  }
}

// load per-week leaderboard
async function loadWeek(week) {
  try {
    boardTitle.textContent = `Week ${week} Ranking`;
    const res = await fetch(`${API_BASE}/api/leaderboard/${week}`);
    if (!res.ok) throw new Error(`Gagal ambil data leaderboard minggu ${week}`);
    const dataObj = await res.json(); // { week, items: [...] }
    const items = dataObj.items || [];
    renderTableWeek(items);
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `<tr><td colspan="3">❌ Gagal muat leaderboard Week ${week}</td></tr>`;
  }
}

function renderTableTotal(data) {
  tableBody.innerHTML = "";
  if (!Array.isArray(data) || data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3">Tiada data</td></tr>`;
    return;
  }
  data.forEach((item, index) => {
    const name = item.username || `User-${item.userId}`;
    const score = Number(item.totalScore || 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${index+1}</td><td>${escapeHtml(name)}</td><td>${score}</td>`;
    tableBody.appendChild(tr);
  });
}

function renderTableWeek(items) {
  tableBody.innerHTML = "";
  if (!Array.isArray(items) || items.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3">Tiada data</td></tr>`;
    return;
  }
  items.forEach((item, index) => {
    const name = item.username || `User-${item.userId}`;
    const score = Number(item.score || 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${index+1}</td><td>${escapeHtml(name)}</td><td>${score} / ${item.total || ""}</td>`;
    tableBody.appendChild(tr);
  });
}

// simple escape helper
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
