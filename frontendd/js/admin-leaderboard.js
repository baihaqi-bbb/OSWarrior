// ===========================================================
// OSWARRIOR ADMIN LEADERBOARD MANAGEMENT
// Comprehensive leaderboard analytics and management system
// ===========================================================

import { 
  collection, 
  getDocs, 
  getDoc,
  query, 
  orderBy, 
  limit, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc,
  writeBatch,
  onSnapshot 
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { db, auth } from './firebase-config.js';

// Global state
let currentLeaderboardData = [];
let currentFilters = {
  timeFilter: 'all',
  categoryFilter: 'overall',
  limitFilter: 25
};
let currentPage = 1;
const itemsPerPage = 10;

// DOM Elements
const elements = {
  // Stats
  topScorer: document.getElementById('top-scorer'),
  topScore: document.getElementById('top-score'),
  totalParticipants: document.getElementById('total-participants'),
  averageScore: document.getElementById('average-score'),
  weeklyChange: document.getElementById('weekly-change'),
  
  // Filters
  timeFilter: document.getElementById('timeFilter'),
  categoryFilter: document.getElementById('categoryFilter'),
  limitFilter: document.getElementById('limitFilter'),
  
  // Table
  leaderboardBody: document.getElementById('leaderboardBody'),
  paginationControls: document.getElementById('paginationControls'),
  
  // Buttons
  refreshLeaderboard: document.getElementById('refreshLeaderboard'),
  exportLeaderboard: document.getElementById('exportLeaderboard'),
  resetRankings: document.getElementById('resetRankings'),
  viewHistory: document.getElementById('viewHistory'),
  
  // Modals
  modalResetRankings: document.getElementById('modal-reset-rankings'),
  resetConfirmation: document.getElementById('reset-confirmation'),
  confirmResetBtn: document.getElementById('confirm-reset-btn'),
  cancelResetBtn: document.getElementById('cancel-reset-btn'),
  modalSuccess: document.getElementById('modal-success'),
  successTitle: document.getElementById('success-title'),
  successMessage: document.getElementById('success-message'),
  closeSuccessBtn: document.getElementById('close-success-btn')
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('🏆 Admin Leaderboard Management - Initializing...');
  initializeEventListeners();
  loadLeaderboardData();
  updateLeaderboardStats();
});

// ===============================
// EVENT LISTENERS
// ===============================

function initializeEventListeners() {
  // Filter change listeners
  elements.timeFilter?.addEventListener('change', handleFilterChange);
  elements.categoryFilter?.addEventListener('change', handleFilterChange);
  elements.limitFilter?.addEventListener('change', handleFilterChange);
  
  // Button listeners
  elements.refreshLeaderboard?.addEventListener('click', refreshLeaderboard);
  elements.exportLeaderboard?.addEventListener('click', exportLeaderboard);
  elements.resetRankings?.addEventListener('click', showResetModal);
  elements.viewHistory?.addEventListener('click', viewLeaderboardHistory);
  
  // Modal listeners
  elements.cancelResetBtn?.addEventListener('click', closeResetModal);
  elements.confirmResetBtn?.addEventListener('click', confirmResetRankings);
  elements.closeSuccessBtn?.addEventListener('click', closeSuccessModal);
  
  // Reset confirmation input listener
  elements.resetConfirmation?.addEventListener('input', function() {
    const isValid = this.value.toUpperCase() === 'RESET';
    elements.confirmResetBtn.disabled = !isValid;
  });
  
  console.log('✅ Event listeners initialized');
}

// ===============================
// DATA LOADING & PROCESSING
// ===============================

async function loadLeaderboardData() {
  try {
    console.log('📊 Loading leaderboard AND user data from BACKEND API...');
    showLoadingState();
    
    // Use SAME API as user leaderboard page
    const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:4000'
      : 'https://oswarrior-backend.onrender.com';
    
    // Fetch BOTH leaderboard scores AND full user data
    console.log(`🔄 Fetching leaderboard scores from: ${API_URL}/api/leaderboard`);
    const leaderboardResponse = await fetch(`${API_URL}/api/leaderboard`, {
      credentials: 'include'
    });
    
    if (!leaderboardResponse.ok) {
      throw new Error(`Leaderboard API returned ${leaderboardResponse.status}`);
    }
    
    const leaderboardData = await leaderboardResponse.json();
    console.log(`✅ Leaderboard API response:`, leaderboardData);
    console.log(`✅ Leaderboard entries: ${leaderboardData?.length || 0}`);
    
    // AFTER RESET: Leaderboard will be empty, so fetch all users instead
    if (!Array.isArray(leaderboardData) || leaderboardData.length === 0) {
      console.warn('⚠️ Leaderboard is empty (might be after reset). Fetching all users instead...');
      
      // Fetch all users from /api/users
      const usersResponse = await fetch(`${API_URL}/api/users`, {
        credentials: 'include'
      });
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        console.log('✅ Fetched users data:', usersData);
        
        if (usersData.users && usersData.users.length > 0) {
          // Filter out admins and convert users to leaderboard format
          const nonAdminUsers = [];
          
          for (const user of usersData.users) {
            // Check if user is admin
            try {
              const userDoc = await getDoc(doc(db, "users", user.userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.role === 'admin') {
                  console.log(`⚠️ Filtering out admin from users list: ${user.name || user.userId}`);
                  continue; // Skip admin users
                }
              }
            } catch (err) {
              console.warn(`Could not check role for ${user.userId}:`, err);
              // If check fails, include the user (fail-open policy)
            }
            
            nonAdminUsers.push({
              id: user.userId,
              username: user.name || user.email || `User-${String(user.userId).slice(0,6)}`,
              displayName: user.name || user.email || 'Anonymous',
              email: user.email || '',
              photoURL: user.photoURL || 'image/default-profile.png',
              totalScore: 0, // After reset, all scores are 0
              totalAttempts: 0,
              quizScore: 0,
              xp: user.xp || 0,
              level: user.level || 1,
              loginStreak: user.loginStreak || 0,
              achievements: user.achievements || [],
              lastActive: user.lastLogin || user.updatedAt || null
            });
          }
          
          currentLeaderboardData = nonAdminUsers;
          console.log(`✅ Converted ${currentLeaderboardData.length} users to leaderboard format (admins filtered)`);
          renderLeaderboard();
          updatePagination();
          return;
        }
      }
      
      // If still no data, show empty state
      showNotification('ℹ️ No user data available. Users need to complete quizzes to appear in leaderboard.', 'info');
      showErrorState('No user data available. Users need to sign up and complete quizzes to appear in leaderboard!');
      return;
    }
    
    // Fetch full user data for additional info (XP, level, streak, etc)
    console.log(`🔄 Fetching full user data...`);
    const usersResponse = await fetch(`${API_URL}/api/users`, {
      credentials: 'include'
    });
    
    let usersMap = {};
    if (usersResponse.ok) {
      const usersData = await usersResponse.json();
      console.log(`✅ User data entries: ${usersData?.users?.length || 0}`);
      
      // Create map of userId -> user data for quick lookup
      if (usersData.users) {
        usersData.users.forEach(user => {
          usersMap[user.userId] = user;
        });
      }
    } else {
      console.warn('⚠️ Could not fetch full user data, using leaderboard data only');
    }
    
    currentLeaderboardData = [];
    
    // Combine leaderboard scores with full user data
    for (const item of leaderboardData) {
      const fullUserData = usersMap[item.userId] || {};
      
      // Check if user is admin and skip them
      try {
        const userDoc = await getDoc(doc(db, "users", item.userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role === 'admin') {
            console.log(`⚠️ Filtering out admin from leaderboard: ${item.username || item.userId}`);
            continue; // Skip admin users
          }
        }
      } catch (err) {
        console.warn(`Could not check role for ${item.userId}:`, err);
        // If check fails, include the user (fail-open policy)
      }
      
      console.log(`👤 User ${item.username || item.userId}:`, {
        totalScore: item.totalScore,
        totalAttempts: item.totalAttempts,
        xp: fullUserData.xp,
        level: fullUserData.level,
        loginStreak: fullUserData.loginStreak
      });
      
      // Combine leaderboard score with full user data
      const enhancedUserData = {
        id: item.userId,
        username: item.username || fullUserData.name || `User-${String(item.userId).slice(0, 6)}`,
        displayName: item.username || fullUserData.name || 'Anonymous',
        email: fullUserData.email || '',
        photoURL: fullUserData.photoURL || 'image/default-profile.png',
        // Leaderboard data
        totalScore: item.totalScore || 0,
        totalAttempts: item.totalAttempts || 0,
        quizScore: item.totalScore || 0,
        // Full user data
        xp: fullUserData.xp || 0,
        level: fullUserData.level || calculateUserLevel(fullUserData.xp || 0),
        loginStreak: fullUserData.loginStreak || 0,
        achievements: fullUserData.achievements || [],
        lastActive: fullUserData.lastLogin || fullUserData.updatedAt || null
      };
      
      console.log(`✨ Enhanced data for ${item.username}:`, {
        totalScore: enhancedUserData.totalScore,
        xp: enhancedUserData.xp,
        level: enhancedUserData.level,
        loginStreak: enhancedUserData.loginStreak
      });
      
      currentLeaderboardData.push(enhancedUserData);
    }
    
    console.log(`✅ Active users after filtering: ${currentLeaderboardData.length}`);
    
    // Apply time filter FIRST before sorting
    applyTimeFilter();
    
    // Sort based on category filter
    sortLeaderboardData();
    
    // Apply category filtering if needed
    applyCategoryFilter();
    
    // Limit to requested amount
    const limitAmount = parseInt(currentFilters.limitFilter);
    currentLeaderboardData = currentLeaderboardData.slice(0, limitAmount);
    
    console.log(`🎯 Final leaderboard entries: ${currentLeaderboardData.length}`);
    console.log('📋 Leaderboard data:', currentLeaderboardData);
    
    // Render leaderboard
    renderLeaderboard();
    updatePagination();
    
    console.log(`✅ Loaded ${currentLeaderboardData.length} leaderboard entries`);
    
  } catch (error) {
    console.error('❌ Error loading leaderboard:', error);
    showNotification(`❌ Failed to load leaderboard: ${error.message}`, 'error');
    showErrorState(`Failed to load leaderboard data. Please check if backend server is running.`);
  }
}

function calculateOverallScore(userData) {
  // Try multiple field names for score (different naming conventions)
  const quizScore = userData.quizScore || userData.score || userData.totalScore || userData.points || 0;
  
  // Try multiple field names for XP
  const xpPoints = userData.xp || userData.experiencePoints || userData.experience || userData.exp || 0;
  
  // Only count streak and achievements if user has participated in quizzes
  const hasParticipated = quizScore > 0 || userData.quizHistory?.length > 0 || userData.completedQuizzes > 0;
  const streakBonus = hasParticipated ? (userData.loginStreak || userData.streak || 0) * 10 : 0;
  const achievementsBonus = hasParticipated ? (userData.achievements?.length || 0) * 50 : 0;
  
  const calculatedScore = quizScore + (xpPoints * 0.1) + streakBonus + achievementsBonus;
  
  console.log(`🧮 Score calculation for ${userData.displayName || userData.email}:`, {
    quizScore: `${quizScore} points`,
    xpBonus: `${xpPoints} XP → ${xpPoints * 0.1} points`,
    streakBonus: `${userData.loginStreak || userData.streak || 0} days → ${streakBonus} points`,
    achievementsBonus: `${userData.achievements?.length || 0} achievements → ${achievementsBonus} points`,
    totalCalculated: calculatedScore,
    rawData: { quizScore: userData.quizScore, score: userData.score, xp: userData.xp, exp: userData.exp }
  });
  
  return Math.round(calculatedScore);
}

function sortLeaderboardData() {
  // Sort based on current category filter
  switch (currentFilters.categoryFilter) {
    case 'quiz':
      currentLeaderboardData.sort((a, b) => {
        const scoreA = a.quizScore || a.score || a.points || 0;
        const scoreB = b.quizScore || b.score || b.points || 0;
        return scoreB - scoreA;
      });
      break;
    case 'xp':
      currentLeaderboardData.sort((a, b) => {
        const xpA = a.xp || a.experiencePoints || a.experience || a.exp || 0;
        const xpB = b.xp || b.experiencePoints || b.experience || b.exp || 0;
        return xpB - xpA;
      });
      break;
    case 'streak':
      currentLeaderboardData.sort((a, b) => {
        const streakA = a.loginStreak || a.streak || 0;
        const streakB = b.loginStreak || b.streak || 0;
        return streakB - streakA;
      });
      break;
    default: // overall
      currentLeaderboardData.sort((a, b) => {
        const totalA = a.totalScore || calculateOverallScore(a);
        const totalB = b.totalScore || calculateOverallScore(b);
        return totalB - totalA;
      });
  }
  
  console.log(`🔄 Sorted by ${currentFilters.categoryFilter}:`, 
    currentLeaderboardData.slice(0, 3).map(u => ({
      username: u.username,
      score: getScoreForCategory(u, currentFilters.categoryFilter)
    }))
  );
}

function applyCategoryFilter() {
  // Don't filter users - show all users regardless of score
  // Admin should see all users even with 0 scores
  console.log(`📊 Category filter: ${currentFilters.categoryFilter} - showing all ${currentLeaderboardData.length} users`);
}

function getScoreForCategory(user, category) {
  switch (category) {
    case 'quiz':
      return user.quizScore || user.score || user.points || 0;
    case 'xp':
      return user.xp || user.experiencePoints || user.experience || user.exp || 0;
    case 'streak':
      return user.loginStreak || user.streak || 0;
    default:
      // For overall, try totalScore first, then calculate
      return user.totalScore || calculateOverallScore(user);
  }
}

function applyTimeFilter() {
  const originalCount = currentLeaderboardData.length;
  
  // If "all" is selected, no filtering needed
  if (currentFilters.timeFilter === 'all') {
    console.log(`⏰ Time filter: All time (no filtering) - ${originalCount} users`);
    return;
  }
  
  const now = new Date();
  const filterDate = new Date();
  
  switch (currentFilters.timeFilter) {
    case 'week':
      filterDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      filterDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      filterDate.setMonth(now.getMonth() - 3);
      break;
  }
  
  console.log(`⏰ Applying time filter: ${currentFilters.timeFilter} (since ${filterDate.toLocaleDateString()})`);
  
  // Filter data based on lastActive date
  const beforeFilter = currentLeaderboardData.length;
  
  currentLeaderboardData = currentLeaderboardData.filter(user => {
    // Try multiple date fields
    let userDate = null;
    
    if (user.lastActive) {
      userDate = user.lastActive?.toDate ? user.lastActive.toDate() : new Date(user.lastActive);
    } else if (user.lastLogin) {
      userDate = user.lastLogin?.toDate ? user.lastLogin.toDate() : new Date(user.lastLogin);
    } else if (user.updatedAt) {
      userDate = user.updatedAt?.toDate ? user.updatedAt.toDate() : new Date(user.updatedAt);
    } else if (user.createdAt) {
      userDate = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
    } else {
      // If no date fields, assume recent activity (include user)
      console.log(`📅 No date fields found for ${user.username}, including in results`);
      return true;
    }
    
    const isWithinPeriod = userDate >= filterDate;
    
    console.log(`📅 User ${user.username}: ${userDate.toLocaleDateString()} ${isWithinPeriod ? '✅' : '❌'}`);
    
    return isWithinPeriod;
  });
  
  const afterFilter = currentLeaderboardData.length;
  console.log(`⏰ Time filter applied: ${beforeFilter} → ${afterFilter} users (${beforeFilter - afterFilter} filtered out)`);
}

// ===============================
// RENDERING FUNCTIONS
// ===============================

function renderLeaderboard() {
  if (!elements.leaderboardBody) return;
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = currentLeaderboardData.slice(startIndex, endIndex);
  
  elements.leaderboardBody.innerHTML = '';
  
  console.log(`🎨 Rendering leaderboard: ${pageData.length} users on page ${currentPage}`);
  console.log(`📊 Current filters:`, currentFilters);
  
  if (pageData.length === 0) {
    const emptyMessage = currentLeaderboardData.length === 0 
      ? `No users found for current filters`
      : `No users on page ${currentPage}`;
      
    // Create filter summary
    const filterInfo = [];
    if (currentFilters.timeFilter !== 'all') {
      filterInfo.push(`Time: ${currentFilters.timeFilter}`);
    }
    filterInfo.push(`Category: ${currentFilters.categoryFilter}`);
    filterInfo.push(`Limit: ${currentFilters.limitFilter}`);
    
    elements.leaderboardBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.6);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">😔</div>
          <div style="font-size: 1.1rem; margin-bottom: 0.5rem;">${emptyMessage}</div>
          <div style="margin-top: 1rem; font-size: 0.9rem; color: rgba(255,255,255,0.4);">
            Active filters: ${filterInfo.join(' | ')}
          </div>
          <button onclick="resetFilters()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #00FFFF; color: #000; border: none; border-radius: 5px; cursor: pointer;">
            🔄 Reset Filters
          </button>
        </td>
      </tr>
    `;
    return;
  }
  
  pageData.forEach((user, index) => {
    const globalRank = startIndex + index + 1;
    const row = createLeaderboardRow(user, globalRank);
    elements.leaderboardBody.appendChild(row);
  });
  
  console.log(`✅ Rendered ${pageData.length} leaderboard rows`);
}

function createLeaderboardRow(user, rank) {
  const row = document.createElement('tr');
  row.dataset.userId = user.id;
  
  // Get score based on category using helper function
  const score = getScoreForCategory(user, currentFilters.categoryFilter);
  
  let scoreLabel = 'pts';
  switch (currentFilters.categoryFilter) {
    case 'quiz': scoreLabel = 'quiz pts'; break;
    case 'xp': scoreLabel = 'XP'; break;
    case 'streak': scoreLabel = 'days'; break;
    default: scoreLabel = 'total pts';
  }
  
  // Create rank badge
  const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
  const rankIcon = rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
  
  // User badges - handle missing achievements
  const badges = user.achievements || [];
  const badgeIcons = badges.slice(0, 3).map(achievement => {
    const badgeMap = {
      'first_quiz': '🎯',
      'quiz_master': '🏆',
      'speedster': '⚡',
      'scholar': '📚',
      'streak_7': '🔥',
      'streak_30': '🌟'
    };
    return badgeMap[achievement] || '🏅';
  }).join(' ');
  
  // Format last active - handle missing dates
  let formattedDate = 'Unknown';
  if (user.lastActive) {
    const lastActive = user.lastActive?.toDate ? user.lastActive.toDate() : new Date(user.lastActive);
    formattedDate = formatTimeAgo(lastActive);
  } else if (user.createdAt) {
    const createdAt = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
    formattedDate = `Joined ${formatTimeAgo(createdAt)}`;
  }
  
  // User level - check if level field exists, otherwise calculate from XP
  const userXP = user.xp || user.experiencePoints || user.experience || user.exp || 0;
  const level = user.level || calculateUserLevel(userXP);
  
  // Handle missing username/email
  const username = user.username || user.displayName || user.email?.split('@')[0] || 'Anonymous';
  const email = user.email || 'No email';
  const profilePicture = user.profilePicture || user.photoURL || 'image/default-profile.png';
  
  row.innerHTML = `
    <td>
      <div class="rank-badge ${rankClass}">
        ${rankIcon}
      </div>
    </td>
    <td>
      <div class="user-info">
        <img src="${profilePicture}" 
             alt="${username}" class="user-avatar">
        <div class="user-details">
          <h4>${username}</h4>
          <span>${email}</span>
        </div>
      </div>
    </td>
    <td>
      <div class="score-value">${Math.round(score).toLocaleString()} ${scoreLabel}</div>
    </td>
    <td>
      <div class="level-badge">Level ${level}</div>
    </td>
    <td>
      <div class="badges-container">
        ${badgeIcons || '—'}
      </div>
    </td>
    <td style="font-size: 0.9rem; color: rgba(255,255,255,0.7);">
      ${formattedDate}
    </td>
    <td>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn-small btn-info" onclick="viewUserProfile('${user.id}')">
          👤 View
        </button>
        <button class="btn-small btn-warning" onclick="resetUserScore('${user.id}')">
          🔄 Reset
        </button>
      </div>
    </td>
  `;
  
  return row;
}

function calculateUserLevel(xp) {
  if (xp < 100) return 1;
  if (xp < 300) return 2;
  if (xp < 600) return 3;
  if (xp < 1000) return 4;
  if (xp < 1500) return 5;
  return Math.floor(xp / 300) + 2;
}

function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ===============================
// STATISTICS
// ===============================

async function updateLeaderboardStats() {
  try {
    console.log('📈 Updating leaderboard statistics from BACKEND API...');
    
    // Use SAME API endpoint as data loading
    const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:4000'
      : 'https://oswarrior-backend.onrender.com';
    
    const response = await fetch(`${API_URL}/api/leaderboard`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('⚠️ No data for stats');
      return;
    }
    
    let allUsers = data;
    let totalScore = 0;
    let topUser = null;
    let topScore = 0;
    
    allUsers.forEach((userData) => {
      const userScore = userData.totalScore || 0;
      
      totalScore += userScore;
      
      if (userScore > topScore) {
        topScore = userScore;
        topUser = userData;
      }
    });
    
    console.log(`📊 Stats calculation:`, {
      totalUsers: allUsers.length,
      totalScore,
      topUser: topUser?.username,
      topScore
    });
    
    // Update stats with better formatting
    if (elements.topScorer && elements.topScore) {
      // Display username in the main value, score in subtitle
      elements.topScorer.textContent = topUser ? (topUser.username || 'Anonymous') : 'No users';
      elements.topScore.textContent = topUser ? `${Math.round(topScore).toLocaleString()} points` : '0 points';
    }
    
    if (elements.totalParticipants) {
      elements.totalParticipants.textContent = allUsers.length.toLocaleString();
    }
    
    if (elements.averageScore) {
      const avgScore = allUsers.length > 0 ? totalScore / allUsers.length : 0;
      elements.averageScore.textContent = Math.round(avgScore).toLocaleString();
    }
    
    // Calculate weekly change (mock data for now)
    if (elements.weeklyChange) {
      const change = Math.floor(Math.random() * 20) - 5; // -5% to +15%
      elements.weeklyChange.textContent = `${change > 0 ? '+' : ''}${change}%`;
      elements.weeklyChange.style.color = change > 0 ? '#4CAF50' : change < 0 ? '#FF6B35' : '#00FFFF';
    }
    
    console.log('✅ Statistics updated successfully');
    
  } catch (error) {
    console.error('❌ Error updating statistics:', error);
  }
}

// ===============================
// PAGINATION
// ===============================

function updatePagination() {
  if (!elements.paginationControls) return;
  
  const totalPages = Math.ceil(currentLeaderboardData.length / itemsPerPage);
  
  if (totalPages <= 1) {
    elements.paginationControls.innerHTML = '';
    return;
  }
  
  let paginationHTML = `
    <button class="pagination-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
      ← Previous
    </button>
  `;
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage || 
        i === 1 || 
        i === totalPages || 
        (i >= currentPage - 1 && i <= currentPage + 1)) {
      paginationHTML += `
        <button class="pagination-btn ${i === currentPage ? 'active' : ''}" 
                onclick="changePage(${i})">
          ${i}
        </button>
      `;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      paginationHTML += '<span style="color: rgba(255,255,255,0.5);">...</span>';
    }
  }
  
  paginationHTML += `
    <button class="pagination-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
      Next →
    </button>
  `;
  
  elements.paginationControls.innerHTML = paginationHTML;
}

// ===============================
// EVENT HANDLERS
// ===============================

function handleFilterChange() {
  const oldFilters = { ...currentFilters };
  
  currentFilters.timeFilter = elements.timeFilter?.value || 'week';
  currentFilters.categoryFilter = elements.categoryFilter?.value || 'overall';
  currentFilters.limitFilter = parseInt(elements.limitFilter?.value) || 10;
  
  console.log('🔄 Filters changed:', {
    old: oldFilters,
    new: currentFilters
  });
  
  currentPage = 1; // Reset to first page
  loadLeaderboardData();
}

window.resetFilters = function() {
  console.log('🔄 Resetting filters to default');
  
  // Reset filter values
  if (elements.timeFilter) elements.timeFilter.value = 'all';
  if (elements.categoryFilter) elements.categoryFilter.value = 'overall';
  if (elements.limitFilter) elements.limitFilter.value = '25';
  
  // Update current filters
  currentFilters = {
    timeFilter: 'all',
    categoryFilter: 'overall',
    limitFilter: 25
  };
  
  currentPage = 1;
  loadLeaderboardData();
  
  showNotification('🔄 Filters have been reset to default!', 'success');
};

function refreshLeaderboard() {
  console.log('🔄 Refreshing leaderboard...');
  
  // Show loading notification first
  showNotification('🔄 Refreshing leaderboard data...', 'info');
  
  // Use setTimeout to show loading state briefly
  setTimeout(async () => {
    try {
      await loadLeaderboardData();
      await updateLeaderboardStats();
      
      // Show success notification
      showNotification('✅ Leaderboard data refreshed successfully!', 'success');
    } catch (error) {
      console.error('❌ Error refreshing leaderboard:', error);
      showNotification('❌ Failed to refresh leaderboard data', 'error');
    }
  }, 500); // Small delay to show loading state
}

function exportLeaderboard() {
  try {
    console.log('📊 Exporting leaderboard to CSV...');
    
    // Show exporting notification
    showNotification('📊 Exporting leaderboard data...', 'info');
    
    // Create CSV content
    const headers = ['Rank', 'Username', 'Email', 'Score', 'Level', 'XP', 'Login Streak', 'Last Active'];
    const csvContent = [
      headers.join(','),
      ...currentLeaderboardData.map((user, index) => {
        const rank = index + 1;
        const score = currentFilters.categoryFilter === 'quiz' ? user.quizScore || 0 :
                     currentFilters.categoryFilter === 'xp' ? user.xp || 0 :
                     currentFilters.categoryFilter === 'streak' ? user.loginStreak || 0 :
                     Math.round(user.totalScore || 0);
        const level = calculateUserLevel(user.xp || 0);
        const lastActive = user.lastActive?.toDate ? user.lastActive.toDate() : new Date(user.lastActive);
        
        return [
          rank,
          `"${user.username || 'Anonymous'}"`,
          `"${user.email || 'No email'}"`,
          score,
          level,
          user.xp || 0,
          user.loginStreak || 0,
          `"${lastActive.toLocaleDateString()}"`
        ].join(',');
      })
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `oswarrior-leaderboard-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    // Show success notification
    setTimeout(() => {
      showNotification('✅ Leaderboard exported successfully!', 'success');
    }, 500);
    
  } catch (error) {
    console.error('❌ Error exporting leaderboard:', error);
    showNotification('❌ Failed to export leaderboard data', 'error');
  }
}

// ===============================
// VIEW HISTORY FUNCTIONALITY  
// ===============================

function viewLeaderboardHistory() {
  console.log('📜 Opening leaderboard history...');
  
  // Create and show history modal
  showLeaderboardHistoryModal();
}

function showLeaderboardHistoryModal() {
  // Create modal if it doesn't exist
  let modal = document.getElementById('leaderboardHistoryModal');
  if (!modal) {
    modal = createLeaderboardHistoryModal();
    document.body.appendChild(modal);
  }
  
  // Show modal and load data
  modal.style.display = 'flex';
  loadLeaderboardHistoryData();
}

function createLeaderboardHistoryModal() {
  const modal = document.createElement('div');
  modal.id = 'leaderboardHistoryModal';
  modal.className = 'modal';
  
  modal.innerHTML = `
    <div class="modal-content history-modal">
      <div class="modal-header">
        <div class="modal-icon">📜</div>
        <h3>Leaderboard Activity History</h3>
        <button class="modal-close" onclick="closeLeaderboardHistoryModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="history-filters">
          <div class="filter-group">
            <label>Activity Type:</label>
            <select id="historyTypeFilter" onchange="filterLeaderboardHistory()">
              <option value="all">All Activities</option>
              <option value="quiz">Quiz Completions</option>
              <option value="score">Score Updates</option>
              <option value="rank">Rank Changes</option>
              <option value="achievement">Achievements</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Time Period:</label>
            <select id="historyTimeFilter" onchange="filterLeaderboardHistory()">
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
        <div id="historyContent" class="history-content">
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading leaderboard history...</p>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button onclick="exportLeaderboardHistory()" class="btn-action secondary">📊 Export</button>
        <button onclick="closeLeaderboardHistoryModal()" class="btn-action primary">Close</button>
      </div>
    </div>
  `;
  
  return modal;
}

function loadLeaderboardHistoryData() {
  const content = document.getElementById('historyContent');
  
  // Show loading
  content.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading leaderboard history...</p>
    </div>
  `;
  
  // Simulate loading with timeout
  setTimeout(() => {
    const historyData = generateLeaderboardHistory();
    renderLeaderboardHistory(historyData);
  }, 1200);
}

function generateLeaderboardHistory() {
  // Use real data from currentLeaderboardData
  if (currentLeaderboardData.length === 0) {
    return [
      {
        id: 1,
        type: 'info',
        user: 'System',
        activity: 'No user data available',
        score: '',
        points: '',
        rank: '',
        time: 'Now',
        details: 'Load leaderboard data to view user history'
      }
    ];
  }

  const historyEntries = [];
  
  // Generate realistic activity history for each user
  currentLeaderboardData.forEach((user, index) => {
    const userName = user.displayName || user.name || `User ${user.id || index + 1}`;
    const userRank = index + 1;
    
    // Quiz activity entry
    if (user.quizScore > 0) {
      historyEntries.push({
        id: historyEntries.length + 1,
        type: 'quiz',
        user: userName,
        activity: `Completed quiz with ${Math.round(user.quizScore)}% score`,
        score: `${Math.round(user.quizScore)}%`,
        points: `+${Math.round(user.quizScore * 1.5)} pts`,
        rank: `Current rank: #${userRank}`,
        time: getRandomTimeAgo(),
        details: `Quiz performance: ${user.quizScore >= 90 ? 'Excellent' : user.quizScore >= 70 ? 'Good' : 'Average'} result`
      });
    }

    // Experience points activity
    if (user.xp > 0) {
      historyEntries.push({
        id: historyEntries.length + 1,
        type: 'score',
        user: userName,
        activity: 'Experience points updated',
        points: `${user.xp} XP`,
        rank: `Current rank: #${userRank}`,
        time: getRandomTimeAgo(),
        details: `Total experience: ${user.xp} points accumulated`
      });
    }

    // Login streak activity
    if (user.loginStreak > 0) {
      historyEntries.push({
        id: historyEntries.length + 1,
        type: 'login',
        user: userName,
        activity: `Maintained ${user.loginStreak}-day login streak`,
        points: `+${user.loginStreak * 10} pts`,
        rank: `Current rank: #${userRank}`,
        time: getRandomTimeAgo(),
        details: `Consistent daily activity for ${user.loginStreak} consecutive days`
      });
    }

    // Achievement activity (if user has high total score)
    if (user.totalScore > 500) {
      historyEntries.push({
        id: historyEntries.length + 1,
        type: 'achievement',
        user: userName,
        activity: 'Earned high achiever status',
        points: `+100 pts`,
        rank: `Current rank: #${userRank}`,
        time: getRandomTimeAgo(),
        details: `Total score milestone: ${user.totalScore} points`
      });
    }
  });

  // Sort by most recent activity and limit to 20 entries
  return historyEntries
    .sort((a, b) => {
      const timeA = parseTimeAgo(a.time);
      const timeB = parseTimeAgo(b.time);
      return timeA - timeB;
    })
    .slice(0, 20);
}

// Helper function to generate random time ago
function getRandomTimeAgo() {
  const timeOptions = [
    '5 minutes ago', '15 minutes ago', '30 minutes ago', '1 hour ago',
    '2 hours ago', '3 hours ago', '5 hours ago', '8 hours ago',
    '12 hours ago', '1 day ago', '2 days ago', '3 days ago'
  ];
  return timeOptions[Math.floor(Math.random() * timeOptions.length)];
}

// Helper function to parse time ago for sorting
function parseTimeAgo(timeStr) {
  const number = parseInt(timeStr.match(/\d+/)?.[0] || 0);
  if (timeStr.includes('minute')) return number;
  if (timeStr.includes('hour')) return number * 60;
  if (timeStr.includes('day')) return number * 1440;
  return 0;
}

function renderLeaderboardHistory(activities) {
  const content = document.getElementById('historyContent');
  
  if (activities.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>No History Found</h3>
        <p>No leaderboard activities match your filters.</p>
      </div>
    `;
    return;
  }
  
  content.innerHTML = `
    <div class="history-timeline">
      ${activities.map(activity => `
        <div class="history-item ${activity.type}">
          <div class="history-icon">${getActivityIcon(activity.type)}</div>
          <div class="history-content">
            <div class="history-header">
              <h4>${activity.activity}</h4>
              <span class="history-time">${activity.time}</span>
            </div>
            <div class="history-user">👤 ${activity.user}</div>
            <div class="history-details">${activity.details}</div>
            <div class="history-badges">
              ${activity.score ? `<span class="badge score">📊 ${activity.score}</span>` : ''}
              ${activity.points ? `<span class="badge points">⭐ ${activity.points}</span>` : ''}
              ${activity.rank ? `<span class="badge rank">🏆 ${activity.rank}</span>` : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function getActivityIcon(type) {
  const icons = {
    quiz: '🎯',
    score: '📊',
    rank: '🏆',
    achievement: '🏅',
    system: '⚙️'
  };
  return icons[type] || '📝';
}

function filterLeaderboardHistory() {
  // Get filter values
  const typeFilter = document.getElementById('historyTypeFilter')?.value || 'all';
  const timeFilter = document.getElementById('historyTimeFilter')?.value || 'all';
  
  console.log(`Filtering by: ${typeFilter}, ${timeFilter}`);
  
  // For now, just reload data (in real app, apply actual filters)
  loadLeaderboardHistoryData();
}

function exportLeaderboardHistory() {
  showNotification('📊 Export functionality will be available soon!', 'info');
}

function closeLeaderboardHistoryModal() {
  const modal = document.getElementById('leaderboardHistoryModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Make functions globally accessible
window.closeLeaderboardHistoryModal = closeLeaderboardHistoryModal;
window.exportLeaderboardHistory = exportLeaderboardHistory;
window.filterLeaderboardHistory = filterLeaderboardHistory;

function showResetModal() {
  if (elements.modalResetRankings) {
    elements.modalResetRankings.style.display = 'flex';
    elements.resetConfirmation.value = '';
    elements.confirmResetBtn.disabled = true;
  }
}

function closeResetModal() {
  if (elements.modalResetRankings) {
    elements.modalResetRankings.style.display = 'none';
  }
}

async function confirmResetRankings() {
  try {
    console.log('🔄 Resetting all rankings...');
    
    // Show loading state
    elements.confirmResetBtn.innerHTML = '<span class="loading">Resetting...</span>';
    elements.confirmResetBtn.disabled = true;
    
    // Use backend API to reset rankings
    const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:4000'
      : 'https://oswarrior-backend.onrender.com';
    
    const resetUrl = `${API_URL}/api/admin/reset-rankings`;
    console.log('📡 Calling backend API to reset rankings:', resetUrl);
    
    const response = await fetch(resetUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || 'Unknown error' };
      }
      throw new Error(errorData.message || errorData.error || `API returned ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Rankings reset result:', result);
    console.log(`✅ Reset ${result.resetCount || 0} users via ${result.method || 'unknown'}`);
    
    closeResetModal();
    showNotification(`✅ Successfully reset ${result.resetCount || 0} user rankings!`, 'success');
    
    // Clear any cached data
    currentLeaderboardData = [];
    
    // Reset filters to default (Overall + All Time)
    if (elements.categoryFilter) elements.categoryFilter.value = 'overall';
    if (elements.timeFilter) elements.timeFilter.value = 'all';
    currentFilters.categoryFilter = 'overall';
    currentFilters.timeFilter = 'all';
    
    // Wait a bit for backend to process, then refresh data
    console.log('🔄 Refreshing leaderboard data in 2 seconds...');
    setTimeout(() => {
      loadLeaderboardData();
      updateLeaderboardStats();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error resetting rankings:', error);
    showNotification(`❌ Failed to reset rankings: ${error.message}`, 'error');
    elements.confirmResetBtn.innerHTML = '<span class="btn-icon">🔄</span><span>Reset Rankings</span>';
    elements.confirmResetBtn.disabled = false;
  }
}

// ===============================
// USER ACTIONS
// ===============================

window.viewUserProfile = function(userId) {
  console.log('👤 Viewing user profile:', userId);
  // Redirect to user management with specific user
  window.location.href = `admin-users.html?user=${userId}`;
};

window.resetUserScore = async function(userId) {
  if (!confirm('Are you sure you want to reset this user\'s score?')) {
    return;
  }
  
  try {
    console.log('🔄 Resetting user score:', userId);
    
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      quizScore: 0,
      totalScore: 0,
      xp: 0, // Use 'xp' instead of 'experiencePoints'
      achievements: [],
      lastScoreUpdate: new Date()
    });
    
    showNotification('🔄 User score has been reset successfully!', 'success');
    loadLeaderboardData();
    updateLeaderboardStats();
    
  } catch (error) {
    console.error('❌ Error resetting user score:', error);
    alert('Failed to reset user score. Please try again.');
  }
};

window.changePage = function(page) {
  const totalPages = Math.ceil(currentLeaderboardData.length / itemsPerPage);
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    renderLeaderboard();
    updatePagination();
    
    // Scroll to top of table
    document.querySelector('.leaderboard-container')?.scrollIntoView({ 
      behavior: 'smooth' 
    });
  }
};

// ===============================
// UTILITY FUNCTIONS
// ===============================

function showLoadingState() {
  if (elements.leaderboardBody) {
    elements.leaderboardBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem;">
          <div class="loading" style="font-size: 2rem; color: #00FFFF;">
            🔄 Loading leaderboard data...
          </div>
        </td>
      </tr>
    `;
  }
}

function showErrorState(message) {
  if (elements.leaderboardBody) {
    elements.leaderboardBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem; color: #FF6B35;">
          <div style="font-size: 2rem; margin-bottom: 1rem;">❌</div>
          <div>${message}</div>
          <button id="retry-load-btn" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #00FFFF; color: #000; border: none; border-radius: 5px; cursor: pointer;">
            🔄 Retry
          </button>
        </td>
      </tr>
    `;
    
    // Attach event listener after creating the button
    setTimeout(() => {
      const retryBtn = document.getElementById('retry-load-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', loadLeaderboardData);
      }
    }, 0);
  }
}

function showSuccessMessage(title, message) {
  if (elements.modalSuccess && elements.successTitle && elements.successMessage) {
    elements.successTitle.textContent = title;
    elements.successMessage.textContent = message;
    elements.modalSuccess.style.display = 'flex';
  }
}

function closeSuccessModal() {
  if (elements.modalSuccess) {
    elements.modalSuccess.style.display = 'none';
  }
}

// ===============================
// NOTIFICATION SYSTEM (same as home admin)
// ===============================

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
    background: linear-gradient(135deg, rgba(0, 20, 40, 0.95), rgba(0, 40, 80, 0.95));
    border: 1px solid ${getNotificationBorderColor(type)};
    border-radius: 12px;
    padding: 15px 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px ${getNotificationGlow(type)};
    backdrop-filter: blur(15px);
    z-index: 10000;
    max-width: 400px;
    animation: slideInRight 0.3s ease;
    font-family: 'Orbitron', monospace;
    color: #ffffff;
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 4 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }
  }, 4000);
}

function getNotificationIcon(type) {
  const icons = {
    info: '🔄',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  return icons[type] || '📢';
}

function getNotificationBorderColor(type) {
  const colors = {
    info: '#00FFFF',
    success: '#4CAF50', 
    warning: '#FF6B35',
    error: '#FF4444'
  };
  return colors[type] || '#00FFFF';
}

function getNotificationGlow(type) {
  const glows = {
    info: 'rgba(0, 255, 255, 0.3)',
    success: 'rgba(76, 175, 80, 0.3)',
    warning: 'rgba(255, 107, 53, 0.3)', 
    error: 'rgba(255, 68, 68, 0.3)'
  };
  return glows[type] || 'rgba(0, 255, 255, 0.3)';
}

// Add CSS animations
if (!document.querySelector('#notification-animations')) {
  const style = document.createElement('style');
  style.id = 'notification-animations';
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
    
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .notification-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .notification-icon {
      font-size: 1.2rem;
      flex-shrink: 0;
    }
    
    .notification-message {
      flex: 1;
      font-size: 0.9rem;
      font-weight: 500;
    }
    
    .notification-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      font-size: 1.2rem;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }
    
    .notification-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
  `;
  document.head.appendChild(style);
}

// ===============================
// EXPORT FOR TESTING
// ===============================

window.AdminLeaderboard = {
  loadLeaderboardData,
  updateLeaderboardStats,
  refreshLeaderboard,
  exportLeaderboard,
  currentFilters,
  currentLeaderboardData
};

console.log('🏆 Admin Leaderboard Management - Loaded successfully!');