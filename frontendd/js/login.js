import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Elements
const googleBtn = document.getElementById("google-login");
const emailBtn = document.getElementById("login-btn");
const msg = document.getElementById("message");
const forgotLink = document.querySelector(".help-text a");
const loginContainer = document.querySelector(".login-container");

// Modal elements
const modal = document.getElementById("forgot-modal");
const closeModal = document.getElementById("closeModal");
const resetBtn = document.getElementById("resetBtn");
const resetEmail = document.getElementById("resetEmail");
const resetMsg = document.getElementById("resetMsg");

// Senarai email admin
const adminEmails = [
  "admin1@email.com",
  "admin2@email.com"
  // tambah email admin lain di sini
];

// 🔹 Open modal
forgotLink.addEventListener("click", (e) => {
  e.preventDefault();
  modal.style.display = "flex";
});

// 🔹 Close modal
closeModal.addEventListener("click", () => {
  modal.style.display = "none";
  resetMsg.textContent = "";
});

// 🔹 Send password reset link
resetBtn.addEventListener("click", async () => {
  const email = resetEmail.value.trim();
  if (!email) {
    resetMsg.style.color = "yellow";
    resetMsg.textContent = "⚠️ Please enter your email.";
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    resetMsg.style.color = "lime";
    resetMsg.textContent = "✅ Password reset link sent! Check your inbox.";
  } catch (error) {
    resetMsg.style.color = "red";
    if (error.code === "auth/user-not-found") {
      resetMsg.textContent = "❌ No account found with this email.";
    } else {
      resetMsg.textContent = `❌ ${error.message}`;
    }
  }
});

  // 🧭 Redirect ikut role
  async function redirectBasedOnRole(user) {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    // Prefer role stored in Firestore. Fallback to adminEmails if doc missing.
    let role = "user";
    if (userDoc.exists()) {
      role = userDoc.data().role || "user";
      // ensure Firestore has role (no overwrite from adminEmails)
      if (!userDoc.data().role) {
        await setDoc(userDocRef, { ...userDoc.data(), role }, { merge: true });
      }
    } else {
      // first-time user: decide role by adminEmails
      if (adminEmails.includes(user.email)) role = "admin";
      await setDoc(userDocRef, {
        email: user.email,
        role,
        profileURL: user.photoURL || ""
      });
    }

    if (role === "admin") {
      window.location.href = "home-admin.html";
    } else {
      window.location.href = "home-user.html";
    }
  }
  
// 🔹 Email Login
emailBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    msg.style.color = "yellow";
    msg.textContent = "⚠️ Please enter both email and password.";
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    msg.style.color = "lime";
    msg.textContent = `✅ Welcome back, ${userCredential.user.email}`;
    loginContainer.style.borderColor = "#00ffff";

    // ✅ Redirect ikut role
    setTimeout(() => {
      redirectBasedOnRole(userCredential.user); // untuk email login
    }, 1000);

    // 🛠️ Simpan displayName kalau ada, fallback ke email
    const uid = userCredential.user.uid; 
    const name = userCredential.user.displayName || userCredential.user.email || "User";
    localStorage.setItem("userId", uid);
    localStorage.setItem("username", name);

  } catch (error) {
    msg.style.color = "red";

    // 🔹 Shake + red glow effect
    loginContainer.classList.add("shake");
    loginContainer.style.borderColor = "#ff3366";
    loginContainer.style.boxShadow = "0 0 25px #ff3366, 0 0 50px #ff0000";

    setTimeout(() => {
      loginContainer.classList.remove("shake");
      loginContainer.style.borderColor = "rgba(0,255,255,0.4)";
      loginContainer.style.boxShadow = "0 0 25px rgba(0,255,255,0.3)";
    }, 600);
    
    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/user-not-found" ||
      error.code === "auth/wrong-password"
    ) {
      msg.textContent = "❌ Email or password incorrect.";
    } else if (error.code === "auth/too-many-requests") {
      msg.textContent = "⚠️ Too many failed attempts. Try again later.";
    } else {
      msg.textContent = `❌ ${error.message}`;
    }
  }
});

// 🔹 Google Login
googleBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    msg.style.color = "lime";
    msg.textContent = `✅ Logged in as ${result.user.displayName}`;

    // 🔹 Redirect ikut role Google
    setTimeout(() => {
      redirectBasedOnRole(result.user); // untuk Google login
    }, 1000);
    
    // 🛠️ Simpan displayName kalau ada, fallback ke email
    const uid = result.user.uid; 
    const name = result.user.displayName || result.user.email || "User";
    localStorage.setItem("userId", uid);
    localStorage.setItem("username", name);

  } catch (error) {
    msg.style.color = "red";
    msg.textContent = `❌ ${error.message}`;
    console.error(error); // Tambah ini untuk debug
  }
});
