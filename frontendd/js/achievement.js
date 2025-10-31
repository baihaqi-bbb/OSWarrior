// Import Firebase SDK
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ✅ Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.appspot.com",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e"
};

// ✅ Initialize Firebase only if not already initialized
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ Check login & role
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const profileImg = document.getElementById("profile-img");
    if(profileImg) profileImg.src = user.photoURL || "image/default-profile.png";

    const usernameNavbar = document.getElementById("username-navbar");
    if(usernameNavbar) usernameNavbar.textContent = user.displayName || "Warrior";

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const role = userDoc.data().role;
      if (role !== "user") {
        window.location.href = "index.html";
      }
    } else {
      window.location.href = "index.html";
    }

    // Update XP Bar
    updateXPBar(340, 500, 5, user.displayName || "Warrior");

    // Show mission alert
    showMissionAlert("Welcome back! Check your achievements 🏆");
  } else {
    window.location.href = "index.html";
  }
});

// 🔥 XP SYSTEM
function updateXPBar(xp, maxXP, level, name) {
  const progress = (xp / maxXP) * 100;
  const xpBar = document.getElementById("xp-progress");
  if(xpBar) xpBar.style.width = progress + "%";
  
  const xpCurrent = document.getElementById("xp-current");
  if(xpCurrent) xpCurrent.textContent = xp + " XP";
  
  const xpMax = document.getElementById("xp-max");
  if(xpMax) xpMax.textContent = "/ " + maxXP + " XP";

  const playerLevel = document.getElementById("player-level");
  if(playerLevel) playerLevel.textContent = "Level " + level;

  const playerName = document.getElementById("player-name");
  if(playerName) playerName.textContent = name + " 👑";
}

// 🔔 Mission Alert
function showMissionAlert(message, icon = "🏆") {
  const alertBox = document.getElementById("mission-alert");
  const text = document.getElementById("mission-text");
  const iconBox = document.getElementById("mission-icon");

  if(!alertBox || !text || !iconBox) return;

  text.textContent = message;
  iconBox.textContent = icon;
  alertBox.classList.remove("hidden");

  setTimeout(() => alertBox.classList.add("show"), 10);
  setTimeout(() => hideMissionAlert(), 5000);
}

function hideMissionAlert() {
  const alertBox = document.getElementById("mission-alert");
  if(!alertBox) return;
  alertBox.classList.remove("show");
  setTimeout(() => alertBox.classList.add("hidden"), 400);
}

const missionClose = document.getElementById("mission-close");
if(missionClose) missionClose.addEventListener("click", hideMissionAlert);

// === Profile Dropdown ===
const profileContainer = document.querySelector(".profile-container");
const profileDropdown = document.getElementById("profile-dropdown");

let dropdownOpen = false;

if(profileContainer) {
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
if(viewProfileBtn) viewProfileBtn.addEventListener("click", () => window.location.href="profile.html");

const viewAchievementsBtn = document.getElementById("view-achievements");
if(viewAchievementsBtn) viewAchievementsBtn.addEventListener("click", () => window.location.href="achievements.html");

const toggleThemeBtn = document.getElementById("toggle-theme");
if(toggleThemeBtn) toggleThemeBtn.addEventListener("click", () => document.body.classList.toggle("dark-mode"));

const changeAvatarBtn = document.getElementById("change-avatar");
if(changeAvatarBtn) changeAvatarBtn.addEventListener("click", () => alert("🚧 Feature coming soon: Avatar changer!"));

const editNameBtn = document.getElementById("edit-name");
if(editNameBtn) editNameBtn.addEventListener("click", () => {
  const newName = prompt("Masukkan nama baru:");
  if(newName) {
    const username = document.getElementById("username");
    const usernameNavbar = document.getElementById("username-navbar");
    const playerName = document.getElementById("player-name");
    if(username) username.textContent = newName;
    if(usernameNavbar) usernameNavbar.textContent = newName;
    if(playerName) playerName.textContent = newName + " 👑";
  }
});

// LOGOUT
const logoutBtn = document.getElementById("logout-btn");
if(logoutBtn) logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("❌ Logout error:", error);
    alert("Gagal logout: " + error.message);
  }
});
