// Module: initialize Firebase for admin pages that don't have their own init.
// Sets profile img/name, enforces admin role, and exposes window.firebaseSignOut.
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

try {
  initializeApp(firebaseConfig);
} catch (e) {
  // ignore if already initialized
}

const auth = getAuth();
const db = getFirestore();

// expose firebaseSignOut for admin-common.js
window.firebaseSignOut = async function () {
  await signOut(auth);
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // set profile UI if present
  const profileImg = document.getElementById("profile-img");
  const usernameNavbar = document.getElementById("username-navbar");
  if (profileImg) profileImg.src = user.photoURL || "image/default-profile.png";
  if (usernameNavbar) usernameNavbar.textContent = user.displayName || user.email || "Admin";

  // role check using users collection; redirect if not admin
  try {
    const udoc = await getDoc(doc(db, "users", user.uid));
    const role = udoc.exists() ? udoc.data().role : null;
    if (role !== "admin") {
      window.location.href = "index.html";
      return;
    }
  } catch (err) {
    console.error("admin-init role check error:", err);
    window.location.href = "index.html";
  }
});