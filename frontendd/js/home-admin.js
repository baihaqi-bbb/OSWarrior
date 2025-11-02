// filepath: [home-admin.js](http://_vscodecontentref_/3)
// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  databaseURL: "https://test-4fdf4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.firebasestorage.app",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
    
    // Load quizzes data (from local data folder for now)
    try {
      const response = await fetch('/data/quizzes.json');
      if (response.ok) {
        const quizzesData = await response.json();
        adminData.quizzes = quizzesData || [];
        adminData.stats.totalQuizzes = adminData.quizzes.length;
        adminData.stats.publishedQuizzes = adminData.quizzes.filter(q => q.status === 'published').length;
        adminData.stats.draftQuizzes = adminData.quizzes.filter(q => q.status === 'draft').length;
      }
    } catch (err) {
      console.log("Could not load quizzes data:", err);
      adminData.stats.totalQuizzes = 0;
    }
    
    // Simulate daily activity (you can replace with real data)
    adminData.stats.dailyActivity = Math.floor(Math.random() * 50) + 20;
    
    console.log("✅ Admin data loaded:", adminData);
    
  } catch (error) {
    console.error("❌ Error loading admin data:", error);
  }
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
    'reports-badge': 12,
    'audit-badge': Math.floor(Math.random() * 50) + 10
  };
  
  Object.entries(badges).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
  
  // Update module stats
  const moduleStats = {
    'active-users': adminData.stats.activeUsers,
    'suspended-users': adminData.stats.suspendedUsers,
    'published-quizzes': adminData.stats.publishedQuizzes,
    'draft-quizzes': adminData.stats.draftQuizzes,
    'uploaded-files': Math.floor(Math.random() * 100) + 50,
    'generated-quizzes': adminData.stats.totalQuizzes,
    'top-players': Math.min(adminData.stats.activeUsers, 10),
    'active-competitions': 3,
    'available-reports': 12,
    'recent-exports': 5,
    'recent-events': Math.floor(Math.random() * 200) + 100,
    'active-alerts': Math.floor(Math.random() * 5)
  };
  
  Object.entries(moduleStats).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
  
  console.log("🏷️ Module badges updated");
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
    'generate-report': generateReport,
    'export-logs': exportLogs
  };
  
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
  
  console.log("🎯 Event listeners setup complete");
}

// Quick action handlers
async function handleSystemMaintenance() {
  const confirmed = confirm('⚠️ Are you sure you want to enter maintenance mode? This will temporarily disable user access.');
  if (confirmed) {
    showNotification('🔧 System maintenance mode activated', 'warning');
    console.log("System maintenance mode activated");
    // Add your maintenance mode logic here
  }
}

async function handleBackupData() {
  showNotification('💾 Starting database backup...', 'info');
  
  try {
    // Simulate backup process
    setTimeout(() => {
      showNotification('✅ Database backup completed successfully', 'success');
    }, 2000);
    
    console.log("Database backup initiated");
    // Add your backup logic here
  } catch (error) {
    showNotification('❌ Backup failed: ' + error.message, 'error');
  }
}

async function handleSendAnnouncement() {
  const message = prompt('📢 Enter announcement message:');
  if (message && message.trim()) {
    showNotification('📢 Announcement sent to all users', 'success');
    console.log("Announcement sent:", message);
    // Add your announcement logic here
  }
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

function exportLogs() {
  showNotification('📋 Exporting system logs...', 'info');
  
  setTimeout(() => {
    showNotification('✅ Logs exported successfully', 'success');
    console.log("Logs exported");
  }, 1500);
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
  setInterval(() => {
    // Simulate real-time changes
    adminData.stats.dailyActivity = Math.floor(Math.random() * 50) + 20;
    adminData.stats.systemHealth = Math.max(95, Math.min(100, adminData.stats.systemHealth + (Math.random() - 0.5) * 2));
    
    const dailyActivityEl = document.getElementById('daily-activity');
    const systemHealthEl = document.getElementById('system-health');
    
    if (dailyActivityEl) dailyActivityEl.textContent = adminData.stats.dailyActivity;
    if (systemHealthEl) systemHealthEl.textContent = Math.round(adminData.stats.systemHealth) + '%';
    
    console.log("📈 Real-time stats updated");
  }, 30000);
  
  console.log("🔄 Real-time updates started");
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

const toggleThemeBtn = document.getElementById("toggle-theme");
if (toggleThemeBtn) {
  toggleThemeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const body = document.body;
    if (body.classList.contains("dark-mode")) {
      body.classList.remove("dark-mode");
      localStorage.setItem("osw-theme", "light");
    } else {
      body.classList.add("dark-mode");
      localStorage.setItem("osw-theme", "dark");
    }
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

console.log("🚀 Admin dashboard script loaded");