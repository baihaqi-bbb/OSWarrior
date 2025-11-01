// Complete cleaned home-user script (replace file)

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { initializeUserDisplay } from "./user-utils.js";

const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.appspot.com",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e",
};

// Initialize Firebase only if not already initialized
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const auth = getAuth(app);
const db = getFirestore(app);
const API_BASE = "https://oswarrior-backend.onrender.com";

// use existing image file as default avatar (restore previous behaviour)
const DEFAULT_AVATAR = "image/default-profile.png";

// Helpers
function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function retriggerCardAnimations(delay = 30) {
  setTimeout(() => {
    document.querySelectorAll('.card, .player').forEach(el => {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });
  }, delay);
}

// Public profile modal (centered)
function ensurePublicProfileModal() {
  if (document.getElementById('public-profile-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'public-profile-modal';
  modal.className = 'modal';
  Object.assign(modal.style, {
    display: 'none', position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.6)', zIndex: '9999',
    alignItems: 'center', justifyContent: 'center'
  });
  modal.innerHTML = `
    <div id="public-profile-card" style="
      width:360px;max-width:95%;background:rgba(8,12,20,0.95);
      border:1px solid rgba(0,255,255,0.12);padding:18px;border-radius:12px;
      color:#e6eef8;display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;
    ">
      <button id="public-profile-close" aria-label="Close" style="align-self:flex-end;background:transparent;border:0;color:#cfe7ff;font-size:18px;cursor:pointer">✖</button>
      <img id="public-profile-avatar" src="${DEFAULT_AVATAR}" alt="avatar" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid #00ffff;margin-top:4px">
      <h2 id="public-profile-name" style="margin:6px 0 2px;color:#00ffff;font-size:18px"></h2>
      <p id="public-profile-bio" style="margin:0 0 6px;color:#cfe7ff;font-size:13px;min-height:36px"></p>
      <div style="display:flex;gap:12px;justify-content:center;margin-top:6px;color:#dff7ee;width:100%">
        <div><strong id="public-profile-level">Level</strong></div>
        <div><strong id="public-profile-xp">XP</strong></div>
        <div><strong id="public-profile-rank">Rank</strong></div>
      </div>
      <div id="public-profile-actions" style="margin-top:12px;text-align:center;width:100%"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.style.display = 'none'; });
  modal.querySelector('#public-profile-close').addEventListener('click', () => { modal.style.display = 'none'; });
}

async function openPublicProfile(uid) {
  ensurePublicProfileModal();
  const modal = document.getElementById('public-profile-modal');
  const nameEl = document.getElementById('public-profile-name');
  const avatarEl = document.getElementById('public-profile-avatar');
  const bioEl = document.getElementById('public-profile-bio');
  const levelEl = document.getElementById('public-profile-level');
  const xpEl = document.getElementById('public-profile-xp');
  const rankEl = document.getElementById('public-profile-rank');
  const actionsEl = document.getElementById('public-profile-actions');

  nameEl.textContent = 'Loading...';
  avatarEl.src = DEFAULT_AVATAR;
  bioEl.textContent = '';
  levelEl.textContent = 'Level';
  xpEl.textContent = 'XP';
  rankEl.textContent = 'Rank';
  actionsEl.innerHTML = '';
  modal.style.display = 'flex';

  // Try Firestore first
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data();
      nameEl.textContent = data.name || data.displayName || `User-${String(uid).slice(0,6)}`;
      avatarEl.src = data.profileURL || data.photoURL || data.avatar || DEFAULT_AVATAR;
      bioEl.textContent = data.bio || data.about || '';
      levelEl.textContent = `Level ${data.level ?? Math.floor((data.xp||0)/100)+1}`;
      xpEl.textContent = `${data.xp ?? 0} XP`;
      rankEl.textContent = `#${data.rank ?? '-'}`;
      actionsEl.innerHTML = `<button id="follow-btn" class="btn" style="margin-right:8px">Follow</button><button id="message-btn" class="btn">Message</button>`;
      document.getElementById('follow-btn').addEventListener('click', () => { document.getElementById('follow-btn').textContent = '✓ Following'; document.getElementById('follow-btn').disabled = true; });
      document.getElementById('message-btn').addEventListener('click', () => { alert('Open chat with ' + (data.name||uid)); });
      return;
    }
  } catch (e) {
    console.warn('Firestore read failed for public profile:', e);
  }

  // Backend fallback
  const endpoints = [
    `${API_BASE}/api/users/${encodeURIComponent(uid)}`,
    `${API_BASE}/api/user/${encodeURIComponent(uid)}`,
    `${API_BASE}/api/users?id=${encodeURIComponent(uid)}`
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, { credentials: 'include' });
      if (!r.ok) continue;
      const payload = await r.json();
      const d = payload.user || payload;
      nameEl.textContent = d.name || d.displayName || `User-${String(uid).slice(0,6)}`;
      avatarEl.src = d.photoURL || d.avatar || DEFAULT_AVATAR;
      bioEl.textContent = d.bio || d.about || '';
      levelEl.textContent = `Level ${d.level ?? '-'}`;
      xpEl.textContent = `${d.xp ?? 0} XP`;
      rankEl.textContent = `#${d.rank ?? '-'}`;
      actionsEl.innerHTML = `<button id="follow-btn" class="btn" style="margin-right:8px">Follow</button><button id="message-btn" class="btn">Message</button>`;
      document.getElementById('follow-btn').addEventListener('click', () => { document.getElementById('follow-btn').textContent = '✓ Following'; document.getElementById('follow-btn').disabled = true; });
      document.getElementById('message-btn').addEventListener('click', () => { alert('Open chat with ' + (d.name||uid)); });
      return;
    } catch (e) { /* try next */ }
  }

  // final fallback
  nameEl.textContent = `User-${String(uid).slice(0,6)}`;
  avatarEl.src = DEFAULT_AVATAR;
  bioEl.textContent = 'No public profile data available.';
  levelEl.textContent = 'Level -';
  xpEl.textContent = '- XP';
  rankEl.textContent = '#-';
  actionsEl.innerHTML = `<button class="btn" disabled>No actions</button>`;
}

// XP / user UI helpers
function updateXPBar(xp = 0, maxXP = 100, level = 1, name = 'Warrior') {
  const bar = document.getElementById("xp-progress");
  if (bar) bar.style.width = Math.max(0, Math.min(100, (xp / maxXP) * 100)) + "%";
  const cur = document.getElementById("xp-current"); if (cur) cur.textContent = `${xp}`;
  const max = document.getElementById("xp-max"); if (max) max.textContent = `${maxXP} XP`;
  const lvl = document.getElementById("player-level"); if (lvl) lvl.textContent = `Level ${level}`;
  const pname = document.getElementById("player-name"); if (pname) pname.textContent = `${name} 👑`;
  
  // Update power cores based on level
  updatePowerCores(level);
}

function updatePowerCores(level = 1) {
  const powerBars = document.querySelectorAll(".power-bar");
  const activeBars = Math.min(5, Math.max(1, Math.floor(level / 2) + 1));
  
  powerBars.forEach((bar, index) => {
    if (index < activeBars) {
      bar.classList.add("active");
    } else {
      bar.classList.remove("active");
    }
  });
}

function updateMissionProgress(userData) {
  // Calculate mission progress from user data
  const completedQuizzes = userData.completedQuizzes?.length || 0;
  const totalQuizzes = 14; // Total available quizzes/missions
  const totalXP = userData.xp || 0;
  const successRate = completedQuizzes > 0 ? Math.round((completedQuizzes / totalQuizzes) * 100) : 0;
  const progressPercent = Math.round((completedQuizzes / totalQuizzes) * 100);
  
  // Update mission counter
  const counterEl = document.querySelector(".mission-counter .counter");
  if (counterEl) counterEl.textContent = `${completedQuizzes}/${totalQuizzes}`;
  
  // Update mission stats
  const statValues = document.querySelectorAll(".mission-stats .stat-value");
  if (statValues[0]) statValues[0].textContent = `${completedQuizzes} Missions`;
  if (statValues[1]) statValues[1].textContent = `${totalXP.toLocaleString()} XP`;
  if (statValues[2]) statValues[2].textContent = `${successRate}%`;
  
  // Update progress bar
  const progressFill = document.querySelector(".mission-progress-bar .progress-fill");
  if (progressFill) progressFill.style.width = `${progressPercent}%`;
}
function loadUserXP(uid, displayName) {
  if (!uid) return;
  
  console.log("Loading user XP for:", uid, displayName);
  
  // Load XP from backend API instead of Firestore
  fetch(`${API_BASE}/api/user/${encodeURIComponent(uid)}`, {
    credentials: 'include'
  })
  .then(res => {
    if (res.ok) {
      return res.json();
    } else if (res.status === 404) {
      // User not found, try to update with Firebase Auth info if available
      console.log("User not found in backend, will be auto-created");
      throw new Error(`User not found: ${res.status}`);
    } else {
      throw new Error(`API error: ${res.status}`);
    }
  })
  .then(userData => {
    console.log("User XP data from backend:", userData);
    const xp = Number(userData.xp || 0);
    const level = Number(userData.level || Math.floor(xp / 100) + 1);
    const maxForLevel = Math.max(100, level * 100);
    const name = userData.name || userData.displayName || displayName || "Warrior";
    
    // Update both XP bar and mission progress
    updateXPBar(xp, maxForLevel, level, name);
    updateMissionProgress(userData);
  })
  .catch(err => {
    console.warn("loadUserXP failed:", err);
    
    // Try one more time after a short delay (backend might be creating user)
    setTimeout(() => {
      fetch(`${API_BASE}/api/user/${encodeURIComponent(uid)}`, {
        credentials: 'include'
      })
      .then(res => res.ok ? res.json() : null)
      .then(userData => {
        if (userData) {
          console.log("User data loaded on retry:", userData);
          const xp = Number(userData.xp || 0);
          const level = Number(userData.level || Math.floor(xp / 100) + 1);
          const maxForLevel = Math.max(100, level * 100);
          const name = userData.name || userData.displayName || displayName || "Warrior";
          updateXPBar(xp, maxForLevel, level, name);
          updateMissionProgress(userData);
        } else {
          // Final fallback to default values
          console.log("Using fallback user data");
          updateXPBar(0, 100, 1, displayName || "Warrior");
        }
      })
      .catch(() => {
        // Final fallback to default values
        console.log("Using fallback user data after retry failed");
        updateXPBar(0, 100, 1, displayName || "Warrior");
      });
    }, 1000); // Wait 1 second for backend to create user
  });
}

// Top3 rendering
function renderTop3(top = []) {
  const container = document.getElementById("top3-container");
  if (!container) return;
  container.innerHTML = "";
  if (!Array.isArray(top) || top.length === 0) {
    container.innerHTML = '<div class="no-top">No top players yet.</div>';
    return;
  }
  const ordered = [];
  if (top.length >= 2) ordered.push(top[1]);
  if (top.length >= 1) ordered.push(top[0]);
  if (top.length >= 3) ordered.push(top[2]);

  ordered.forEach((p, idx) => {
    const posClass = idx === 0 ? "second" : idx === 1 ? "first" : "third";
    const rankEmoji = idx === 1 ? "🥇" : idx === 0 ? "🥈" : "🥉";
    const name = escapeHtml(p.name || p.displayName || p.username || ("User-" + String(p.userId || "").slice(0,6)));
    const avatar = p.photo || p.photoURL || p.profileURL || p.avatar || DEFAULT_AVATAR;
    const xp = Number(p.xp || 0);

    const card = document.createElement("div");
    card.className = `player ${posClass}`;
    card.style.cursor = "pointer";
    card.innerHTML = `
      <div class="rank">${rankEmoji}</div>
      <img src="${avatar}" alt="${name}" style="width:72px;height:72px;border-radius:10px;object-fit:cover;margin:8px 0">
      <p class="name">${name}</p>
      <p class="xp">${xp} XP</p>
    `;

    // try load avatar from Firestore if default used
    if ((String(avatar).includes("default") || avatar === DEFAULT_AVATAR) && p.userId) {
      (async () => {
        try {
          const uDoc = await getDoc(doc(db, "users", p.userId));
          if (uDoc.exists()) {
            const d = uDoc.data();
            const remote = d.profileURL || d.photoURL || d.avatar || null;
            if (remote) {
              const img = card.querySelector("img");
              if (img) img.src = remote;
            }
          }
        } catch (e) { console.warn("fetch avatar failed for", p.userId, e); }
      })();
    }

    card.addEventListener("click", () => { if (p.userId) openPublicProfile(p.userId); });
    card.tabIndex = 0;
    card.addEventListener("keypress", (e) => { if (e.key === "Enter") card.click(); });
    container.appendChild(card);
  });
}

// Load top3 from backend
async function loadTop3() {
  try {
    const res = await fetch(`${API_BASE}/api/top3`, { credentials: 'include' });
    if (!res.ok) throw new Error("Failed to load top3");
    const body = await res.json();
    const top = Array.isArray(body.top) ? body.top : (body || []);
    renderTop3(top);
  } catch (e) {
    console.error("loadTop3 failed:", e);
    // fallback empty
    renderTop3([]);
  }
}

// Unified auth handler
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      console.log("User not authenticated, redirecting to login");
      window.location.href = "index.html";
      return;
    }
    
    console.log("User authenticated:", user.uid, user.displayName || user.email);
    
    // populate some UI nodes if present
    const profileImg = document.getElementById("profile-img");
    if (profileImg) profileImg.src = user.photoURL || DEFAULT_AVATAR;

    // Skip Firestore operations since we're using backend now
    // const userRef = doc(db, "users", user.uid);
    // try {
    //   const snap = await getDoc(userRef);
    //   const updates = {};
    //   if (!snap.exists()) updates.xp = 0, updates.level = 1;
    //   if (!snap.exists() || (!snap.data().name && user.displayName)) updates.name = user.displayName;
    //   if (!snap.exists() || (!snap.data().email && user.email)) updates.email = user.email || null;
    //   if (Object.keys(updates).length) await setDoc(userRef, updates, { merge: true });
    // } catch (e) { console.warn("ensure user doc failed:", e); }

    const displayName = user.displayName || user.email?.split('@')[0] || "Warrior";
    
    // Try to get updated name from Firestore first
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      let finalDisplayName = displayName;
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        finalDisplayName = userData.displayName || userData.name || displayName;
        
        // Update profile image if available in Firestore
        if (userData.photoURL && profileImg) {
          profileImg.src = userData.photoURL;
        }
      }
      
      // Update UI with final name
      const usernameWelcome = document.getElementById("username");
      if (usernameWelcome) usernameWelcome.textContent = finalDisplayName;
      
      // Update navbar username
      const usernameNavbar = document.getElementById("username-navbar");
      if (usernameNavbar) usernameNavbar.textContent = finalDisplayName;
      
      const playerName = document.getElementById("player-name");
      if (playerName) playerName.textContent = finalDisplayName + " 👑";
      
      // Load user data with final name
      loadUserXP(user.uid, finalDisplayName);
      
    } catch (firestoreError) {
      console.warn("Firestore name fetch failed, using fallback:", firestoreError);
      
      // Fallback to original logic
      const usernameWelcome = document.getElementById("username");
      if (usernameWelcome) usernameWelcome.textContent = displayName;
      
      const usernameNavbar = document.getElementById("username-navbar");
      if (usernameNavbar) usernameNavbar.textContent = displayName;
      
      const playerName = document.getElementById("player-name");
      if (playerName) playerName.textContent = displayName + " 👑";
      
      loadUserXP(user.uid, displayName);
    }
    await loadTop3();
    retriggerCardAnimations(80);
  } catch (err) {
    console.error("Auth handler error:", err);
    // Don't redirect on error, just log it
  }
});

// Cleanup when page unloads
window.addEventListener('beforeunload', () => {
  cleanupPlayersSidebar();
});

/**
 * Setup welcome banner interactions and animations
 */
function setupWelcomeBanner() {
  // Setup typing effect for welcome subtitle
  setupTypingEffect();
  
  // Setup status card hover effects
  setupStatusCardEffects();
}

/**
 * Setup status card hover effects
 */
function setupStatusCardEffects() {
  const statusCards = document.querySelectorAll('.status-card');
  
  statusCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-3px) scale(1.05)';
      card.style.boxShadow = '0 15px 35px rgba(0, 255, 255, 0.4)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
    });
  });
}

/**
 * Create typing effect for welcome subtitle
 */
function setupTypingEffect() {
  const typingText = document.querySelector('.typing-text');
  if (!typingText) return;
  
  const messages = [
    "Ready to dominate the digital battlefield?",
    "Time to level up your OS mastery!",
    "Your next victory awaits, warrior!",
    "Conquer challenges and claim glory!",
    "The arena is calling your name!"
  ];
  
  let messageIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  
  function typeEffect() {
    const currentMessage = messages[messageIndex];
    
    if (isDeleting) {
      typingText.textContent = currentMessage.substring(0, charIndex - 1);
      charIndex--;
    } else {
      typingText.textContent = currentMessage.substring(0, charIndex + 1);
      charIndex++;
    }
    
    let typeSpeed = isDeleting ? 50 : 100;
    
    if (!isDeleting && charIndex === currentMessage.length) {
      typeSpeed = 2000; // Wait at end
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      messageIndex = (messageIndex + 1) % messages.length;
      typeSpeed = 500; // Wait before starting new message
    }
    
    setTimeout(typeEffect, typeSpeed);
  }
  
  // Start typing effect after a delay
  setTimeout(typeEffect, 1000);
}

/**
 * Setup welcome action buttons
 */
function setupWelcomeActions() {
  const startMissionBtn = document.querySelector('.action-btn.primary');
  const viewStatsBtn = document.querySelector('.action-btn.secondary');
  
  if (startMissionBtn) {
    startMissionBtn.addEventListener('click', (e) => {
      // Create particle effect
      createParticleEffect(startMissionBtn);
      
      // Navigate to quiz page with special effect
      startMissionBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        window.location.href = 'quiz.html';
      }, 300);
    });
  }
  
  if (viewStatsBtn) {
    viewStatsBtn.addEventListener('click', (e) => {
      // Create particle effect
      createParticleEffect(viewStatsBtn);
      
      // Navigate to profile page
      viewStatsBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        window.location.href = 'profile.html';
      }, 300);
    });
  }
}

/**
 * Setup avatar interaction in welcome banner
 */
function setupAvatarInteraction() {
  const userAvatar = document.querySelector('.user-avatar');
  const levelBadge = document.querySelector('.level-badge');
  
  if (userAvatar) {
    userAvatar.addEventListener('click', () => {
      // Add click animation
      userAvatar.style.transform = 'scale(1.2)';
      setTimeout(() => {
        userAvatar.style.transform = '';
      }, 200);
      
      // Show profile modal or navigate to profile
      if (auth.currentUser) {
        openPublicProfile(auth.currentUser.uid);
      }
    });
    
    // Add hover effect to level badge
    if (levelBadge) {
      userAvatar.addEventListener('mouseenter', () => {
        levelBadge.style.transform = 'scale(1.1)';
      });
      
      userAvatar.addEventListener('mouseleave', () => {
        levelBadge.style.transform = '';
      });
    }
  }
}

/**
 * Update welcome banner avatar from user profile
 */
function updateWelcomeBannerAvatar() {
  const userAvatar = document.querySelector('.user-avatar');
  if (!userAvatar) return;
  
  // Update from current user
  onAuthStateChanged(auth, (user) => {
    if (user && userAvatar) {
      userAvatar.src = user.photoURL || DEFAULT_AVATAR;
      
      // Also try to get from Firestore if available
      getDoc(doc(db, "users", user.uid)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          const avatar = data.profileURL || data.photoURL || data.avatar;
          if (avatar) {
            userAvatar.src = avatar;
          }
        }
      }).catch(e => {
        console.warn("Failed to load avatar from Firestore:", e);
      });
    }
  });
}

/**
 * Update level badge in welcome banner
 */
function updateWelcomeLevelBadge(level = 1) {
  const levelBadge = document.querySelector('.level-badge');
  if (levelBadge) {
    levelBadge.textContent = `LV.${level}`;
    
    // Add animation for level up
    levelBadge.style.animation = 'none';
    void levelBadge.offsetWidth; // Trigger reflow
    levelBadge.style.animation = 'crownFloat 2s ease-in-out infinite';
  }
}

// add near the UI helpers section (anywhere before DOMContentLoaded)

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

  // Function to position dropdown correctly
  function positionDropdown() {
    const rect = profileContainer.getBoundingClientRect();
    profileDropdown.style.position = 'fixed';
    profileDropdown.style.top = (rect.bottom + 5) + 'px';
    profileDropdown.style.right = '20px';
    profileDropdown.style.left = 'auto';
  }

  let open = false;
  profileContainer.addEventListener('click', (ev) => {
    ev.stopPropagation();
    open = !open;
    if (open) {
      positionDropdown(); // Calculate position before showing
      profileDropdown.classList.remove('hidden');
      profileDropdown.classList.add('show');
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

// Check for new quizzes and update badge
async function checkNewQuizzes() {
  try {
    // Get last visit time from localStorage
    const lastVisit = localStorage.getItem('lastQuizVisit');
    const lastVisitTime = lastVisit ? new Date(lastVisit) : new Date(0); // If no visit, use epoch
    
    console.log('Checking new quizzes...', { lastVisit, lastVisitTime });
    
    // Fetch available quizzes from backend
    const response = await fetch(`${API_BASE}/api/quizzes`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const quizzes = await response.json();
      
      // Check if there are new quizzes since last visit
      let hasNewQuizzes = false;
      let newestQuizDate = null;
      
      if (Array.isArray(quizzes) && quizzes.length > 0) {
        // Check if any quiz is newer than last visit
        for (const quiz of quizzes) {
          const quizDate = new Date(quiz.createdAt || quiz.dateCreated || Date.now());
          
          if (!newestQuizDate || quizDate > newestQuizDate) {
            newestQuizDate = quizDate;
          }
          
          if (quizDate > lastVisitTime) {
            hasNewQuizzes = true;
          }
        }
        
        // If no lastVisit (first time user), show badge for any published quiz
        if (!lastVisit && quizzes.some(q => q.published !== false)) {
          hasNewQuizzes = true;
        }
        
        // Store quiz count for future reference
        localStorage.setItem('lastQuizCount', quizzes.length.toString());
      }
      
      // Update badge visibility
      const badge = document.querySelector('.card.quiz .badge');
      if (badge) {
        if (hasNewQuizzes) {
          badge.style.display = 'block';
          badge.textContent = 'New';
          // Add pulse animation for new quizzes
          badge.classList.add('pulse-new');
          
          // Store that we've shown the new badge
          if (newestQuizDate) {
            localStorage.setItem('lastNewBadgeShown', newestQuizDate.toISOString());
          }
        } else {
          badge.style.display = 'none';
          badge.classList.remove('pulse-new');
        }
      }
      
      console.log('New quizzes check result:', { 
        hasNewQuizzes, 
        quizCount: quizzes.length,
        newestQuizDate: newestQuizDate?.toISOString(),
        lastVisitTime: lastVisitTime.toISOString()
      });
      
    } else {
      console.warn('Failed to fetch quizzes for new badge check');
      // Hide badge if can't determine
      const badge = document.querySelector('.card.quiz .badge');
      if (badge) {
        badge.style.display = 'none';
        badge.classList.remove('pulse-new');
      }
    }
    
  } catch (error) {
    console.error('Error checking new quizzes:', error);
    // Hide badge on error
    const badge = document.querySelector('.card.quiz .badge');
    if (badge) {
      badge.style.display = 'none';
      badge.classList.remove('pulse-new');
    }
  }
}

// Mark quiz as visited (call this when user goes to quiz page)
function markQuizAsVisited() {
  localStorage.setItem('lastQuizVisit', new Date().toISOString());
  
  // Also update quiz count
  fetch(`${API_BASE}/api/quizzes`, { credentials: 'include' })
    .then(res => res.ok ? res.json() : [])
    .then(quizzes => {
      if (Array.isArray(quizzes)) {
        localStorage.setItem('lastQuizCount', quizzes.length.toString());
      }
    })
    .catch(err => console.warn('Failed to update quiz count:', err));
}

// Make function available globally
window.markQuizAsVisited = markQuizAsVisited;

// Player Sidebar Functions
let playersCache = [];
let refreshInterval;

/**
 * Load and display online players in sidebar
 */
async function loadOnlinePlayers() {
  try {
    const response = await fetch(`${API_BASE}/api/leaderboard`, {
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Failed to load players');
    
    const data = await response.json();
    const players = data.leaderboard || [];
    
    playersCache = players;
    renderPlayersList(players);
    updateOnlineCount(players.length);
    
  } catch (error) {
    console.error('Failed to load online players:', error);
    renderPlayersError();
  }
}

/**
 * Render players list in sidebar
 */
function renderPlayersList(players) {
  const playersList = document.getElementById('players-list');
  if (!playersList) return;
  
  if (players.length === 0) {
    playersList.innerHTML = `
      <div class="loading-players">
        <span style="color: #B0E0FF;">No warriors online</span>
      </div>
    `;
    return;
  }
  
  const currentUser = auth.currentUser;
  const currentUserId = currentUser ? currentUser.uid : null;
  
  // Get following list from localStorage
  const following = JSON.parse(localStorage.getItem('following') || '[]');
  
  // Filter out current user and limit to first 20 players
  const otherPlayers = players
    .filter(player => player.uid !== currentUserId)
    .slice(0, 20);
  
  playersList.innerHTML = otherPlayers.map(player => {
    const name = escapeHtml(player.displayName || player.email || player.name || 'Unknown Warrior');
    const avatar = player.profileImage || player.photoURL || player.avatar || DEFAULT_AVATAR;
    const level = player.level || Math.floor((player.totalXP || 0) / 100) + 1;
    const xp = player.totalXP || 0;
    const isFollowing = following.includes(player.uid);
    
    return `
      <div class="player-item" data-uid="${player.uid || ''}" onclick="openPlayerProfile('${player.uid || ''}')">
        <img src="${avatar}" alt="${name}" class="player-avatar" onerror="this.src='${DEFAULT_AVATAR}'">
        <div class="player-info">
          <div class="player-name">${name}</div>
          <div class="player-level">Level ${level} • ${xp.toLocaleString()} XP</div>
        </div>
        <div class="player-status"></div>
        <div class="player-actions">
          <div class="action-icon follow-btn ${isFollowing ? 'following' : ''}" onclick="followPlayer(event, '${player.uid || ''}', '${name}')" title="${isFollowing ? 'Following' : 'Follow'}">
            ${isFollowing ? '✓' : '👥'}
          </div>
          <div class="action-icon message-btn" onclick="messagePlayer(event, '${player.uid || ''}', '${name}')" title="Message">
            💬
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render error state for players list
 */
function renderPlayersError() {
  const playersList = document.getElementById('players-list');
  if (!playersList) return;
  
  playersList.innerHTML = `
    <div class="loading-players">
      <span style="color: #FF6B6B;">Failed to load warriors</span>
      <button onclick="loadOnlinePlayers()" style="margin-top: 10px; padding: 5px 10px; background: rgba(0,255,255,0.2); border: 1px solid rgba(0,255,255,0.3); border-radius: 5px; color: #00FFFF; cursor: pointer;">
        Retry
      </button>
    </div>
  `;
}

/**
 * Update online count display
 */
function updateOnlineCount(count) {
  const onlineCountText = document.getElementById('online-count-text');
  if (onlineCountText) {
    onlineCountText.textContent = `${count} online`;
  }
}

/**
 * Open player profile from sidebar
 */
function openPlayerProfile(uid) {
  if (!uid) return;
  openPublicProfile(uid);
}

/**
 * Follow a player
 */
function followPlayer(event, uid, name) {
  event.stopPropagation();
  
  if (!uid) return;
  
  const followBtn = event.target;
  
  // Disable button temporarily
  followBtn.style.pointerEvents = 'none';
  
  // Animate button
  followBtn.style.transform = 'scale(1.2)';
  setTimeout(() => {
    followBtn.innerHTML = '✓';
    followBtn.style.color = '#00FF88';
    followBtn.title = 'Following';
    followBtn.style.transform = 'scale(1)';
    
    // Re-enable button after animation
    setTimeout(() => {
      followBtn.style.pointerEvents = 'auto';
    }, 300);
  }, 200);
  
  // Store follow status in localStorage
  const following = JSON.parse(localStorage.getItem('following') || '[]');
  if (!following.includes(uid)) {
    following.push(uid);
    localStorage.setItem('following', JSON.stringify(following));
  }
  
  console.log('Following player:', uid, name);
  showNotification(`Now following ${name}!`, 'success');
}

/**
 * Message a player
 */
function messagePlayer(event, uid, name) {
  event.stopPropagation();
  
  if (!uid) return;
  
  const messageBtn = event.target;
  
  // Animate button
  messageBtn.style.transform = 'scale(1.3)';
  messageBtn.style.color = '#FFED4A';
  
  setTimeout(() => {
    messageBtn.style.transform = 'scale(1)';
    messageBtn.style.color = '#FFD700';
  }, 300);
  
  console.log('Messaging player:', uid, name);
  showNotification(`Opening chat with ${name}...`, 'info');
  
  // Here you could implement actual messaging functionality
  // For now, we'll simulate opening a chat
  setTimeout(() => {
    showNotification(`Chat with ${name} is ready!`, 'success');
  }, 1500);
}

/**
 * Show enhanced notification
 */
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notif => notif.remove());
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  // Add icon based on type
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 1.1rem;">${icons[type] || icons.info}</span>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  // Remove after 4 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 400);
  }, 4000);
}

/**
 * Setup sidebar functionality
 */
function setupPlayersSidebar() {
  // Load initial players
  loadOnlinePlayers();
  
  // Setup refresh button
  const refreshBtn = document.getElementById('refresh-players');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        refreshBtn.style.transform = '';
      }, 150);
      loadOnlinePlayers();
    });
  }
  
  // Auto-refresh every 30 seconds
  refreshInterval = setInterval(loadOnlinePlayers, 30000);
}

/**
 * Setup sidebar toggle functionality
 */
function setupSidebarToggle() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('right-sidebar');
  const toggleIcon = document.getElementById('toggle-icon');
  
  if (toggleBtn && sidebar && toggleIcon) {
    toggleBtn.addEventListener('click', () => {
      const isVisible = sidebar.classList.contains('show');
      
      if (isVisible) {
        // Hide sidebar
        sidebar.classList.remove('show');
        toggleBtn.classList.remove('active');
        toggleIcon.textContent = '👥';
      } else {
        // Show sidebar
        sidebar.classList.add('show');
        toggleBtn.classList.add('active');
        toggleIcon.textContent = '✖';
        // Refresh players when showing
        loadOnlinePlayers();
      }
    });
  }
}

/**
 * Cleanup sidebar when leaving page
 */
function cleanupPlayersSidebar() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Make functions available globally
window.openPlayerProfile = openPlayerProfile;
window.followPlayer = followPlayer;
window.messagePlayer = messagePlayer;

// Testing/debugging functions (for admin/development)
window.resetNewBadge = function() {
  localStorage.removeItem('lastQuizVisit');
  localStorage.removeItem('lastQuizCount');
  localStorage.removeItem('lastNewBadgeShown');
  console.log('Badge status reset. Refresh page to see new badge.');
  checkNewQuizzes();
};

window.checkNewQuizzesDebug = checkNewQuizzes;

// call it on boot
document.addEventListener("DOMContentLoaded", () => {
  ensurePublicProfileModal();
  setupProfileDropdown(); // <-- added
  
  // Setup welcome banner interactions
  setupWelcomeBanner();
  
  // Setup players sidebar
  setupPlayersSidebar();
  
  // Setup sidebar toggle functionality
  setupSidebarToggle();
  
  // Initialize search warriors functionality
  initializeSearchWarriors();
  
  // Setup dropdown button functions
  const toggleThemeBtn = document.getElementById("toggle-theme");
  if (toggleThemeBtn) {
    toggleThemeBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark-theme");
      localStorage.setItem("theme", document.body.classList.contains("dark-theme") ? "dark" : "light");
    });
  }
  
  const changeAvatarBtn = document.getElementById("change-avatar");
  if (changeAvatarBtn) {
    changeAvatarBtn.addEventListener("click", () => {
      const modal = document.getElementById("modal-change-avatar");
      const input = document.getElementById("input-avatar-url");
      
      if (modal && input) {
        input.value = "";
        modal.style.display = "flex";
        input.focus();
      }
    });
  }
  
  // Avatar modal save
  const saveAvatarBtn = document.getElementById("save-avatar-btn");
  if (saveAvatarBtn) {
    saveAvatarBtn.addEventListener("click", async () => {
      const input = document.getElementById("input-avatar-url");
      const modal = document.getElementById("modal-change-avatar");
      
      if (input && input.value.trim() && auth.currentUser) {
        const newAvatarUrl = input.value.trim();
        const uid = auth.currentUser.uid;
        
        try {
          // Update Firebase user profile
          await updateProfile(auth.currentUser, { photoURL: newAvatarUrl });
          
          // Update Firestore if available
          try {
            await updateDoc(doc(db, "users", uid), { profileURL: newAvatarUrl });
          } catch (firestoreErr) {
            console.warn("Firestore update failed, continuing with local update:", firestoreErr);
          }
          
          // Update UI
          const profileImg = document.getElementById("profile-img");
          if (profileImg) profileImg.src = newAvatarUrl;
          
          // Save to localStorage as backup
          localStorage.setItem("avatar", newAvatarUrl);
          
          if (modal) modal.style.display = "none";
          alert("Avatar berjaya ditukar!");
        } catch (err) {
          console.error("Avatar update error:", err);
          alert("Gagal kemaskini avatar: " + err.message);
        }
      } else {
        alert("Sila masukkan URL gambar yang sah");
      }
    });
  }
  
  // Avatar modal cancel
  const cancelAvatarBtn = document.getElementById("cancel-avatar-btn");
  if (cancelAvatarBtn) {
    cancelAvatarBtn.onclick = () => {
      const modal = document.getElementById("modal-change-avatar");
      if (modal) modal.style.display = "none";
    };
  }
  
  const editNameBtn = document.getElementById("edit-name");
  if (editNameBtn) {
    editNameBtn.addEventListener("click", () => {
      const modal = document.getElementById("modal-edit-name");
      const input = document.getElementById("input-new-name");
      
      if (modal && input) {
        input.value = "";
        modal.style.display = "flex";
        input.focus();
      }
    });
  }
  
  // Name modal save
  const saveNameBtn = document.getElementById("save-name-btn");
  if (saveNameBtn) {
    saveNameBtn.addEventListener("click", async () => {
      const input = document.getElementById("input-new-name");
      const modal = document.getElementById("modal-edit-name");
      
      if (input && input.value.trim() && auth.currentUser) {
        const newName = input.value.trim();
        const uid = auth.currentUser.uid;
        
        try {
          // Update Firebase user profile
          await updateProfile(auth.currentUser, { displayName: newName });
          
          // Update Firestore if available  
          try {
            await updateDoc(doc(db, "users", uid), { name: newName });
          } catch (firestoreErr) {
            console.warn("Firestore update failed, continuing with local update:", firestoreErr);
          }
          
          // Update all name displays in UI
          const usernameNavbar = document.getElementById("username-navbar");
          const username = document.getElementById("username");
          const playerName = document.getElementById("player-name");
          
          if (usernameNavbar) usernameNavbar.textContent = newName;
          if (username) username.textContent = newName;
          if (playerName) playerName.textContent = newName + " 👑";
          
          // Save to localStorage as backup
          localStorage.setItem("displayName", newName);
          
          if (modal) modal.style.display = "none";
          alert("Nama berjaya ditukar!");
        } catch (err) {
          console.error("Name update error:", err);
          alert("Gagal kemaskini nama: " + err.message);
        }
      } else {
        alert("Sila masukkan nama yang sah");
      }
    });
  }
  
  // Name modal cancel
  const cancelNameBtn = document.getElementById("cancel-name-btn");
  if (cancelNameBtn) {
    cancelNameBtn.onclick = () => {
      const modal = document.getElementById("modal-edit-name");
      if (modal) modal.style.display = "none";
    };
  }
  
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        localStorage.clear();
        window.location.href = "index.html";
      } catch (error) {
        console.error("Logout error:", error);
        alert("Logout failed: " + error.message);
      }
    });
  }
  
  // Load saved preferences
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
  }
  
  const savedAvatar = localStorage.getItem("avatar");
  if (savedAvatar) {
    const profileImg = document.getElementById("profile-img");
    if (profileImg) profileImg.src = savedAvatar;
  }
  
  const savedName = localStorage.getItem("displayName");
  if (savedName) {
    const usernameNavbar = document.getElementById("username-navbar");
    const username = document.getElementById("username");
    const playerName = document.getElementById("player-name");
    if (usernameNavbar) usernameNavbar.textContent = savedName;
    if (username) username.textContent = savedName;
    if (playerName) playerName.textContent = savedName + " 👑";
  }
  
  // Close modals when clicking outside
  window.addEventListener("click", (event) => {
    const nameModal = document.getElementById("modal-edit-name");
    const avatarModal = document.getElementById("modal-change-avatar");
    
    if (event.target === nameModal) {
      nameModal.style.display = "none";
    }
    if (event.target === avatarModal) {
      avatarModal.style.display = "none";
    }
  });
  
  loadTop3();
  retriggerCardAnimations(60);
  
  // Check for new quizzes and update badge
  checkNewQuizzes();
  
  // Load leaderboard for new layout
  loadLeaderboardForHome();
  
  // Load real data for card stats
  loadRealCardData();
});

// Function to load real data for card statistics
async function loadRealCardData() {
  try {
    // Load quiz data
    const quizResponse = await fetch(`${API_BASE}/api/quizzes`);
    if (quizResponse.ok) {
      const quizData = await quizResponse.json();
      const totalQuizzes = quizData.length || 0;
      const maxXP = totalQuizzes * 20; // Assuming 20 XP per quiz
      
      // Update quiz card stats
      const quizChallengesStat = document.querySelector('.quiz .stat');
      if (quizChallengesStat) {
        quizChallengesStat.textContent = `📊 ${totalQuizzes} Challenges`;
      }
      const quizXPStat = document.querySelectorAll('.quiz .stat')[1];
      if (quizXPStat) {
        quizXPStat.textContent = `🏆 Max ${maxXP} XP`;
      }
    }
    
    // Load leaderboard data for warrior count
    let leaderboardData = null;
    const leaderboardResponse = await fetch(`${API_BASE}/api/leaderboard`);
    if (leaderboardResponse.ok) {
      leaderboardData = await leaderboardResponse.json();
      const totalWarriors = leaderboardData.leaderboard?.length || 0;
      
      // Update arena rankings stats
      const warriorsStat = document.querySelector('.leaderboard .stat');
      if (warriorsStat) {
        warriorsStat.textContent = `⚔️ ${totalWarriors} Warriors`;
      }
    }
    
    // Load current user's achievements
    const currentUser = auth.currentUser;
    if (currentUser) {
      const userResponse = await fetch(`${API_BASE}/api/user/${currentUser.uid}`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        const userAchievements = userData.achievements || [];
        const unlockedCount = userAchievements.length;
        const totalAchievements = 20; // Total possible achievements
        
        // Update achievements stats
        const achievementsStat = document.querySelector('.achievement .stat');
        if (achievementsStat) {
          achievementsStat.textContent = `🎖️ ${unlockedCount} Unlocked`;
        }
        
        // Update achievement counter in header
        const achievementCounter = document.querySelector('.achievement-counter .counter');
        if (achievementCounter) {
          achievementCounter.textContent = `${unlockedCount}/${totalAchievements}`;
        }
        
        // Update user's rank in arena rankings card
        if (leaderboardData && leaderboardData.leaderboard) {
          const userRank = leaderboardData.leaderboard.findIndex(user => user.uid === currentUser.uid) + 1;
          const rankText = document.querySelector('.leaderboard .rank-text');
          if (rankText && userRank > 0) {
            rankText.textContent = `#${userRank}`;
          }
        }
      }
    }
    
  } catch (error) {
    console.error("Failed to load real card data:", error);
    // Keep default values if API fails
  }
}

// Function to load top 3 warriors for the new home layout
async function loadLeaderboardForHome() {
  try {
    const response = await fetch(`${API_BASE}/api/leaderboard`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    const leaderboard = data.leaderboard || [];
    
    // Get the leaderboard container in the new layout
    const leaderboardContainer = document.querySelector('.top3-container');
    if (!leaderboardContainer) return;
    
    if (leaderboard.length === 0) {
      leaderboardContainer.innerHTML = '<p style="color: rgba(255,255,255,0.6); text-align: center;">No warriors yet</p>';
      return;
    }
    
    // Show top 3 warriors
    const top3 = leaderboard.slice(0, 3);
    leaderboardContainer.innerHTML = top3.map((warrior, index) => {
      const rankClass = index === 0 ? 'first' : index === 1 ? 'second' : 'third';
      const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
      
      return `
        <div class="player ${rankClass}">
          <div class="rank">${rankEmoji}</div>
          <img src="${warrior.profileImage || DEFAULT_AVATAR}" alt="Profile" onerror="this.src='${DEFAULT_AVATAR}'">
          <div class="name">${escapeHtml(warrior.displayName || warrior.email || 'Unknown Warrior')}</div>
          <div class="xp">${warrior.totalXP || 0} XP</div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error("Failed to load leaderboard:", error);
    const leaderboardContainer = document.querySelector('.top3-container');
    if (leaderboardContainer) {
      leaderboardContainer.innerHTML = '<p style="color: rgba(255,100,100,0.8); text-align: center;">Failed to load leaderboard</p>';
    }
  }
}

// ===================================
// SEARCH WARRIORS FUNCTIONALITY
// ===================================

let searchResults = [];
let searchTimeout = null;

/**
 * Initialize search warriors functionality
 */
function initializeSearchWarriors() {
  const searchInput = document.getElementById('search-warriors');
  const searchBtn = document.getElementById('search-warriors-btn');
  const searchResultsContainer = document.getElementById('search-results');
  
  if (!searchInput || !searchBtn || !searchResultsContainer) return;
  
  // Search on input with debounce
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (query.length >= 2) {
        searchWarriors(query);
      } else {
        hideSearchResults();
      }
    }, 300);
  });
  
  // Search on button click
  searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query.length >= 2) {
      searchWarriors(query);
    }
  });
  
  // Search on Enter key
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query.length >= 2) {
        searchWarriors(query);
      }
    }
  });
  
  // Hide search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-warriors-container')) {
      hideSearchResults();
    }
  });
}

/**
 * Search for warriors based on query
 */
async function searchWarriors(query) {
  const searchResultsContainer = document.getElementById('search-results');
  if (!searchResultsContainer) return;
  
  try {
    // Show loading state
    searchResultsContainer.style.display = 'block';
    searchResultsContainer.innerHTML = `
      <div class="search-result-item">
        <div class="search-result-info">
          <div class="loading-spinner" style="width: 16px; height: 16px; border: 2px solid rgba(0,255,255,0.3); border-top: 2px solid #00FFFF; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <span class="search-result-name">Searching warriors...</span>
        </div>
      </div>
    `;
    
    // Search from cached players first (local search)
    const localResults = searchLocalWarriors(query);
    
    // Also try to search from API for more comprehensive results
    const apiResults = await searchWarriorsFromAPI(query);
    
    // Combine and deduplicate results
    const combinedResults = combineSearchResults(localResults, apiResults);
    
    // Filter out current user
    const currentUser = auth.currentUser;
    const filteredResults = combinedResults.filter(warrior => 
      warrior.uid !== (currentUser ? currentUser.uid : null)
    );
    
    searchResults = filteredResults;
    renderSearchResults(filteredResults);
    
  } catch (error) {
    console.error('Search failed:', error);
    searchResultsContainer.innerHTML = `
      <div class="no-results">
        ❌ Search failed. Please try again.
      </div>
    `;
  }
}

/**
 * Search from cached local players
 */
function searchLocalWarriors(query) {
  const lowerQuery = query.toLowerCase();
  
  return playersCache.filter(warrior => {
    const name = (warrior.displayName || warrior.name || warrior.email || '').toLowerCase();
    const email = (warrior.email || '').toLowerCase();
    const level = (warrior.level || Math.floor((warrior.totalXP || warrior.xp || 0) / 100) + 1).toString();
    
    return name.includes(lowerQuery) || 
           email.includes(lowerQuery) || 
           level.includes(lowerQuery);
  }).slice(0, 10); // Limit to 10 results
}

/**
 * Search warriors from API
 */
async function searchWarriorsFromAPI(query) {
  try {
    // Use existing /api/users endpoint instead of non-existent /api/search-users
    const response = await fetch(`${API_BASE}/api/users`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      // If users API fails, fall back to leaderboard
      const leaderboardResponse = await fetch(`${API_BASE}/api/leaderboard`, {
        credentials: 'include'
      });
      
      if (leaderboardResponse.ok) {
        const data = await leaderboardResponse.json();
        const allWarriors = data.leaderboard || [];
        return searchLocalWarriorsFromArray(allWarriors, query);
      }
      
      return [];
    }
    
    const data = await response.json();
    const allUsers = data.users || [];
    
    // Transform API users data to match expected format
    const transformedUsers = allUsers.map(user => ({
      uid: user.userId || user.uid,
      displayName: user.name || user.displayName,
      email: user.email,
      profileImage: user.photoURL || user.profileImage,
      photoURL: user.photoURL,
      avatar: user.photoURL || user.profileImage,
      totalXP: user.xp || 0,
      level: user.level || Math.floor((user.xp || 0) / 100) + 1
    }));
    
    // Search through the transformed users data
    return searchLocalWarriorsFromArray(transformedUsers, query);
    
  } catch (error) {
    console.error('API search failed:', error);
    return [];
  }
}

/**
 * Search from array of warriors
 */
function searchLocalWarriorsFromArray(warriors, query) {
  const lowerQuery = query.toLowerCase();
  
  return warriors.filter(warrior => {
    const name = (warrior.displayName || warrior.name || warrior.email || '').toLowerCase();
    const email = (warrior.email || '').toLowerCase();
    const level = (warrior.level || Math.floor((warrior.totalXP || warrior.xp || 0) / 100) + 1).toString();
    
    return name.includes(lowerQuery) || 
           email.includes(lowerQuery) || 
           level.includes(lowerQuery);
  }).slice(0, 10);
}

/**
 * Combine and deduplicate search results
 */
function combineSearchResults(localResults, apiResults) {
  const combined = [...localResults];
  const existingUids = new Set(localResults.map(warrior => warrior.uid));
  
  // Add API results that are not already in local results
  apiResults.forEach(warrior => {
    if (!existingUids.has(warrior.uid)) {
      combined.push(warrior);
    }
  });
  
  return combined.slice(0, 15); // Limit total results to 15
}

/**
 * Render search results
 */
function renderSearchResults(results) {
  const searchResultsContainer = document.getElementById('search-results');
  if (!searchResultsContainer) return;
  
  if (results.length === 0) {
    searchResultsContainer.innerHTML = `
      <div class="no-results">
        🔍 No warriors found. Try a different search term.
      </div>
    `;
    return;
  }
  
  // Get following list from localStorage
  const following = JSON.parse(localStorage.getItem('following') || '[]');
  
  searchResultsContainer.innerHTML = results.map(warrior => {
    const name = escapeHtml(warrior.displayName || warrior.email || warrior.name || 'Unknown Warrior');
    const avatar = warrior.profileImage || warrior.photoURL || warrior.avatar || DEFAULT_AVATAR;
    const level = warrior.level || Math.floor((warrior.totalXP || 0) / 100) + 1;
    const isFollowing = following.includes(warrior.uid);
    
    return `
      <div class="search-result-item" onclick="openPlayerProfile('${warrior.uid || ''}')">
        <div class="search-result-info">
          <img src="${avatar}" alt="${name}" class="search-result-avatar" onerror="this.src='${DEFAULT_AVATAR}'">
          <div>
            <div class="search-result-name">${name}</div>
            <div class="search-result-level">Level ${level}</div>
          </div>
        </div>
        <button class="follow-btn ${isFollowing ? 'following' : ''}" 
                onclick="followWarriorFromSearch(event, '${warrior.uid || ''}', '${name}')"
                title="${isFollowing ? 'Unfollow' : 'Follow'}">
          ${isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>
    `;
  }).join('');
  
  searchResultsContainer.style.display = 'block';
}

/**
 * Follow warrior from search results
 */
function followWarriorFromSearch(event, uid, name) {
  event.stopPropagation();
  
  if (!uid) return;
  
  const followBtn = event.target;
  const following = JSON.parse(localStorage.getItem('following') || '[]');
  const isCurrentlyFollowing = following.includes(uid);
  
  // Disable button temporarily
  followBtn.disabled = true;
  
  if (isCurrentlyFollowing) {
    // Unfollow
    const updatedFollowing = following.filter(id => id !== uid);
    localStorage.setItem('following', JSON.stringify(updatedFollowing));
    
    followBtn.textContent = 'Follow';
    followBtn.className = 'follow-btn';
    followBtn.title = 'Follow';
    
    showNotification(`Unfollowed ${name}`, 'info');
  } else {
    // Follow
    following.push(uid);
    localStorage.setItem('following', JSON.stringify(following));
    
    followBtn.textContent = 'Following';
    followBtn.className = 'follow-btn following';
    followBtn.title = 'Unfollow';
    
    showNotification(`Now following ${name}!`, 'success');
  }
  
  // Re-enable button
  setTimeout(() => {
    followBtn.disabled = false;
  }, 500);
  
  // Update the main players list to reflect follow status
  setTimeout(() => {
    renderPlayersList(playersCache);
  }, 100);
}

/**
 * Hide search results
 */
function hideSearchResults() {
  const searchResultsContainer = document.getElementById('search-results');
  if (searchResultsContainer) {
    searchResultsContainer.style.display = 'none';
  }
}

