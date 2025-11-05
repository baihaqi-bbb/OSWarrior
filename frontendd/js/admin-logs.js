// Admin Logs Management
import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, limit, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

let allLogs = [];
let filteredLogs = [];
let currentPage = 1;
const logsPerPage = 20;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔍 Admin Logs - Initializing...');
  setupEventListeners();
  loadLogs();
});

function setupEventListeners() {
  document.getElementById('refresh-logs-btn')?.addEventListener('click', loadLogs);
  document.getElementById('export-logs-btn')?.addEventListener('click', exportLogsToCSV);
  document.getElementById('time-filter')?.addEventListener('change', applyFilters);
  document.getElementById('action-filter')?.addEventListener('change', applyFilters);
  document.getElementById('search-logs')?.addEventListener('input', applyFilters);
}

async function loadLogs() {
  try {
    console.log('📊 Loading system logs...');
    
    // Load logs from Firestore
    const logsRef = collection(db, 'logs');
    const logsQuery = query(logsRef, orderBy('timestamp', 'desc'), limit(500));
    const snapshot = await getDocs(logsQuery);
    
    allLogs = [];
    
    // If Firestore logs collection is empty, show empty state
    if (snapshot.size === 0) {
      console.log('⚠️ No logs in Firestore yet');
    } else {
      // Use real Firestore logs - DON'T filter by user validation
      snapshot.forEach(doc => {
        const logData = doc.data();
        allLogs.push({ id: doc.id, ...logData });
      });
      
      console.log(`✅ Loaded ${allLogs.length} log entries from Firestore`);
    }
    
    // Update stats
    updateStats();
    
    // Apply filters and render
    applyFilters();
    
  } catch (error) {
    console.error('❌ Error loading logs:', error);
    
    // Don't generate sample logs - show empty state
    allLogs = [];
    updateStats();
    applyFilters();
  }
}

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

function updateStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const todayLogs = allLogs.filter(log => {
    const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
    return logDate >= today;
  });
  
  const uniqueUsers = new Set(todayLogs.map(log => log.user || log.userId)).size;
  
  document.getElementById('total-events').textContent = allLogs.length.toLocaleString();
  document.getElementById('today-activity').textContent = todayLogs.length.toLocaleString();
  document.getElementById('active-users-today').textContent = uniqueUsers.toLocaleString();
  document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
}

function applyFilters() {
  const timeFilter = document.getElementById('time-filter')?.value || 'week';
  const actionFilter = document.getElementById('action-filter')?.value || 'all';
  const searchText = document.getElementById('search-logs')?.value.toLowerCase() || '';
  
  let filtered = [...allLogs];
  
  // Time filter
  const now = new Date();
  if (timeFilter !== 'all') {
    const cutoff = new Date();
    if (timeFilter === 'today') cutoff.setHours(0, 0, 0, 0);
    else if (timeFilter === 'week') cutoff.setDate(now.getDate() - 7);
    else if (timeFilter === 'month') cutoff.setMonth(now.getMonth() - 1);
    
    filtered = filtered.filter(log => {
      const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
      return logDate >= cutoff;
    });
  }
  
  // Action filter
  if (actionFilter !== 'all') {
    filtered = filtered.filter(log => (log.type || '').toLowerCase() === actionFilter);
  }
  
  // Search filter
  if (searchText) {
    filtered = filtered.filter(log => {
      const searchable = `${log.user} ${log.action} ${log.details}`.toLowerCase();
      return searchable.includes(searchText);
    });
  }
  
  filteredLogs = filtered;
  currentPage = 1;
  renderLogs();
}

function renderLogs() {
  const tbody = document.getElementById('logs-table-body');
  if (!tbody) return;
  
  const start = (currentPage - 1) * logsPerPage;
  const end = start + logsPerPage;
  const pageLogs = filteredLogs.slice(start, end);
  
  if (pageLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding:60px;text-align:center;color:rgba(255,255,255,0.5);">
          <div style="font-size:3rem;margin-bottom:16px;">📭</div>
          <div>No logs match your filters</div>
        </td>
      </tr>
    `;
    document.getElementById('pagination-controls').innerHTML = '';
    return;
  }
  
  tbody.innerHTML = pageLogs.map(log => {
    const timestamp = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
    const actionColor = getActionColor(log.type);
    
    return `
      <tr style="border-bottom:1px solid rgba(0,255,255,0.1);transition:background 0.2s;" onmouseover="this.style.background='rgba(0,255,255,0.05)'" onmouseout="this.style.background='transparent'">
        <td style="padding:16px;color:rgba(255,255,255,0.8);font-size:0.85rem;">
          ${timestamp.toLocaleDateString()}<br>
          <span style="color:rgba(255,255,255,0.5);font-size:0.75rem;">${timestamp.toLocaleTimeString()}</span>
        </td>
        <td style="padding:16px;color:#00ffff;font-weight:600;">${log.user || log.userId || 'System'}</td>
        <td style="padding:16px;">
          <span style="background:${actionColor};color:#000;padding:6px 12px;border-radius:6px;font-weight:600;font-size:0.85rem;">
            ${log.action || 'Unknown Action'}
          </span>
        </td>
        <td style="padding:16px;color:rgba(255,255,255,0.7);">${log.details || '-'}</td>
        <td style="padding:16px;color:rgba(255,255,255,0.6);font-family:monospace;font-size:0.85rem;">${log.ipAddress || '-'}</td>
      </tr>
    `;
  }).join('');
  
  renderPagination();
}

function getActionColor(type) {
  const colors = {
    login: '#4ade80',
    quiz: '#60a5fa',
    user: '#fbbf24',
    admin: '#f87171'
  };
  return colors[type] || '#94a3b8';
}

function renderPagination() {
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const container = document.getElementById('pagination-controls');
  
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = '';
  
  if (currentPage > 1) {
    html += `<button onclick="changePage(${currentPage - 1})" style="padding:8px 16px;background:rgba(0,255,255,0.2);border:1px solid #00ffff;color:#00ffff;border-radius:6px;cursor:pointer;">← Previous</button>`;
  }
  
  html += `<span style="color:rgba(255,255,255,0.7);padding:8px 16px;">Page ${currentPage} of ${totalPages}</span>`;
  
  if (currentPage < totalPages) {
    html += `<button onclick="changePage(${currentPage + 1})" style="padding:8px 16px;background:rgba(0,255,255,0.2);border:1px solid #00ffff;color:#00ffff;border-radius:6px;cursor:pointer;">Next →</button>`;
  }
  
  container.innerHTML = html;
}

window.changePage = function(page) {
  currentPage = page;
  renderLogs();
};

function exportLogsToCSV() {
  const headers = ['Timestamp', 'User', 'Action', 'Details', 'IP Address'];
  const rows = filteredLogs.map(log => {
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
  
  console.log('📊 Exported', filteredLogs.length, 'logs to CSV');
}