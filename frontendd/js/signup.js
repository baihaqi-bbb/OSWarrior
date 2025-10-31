// 🚀 Enhanced OSwarrior Registration Portal
// Advanced Firebase Integration with Cyber UI Effects

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword,
  onAuthStateChanged
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
const googleBtn = document.getElementById("su-google");
const signupBtn = document.getElementById("su-submit");
const msg = document.getElementById("su-msg");
const signupContainer = document.querySelector(".login-container");
const statusText = document.querySelector(".system-online");
const statusDot = document.querySelector(".status-dot");

// Input elements
const emailInput = document.getElementById("su-email");
const passwordInput = document.getElementById("su-password");
const confirmInput = document.getElementById("su-confirm");
const signupForm = document.getElementById("signupForm");

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
    signupContainer.classList.remove('success-state', 'error-state');
    if (state === 'success') {
      signupContainer.classList.add('success-state');
    } else if (state === 'error') {
      signupContainer.classList.add('error-state');
      signupContainer.classList.add('shake');
      setTimeout(() => {
        signupContainer.classList.remove('shake', 'error-state');
      }, 600);
    }
  }

  static updateSystemStatus(status, text) {
    if (statusText && statusDot) {
      statusText.textContent = text;
      statusDot.style.background = status === 'online' ? '#00ffff' : 
                                   status === 'warning' ? '#ffaa00' : 
                                   '#ff5252';
      statusDot.style.boxShadow = `0 0 10px ${statusDot.style.background}`;
    }
  }

  static animateButton(button) {
    button.style.transform = 'scale(0.95)';
    setTimeout(() => {
      button.style.transform = '';
    }, 150);
  }

  static validateInput(input, isValid) {
    const parent = input.parentElement;
    if (isValid) {
      parent.classList.remove('error-state');
      parent.classList.add('success-state');
    } else {
      parent.classList.remove('success-state');
      parent.classList.add('error-state');
    }
  }
}

// 🔒 Enhanced Authentication Functions
async function createUserAccount(user) {
  try {
    CyberEffects.updateSystemStatus('warning', 'SETTING UP ACCOUNT...');
    
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    let role = "user";
    
    // Check if user is admin
    if (adminEmails.includes(user.email)) {
      role = "admin";
    }

    // Create user document in Firestore
    await setDoc(userDocRef, {
      email: user.email,
      role,
      profileURL: user.photoURL || "",
      displayName: user.displayName || user.email.split('@')[0],
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      loginCount: 1
    });

    // Store user info in localStorage
    const uid = user.uid;
    const name = user.displayName || user.email || "User";
    localStorage.setItem("userId", uid);
    localStorage.setItem("username", name);
    localStorage.setItem("userRole", role);

    CyberEffects.updateSystemStatus('online', 'ACCOUNT CREATED');
    CyberEffects.showMessage(msg, `🚀 Warrior account created! Redirecting to ${role} portal...`, 'success');
    
    setTimeout(() => {
      if (role === "admin") {
        window.location.href = "home-admin.html";
      } else {
        window.location.href = "home-user.html";
      }
    }, 2000);

  } catch (error) {
    console.error("Account creation error:", error);
    CyberEffects.updateSystemStatus('error', 'SETUP ERROR');
    CyberEffects.showMessage(msg, "⚠️ Account setup failed. Please try again.", 'warning');
  }
}

// 📧 Email Validation
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 🔐 Password Validation
function validatePassword(password) {
  return password.length >= 6;
}

// 🎮 Event Listeners & Setup
document.addEventListener('DOMContentLoaded', function() {
  // Initialize system status
  CyberEffects.updateSystemStatus('online', 'REGISTRATION SYSTEM ONLINE');
  
  // Check if user is already logged in
  onAuthStateChanged(auth, (user) => {
    if (user) {
      CyberEffects.showMessage(msg, '🔄 Already logged in, redirecting...', 'warning');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    }
  });

  // Enhanced keyboard navigation
  [emailInput, passwordInput, confirmInput].forEach(input => {
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          CyberEffects.animateButton(signupBtn);
          signupForm.dispatchEvent(new Event('submit'));
        }
      });

      // Add focus effects
      input.addEventListener('focus', function() {
        this.parentElement.style.transform = 'scale(1.02)';
      });

      input.addEventListener('blur', function() {
        this.parentElement.style.transform = 'scale(1)';
      });

      // Real-time validation
      input.addEventListener('input', function() {
        if (this === emailInput) {
          CyberEffects.validateInput(this, validateEmail(this.value));
        } else if (this === passwordInput) {
          CyberEffects.validateInput(this, validatePassword(this.value));
        } else if (this === confirmInput) {
          CyberEffects.validateInput(this, this.value === passwordInput.value);
        }
      });
    }
  });
});

// 🔹 Email Registration
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmPassword = confirmInput.value.trim();

    // Validation
    if (!email || !password || !confirmPassword) {
      CyberEffects.showMessage(msg, "⚠️ Please fill in all fields.", 'warning');
      CyberEffects.animateButton(signupBtn);
      return;
    }

    if (!validateEmail(email)) {
      CyberEffects.showMessage(msg, "❌ Please enter a valid email address.", 'danger');
      CyberEffects.animateButton(signupBtn);
      emailInput.focus();
      return;
    }

    if (!validatePassword(password)) {
      CyberEffects.showMessage(msg, "❌ Password must be at least 6 characters.", 'danger');
      CyberEffects.animateButton(signupBtn);
      passwordInput.focus();
      return;
    }

    if (password !== confirmPassword) {
      CyberEffects.showMessage(msg, "❌ Passwords do not match.", 'danger');
      CyberEffects.animateButton(signupBtn);
      confirmInput.focus();
      return;
    }

    try {
      signupBtn.disabled = true;
      signupBtn.innerHTML = '🔄 CREATING ACCOUNT...';
      CyberEffects.updateSystemStatus('warning', 'REGISTERING...');
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      CyberEffects.setContainerState('success');
      CyberEffects.showMessage(msg, `✅ Welcome warrior, ${userCredential.user.email}!`, 'success');

      // Create user account in Firestore
      await createUserAccount(userCredential.user);

    } catch (error) {
      CyberEffects.setContainerState('error');
      CyberEffects.updateSystemStatus('error', 'REGISTRATION FAILED');
      
      if (error.code === 'auth/email-already-in-use') {
        CyberEffects.showMessage(msg, "❌ Email already in use. Try logging in instead.", 'danger');
      } else if (error.code === 'auth/invalid-email') {
        CyberEffects.showMessage(msg, "❌ Invalid email address.", 'danger');
      } else if (error.code === 'auth/weak-password') {
        CyberEffects.showMessage(msg, "❌ Password is too weak.", 'danger');
      } else {
        CyberEffects.showMessage(msg, `❌ ${error.message}`, 'danger');
      }
    } finally {
      signupBtn.disabled = false;
      signupBtn.innerHTML = '⚡ CREATE WARRIOR ACCOUNT';
    }
  });
}

// 🔹 Google Registration
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      googleBtn.disabled = true;
      googleBtn.innerHTML = '🔄 CONNECTING...';
      CyberEffects.updateSystemStatus('warning', 'GOOGLE AUTH...');
      
      const result = await signInWithPopup(auth, provider);
      
      CyberEffects.setContainerState('success');
      CyberEffects.showMessage(msg, `✅ Welcome warrior, ${result.user.displayName}!`, 'success');
      
      // Create user account in Firestore
      await createUserAccount(result.user);

    } catch (error) {
      CyberEffects.setContainerState('error');
      CyberEffects.updateSystemStatus('error', 'GOOGLE AUTH FAILED');
      CyberEffects.showMessage(msg, `❌ ${error.message}`, 'danger');
      console.error("Google registration error:", error);
    } finally {
      googleBtn.disabled = false;
      googleBtn.innerHTML = '🔗 GOOGLE PROTOCOL';
    }
  });
}