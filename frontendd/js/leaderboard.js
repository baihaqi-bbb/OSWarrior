/* ==========================================================
   CYBER LEADERBOARD SCRIPT - OSwarrior
   ========================================================== */

// API Configuration
const API_BASE = "https://oswarrior-backend.onrender.com";

// DOM Elements
const totalBtn = document.getElementById("totalBtn");
const weekButtonsDiv = document.getElementById("weekButtons");
const boardTitle = document.querySelector("#board h2");
const tableBody = document.querySelector("#rankingTable tbody");
const board = document.querySelector(".board");

// Current state
let currentView = 'total';
let currentWeek = null;
let currentUser = null;

// Initialize Firebase and get current user
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.appspot.com",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e",
};

// Initialize Firebase
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth = getAuth(app);

// Setup authentication listener
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  console.log("Leaderboard loaded for user:", user.uid);
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializeLeaderboard();
});

function initializeLeaderboard() {
  // Generate week buttons 1–14
  for (let i = 1; i <= 14; i++) {
    const btn = document.createElement("button");
    btn.textContent = `Week ${i}`;
    btn.dataset.week = i;
    btn.addEventListener("click", () => {
      setActiveButton(btn);
      loadWeek(i);
    });
    weekButtonsDiv.appendChild(btn);
  }

  // Set up total button
  totalBtn.addEventListener("click", () => {
    setActiveButton(totalBtn);
    loadTotal();
  });

  // Load total leaderboard initially
  setActiveButton(totalBtn);
  loadTotal();
}

function setActiveButton(activeBtn) {
  // Remove active class from all buttons
  document.querySelectorAll('.sidebar button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active class to clicked button
  activeBtn.classList.add('active');
}

// Show loading state
function showLoading() {
  board.innerHTML = `
    <h2>${boardTitle.textContent}</h2>
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading leaderboard data...</p>
    </div>
  `;
}

// Show error state
function showError(message) {
  board.innerHTML = `
    <h2>${boardTitle.textContent}</h2>
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <p>${message}</p>
      <button class="btn-action" onclick="location.reload()">🔄 Retry</button>
    </div>
  `;
}

// Show empty state
function showEmpty(message) {
  board.innerHTML = `
    <h2>${boardTitle.textContent}</h2>
    <div class="empty-state">
      <div class="empty-icon">📊</div>
      <p>${message}</p>
    </div>
  `;
}

// Restore table HTML
function restoreTable() {
  if (!document.querySelector('#rankingTable')) {
    board.innerHTML = `
      <h2>${boardTitle.textContent}</h2>
      <table id="rankingTable">
        <thead>
          <tr>
            <th>Rank</th>
            <th>User</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
  }
}

// Load total aggregated leaderboard
async function loadTotal() {
  currentView = 'total';
  currentWeek = null;
  boardTitle.textContent = "🏆 Total Ranking";
  
  showLoading();
  
  try {
    console.log("Fetching total leaderboard...");
    const res = await fetch(`${API_BASE}/api/leaderboard`, {
      credentials: 'include'
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log("Total leaderboard data:", data);
    
    restoreTable();
    renderTableTotal(data);
    
  } catch (err) {
    console.error("Error loading total leaderboard:", err);
    showError(`❌ Failed to load total leaderboard: ${err.message}`);
  }
}

// Load per-week leaderboard
async function loadWeek(week) {
  currentView = 'week';
  currentWeek = week;
  boardTitle.textContent = `📅 Week ${week} Ranking`;
  
  showLoading();
  
  try {
    console.log(`Fetching Week ${week} leaderboard...`);
    const res = await fetch(`${API_BASE}/api/leaderboard/${week}`, {
      credentials: 'include'
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const dataObj = await res.json();
    console.log(`Week ${week} leaderboard data:`, dataObj);
    
    const items = dataObj.items || [];
    
    restoreTable();
    renderTableWeek(items, week);
    
  } catch (err) {
    console.error(`Error loading Week ${week} leaderboard:`, err);
    showError(`❌ Failed to load Week ${week} leaderboard: ${err.message}`);
  }
}

function renderTableTotal(data) {
  const tableBody = document.querySelector("#rankingTable tbody");
  
  if (!tableBody) {
    console.error("Table body not found");
    return;
  }
  
  tableBody.innerHTML = "";
  
  if (!Array.isArray(data) || data.length === 0) {
    showEmpty("No leaderboard data available yet. Complete some quizzes to see rankings!");
    return;
  }
  
  // Sort by total score descending
  const sortedData = data.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  
  sortedData.forEach((item, index) => {
    const rank = index + 1;
    const name = item.username || item.name || `Warrior-${String(item.userId).slice(0, 6)}`;
    const score = Number(item.totalScore || 0);
    const attempts = item.totalAttempts || 0;
    
    const tr = document.createElement("tr");
    
    // Check if this is current user's row
    if (currentUser && (item.userId === currentUser.uid || item.userId === currentUser.email)) {
      tr.classList.add('my-row');
    }
    
    // Add rank class for top 3
    const rankClass = rank <= 3 ? `rank-${rank}` : '';
    
    tr.innerHTML = `
      <td class="${rankClass}">${getRankDisplay(rank)}</td>
      <td>${escapeHtml(name)}</td>
      <td>${score} ${attempts > 0 ? `(${attempts} attempts)` : ''}</td>
    `;
    
    tableBody.appendChild(tr);
  });
  
  // Add some visual flair
  setTimeout(() => {
    document.querySelectorAll('#rankingTable tbody tr').forEach((row, index) => {
      row.style.animationDelay = `${index * 0.1}s`;
      row.style.animation = 'slideInUp 0.5s ease-out forwards';
    });
  }, 100);
}

function renderTableWeek(items, week) {
  const tableBody = document.querySelector("#rankingTable tbody");
  
  if (!tableBody) {
    console.error("Table body not found");
    return;
  }
  
  tableBody.innerHTML = "";
  
  if (!Array.isArray(items) || items.length === 0) {
    showEmpty(`No one has completed Week ${week} quiz yet. Be the first to take it!`);
    return;
  }
  
  // Sort by score descending
  const sortedItems = items.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  sortedItems.forEach((item, index) => {
    const rank = index + 1;
    const name = item.username || item.name || `Warrior-${String(item.userId).slice(0, 6)}`;
    const score = Number(item.score || 0);
    const total = item.total || item.maxScore || 100;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    
    const tr = document.createElement("tr");
    
    // Check if this is current user's row
    if (currentUser && (item.userId === currentUser.uid || item.userId === currentUser.email)) {
      tr.classList.add('my-row');
    }
    
    // Add rank class for top 3
    const rankClass = rank <= 3 ? `rank-${rank}` : '';
    
    tr.innerHTML = `
      <td class="${rankClass}">${getRankDisplay(rank)}</td>
      <td>${escapeHtml(name)}</td>
      <td>${score}/${total} (${percentage}%)</td>
    `;
    
    tableBody.appendChild(tr);
  });
  
  // Add animation
  setTimeout(() => {
    document.querySelectorAll('#rankingTable tbody tr').forEach((row, index) => {
      row.style.animationDelay = `${index * 0.1}s`;
      row.style.animation = 'slideInUp 0.5s ease-out forwards';
    });
  }, 100);
}

// Get rank display with emojis for top 3
function getRankDisplay(rank) {
  switch(rank) {
    case 1: return '🥇 1st';
    case 2: return '🥈 2nd'; 
    case 3: return '🥉 3rd';
    default: return `${rank}th`;
  }
}

// Simple escape helper
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  #rankingTable tbody tr {
    opacity: 0;
  }
`;
document.head.appendChild(style);

// Auto-refresh leaderboard every 30 seconds
setInterval(() => {
  if (currentView === 'total') {
    loadTotal();
  } else if (currentView === 'week' && currentWeek) {
    loadWeek(currentWeek);
  }
}, 30000);

// Export for debugging
window.LeaderboardDebug = {
  loadTotal,
  loadWeek,
  currentView,
  currentWeek,
  currentUser
};
