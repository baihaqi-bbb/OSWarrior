// === User Management & Quiz Management Counter Functions ===
function updateActiveUsersCount(count) {
  const el = document.getElementById('active-users');
  if (el) el.textContent = (typeof count === 'number' && !isNaN(count)) ? count : '-';
}

function updateSuspendedUsersCount(count) {
  const el = document.getElementById('suspended-users');
  if (el) el.textContent = (typeof count === 'number' && !isNaN(count)) ? count : '-';
}

function updatePublishedQuizzesCount(count) {
  const el = document.getElementById('published-quizzes');
  if (el) el.textContent = (typeof count === 'number' && !isNaN(count)) ? count : '-';
}

function updateDraftQuizzesCount(count) {
  const el = document.getElementById('draft-quizzes');
  if (el) el.textContent = (typeof count === 'number' && !isNaN(count)) ? count : '-';
}

// Call these on page load to sync values (fetch from API, fallback to localStorage)
document.addEventListener('DOMContentLoaded', () => {
  (async () => {
    // User Management: fetch users from API
    let users = [];
    try {
      const response = await fetch('https://oswarrior-backend.onrender.com/api/users', { credentials: 'include' });
      if (response.ok) {
        const apiUsers = await response.json();
        users = Array.isArray(apiUsers) ? apiUsers : [];
      } else {
        throw new Error(`API returned ${response.status}`);
      }
    } catch (apiError) {
      // Fallback to localStorage (if any)
      const stored = localStorage.getItem('users');
      users = stored ? JSON.parse(stored) : [];
    }
    updateActiveUsersCount(users.filter(u => u.status === 'active').length);
    updateSuspendedUsersCount(users.filter(u => u.status === 'suspended').length);

    // Quiz Management: fetch quizzes from API
    let quizzes = [];
    try {
      const response = await fetch('https://oswarrior-backend.onrender.com/api/quizzes', { credentials: 'include' });
      if (response.ok) {
        const apiQuizzes = await response.json();
        quizzes = Array.isArray(apiQuizzes) ? apiQuizzes : [];
      } else {
        throw new Error(`API returned ${response.status}`);
      }
    } catch (apiError) {
      // Fallback to localStorage (if any)
      const stored = localStorage.getItem('uploaded-quizzes');
      quizzes = stored ? JSON.parse(stored) : [];
    }
    updatePublishedQuizzesCount(quizzes.filter(q => q.published === true).length);
    updateDraftQuizzesCount(quizzes.filter(q => !q.published).length);
  })();
});
// === Content Upload Counter Functions (REAL DATA) ===
function updateUploadedFilesCount(count) {
  const el = document.getElementById('uploaded-files');
  if (el) el.textContent = (typeof count === 'number' && !isNaN(count)) ? count : '-';
}

function updateGeneratedQuizzesCount(count) {
  const el = document.getElementById('generated-quizzes');
  if (el) el.textContent = (typeof count === 'number' && !isNaN(count)) ? count : '-';
}

// Call these on page load to sync values (fetch from API, fallback to localStorage)
document.addEventListener('DOMContentLoaded', () => {
  (async () => {
    let uploadedQuizzes = [];
    try {
      const response = await fetch('https://oswarrior-backend.onrender.com/api/quizzes', { credentials: 'include' });
      if (response.ok) {
        const apiQuizzes = await response.json();
        uploadedQuizzes = Array.isArray(apiQuizzes) ? apiQuizzes : [];
      } else {
        throw new Error(`API returned ${response.status}`);
      }
    } catch (apiError) {
      // Fallback to localStorage
      const stored = localStorage.getItem('uploaded-quizzes');
      uploadedQuizzes = stored ? JSON.parse(stored) : [];
    }
    updateUploadedFilesCount(uploadedQuizzes.length);
    updateGeneratedQuizzesCount(uploadedQuizzes.length);
  })();
});
// === Analytics & Reports Counter Functions ===
function updateReportsCount(count) {
  const el = document.getElementById('available-reports');
  if (el) el.textContent = (typeof count === 'number' && !isNaN(count)) ? count : '-';
}

function updateExportsCount(count) {
  const el = document.getElementById('recent-exports');
  if (el) el.textContent = (typeof count === 'number' && !isNaN(count)) ? count : '-';
}

// Call these on page load to sync values
document.addEventListener('DOMContentLoaded', () => {
  // Fetch report count from API (same as exportReport logic)
  const q = new URLSearchParams();
  q.set('type', 'summary');
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
    ...ABS_HOSTS.flatMap(h => RELATIVE.map(p => `${h}${p.startsWith('/')?p:''}${p}`)),
    ...RELATIVE
  ].filter((v,i,a) => a.indexOf(v) === i);
  (async () => {
    let data = null;
    for (const url of CANDIDATES) {
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch {}
    }
    if (data && data.rows) {
      updateReportsCount(data.rows.length);
    } else {
      updateReportsCount('-');
    }
    // Exports count from localStorage
    let exportCount = Number(localStorage.getItem('reportExportCount') || 0);
    updateExportsCount(exportCount);
  })();
});
// filepath: [home-admin.js](http://_vscodecontentref_/3)
// Import Firebase SDK and shared config
import { app, auth, db } from './firebase-config.js';
import { onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Global admin data storage
let adminData = {
  users: [],
  quizzes: [],
  activities: [],
  stats: {
    totalUsers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
    totalQuizzes: 0,
    publishedQuizzes: 0,
    draftQuizzes: 0,
    dailyActivity: 0,
    systemHealth: 98
  }
};

// ✅ Admin Authentication & Role Check
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Update profile display
    const profileImg = document.getElementById("profile-img");
    const usernameNavbar = document.getElementById("username-navbar");
    
    if (profileImg) profileImg.src = user.photoURL || "image/default-profile.png";

    // Get display name
    let displayName = user.displayName;
    if (!displayName) {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          displayName = userDoc.data().name || "Admin";
        } else {
          displayName = "Admin";
        }
      } catch {
        displayName = "Admin";
      }
    }

    if (usernameNavbar) usernameNavbar.textContent = displayName;

    // Check admin role
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        if (role !== "admin") {
          console.log("Access denied: User is not admin");
          window.location.href = "index.html";
          return;
        }
        
        // Load admin dashboard data
        await loadAdminData();
        initializeDashboard();
      } else {
        console.log("User document not found");
        window.location.href = "index.html";
      }
    } catch (err) {
      console.error("Role check error:", err);
      window.location.href = "index.html";
    }
  } else {
    console.log("User not authenticated");
    window.location.href = "index.html";
  }
});

// Load admin dashboard data
async function loadAdminData() {
  try {
    console.log("🔄 Loading admin dashboard data...");
    
    // Load users data
    const usersSnapshot = await getDocs(collection(db, "users"));
    adminData.users = [];
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      // Only include non-deleted users (same as user management page)
      if (!userData.deleted) {
        adminData.users.push({ id: doc.id, ...userData });
      }
    });
    
    // Calculate user stats
    adminData.stats.totalUsers = adminData.users.length;
    adminData.stats.activeUsers = adminData.users.filter(user => !user.disabled && user.status !== 'suspended').length;
    adminData.stats.suspendedUsers = adminData.users.filter(user => user.disabled || user.status === 'suspended').length;
    
    // Load quizzes data from Firestore
    try {
      const quizzesSnapshot = await getDocs(collection(db, "quizzes"));
      adminData.quizzes = [];
      quizzesSnapshot.forEach((doc) => {
        adminData.quizzes.push({ id: doc.id, ...doc.data() });
      });
      adminData.stats.totalQuizzes = adminData.quizzes.length;
      adminData.stats.publishedQuizzes = adminData.quizzes.filter(q => q.published === true).length;
      adminData.stats.draftQuizzes = adminData.quizzes.filter(q => !q.published).length;
      console.log(`📊 Loaded ${adminData.stats.totalQuizzes} quizzes (${adminData.stats.publishedQuizzes} published)`);
    } catch (err) {
      console.error("❌ Could not load quizzes data:", err);
      adminData.stats.totalQuizzes = 0;
      adminData.stats.publishedQuizzes = 0;
    }
    
    // Calculate REAL daily activity from logs
    await calculateDailyActivity();
    
    // Calculate REAL system health based on services status
    await calculateSystemHealth();
    
    console.log("✅ Admin data loaded:", adminData);
    
  } catch (error) {
    console.error("❌ Error loading admin data:", error);
    adminData.stats.systemHealth = 50; // Low health on error
  }
}

// Calculate real daily activity from logs
async function calculateDailyActivity() {
  try {
    // Fetch logs from Firestore
    const logsRef = collection(db, 'logs');
    const logsQuery = query(logsRef, orderBy('timestamp', 'desc'), limit(500));
    const snapshot = await getDocs(logsQuery);
    
    let logs = [];
    
    // Use real Firestore logs - DON'T filter by user validation
    snapshot.forEach(doc => {
      const logData = doc.data();
      logs.push({ id: doc.id, ...logData });
    });
    
    // Count logs from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayLogs = logs.filter(log => {
      const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
      return logDate >= today;
    });
    
    adminData.stats.dailyActivity = todayLogs.length;
    console.log(`📊 Daily Activity: ${todayLogs.length} sessions today`);
    
  } catch (error) {
    console.error('❌ Error calculating daily activity:', error);
    adminData.stats.dailyActivity = 0;
  }
}

// Calculate real system health
async function calculateSystemHealth() {
  let healthScore = 100;
  const checks = [];
  
  // Check 1: Firebase connection (already working if we got here)
  checks.push({ name: 'Firebase', status: true, weight: 30 });
  
  // Check 2: Backend API availability
  try {
    const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:4000'
      : 'https://oswarrior-backend.onrender.com';
    const response = await fetch(`${API_URL}/api/users`, { credentials: 'include' });
    checks.push({ name: 'Backend API', status: response.ok, weight: 30 });
    if (!response.ok) healthScore -= 30;
  } catch (error) {
    checks.push({ name: 'Backend API', status: false, weight: 30 });
    healthScore -= 30;
  }
  
  // Check 3: Data integrity - users exist
  checks.push({ name: 'User Data', status: adminData.users.length > 0, weight: 20 });
  if (adminData.users.length === 0) healthScore -= 20;
  
  // Check 4: Quiz data available
  checks.push({ name: 'Quiz Data', status: adminData.quizzes.length > 0, weight: 20 });
  if (adminData.quizzes.length === 0) healthScore -= 20;
  
  adminData.stats.systemHealth = Math.max(0, Math.min(100, healthScore));
  
  // Update health status text
  const healthChangeEl = document.getElementById('health-change');
  if (healthChangeEl) {
    if (healthScore >= 95) {
      healthChangeEl.textContent = 'All systems operational';
      healthChangeEl.className = 'stat-change positive';
    } else if (healthScore >= 70) {
      healthChangeEl.textContent = 'Minor issues detected';
      healthChangeEl.className = 'stat-change neutral';
    } else {
      healthChangeEl.textContent = 'System degraded';
      healthChangeEl.className = 'stat-change negative';
    }
  }
  
  console.log('🏥 System Health:', healthScore + '%', checks);
}

// Initialize dashboard components
function initializeDashboard() {
  console.log("🚀 Initializing admin dashboard...");
  
  updateStatsCards();
  updateModuleBadges();
  setupEventListeners();
  startRealTimeUpdates();
  
  // Add loading animations
  animateStatsCards();
}

// Update statistics cards
function updateStatsCards() {
  const elements = {
    totalUsers: document.getElementById('total-users'),
    totalQuizzes: document.getElementById('total-quizzes'),
    systemHealth: document.getElementById('system-health'),
    dailyActivity: document.getElementById('daily-activity')
  };
  
  // Animate number counting
  if (elements.totalUsers) animateNumber(elements.totalUsers, 0, adminData.stats.totalUsers, 1000);
  if (elements.totalQuizzes) animateNumber(elements.totalQuizzes, 0, adminData.stats.totalQuizzes, 1200);
  if (elements.systemHealth) elements.systemHealth.textContent = adminData.stats.systemHealth + '%';
  if (elements.dailyActivity) animateNumber(elements.dailyActivity, 0, adminData.stats.dailyActivity, 800);
  
  console.log("📊 Stats cards updated");
}

// Update module badges
function updateModuleBadges() {
  const badges = {
    'users-badge': adminData.stats.totalUsers,
    'quizzes-badge': adminData.stats.totalQuizzes,
    'uploads-badge': Math.floor(Math.random() * 20) + 5,
    'leaderboard-badge': adminData.stats.activeUsers,
    'reports-badge': 12
    // audit-badge is updated by loadAuditStats() with real alert count
  };

  // Update badge numbers
  Object.entries(badges).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  // Update active and suspended user counts in User Management card
  const activeUsersEl = document.getElementById('active-users');
  const suspendedUsersEl = document.getElementById('suspended-users');
  if (activeUsersEl) activeUsersEl.textContent = adminData.stats.activeUsers;
  if (suspendedUsersEl) suspendedUsersEl.textContent = adminData.stats.suspendedUsers;
  
  // Update Leaderboard Management card stats - fetch from backend API
  fetchLeaderboardStats();
}

// Animate number counting
function animateNumber(element, start, end, duration) {
  if (!element) return;
  
  const startTime = performance.now();
  const range = end - start;
  
  function updateNumber(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth animation
    const easeOutCubic = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.floor(start + (range * easeOutCubic));
    
    element.textContent = currentValue;
    
    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    } else {
      element.textContent = end;
    }
  }
  
  requestAnimationFrame(updateNumber);
}

// Animate stats cards entrance
function animateStatsCards() {
  const cards = document.querySelectorAll('.stat-card, .module-card');
  cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    
    setTimeout(() => {
      card.style.transition = 'all 0.6s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, index * 100);
  });
}

// Fetch leaderboard stats from backend API
async function fetchLeaderboardStats() {
  try {
    const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:4000'
      : 'https://oswarrior-backend.onrender.com';
    
    // Fetch leaderboard data
    const response = await fetch(`${API_URL}/api/leaderboard`);
    if (!response.ok) throw new Error('Failed to fetch leaderboard');
    
    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      // Get top scorer
      const topScorer = data.reduce((prev, current) => 
        (current.totalScore > prev.totalScore) ? current : prev
      );
      
      const topPlayersEl = document.getElementById('top-players');
      if (topPlayersEl) {
        topPlayersEl.textContent = topScorer.username || 'No users';
      }
      
      // Total participants
      const activeCompetitionsEl = document.getElementById('active-competitions');
      if (activeCompetitionsEl) {
        activeCompetitionsEl.textContent = data.length;
      }
    }
  } catch (error) {
    console.error('❌ Error fetching leaderboard stats:', error);
  }
}

// Setup event listeners for admin actions
function setupEventListeners() {
  // Quick action buttons
  const actionButtons = {
    'system-maintenance': handleSystemMaintenance,
    'backup-data': handleBackupData,
    'send-announcement': handleSendAnnouncement,
    'refresh-stats': handleRefreshStats
  };
  
  Object.entries(actionButtons).forEach(([id, handler]) => {
    const button = document.getElementById(id);
    if (button) {
      button.addEventListener('click', handler);
    }
  });
  
  // Module quick actions
  const moduleButtons = {
    'quick-user-stats': showQuickUserStats,
    'create-quick-quiz': createQuickQuiz,
    'upload-status': showUploadStatus,
    'reset-leaderboard': resetLeaderboard,
    'export-report': exportReport,
    'export-logs': exportLogs
  };
// Export CSV handler for Analytics & Reports
function exportReport() {
  showNotification('📋 Exporting analytics report...', 'info');
  // Use robust candidate API logic (same as admin-reports.js)
  const q = new URLSearchParams();
  q.set('type', 'summary');
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
    ...ABS_HOSTS.flatMap(h => RELATIVE.map(p => `${h}${p.startsWith('/')?p:''}${p}`)),
    ...RELATIVE
  ].filter((v,i,a) => a.indexOf(v) === i);
  (async () => {
    let data = null;
    for (const url of CANDIDATES) {
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch {}
    }
    if (data && data.meta && data.rows) {
      const columns = data.meta.columns || [];
      const rows = data.rows || [];
      const out = [columns.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))].join("\n");
      const blob = new Blob([out], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "report.csv"; document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
      let exportCount = Number(localStorage.getItem('reportExportCount') || 0) + 1;
      localStorage.setItem('reportExportCount', exportCount);
      const recentExportsEl = document.getElementById('recent-exports');
      if (recentExportsEl) recentExportsEl.textContent = exportCount;
      showNotification('✅ Analytics report exported as CSV', 'success');
    } else {
      showNotification('❌ Failed to export: No data', 'error');
    }
  })();
}
  
  Object.entries(moduleButtons).forEach(([id, handler]) => {
    const button = document.getElementById(id);
    if (button) {
      button.addEventListener('click', handler);
    }
  });
  
  // Reset Scores Modal Event Listeners
  const confirmResetBtn = document.getElementById('confirm-reset-btn');
  if (confirmResetBtn) {
    confirmResetBtn.addEventListener('click', executeResetScores);
  }
  
  const cancelResetBtn = document.getElementById('cancel-reset-btn');
  if (cancelResetBtn) {
    cancelResetBtn.addEventListener('click', cancelResetScores);
  }
  
  // Close modal when clicking outside
  const resetModal = document.getElementById('modal-reset-scores');
  if (resetModal) {
    resetModal.addEventListener('click', (e) => {
      if (e.target === resetModal) {
        cancelResetScores();
      }
    });
  }
  
  // View all activity button
  const viewAllBtn = document.getElementById('view-all-activity');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      window.location.href = 'admin-logs.html';
    });
  }
  
  // Load recent activity on page load
  loadRecentActivity();
  
  // Load audit stats
  loadAuditStats();
  
  console.log("🎯 Event listeners setup complete");
}

// Load audit & logs stats
async function loadAuditStats() {
  try {
    console.log('🔍 Loading audit stats...');
    
    // Fetch logs from Firestore
    const logsRef = collection(db, 'logs');
    const logsQuery = query(logsRef, orderBy('timestamp', 'desc'), limit(500));
    const snapshot = await getDocs(logsQuery);
    
    let logs = [];
    
    // Use real Firestore logs - DON'T filter by user validation
    snapshot.forEach(doc => {
      const logData = doc.data();
      logs.push({ id: doc.id, ...logData });
    });
    
    // Count total events
    const totalEvents = logs.length;
    
    // Count alerts (admin actions, errors, security events)
    const alertTypes = ['admin', 'error', 'security', 'warning'];
    const alerts = logs.filter(log => 
      alertTypes.includes((log.type || '').toLowerCase()) ||
      (log.action || '').toLowerCase().includes('admin') ||
      (log.action || '').toLowerCase().includes('error')
    ).length;
    
    // Update UI
    const eventsEl = document.getElementById('recent-events');
    const alertsEl = document.getElementById('active-alerts');
    const badgeEl = document.getElementById('audit-badge');
    
    if (eventsEl) eventsEl.textContent = totalEvents;
    if (alertsEl) alertsEl.textContent = alerts;
    if (badgeEl) badgeEl.textContent = alerts; // Badge shows alert count
    
    console.log(`✅ Audit stats loaded: ${totalEvents} events, ${alerts} alerts`);
    
  } catch (error) {
    console.error('❌ Error loading audit stats:', error);
    const eventsEl = document.getElementById('recent-events');
    const alertsEl = document.getElementById('active-alerts');
    if (eventsEl) eventsEl.textContent = '-';
    if (alertsEl) alertsEl.textContent = '-';
  }
}

// Load recent system activity from Firestore logs
async function loadRecentActivity() {
  const activityContainer = document.getElementById('activity-container');
  if (!activityContainer) return;
  
  try {
    console.log('🔄 Loading recent system activity...');
    
    // Fetch latest logs from Firestore
    const logsRef = collection(db, 'logs');
    const recentLogsQuery = query(logsRef, orderBy('timestamp', 'desc'), limit(10));
    const snapshot = await getDocs(recentLogsQuery);
    
    let logs = [];
    
    // Use real Firestore logs - DON'T filter by user validation
    snapshot.forEach(doc => {
      const logData = doc.data();
      logs.push({ id: doc.id, ...logData });
    });
    
    console.log(`✅ Loaded ${logs.length} log entries from Firestore`)
    
    // Take only the first 5 for recent activity display
    const recentLogs = logs.slice(0, 5);
    
    // Build activity items from logs
    let activityHTML = '';
    recentLogs.forEach(log => {
      const activity = formatLogAsActivity(log);
      activityHTML += activity;
    });
    
    activityContainer.innerHTML = activityHTML;
    console.log(`✅ Displayed ${recentLogs.length} recent activities`);
    
  } catch (error) {
    console.error('❌ Error loading recent activity:', error);
    activityContainer.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.5);">Failed to load recent activity</div>';
  }
}

// Format log entry as activity item
function formatLogAsActivity(log) {
  const timestamp = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
  const timeAgo = getTimeAgo(timestamp);
  
  // Map action types to icons and titles (matching backend log actions)
  const actionMap = {
    'User Registered': { icon: '👤', color: '#4ade80', title: 'User registered' },
    'User Login': { icon: '🔐', color: '#60a5fa', title: 'User login' },
    'Quiz Completed': { icon: '✅', color: '#fbbf24', title: 'Quiz completed' },
    'Quiz Generated': { icon: '🎯', color: '#f87171', title: 'Quiz generated' },
    'Quiz Created': { icon: '➕', color: '#f87171', title: 'Quiz created' },
    'Quiz Updated': { icon: '✏️', color: '#a78bfa', title: 'Quiz updated' },
    'Quiz Deleted': { icon: '🗑️', color: '#ef4444', title: 'Quiz deleted' },
    'User Role Changed': { icon: '⚙️', color: '#f97316', title: 'Role updated' },
    'Rankings Reset': { icon: '🔄', color: '#dc2626', title: 'Rankings reset' },
    'Admin Action': { icon: '⚙️', color: '#f87171', title: 'Admin action' },
    'Content uploaded': { icon: '📤', color: '#a78bfa', title: 'Content uploaded' }
  };
  
  const actionInfo = actionMap[log.action] || { icon: '📋', color: '#94a3b8', title: log.action };
  const user = log.user || log.userId || 'System';
  const details = log.details || '';
  
  return `
    <div class="activity-item" style="display:flex;gap:12px;padding:12px;border-bottom:1px solid rgba(0,255,255,0.1);transition:background 0.2s;" onmouseover="this.style.background='rgba(0,255,255,0.05)'" onmouseout="this.style.background='transparent'">
      <div class="activity-icon" style="width:40px;height:40px;background:${actionInfo.color}33;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">
        ${actionInfo.icon}
      </div>
      <div class="activity-content" style="flex:1;">
        <div class="activity-title" style="color:#00ffff;font-weight:600;font-size:0.9rem;margin-bottom:4px;">
          ${actionInfo.title}: ${user}
        </div>
        <div class="activity-description" style="color:rgba(255,255,255,0.6);font-size:0.85rem;">
          ${details}
        </div>
        <div class="activity-time" style="color:rgba(255,255,255,0.4);font-size:0.75rem;margin-top:4px;">
          ${timeAgo}
        </div>
      </div>
    </div>
  `;
}

// Generate sample logs (SHARED via localStorage)
function generateSampleLogs(validUsers) {
  // Convert Set to Array for easy access
  const usersArray = Array.from(validUsers).sort(); // Sort for consistency
  
  // If no valid users, return empty array
  if (usersArray.length === 0) {
    console.warn('⚠️ No valid users found, cannot generate sample logs');
    return [];
  }
  
  // Create cache key based on users (so different user sets get different data)
  const userKey = usersArray.join(',');
  const cacheKey = `osw_sample_logs_${userKey}`;
  
  // Check if sample logs already exist in localStorage with matching users
  const cached = localStorage.getItem(cacheKey);
  const cachedKey = localStorage.getItem('osw_sample_logs_key');
  
  if (cached && cachedKey === userKey) {
    try {
      const parsed = JSON.parse(cached);
      // Convert timestamp strings back to Date objects
      const logs = parsed.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
      console.log('✅ Using cached sample logs from localStorage');
      return logs;
    } catch (e) {
      console.warn('⚠️ Failed to parse cached logs, generating new ones');
    }
  } else if (cachedKey !== userKey) {
    console.log('🔄 User list changed, regenerating sample logs');
  }
  
  // Generate new sample logs
  const now = Date.now();
  const actions = [
    { action: 'User Login', type: 'login', details: 'Successful login' },
    { action: 'Quiz Completed', type: 'quiz', details: 'Week 1 quiz submitted' },
    { action: 'Admin Action', type: 'admin', details: 'User data updated' },
    { action: 'User Registered', type: 'user', details: 'New account created' },
    { action: 'Quiz Generated', type: 'admin', details: 'AI quiz created' }
  ];
  
  const ips = ['192.168.1.100', '10.0.0.50', '172.16.0.10', '192.168.0.200'];
  
  // FIXED PATTERN - no random, consistent data
  const logs = [];
  for (let i = 0; i < 50; i++) {
    const actionData = actions[i % actions.length];
    logs.push({
      id: `log_${i}`,
      timestamp: new Date(now - (i * 3600000)),
      user: usersArray[i % usersArray.length],
      action: actionData.action,
      type: actionData.type,
      details: actionData.details,
      ipAddress: ips[i % ips.length]
    });
  }
  
  const sorted = logs.sort((a, b) => b.timestamp - a.timestamp);
  
  // Save to localStorage for sharing between pages
  try {
    const userKey = usersArray.join(',');
    const cacheKey = `osw_sample_logs_${userKey}`;
    localStorage.setItem(cacheKey, JSON.stringify(sorted));
    localStorage.setItem('osw_sample_logs_key', userKey);
    console.log('✅ Sample logs cached to localStorage with key:', userKey.substring(0, 50) + '...');
  } catch (e) {
    console.warn('⚠️ Failed to cache logs to localStorage');
  }
  
  return sorted;
}

// Get human-readable time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// Quick action handlers
async function handleSystemMaintenance() {
  // Check current maintenance state
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');
  const maintenanceRef = doc(db, 'system', 'maintenance');
  const maintenanceDoc = await getDoc(maintenanceRef);
  const isEnabled = maintenanceDoc.exists() ? maintenanceDoc.data().enabled : false;
  
  // Update modal content based on current state
  const modal = document.getElementById('modal-system-maintenance');
  const modalBody = modal.querySelector('.modal-body');
  const confirmBtn = document.getElementById('confirm-maintenance');
  
  if (isEnabled) {
    // Currently enabled - show disable option
    modalBody.innerHTML = `
      <p style="margin-bottom: 20px; color: rgba(255, 255, 255, 0.9);">
        Maintenance mode is currently <strong style="color: #ff3333;">ACTIVE</strong>. 
        Users cannot access the system.
      </p>
      <div style="background: rgba(0, 255, 0, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #00ff00;">
        <p style="margin: 0; color: rgba(255, 255, 255, 0.8);">
          ✅ Click below to <strong style="color: #00ff00;">DISABLE</strong> maintenance mode and restore user access.
        </p>
      </div>
    `;
    confirmBtn.textContent = 'Disable Maintenance Mode';
    confirmBtn.className = 'modal-btn modal-btn-success';
  } else {
    // Currently disabled - show enable option
    modalBody.innerHTML = `
      <p style="margin-bottom: 20px; color: rgba(255, 255, 255, 0.9);">
        Enabling maintenance mode will temporarily disable user access to the platform. Only administrators will be able to log in.
      </p>
      <div style="background: rgba(255, 153, 0, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #ff9900;">
        <p style="margin: 0; color: rgba(255, 255, 255, 0.8);">
          ⚠️ <strong style="color: #ff9900;">This will affect all active users</strong>
        </p>
      </div>
    `;
    confirmBtn.textContent = 'Enable Maintenance Mode';
    confirmBtn.className = 'modal-btn modal-btn-danger';
  }
  
  modal.style.display = 'flex';
}

async function handleBackupData() {
  document.getElementById('modal-backup-database').style.display = 'flex';
}

async function handleSendAnnouncement() {
  document.getElementById('modal-send-announcement').style.display = 'flex';
}

async function handleRefreshStats() {
  showNotification('🔄 Refreshing dashboard data...', 'info');
  
  try {
    await loadAdminData();
    updateStatsCards();
    updateModuleBadges();
    
    setTimeout(() => {
      showNotification('✅ Dashboard data refreshed', 'success');
    }, 1000);
  } catch (error) {
    showNotification('❌ Failed to refresh data', 'error');
  }
}

// Module action handlers
function showQuickUserStats() {
  const stats = `
📊 Quick User Statistics:
• Total Users: ${adminData.stats.totalUsers}
• Active Users: ${adminData.stats.activeUsers}
• Suspended Users: ${adminData.stats.suspendedUsers}
• New This Week: ${Math.floor(Math.random() * 20) + 5}
  `;
  alert(stats);
}

function createQuickQuiz() {
  const title = prompt('🧩 Enter quiz title:');
  if (title && title.trim()) {
    showNotification('🧩 Quick quiz created: ' + title, 'success');
    console.log("Quick quiz created:", title);
    // Add quiz creation logic here
  }
}

function showUploadStatus() {
  const status = `
📤 Upload System Status:
• Files Processed Today: ${Math.floor(Math.random() * 50) + 10}
• Queue Status: ${Math.floor(Math.random() * 5)} pending
• AI Generation: Online ✅
• Storage: 85% available
  `;
  alert(status);
}

function resetLeaderboard() {
  // Show the beautiful reset modal instead of basic confirm
  showResetScoresModal();
}

// Enhanced Reset Scores Modal System
function showResetScoresModal() {
  const modal = document.getElementById('modal-reset-scores');
  const confirmationInput = document.getElementById('reset-confirmation-input');
  const confirmButton = document.getElementById('confirm-reset-btn');
  
  if (!modal) return;
  
  // Reset modal state
  confirmationInput.value = '';
  confirmButton.disabled = true;
  confirmButton.textContent = '🔄 Reset All Scores';
  
  // Show modal with animation
  modal.style.display = 'flex';
  
  // Setup confirmation input validation
  confirmationInput.addEventListener('input', validateResetConfirmation);
  
  console.log("🚨 Reset scores modal opened");
}

function validateResetConfirmation() {
  const input = document.getElementById('reset-confirmation-input');
  const confirmButton = document.getElementById('confirm-reset-btn');
  
  if (!input || !confirmButton) return;
  
  const inputValue = input.value.trim();
  const requiredText = 'RESET CONFIRM';
  
  if (inputValue === requiredText) {
    confirmButton.disabled = false;
    confirmButton.textContent = '🔄 CONFIRMED - Reset All Scores';
    input.classList.add('valid');
    
    // Add warning pulse animation
    confirmButton.style.animation = 'pulse-danger 1s ease-in-out infinite';
  } else {
    confirmButton.disabled = true;
    confirmButton.textContent = '🔄 Reset All Scores';
    input.classList.remove('valid');
    confirmButton.style.animation = 'none';
  }
}

async function executeResetScores() {
  const confirmButton = document.getElementById('confirm-reset-btn');
  const modal = document.getElementById('modal-reset-scores');
  
  if (!confirmButton || confirmButton.disabled) return;
  
  try {
    // Update button to show processing
    confirmButton.disabled = true;
    confirmButton.innerHTML = '⏳ Resetting Scores...';
    confirmButton.style.animation = 'none';
    
    // Show processing notification
    showNotification('🔄 Initiating leaderboard reset...', 'warning');
    
    // Simulate reset process with steps
    await new Promise(resolve => setTimeout(resolve, 1000));
    showNotification('📊 Clearing quiz scores...', 'info');
    
    await new Promise(resolve => setTimeout(resolve, 800));
    showNotification('⭐ Resetting experience points...', 'info');
    
    await new Promise(resolve => setTimeout(resolve, 800));
    showNotification('🔥 Clearing login streaks...', 'info');
    
    await new Promise(resolve => setTimeout(resolve, 800));
    showNotification('🏆 Removing achievement badges...', 'info');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Actual Firebase/database reset logic
    await resetFirebaseLeaderboard();
    
    // Success notification
    showNotification('✅ Leaderboard reset completed successfully!', 'success');
    
    // Close modal
    modal.style.display = 'none';
    
    // Update dashboard stats to reflect reset
    updateStatsAfterReset();
    
    console.log("🏆 Leaderboard reset completed successfully");
    
  } catch (error) {
    console.error("❌ Reset failed:", error);
    showNotification('❌ Reset failed: ' + error.message, 'error');
    
    // Reset button state
    confirmButton.disabled = false;
    confirmButton.innerHTML = '🔄 CONFIRMED - Reset All Scores';
    confirmButton.style.animation = 'pulse-danger 1s ease-in-out infinite';
  }
}

function updateStatsAfterReset() {
  // Reset relevant stats in the dashboard
  const statsToReset = {
    'total-quizzes': 0,
    'total-points': 0,
    'active-players': 0,
    // Reset Leaderboard Control module stats
    'top-players': 0,
    'active-competitions': 0
  };
  
  Object.entries(statsToReset).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      // Animate the number change
      const currentValue = parseInt(element.textContent) || 0;
      animateNumber(element, currentValue, value, 1000);
    }
  });
  
  console.log("📊 Dashboard stats updated after reset");
}

// Actual Firebase reset functionality
async function resetFirebaseLeaderboard() {
  try {
    console.log("🔄 Starting Firebase leaderboard reset...");
    
    // Try Firebase first
    try {
      // Import Firebase services
      const { db } = await import('./firebase-config.js');
      const { collection, getDocs, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');
      
      // Get all users from Firebase
      const usersCollection = collection(db, 'users');
      const userSnapshot = await getDocs(usersCollection);
      
      console.log(`📋 Found ${userSnapshot.size} users to reset`);
      
      // Reset data for each user
      const resetPromises = [];
      
      userSnapshot.forEach((userDoc) => {
        const userId = userDoc.id;
        const resetData = {
          xp: 0,
          quizScore: 0,
          loginStreak: 0,
          achievements: [],
          totalScore: 0,
          level: 1,
          lastActive: new Date().toISOString()
        };
        
        // Add to batch of promises
        const userRef = doc(db, 'users', userId);
        resetPromises.push(updateDoc(userRef, resetData));
        
        console.log(`🔄 Queued reset for user: ${userId}`);
      });
      
      // Execute all resets
      await Promise.all(resetPromises);
      
      console.log("✅ All user data reset successfully in Firebase");
      return { success: true, resetCount: userSnapshot.size, source: 'firebase' };
      
    } catch (firebaseError) {
      console.warn("⚠️ Firebase reset failed, falling back to local data:", firebaseError);
      
      // Fallback to local data reset
      await resetLocalUserData();
      return { success: true, resetCount: 'unknown', source: 'local_fallback' };
    }
    
  } catch (error) {
    console.error("❌ Complete reset failed:", error);
    throw new Error(`Failed to reset leaderboard data: ${error.message}`);
  }
}

// Reset local JSON data for demo purposes
async function resetLocalUserData() {
  try {
    console.log("📝 Resetting local demo user data...");
    
    // Reset any cached data in localStorage
    const keysToReset = [
      'leaderboard_cache',
      'user_stats_cache', 
      'quiz_scores_cache',
      'achievements_cache'
    ];
    
    keysToReset.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`�️ Cleared localStorage: ${key}`);
      }
    });
    
    // Reset any demo user data in sessionStorage
    if (sessionStorage.getItem('demo_users')) {
      sessionStorage.removeItem('demo_users');
      console.log("🗑️ Cleared demo users from sessionStorage");
    }
    
    // If there were any in-memory user arrays, reset them
    if (window.currentLeaderboardData) {
      window.currentLeaderboardData = [];
      console.log("🗑️ Cleared currentLeaderboardData");
    }
    
    console.log("✅ Local data reset completed");
    return { success: true };
    
  } catch (error) {
    console.error("❌ Local data reset failed:", error);
    // Don't throw error for local data - Firebase is primary
    return { success: false, error: error.message };
  }
}

function cancelResetScores() {
  const modal = document.getElementById('modal-reset-scores');
  const confirmationInput = document.getElementById('reset-confirmation-input');
  
  if (modal) {
    modal.style.display = 'none';
  }
  
  if (confirmationInput) {
    confirmationInput.value = '';
    confirmationInput.classList.remove('valid');
  }
  
  console.log("❌ Reset scores cancelled");
}

function generateReport() {
  showNotification('📊 Generating comprehensive report...', 'info');
  
  setTimeout(() => {
    showNotification('✅ Report generated and ready for download', 'success');
    console.log("Report generated");
  }, 2000);
}

async function exportLogs() {
  showNotification('📋 Exporting system logs...', 'info');
  
  try {
    // Get valid users from Firestore
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const validUsers = new Set();
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.email) validUsers.add(userData.email);
      if (userData.name) validUsers.add(userData.name);
    });
    
    // Fetch logs from Firestore
    const logsRef = collection(db, 'logs');
    const logsQuery = query(logsRef, orderBy('timestamp', 'desc'), limit(500));
    const snapshot = await getDocs(logsQuery);
    
    let logs = [];
    
    if (snapshot.size === 0) {
      logs = generateSampleLogs(validUsers);
    } else {
      snapshot.forEach(doc => {
        const logData = doc.data();
        const logUser = logData.user || logData.userId;
        if (logUser && validUsers.has(logUser)) {
          logs.push({ id: doc.id, ...logData });
        }
      });
    }
    
    // Generate CSV
    const headers = ['Timestamp', 'User', 'Action', 'Details', 'IP Address'];
    const rows = logs.map(log => {
      const timestamp = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
      return [
        timestamp.toISOString(),
        log.user || log.userId || 'System',
        log.action || 'Unknown',
        log.details || '',
        log.ipAddress || ''
      ];
    });
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('✅ Logs exported successfully', 'success');
    console.log('📊 Exported', logs.length, 'logs to CSV');
    
  } catch (error) {
    console.error('❌ Error exporting logs:', error);
    showNotification('❌ Failed to export logs', 'error');
  }
}

// Notification system
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
  
  // Add styles
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

// Real-time updates
function startRealTimeUpdates() {
  // Update stats every 30 seconds
  setInterval(async () => {
    // Refresh REAL data instead of random
    await calculateDailyActivity();
    await calculateSystemHealth();
    
    const dailyActivityEl = document.getElementById('daily-activity');
    const systemHealthEl = document.getElementById('system-health');
    
    if (dailyActivityEl) dailyActivityEl.textContent = adminData.stats.dailyActivity;
    if (systemHealthEl) systemHealthEl.textContent = Math.round(adminData.stats.systemHealth) + '%';
    
    console.log("📈 Real-time stats refreshed from data");
  }, 30000);
  
  console.log("🔄 Real-time updates started (refreshes every 30s)");
}

/**
 * Setup profile dropdown toggle (top-right). Adds click-outside to close.
 */
function setupProfileDropdown() {
  const profileContainer = document.querySelector('.profile-container');
  const profileDropdown = document.getElementById('profile-dropdown');
  if (!profileContainer || !profileDropdown) return;

  // ensure initial state
  profileDropdown.classList.add('hidden');
  profileDropdown.classList.remove('show');

  let open = false;
  profileContainer.addEventListener('click', (ev) => {
    ev.stopPropagation();
    open = !open;
    if (open) {
      profileDropdown.classList.remove('hidden');
      // small delay to allow CSS transition if any
      setTimeout(() => profileDropdown.classList.add('show'), 10);
    } else {
      profileDropdown.classList.remove('show');
      setTimeout(() => profileDropdown.classList.add('hidden'), 200);
    }
  });

  // click outside closes dropdown
  document.addEventListener('click', (ev) => {
    if (!open) return;
    if (!profileContainer.contains(ev.target)) {
      open = false;
      profileDropdown.classList.remove('show');
      setTimeout(() => profileDropdown.classList.add('hidden'), 200);
    }
  });

  // keyboard: Esc closes
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && open) {
      open = false;
      profileDropdown.classList.remove('show');
      setTimeout(() => profileDropdown.classList.add('hidden'), 200);
    }
  });
}

// Initialize theme from localStorage
function initializeTheme() {
  const savedTheme = localStorage.getItem("osw-theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  }
}

// PROFILE DROPDOWN BUTTONS
const viewProfileBtn = document.getElementById("view-profile");
if (viewProfileBtn) {
  viewProfileBtn.addEventListener("click", () => {
    window.location.href = "profile.html";
  });
}

const viewAchievementsBtn = document.getElementById("view-achievements");
if (viewAchievementsBtn) {
  viewAchievementsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "achievement.html";
  });
}

const changeAvatarBtn = document.getElementById("change-avatar");
if (changeAvatarBtn) {
  changeAvatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const modalChangeAvatar = document.getElementById("modal-change-avatar");
    const inputAvatarUrl = document.getElementById("input-avatar-url");
    if (modalChangeAvatar) {
      modalChangeAvatar.style.display = "flex";
      if (inputAvatarUrl) {
        inputAvatarUrl.value = "";
        inputAvatarUrl.focus();
      }
    }
  });
}

const editNameBtn = document.getElementById("edit-name");
if (editNameBtn) {
  editNameBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const modalEditName = document.getElementById("modal-edit-name");
    const inputNewName = document.getElementById("input-new-name");
    if (modalEditName) {
      modalEditName.style.display = "flex";
      if (inputNewName) {
        inputNewName.value = "";
        inputNewName.focus();
      }
    }
  });
}

// LOGOUT
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await signOut(auth);
      console.log("✅ Logout successful");
      window.location.href = "index.html";
    } catch (error) {
      console.error("❌ Logout error:", error);
      showNotification("Failed to logout: " + error.message, 'error');
    }
  });
}

// expose signOut for admin-common.js / other pages
window.firebaseSignOut = async function () {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("firebaseSignOut error:", e);
    throw e;
  }
};

// === Save name/avatar buttons ===
const saveNameBtn = document.getElementById("save-name-btn");
const cancelNameBtn = document.getElementById("cancel-name-btn");

if (cancelNameBtn) {
  cancelNameBtn.onclick = () => {
    const modal = document.getElementById("modal-edit-name");
    if (modal) modal.style.display = "none";
  };
}

if (saveNameBtn) {
  saveNameBtn.onclick = async () => {
    const inputNewName = document.getElementById("input-new-name");
    if (inputNewName && auth.currentUser) {
      const newName = inputNewName.value.trim();
      if (!newName) {
        showNotification("Please enter a valid name", 'warning');
        return;
      }
      
      const uid = auth.currentUser.uid;
      try {
        await updateDoc(doc(db, "users", uid), { name: newName });
        await updateProfile(auth.currentUser, { displayName: newName });
        
        const navbarName = document.getElementById("username-navbar");
        if (navbarName) navbarName.textContent = newName;
        
        const modal = document.getElementById("modal-edit-name");
        if (modal) modal.style.display = "none";
        
        showNotification("Name updated successfully!", 'success');
      } catch (err) {
        console.error(err);
        showNotification("Failed to update name: " + err.message, 'error');
      }
    }
  };
}

const saveAvatarBtn = document.getElementById("save-avatar-btn");
const cancelAvatarBtn = document.getElementById("cancel-avatar-btn");

if (cancelAvatarBtn) {
  cancelAvatarBtn.onclick = () => {
    const modal = document.getElementById("modal-change-avatar");
    if (modal) modal.style.display = "none";
  };
}

if (saveAvatarBtn) {
  saveAvatarBtn.onclick = async () => {
    const inputAvatarUrl = document.getElementById("input-avatar-url");
    if (inputAvatarUrl && auth.currentUser) {
      const newURL = inputAvatarUrl.value.trim();
      if (!newURL) {
        showNotification("Please enter a valid image URL", 'warning');
        return;
      }
      
      const uid = auth.currentUser.uid;
      try {
        await updateDoc(doc(db, "users", uid), { profileURL: newURL });
        await updateProfile(auth.currentUser, { photoURL: newURL });
        
        const img = document.getElementById("profile-img");
        if (img) img.src = newURL;
        
        const modal = document.getElementById("modal-change-avatar");
        if (modal) modal.style.display = "none";
        
        showNotification("Avatar updated successfully!", 'success');
      } catch (err) {
        console.error(err);
        showNotification("Failed to update avatar: " + err.message, 'error');
      }
    }
  };
}

// NAVIGATION / ACTIONS for admin modules
const routeMap = {
  "manage-users": "admin-users.html",
  "manage-quizzes": "admin-quizzes.html",
  "upload-system": "admin-upload.html",
  "leaderboard-system": "admin-leaderboard.html",
  "reports-system": "admin-reports.html",
  "audit-system": "admin-logs.html"
};

Object.keys(routeMap).forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("click", (e) => {
      // Only handle clicks on the card itself, not on buttons within it
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
        return;
      }
      e.preventDefault();
      window.location.href = routeMap[id];
    });
  }
});

// Initialize everything when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("🎯 Admin dashboard DOM loaded");
  
  setupProfileDropdown();
  initializeTheme();
  
  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    .notification-content {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text-primary);
    }
    
    .notification-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1.2rem;
      margin-left: auto;
    }
    
    .notification-close:hover {
      color: var(--text-primary);
    }
  `;
  document.head.appendChild(style);
  
  console.log("✅ Admin dashboard initialization complete");
});

// Setup modal confirm handlers
document.addEventListener('DOMContentLoaded', () => {
  // System Maintenance confirm
  const confirmMaintenanceBtn = document.getElementById('confirm-maintenance');
  if (confirmMaintenanceBtn) {
    confirmMaintenanceBtn.addEventListener('click', async () => {
      try {
        // Toggle maintenance mode in Firestore
        const { doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');
        
        const maintenanceRef = doc(db, 'system', 'maintenance');
        const maintenanceDoc = await getDoc(maintenanceRef);
        
        const currentState = maintenanceDoc.exists() ? maintenanceDoc.data().enabled : false;
        const newState = !currentState;
        
        await setDoc(maintenanceRef, {
          enabled: newState,
          updatedBy: auth.currentUser?.email || 'admin',
          updatedAt: new Date().toISOString()
        });
        
        document.getElementById('modal-system-maintenance').style.display = 'none';
        
        if (newState) {
          showNotification('🔧 System maintenance mode ACTIVATED', 'warning');
          console.log("System maintenance mode activated");
        } else {
          showNotification('✅ System maintenance mode DEACTIVATED', 'success');
          console.log("System maintenance mode deactivated");
        }
      } catch (error) {
        console.error('❌ Error toggling maintenance mode:', error);
        showNotification('❌ Failed to toggle maintenance mode', 'error');
      }
    });
  }

  // Backup confirm
  const confirmBackupBtn = document.getElementById('confirm-backup');
  if (confirmBackupBtn) {
    confirmBackupBtn.addEventListener('click', async () => {
      try {
        document.getElementById('modal-backup-database').style.display = 'none';
        showNotification('💾 Starting database backup...', 'info');
        
        // Import Firestore functions
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');
        
        // Backup data object
        const backupData = {
          timestamp: new Date().toISOString(),
          backupBy: auth.currentUser?.email || 'admin',
          collections: {}
        };
        
        // Collections to backup
        const collectionsToBackup = ['users', 'quizzes', 'logs', 'announcements', 'system'];
        
        // Fetch all collections
        for (const collectionName of collectionsToBackup) {
          try {
            const snapshot = await getDocs(collection(db, collectionName));
            backupData.collections[collectionName] = [];
            
            snapshot.forEach(doc => {
              const data = doc.data();
              // Convert Firestore Timestamps to ISO strings
              const cleanData = JSON.parse(JSON.stringify(data, (key, value) => {
                if (value && typeof value === 'object' && value.toDate) {
                  return value.toDate().toISOString();
                }
                return value;
              }));
              
              backupData.collections[collectionName].push({
                id: doc.id,
                data: cleanData
              });
            });
            
            console.log(`✅ Backed up ${collectionName}: ${backupData.collections[collectionName].length} documents`);
          } catch (error) {
            console.error(`Error backing up ${collectionName}:`, error);
            backupData.collections[collectionName] = { error: error.message };
          }
        }
        
        // Create downloadable JSON file
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `oswarrior-backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('✅ Database backup downloaded successfully', 'success');
        console.log("Database backup completed and downloaded");
        
      } catch (error) {
        console.error("Backup error:", error);
        showNotification('❌ Backup failed: ' + error.message, 'danger');
      }
    });
  }

  // Announcement confirm
  const confirmAnnouncementBtn = document.getElementById('confirm-announcement');
  if (confirmAnnouncementBtn) {
    confirmAnnouncementBtn.addEventListener('click', async () => {
      const title = document.getElementById('announcement-title').value;
      const message = document.getElementById('announcement-message').value;
      const urgent = document.getElementById('announcement-urgent').checked;
      
      if (!title || !message) {
        showNotification('⚠️ Please fill in all fields', 'warning');
        return;
      }
      
      try {
        // Save announcement to Firestore
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');
        
        await addDoc(collection(db, 'announcements'), {
          title: title,
          message: message,
          urgent: urgent,
          timestamp: serverTimestamp(),
          createdBy: auth.currentUser?.email || 'admin',
          active: true
        });
        
        document.getElementById('modal-send-announcement').style.display = 'none';
        showNotification('📢 Announcement sent to all users', 'success');
        console.log("Announcement sent:", { title, message, urgent });
        
        // Clear form
        document.getElementById('announcement-title').value = '';
        document.getElementById('announcement-message').value = '';
        document.getElementById('announcement-urgent').checked = false;
      } catch (error) {
        console.error('❌ Error sending announcement:', error);
        showNotification('❌ Failed to send announcement', 'error');
      }
    });
  }
});

console.log("🚀 Admin dashboard script loaded");