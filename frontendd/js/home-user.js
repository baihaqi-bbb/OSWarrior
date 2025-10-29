// Complete cleaned home-user script (replace file)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.appspot.com",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e",
};
const app = initializeApp(firebaseConfig);
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
  const cur = document.getElementById("xp-current"); if (cur) cur.textContent = `${xp} XP`;
  const max = document.getElementById("xp-max"); if (max) max.textContent = `/ ${maxXP} XP`;
  const lvl = document.getElementById("player-level"); if (lvl) lvl.textContent = `Level ${level}`;
  const pname = document.getElementById("player-name"); if (pname) pname.textContent = `${name} 👑`;
}
function loadUserXP(uid, displayName) {
  if (!uid) return;
  const userRef = doc(db, "users", uid);
  try {
    onSnapshot(userRef, snap => {
      const data = snap.exists() ? snap.data() : null;
      const xp = Number(data?.xp || 0);
      const level = Number(data?.level || Math.floor(xp / 100) + 1);
      const maxForLevel = Math.max(100, level * 100);
      const name = data?.name || data?.displayName || displayName || "Warrior";
      updateXPBar(xp, maxForLevel, level, name);
    });
  } catch (e) {
    console.warn("loadUserXP failed:", e);
    // fallback one-time read
    getDoc(userRef).then(snap => {
      const data = snap.exists() ? snap.data() : null;
      const xp = Number(data?.xp || 0);
      const level = Number(data?.level || Math.floor(xp / 100) + 1);
      const name = data?.name || data?.displayName || displayName || "Warrior";
      updateXPBar(xp, Math.max(100, level * 100), level, name);
    }).catch(() => {});
  }
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
      // leave page if not authed (adjust if public view allowed)
      // window.location.href = "index.html";
      await loadTop3();
      return;
    }
    // populate some UI nodes if present
    const profileImg = document.getElementById("profile-img");
    if (profileImg) profileImg.src = user.photoURL || DEFAULT_AVATAR;

    const userRef = doc(db, "users", user.uid);
    try {
      const snap = await getDoc(userRef);
      const updates = {};
      if (!snap.exists()) updates.xp = 0, updates.level = 1;
      if (!snap.exists() || (!snap.data().name && user.displayName)) updates.name = user.displayName;
      if (!snap.exists() || (!snap.data().email && user.email)) updates.email = user.email || null;
      if (Object.keys(updates).length) await setDoc(userRef, updates, { merge: true });
    } catch (e) { console.warn("ensure user doc failed:", e); }

    const displayName = user.displayName || (await getDoc(userRef)).data()?.name || "Warrior";
    const usernameWelcome = document.getElementById("username");
    if (usernameWelcome) usernameWelcome.textContent = displayName;
    const playerName = document.getElementById("player-name");
    if (playerName) playerName.textContent = displayName + " 👑";

    loadUserXP(user.uid, displayName);
    await loadTop3();
    retriggerCardAnimations(80);
  } catch (err) {
    console.error("Auth handler error:", err);
  }
});

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

// call it on boot
document.addEventListener("DOMContentLoaded", () => {
  ensurePublicProfileModal();
  setupProfileDropdown(); // <-- added
  loadTop3();
  retriggerCardAnimations(60);
});

