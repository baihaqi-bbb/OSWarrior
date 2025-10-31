// 🚀 Enhanced OSwarrior Login Portal
// Advanced Firebase Integration with Cyber UI Effects

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

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  databaseURL: "https://test-4fdf4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.firebasestorage.app",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// 🎯 DOM Elements
const googleBtn = document.getElementById("google-login");
const emailBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const msg = document.getElementById("message");
const forgotLink = document.getElementById("forgot-password");
const loginContainer = document.querySelector(".login-container");
const statusText = document.querySelector(".system-online");
const statusDot = document.querySelector(".status-dot");

// Modal elements
const modal = document.getElementById("forgot-modal");
const closeModal = document.getElementById("closeModal");
const resetBtn = document.getElementById("resetBtn");
const resetEmail = document.getElementById("resetEmail");
const resetMsg = document.getElementById("resetMsg");

// Input elements
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

// 👥 Admin Email List
const adminEmails = [
  "admin1@email.com",
  "admin2@email.com"
  // Add more admin emails here
];

// 🎮 Enhanced UI Effects
class CyberEffects {
  static showMessage(element, text, type = 'info') {
    element.textContent = text;
    element.className = `status-message text-${type}`;
    
    // Add glow effect
    if (type === 'success') {
      element.classList.add('glow-success');
    } else if (type === 'warning') {
      element.classList.add('glow-warning');
    } else if (type === 'danger') {
      element.classList.add('glow-danger');
    }
    
    // Auto-clear after 5 seconds
    setTimeout(() => {
      element.textContent = '';
      element.className = 'status-message';
    }, 5000);
  }

  static setContainerState(state) {
    loginContainer.classList.remove('success-state', 'error-state');
    if (state === 'success') {
      loginContainer.classList.add('success-state');
    } else if (state === 'error') {
      loginContainer.classList.add('error-state');
      loginContainer.classList.add('shake');
      setTimeout(() => {
        loginContainer.classList.remove('shake', 'error-state');
      }, 600);
    }
  }

  static updateSystemStatus(status, text) {
    if (statusText && statusDot) {
      statusText.textContent = text;
      statusDot.style.background = status === 'online' ? 'var(--success-color)' : 
                                   status === 'warning' ? 'var(--warning-color)' : 
                                   'var(--danger-color)';
      statusDot.style.boxShadow = `0 0 10px ${statusDot.style.background}`;
    }
  }

  static animateButton(button, type = 'click') {
    button.style.transform = 'scale(0.95)';
    setTimeout(() => {
      button.style.transform = '';
    }, 150);
  }
}

// 🔒 Enhanced Authentication Functions
async function redirectBasedOnRole(user) {
  try {
    CyberEffects.updateSystemStatus('warning', 'VERIFYING ACCESS...');
    
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    let role = "user";
    if (userDoc.exists()) {
      role = userDoc.data().role || "user";
      if (!userDoc.data().role) {
        await setDoc(userDocRef, { ...userDoc.data(), role }, { merge: true });
      }
    } else {
      if (adminEmails.includes(user.email)) role = "admin";
      await setDoc(userDocRef, {
        email: user.email,
        role,
        profileURL: user.photoURL || "",
        lastLogin: new Date().toISOString(),
        loginCount: 1
      });
    }

    // Store user info in localStorage
    const uid = user.uid;
    const name = user.displayName || user.email || "User";
    localStorage.setItem("userId", uid);
    localStorage.setItem("username", name);
    localStorage.setItem("userRole", role);

    CyberEffects.updateSystemStatus('online', 'ACCESS GRANTED');
    CyberEffects.showMessage(msg, `🚀 Access granted! Redirecting to ${role} portal...`, 'success');
    
    setTimeout(() => {
      if (role === "admin") {
        window.location.href = "home-admin.html";
      } else {
        window.location.href = "home-user.html";
      }
    }, 1500);

  } catch (error) {
    console.error("Role verification error:", error);
    CyberEffects.updateSystemStatus('error', 'ACCESS ERROR');
    CyberEffects.showMessage(msg, "⚠️ Role verification failed. Please try again.", 'warning');
  }
}

// 🎮 Event Listeners & Modal Handling
document.addEventListener('DOMContentLoaded', function() {
  // Initialize system status
  CyberEffects.updateSystemStatus('online', 'SYSTEM ONLINE');
  
  // Setup navigation for signup button
  if (signupBtn) {
    signupBtn.addEventListener('click', function() {
      CyberEffects.animateButton(signupBtn);
      CyberEffects.showMessage(msg, '🔄 Redirecting to registration...', 'warning');
      setTimeout(() => {
        window.location.href = 'signup.html';
      }, 500);
    });
  }

  // Enhanced keyboard navigation
  [emailInput, passwordInput].forEach(input => {
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          CyberEffects.animateButton(emailBtn);
          emailBtn.click();
        }
      });

      // Add focus effects
      input.addEventListener('focus', function() {
        this.parentElement.style.transform = 'scale(1.02)';
      });

      input.addEventListener('blur', function() {
        this.parentElement.style.transform = 'scale(1)';
      });
    }
  });
});

// 🔧 Modal Management
if (forgotLink) {
  forgotLink.addEventListener("click", (e) => {
    e.preventDefault();
    modal.style.display = "flex";
    CyberEffects.updateSystemStatus('warning', 'RECOVERY MODE');
    setTimeout(() => resetEmail.focus(), 300);
  });
}

if (closeModal) {
  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
    resetMsg.textContent = "";
    resetEmail.value = "";
    CyberEffects.updateSystemStatus('online', 'SYSTEM ONLINE');
  });
}

// � Enhanced Password Reset
if (resetBtn) {
  resetBtn.addEventListener("click", async () => {
    const email = resetEmail.value.trim();
    
    if (!email) {
      resetMsg.className = "reset-message text-warning";
      resetMsg.textContent = "⚠️ Please enter your email address.";
      CyberEffects.animateButton(resetBtn);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      resetMsg.className = "reset-message text-danger";
      resetMsg.textContent = "❌ Please enter a valid email address.";
      CyberEffects.animateButton(resetBtn);
      return;
    }

    try {
      resetBtn.disabled = true;
      resetBtn.innerHTML = '<span class="btn-text">🔄 SENDING...</span>';
      
      await sendPasswordResetEmail(auth, email);
      
      resetMsg.className = "reset-message text-success";
      resetMsg.textContent = "✅ Recovery link sent! Check your inbox.";
      
      setTimeout(() => {
        modal.style.display = "none";
        resetMsg.textContent = "";
        resetEmail.value = "";
        CyberEffects.updateSystemStatus('online', 'SYSTEM ONLINE');
      }, 3000);
      
    } catch (error) {
      resetMsg.className = "reset-message text-danger";
      if (error.code === "auth/user-not-found") {
        resetMsg.textContent = "❌ No account found with this email.";
      } else if (error.code === "auth/too-many-requests") {
        resetMsg.textContent = "⚠️ Too many requests. Please try again later.";
      } else {
        resetMsg.textContent = `❌ ${error.message}`;
      }
    } finally {
      resetBtn.disabled = false;
      resetBtn.innerHTML = '<span class="btn-text">🚀 SEND RESET LINK</span>';
    }
  });
}

// 🔹 Email Login
emailBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    CyberEffects.showMessage(msg, "⚠️ Please enter both email and password.", 'warning');
    CyberEffects.animateButton(emailBtn);
    return;
  }

  try {
    emailBtn.disabled = true;
    emailBtn.innerHTML = '🔄 AUTHENTICATING...';
    CyberEffects.updateSystemStatus('warning', 'AUTHENTICATING...');
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    CyberEffects.setContainerState('success');
    CyberEffects.showMessage(msg, `✅ Welcome back, ${userCredential.user.email}`, 'success');

    // Store basic info and redirect
    const uid = userCredential.user.uid; 
    const name = userCredential.user.displayName || userCredential.user.email || "User";
    localStorage.setItem("userId", uid);
    localStorage.setItem("username", name);

    // Redirect based on role
    await redirectBasedOnRole(userCredential.user);

  } catch (error) {
    CyberEffects.setContainerState('error');
    CyberEffects.updateSystemStatus('error', 'AUTH FAILED');
    
    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/user-not-found" ||
      error.code === "auth/wrong-password"
    ) {
      CyberEffects.showMessage(msg, "❌ Email or password incorrect.", 'danger');
    } else if (error.code === "auth/too-many-requests") {
      CyberEffects.showMessage(msg, "⚠️ Too many failed attempts. Try again later.", 'warning');
    } else {
      CyberEffects.showMessage(msg, `❌ ${error.message}`, 'danger');
    }
  } finally {
    emailBtn.disabled = false;
    emailBtn.innerHTML = '🚀 INITIALIZE LOGIN';
  }
});

// 🔹 Google Login
googleBtn.addEventListener("click", async () => {
  try {
    googleBtn.disabled = true;
    googleBtn.innerHTML = '🔄 CONNECTING...';
    CyberEffects.updateSystemStatus('warning', 'GOOGLE AUTH...');
    
    const result = await signInWithPopup(auth, provider);
    
    CyberEffects.setContainerState('success');
    CyberEffects.showMessage(msg, `✅ Logged in as ${result.user.displayName}`, 'success');
    
    // Store basic info and redirect
    const uid = result.user.uid; 
    const name = result.user.displayName || result.user.email || "User";
    localStorage.setItem("userId", uid);
    localStorage.setItem("username", name);

    // Redirect based on role
    await redirectBasedOnRole(result.user);

  } catch (error) {
    CyberEffects.setContainerState('error');
    CyberEffects.updateSystemStatus('error', 'GOOGLE AUTH FAILED');
    CyberEffects.showMessage(msg, `❌ ${error.message}`, 'danger');
    console.error("Google login error:", error);
  } finally {
    googleBtn.disabled = false;
    googleBtn.innerHTML = '🔗 GOOGLE PROTOCOL';
  }
});
