import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Sama config di semua halaman
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

let currentUser = null;

// Tunggu DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const profileImg = document.getElementById("profile-img");

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    currentUser = user;
    profileImg.src = user.photoURL || "image/default-profile.png";

    // Semak role dari Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists() || userDoc.data().role !== "user") {
      window.location.href = "index.html";
      return;
    }
  });

  // Logout
  document.getElementById("logout-btn").addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (error) {
      alert("Error logging out: " + error.message);
    }
  });

  // Week card click
  document.querySelectorAll(".week-card").forEach(card => {
    card.addEventListener("click", () => {
      const week = card.dataset.week;
      // Redirect hanya jika currentUser valid
      if (currentUser) {
        window.location.href = `take-quiz.html?week=${week}`;
      }
    });
  });
});
