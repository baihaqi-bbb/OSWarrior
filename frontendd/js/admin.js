import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  databaseURL: "https://test-4fdf4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.firebasestorage.app",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const API_BASE = "https://oswarrior-backend.onrender.com";

const profileImg = document.getElementById("profile-img");
const profileName = document.getElementById("profile-name");
const tbody = document.getElementById("admin-table-body");
const logoutBtn = document.getElementById("logout-btn");

// Require admin role
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  try {
    const udoc = await getDoc(doc(db, "users", user.uid));
    const role = udoc.exists() ? udoc.data().role : null;
    if (role !== "admin") {
      window.location.href = "index.html";
      return;
    }
    if (profileImg) profileImg.src = user.photoURL || "image/default-profile.png";
    if (profileName) profileName.textContent = user.displayName || user.email || "Admin";

    // load leaderboard for admin view
    await loadLeaderboard();
  } catch (e) {
    console.error(e);
    window.location.href = "index.html";
  }
});

async function loadLeaderboard() {
  try {
    const res = await fetch(`${API_BASE}/api/leaderboard`);
    if (!res.ok) throw new Error("Failed fetching leaderboard");
    const data = await res.json();
    renderRows(data);
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="4" class="center small">❌ Gagal muat leaderboard</td></tr>`;
  }
}

function renderRows(data) {
  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="center small">Tiada data</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  data.forEach((u, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${u.username || u.userId}</td>
      <td>${u.total || 0}</td>
      <td><button class="btn ghost" data-user="${u.userId}" data-username="${u.username || ''}">View</button></td>
    `;
    tbody.appendChild(tr);
  });
  // optional: attach handlers to action buttons (view, export etc.)
}

// logout
if (logoutBtn) logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (err) {
    console.error("Logout error", err);
  }
});

// expose signOut for admin-common.js
window.firebaseSignOut = async function () {
  try {
    await signOut(getAuth());
  } catch (e) {
    console.error("firebaseSignOut error:", e);
    throw e;
  }
};
