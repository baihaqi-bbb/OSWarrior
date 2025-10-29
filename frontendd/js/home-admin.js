// filepath: [home-admin.js](http://_vscodecontentref_/3)
// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  databaseURL: "https://test-4fdf4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.firebasestorage.app",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ Check login & role (admin)
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const profileImg = document.getElementById("profile-img");
    if (profileImg) profileImg.src = user.photoURL || "image/default-profile.png";

    // Ambil nama user (Google: displayName, Email: dari Firestore)
    let displayName = user.displayName;
    if (!displayName) {
      // Ambil dari Firestore jika tiada displayName
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

    // Papar nama di navbar sahaja
    const usernameNavbar = document.getElementById("username-navbar");
    if (usernameNavbar) usernameNavbar.textContent = displayName;

    // Semak role -> mesti "admin"
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        if (role !== "admin") {
          window.location.href = "index.html";
        }
      } else {
        window.location.href = "index.html";
      }
    } catch (err) {
      console.error("Role check error:", err);
      window.location.href = "index.html";
    }
  } else {
    window.location.href = "index.html";
  }
});

/* --- added: inject reusable profile + dropdown into navbar on every page --- */
(function initProfileDropdown(){
  // avoid double-inject
  if (document.querySelector(".profile-container")) return;

  // minimal styles to ensure consistent look
  const css = `
  .profile-container{ margin-left:auto; display:flex; align-items:center; gap:8px; position:relative; }
  .profile-name{ color:var(--muted,#9aa4b2); font-weight:600; margin-right:6px; }
  .profile-img{ width:36px; height:36px; border-radius:50%; object-fit:cover; border:2px solid rgba(255,255,255,0.04); cursor:pointer; }
  .profile-dropdown{ position:absolute; right:0; top:46px; min-width:220px; background:#071026; border:1px solid rgba(255,255,255,0.04); border-radius:10px; padding:6px; display:none; box-shadow:0 10px 30px rgba(2,6,23,0.6); z-index:999; }
  .profile-dropdown.show{ display:flex; flex-direction:column; }
  .profile-dropdown a, .profile-dropdown button{ color:#e6eef6; text-align:left; padding:8px 10px; background:transparent; border:0; cursor:pointer; border-radius:8px; }
  .profile-dropdown a:hover, .profile-dropdown button:hover{ background: rgba(255,255,255,0.02); }
  .profile-dropdown .sep{ height:1px; background:rgba(255,255,255,0.03); margin:6px 4px; border-radius:2px; }
  `;
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // find navbar and append profile container
  const nav = document.querySelector(".navbar");
  if (!nav) return;
  const container = document.createElement("div");
  container.className = "profile-container";
  container.innerHTML = `
    <span class="profile-name" id="username-navbar">Admin</span>
    <img id="profile-img" class="profile-img" src="image/default-profile.png" alt="Profile"/>
    <div id="profile-dropdown" class="profile-dropdown" role="menu" aria-hidden="true">
      <a id="view-profile" href="profile.html">👤 View Profile</a>
      <a id="view-achievements" href="achievement.html">🏆 Achievements</a>
      <div class="sep"></div>
      <button id="toggle-theme">🌗 Toggle theme</button>
      <button id="change-avatar">🖼️ Change avatar</button>
      <button id="edit-name">✏️ Edit name</button>
      <div class="sep"></div>
      <button id="logout-btn">🚪 Logout</button>
    </div>
  `;
  nav.appendChild(container);

  const dropdown = document.getElementById("profile-dropdown");
  const img = document.getElementById("profile-img");
  const nameEl = document.getElementById("username-navbar");

  // toggle dropdown
  img.addEventListener("click", (e)=> {
    e.stopPropagation();
    dropdown.classList.toggle("show");
    dropdown.setAttribute("aria-hidden", !dropdown.classList.contains("show"));
  });
  // close on outside click
  window.addEventListener("click", ()=> { dropdown.classList.remove("show"); dropdown.setAttribute("aria-hidden","true"); });

  // auth updates (assumes auth & onAuthStateChanged exist earlier in file)
  try {
    onAuthStateChanged(auth, (user)=>{
      if (!user) {
        nameEl.textContent = "Guest";
        img.src = "image/default-profile.png";
        return;
      }
      nameEl.textContent = user.displayName || user.email?.split("@")[0] || "Admin";
      img.src = user.photoURL || "image/default-profile.png";
      // add role marker if admin
      // (optional) set special border for admin
      if (user?.email && user.email.includes("@")) {
        // no-op placeholder if you want admin styling later
      }
    });
  } catch(e){
    // silent if onAuthStateChanged/auth not available in this scope
    console.warn("Profile init: auth not available", e);
  }

  // logout handler (uses signOut if available)
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (ev)=>{
      ev.stopPropagation();
      try {
        if (typeof signOut === "function") {
          await signOut(auth);
        } else if (auth && auth.signOut) {
          await auth.signOut();
        }
      } catch(err){
        console.error("Logout failed", err);
      } finally {
        window.location.href = "index.html";
      }
    });
  }

  // toggle theme: add/remove body.dark-mode and persist
  const toggleThemeBtn = document.getElementById("toggle-theme");
  if (toggleThemeBtn) {
    toggleThemeBtn.addEventListener("click", (e)=>{
      e.stopPropagation();
      const bm = document.body.classList;
      if (bm.contains("dark-mode")) {
        bm.remove("dark-mode");
        localStorage.setItem("osw-theme","light");
      } else {
        bm.add("dark-mode");
        localStorage.setItem("osw-theme","dark");
      }
    });
    // restore theme from storage
    const saved = localStorage.getItem("osw-theme");
    if (saved === "dark") document.body.classList.add("dark-mode");
  }

  // change avatar — opens file picker and shows preview only (no server upload here)
  const changeAvatarBtn = document.getElementById("change-avatar");
  if (changeAvatarBtn) {
    changeAvatarBtn.addEventListener("click", (e)=>{
      e.stopPropagation();
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/*";
      inp.onchange = () => {
        const f = inp.files[0];
        if (!f) return;
        const url = URL.createObjectURL(f);
        img.src = url;
        alert("Preview updated locally. To persist avatar upload, implement storage upload and updateProfile.");
      };
      inp.click();
    });
  }

  // edit name (simple prompt + firebase updateProfile if available)
  const editNameBtn = document.getElementById("edit-name");
  if (editNameBtn) {
    editNameBtn.addEventListener("click", async (e)=>{
      e.stopPropagation();
      const v = prompt("Edit display name:", nameEl.textContent || "");
      if (!v) return;
      nameEl.textContent = v;
      try {
        if (typeof updateProfile === "function" && auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName: v });
        } else {
          // store locally or ask to implement server-side save
        }
      } catch(err){
        console.error("UpdateProfile failed", err);
      }
    });
  }
})();
/* --- end added --- */

// Removed XP, mission, leaderboard UI related code to avoid referencing removed DOM elements

// === Profile Dropdown ===
const profileContainer = document.querySelector(".profile-container");
const profileDropdown = document.getElementById("profile-dropdown");
let dropdownOpen = false;
if (profileContainer) {
  profileContainer.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dropdownOpen) {
      profileDropdown.classList.remove("show");
      setTimeout(() => profileDropdown.classList.add("hidden"), 300);
    } else {
      profileDropdown.classList.remove("hidden");
      setTimeout(() => profileDropdown.classList.add("show"), 10);
    }
    dropdownOpen = !dropdownOpen;
  });
  document.addEventListener("click", (e) => {
    if (dropdownOpen && !profileContainer.contains(e.target)) {
      profileDropdown.classList.remove("show");
      setTimeout(() => profileDropdown.classList.add("hidden"), 300);
      dropdownOpen = false;
    }
  });
}

// PROFILE DROPDOWN BUTTONS
const viewProfileBtn = document.getElementById("view-profile");
if (viewProfileBtn) viewProfileBtn.addEventListener("click", () => { window.location.href = "profile.html"; });

const viewAchievementsBtn = document.getElementById("view-achievements");
if (viewAchievementsBtn) viewAchievementsBtn.addEventListener("click", (e) => { e.preventDefault(); window.location.href = "achievement.html"; });

const toggleThemeBtn = document.getElementById("toggle-theme");
if (toggleThemeBtn) toggleThemeBtn.addEventListener("click", () => { document.body.classList.toggle("dark-mode"); });

const changeAvatarBtn = document.getElementById("change-avatar");
if (changeAvatarBtn) changeAvatarBtn.addEventListener("click", () => {
  const modalChangeAvatar = document.getElementById("modal-change-avatar");
  const inputAvatarUrl = document.getElementById("input-avatar-url");
  if (modalChangeAvatar) {
    modalChangeAvatar.style.display = "flex";
    if (inputAvatarUrl) { inputAvatarUrl.value = ""; inputAvatarUrl.focus(); }
  }
});

const editNameBtn = document.getElementById("edit-name");
if (editNameBtn) editNameBtn.addEventListener("click", () => {
  const modalEditName = document.getElementById("modal-edit-name");
  const inputNewName = document.getElementById("input-new-name");
  if (modalEditName) {
    modalEditName.style.display = "flex";
    if (inputNewName) { inputNewName.value = ""; inputNewName.focus(); }
  }
});

// LOGOUT
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    console.log("✅ Logout berjaya");
    window.location.href = "index.html";
  } catch (error) {
    console.error("❌ Logout error:", error);
    alert("Gagal logout: " + error.message);
  }
});

// expose signOut for admin-common.js / other pages
window.firebaseSignOut = async function () {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("firebaseSignOut error:", e);
    throw e;
  }
};

// === Save name/avatar buttons (reuse logic from home-user) ===
const saveNameBtn = document.getElementById("save-name-btn");
const cancelNameBtn = document.getElementById("cancel-name-btn");
if (cancelNameBtn) cancelNameBtn.onclick = () => { const m = document.getElementById("modal-edit-name"); if (m) m.style.display = "none"; };
if (saveNameBtn) saveNameBtn.onclick = async () => {
  const inputNewName = document.getElementById("input-new-name");
  if (inputNewName && auth.currentUser) {
    const newName = inputNewName.value.trim();
    if (!newName) return;
    const uid = auth.currentUser.uid;
    try {
      await updateDoc(doc(db, "users", uid), { name: newName });
      await updateProfile(auth.currentUser, { displayName: newName });
      const navbarName = document.getElementById("username-navbar");
      if (navbarName) navbarName.textContent = newName;
      const modal = document.getElementById("modal-edit-name");
      if (modal) modal.style.display = "none";
      alert("Nama berjaya ditukar!");
    } catch (err) {
      console.error(err);
      alert("Gagal kemaskini nama: " + err.message);
    }
  }
};

const saveAvatarBtn = document.getElementById("save-avatar-btn");
const cancelAvatarBtn = document.getElementById("cancel-avatar-btn");
if (cancelAvatarBtn) cancelAvatarBtn.onclick = () => { const m = document.getElementById("modal-change-avatar"); if (m) m.style.display = "none"; };
if (saveAvatarBtn) saveAvatarBtn.onclick = async () => {
  const inputAvatarUrl = document.getElementById("input-avatar-url");
  if (inputAvatarUrl && auth.currentUser) {
    const newURL = inputAvatarUrl.value.trim();
    if (!newURL) return;
    const uid = auth.currentUser.uid;
    try {
      await updateDoc(doc(db, "users", uid), { profileURL: newURL });
      await updateProfile(auth.currentUser, { photoURL: newURL });
      const img = document.getElementById("profile-img");
      if (img) img.src = newURL;
      const modal = document.getElementById("modal-change-avatar");
      if (modal) modal.style.display = "none";
      alert("Avatar berjaya ditukar!");
    } catch (err) {
      console.error(err);
      alert("Gagal kemaskini avatar: " + err.message);
    }
  }
};

// NAVIGATION / ACTIONS for admin cards
const routeMap = {
  "manage-users": "admin-users.html",
  "manage-quizzes": "admin-quizzes.html",
  "admin-leaderboard": "admin-leaderboard.html",
  "admin-reports": "admin-reports.html",
  "admin-logs": "admin-logs.html",
  "upload-notes": "admin-upload.html" // added: route to upload page
};

Object.keys(routeMap).forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = routeMap[id];
    });
  }
});