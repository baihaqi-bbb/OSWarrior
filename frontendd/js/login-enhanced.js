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
const forgotLink = document.querySelector(".neon-link");
const loginContainer = document.querySelector(".login-container");
const statusText = document.querySelector(".status-text");
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
    if (!element) return;
    
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
    if (!loginContainer) return;
    
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
    if (!button) return;
    
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
          if (emailBtn) emailBtn.click();
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

  // Add typing effect to matrix text
  const matrixText = document.querySelector('.matrix-text');
  if (matrixText) {
    const originalText = matrixText.textContent;
    matrixText.textContent = '';
    let i = 0;
    
    const typeWriter = () => {
      if (i < originalText.length) {
        matrixText.textContent += originalText.charAt(i);
        i++;
        setTimeout(typeWriter, 100);
      }
    };
    
    setTimeout(typeWriter, 1000);
  }
});

// 🔧 Modal Management
if (forgotLink) {
  forgotLink.addEventListener("click", (e) => {
    e.preventDefault();
    if (modal) {
      modal.style.display = "flex";
      CyberEffects.updateSystemStatus('warning', 'RECOVERY MODE');
      setTimeout(() => {
        if (resetEmail) resetEmail.focus();
      }, 300);
    }
  });
}

if (closeModal) {
  closeModal.addEventListener("click", () => {
    if (modal) {
      modal.style.display = "none";
      if (resetMsg) resetMsg.textContent = "";
      if (resetEmail) resetEmail.value = "";
      CyberEffects.updateSystemStatus('online', 'SYSTEM ONLINE');
    }
  });
}

// 🔄 Enhanced Password Reset
if (resetBtn) {
  resetBtn.addEventListener("click", async () => {
    const email = resetEmail?.value.trim();
    
    if (!email) {
      if (resetMsg) {
        resetMsg.className = "reset-message text-warning";
        resetMsg.textContent = "⚠️ Please enter your email address.";
      }
      CyberEffects.animateButton(resetBtn);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (resetMsg) {
        resetMsg.className = "reset-message text-danger";
        resetMsg.textContent = "❌ Please enter a valid email address.";
      }
      CyberEffects.animateButton(resetBtn);
      return;
    }

    try {
      resetBtn.disabled = true;
      resetBtn.innerHTML = '<span class="btn-text">🔄 SENDING...</span>';
      
      await sendPasswordResetEmail(auth, email);
      
      if (resetMsg) {
        resetMsg.className = "reset-message text-success";
        resetMsg.textContent = "✅ Recovery link sent! Check your inbox.";
      }
      
      setTimeout(() => {
        if (modal) modal.style.display = "none";
        if (resetMsg) resetMsg.textContent = "";
        if (resetEmail) resetEmail.value = "";
        CyberEffects.updateSystemStatus('online', 'SYSTEM ONLINE');
      }, 3000);
      
    } catch (error) {
      if (resetMsg) {
        resetMsg.className = "reset-message text-danger";
        if (error.code === "auth/user-not-found") {
          resetMsg.textContent = "❌ No account found with this email.";
        } else if (error.code === "auth/too-many-requests") {
          resetMsg.textContent = "⚠️ Too many requests. Please try again later.";
        } else {
          resetMsg.textContent = `❌ ${error.message}`;
        }
      }
    } finally {
      resetBtn.disabled = false;
      resetBtn.innerHTML = '<span class="btn-text">🚀 SEND RESET LINK</span>';
    }
  });
}

// 🚀 Enhanced Email/Password Login
if (emailBtn) {
  emailBtn.addEventListener("click", async () => {
    const email = emailInput?.value.trim();
    const password = passwordInput?.value.trim();

    // Input validation
    if (!email || !password) {
      CyberEffects.showMessage(msg, "⚠️ Please enter both email and password.", 'warning');
      CyberEffects.animateButton(emailBtn);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      CyberEffects.showMessage(msg, "❌ Please enter a valid email address.", 'danger');
      CyberEffects.setContainerState('error');
      return;
    }

    try {
      // Update UI for loading state
      emailBtn.disabled = true;
      emailBtn.innerHTML = '<span class="btn-text">🔄 AUTHENTICATING...</span>';
      CyberEffects.updateSystemStatus('warning', 'VERIFYING...');
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      CyberEffects.showMessage(msg, `✅ Welcome back, ${userCredential.user.email}!`, 'success');
      CyberEffects.setContainerState('success');
      
      // Redirect based on role
      await redirectBasedOnRole(userCredential.user);

    } catch (error) {
      console.error("Login error:", error);
      
      CyberEffects.setContainerState('error');
      CyberEffects.updateSystemStatus('error', 'ACCESS DENIED');
      
      // Enhanced error handling
      let errorMessage = "❌ Login failed.";
      switch (error.code) {
        case "auth/invalid-credential":
        case "auth/user-not-found":
        case "auth/wrong-password":
          errorMessage = "❌ Invalid email or password.";
          break;
        case "auth/too-many-requests":
          errorMessage = "⚠️ Too many failed attempts. Please try again later.";
          break;
        case "auth/user-disabled":
          errorMessage = "❌ This account has been disabled.";
          break;
        case "auth/network-request-failed":
          errorMessage = "🌐 Network error. Please check your connection.";
          break;
        default:
          errorMessage = `❌ ${error.message}`;
      }
      
      CyberEffects.showMessage(msg, errorMessage, 'danger');
      
      // Reset system status after error display
      setTimeout(() => {
        CyberEffects.updateSystemStatus('online', 'SYSTEM ONLINE');
      }, 3000);
      
    } finally {
      emailBtn.disabled = false;
      emailBtn.innerHTML = '<span class="btn-text">🚀 INITIALIZE LOGIN</span>';
    }
  });
}

// 🔗 Enhanced Google Authentication
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      googleBtn.disabled = true;
      googleBtn.innerHTML = '<img src="image/Google__G__logo.svg.webp" alt="Google logo" /><span class="btn-text">🔄 CONNECTING...</span>';
      CyberEffects.updateSystemStatus('warning', 'GOOGLE AUTH...');
      
      const result = await signInWithPopup(auth, provider);
      
      CyberEffects.showMessage(msg, `✅ Connected via Google: ${result.user.displayName}`, 'success');
      CyberEffects.setContainerState('success');
      
      // Redirect based on role
      await redirectBasedOnRole(result.user);
      
    } catch (error) {
      console.error("Google login error:", error);
      
      CyberEffects.setContainerState('error');
      CyberEffects.updateSystemStatus('error', 'GOOGLE AUTH FAILED');
      
      let errorMessage = "❌ Google authentication failed.";
      switch (error.code) {
        case "auth/popup-closed-by-user":
          errorMessage = "⚠️ Authentication cancelled by user.";
          break;
        case "auth/popup-blocked":
          errorMessage = "🚫 Popup blocked. Please allow popups and try again.";
          break;
        case "auth/network-request-failed":
          errorMessage = "🌐 Network error. Please check your connection.";
          break;
        default:
          errorMessage = `❌ ${error.message}`;
      }
      
      CyberEffects.showMessage(msg, errorMessage, 'danger');
      
      setTimeout(() => {
        CyberEffects.updateSystemStatus('online', 'SYSTEM ONLINE');
      }, 3000);
      
    } finally {
      googleBtn.disabled = false;
      googleBtn.innerHTML = '<img src="image/Google__G__logo.svg.webp" alt="Google logo" /><span class="btn-text">🔗 GOOGLE PROTOCOL</span>';
    }
  });
}

// 🌐 Global Error Handler
window.addEventListener('error', function(e) {
  console.error('Global error:', e);
  CyberEffects.updateSystemStatus('error', 'SYSTEM ERROR');
  setTimeout(() => {
    CyberEffects.updateSystemStatus('online', 'SYSTEM RECOVERED');
  }, 5000);
});