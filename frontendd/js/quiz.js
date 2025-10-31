import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { initializeUserDisplay } from "./user-utils.js";

const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.appspot.com",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e",
};

// Initialize Firebase only if not already initialized
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const auth = getAuth(app);
const db = getFirestore(app);

// use existing image file as default avatar (restore previous behaviour)
const DEFAULT_AVATAR = "image/default-profile.png";

let currentUser = null;

// Helpers
function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Setup profile dropdown toggle (consistent with home page)
 */
function setupProfileDropdown() {
  const profileContainer = document.querySelector('.profile-container');
  const profileDropdown = document.getElementById('profile-dropdown');
  if (!profileContainer || !profileDropdown) return;

  // ensure initial state
  profileDropdown.classList.add('hidden');
  profileDropdown.classList.remove('show');

  // Function to position dropdown correctly
  function positionDropdown() {
    const rect = profileContainer.getBoundingClientRect();
    profileDropdown.style.position = 'fixed';
    profileDropdown.style.top = (rect.bottom + 5) + 'px';
    profileDropdown.style.right = '20px';
    profileDropdown.style.left = 'auto';
  }

  let open = false;
  profileContainer.addEventListener('click', (ev) => {
    ev.stopPropagation();
    open = !open;
    if (open) {
      positionDropdown(); // Calculate position before showing
      profileDropdown.classList.remove('hidden');
      profileDropdown.classList.add('show');
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

/**
 * Setup week card interactions with enhanced effects
 */
function setupWeekCards() {
  document.querySelectorAll(".week-card").forEach((card, index) => {
    // Stagger animation delays
    card.style.animationDelay = `${index * 0.1}s`;
    
    card.addEventListener("click", () => {
      const week = card.dataset.week;
      if (currentUser && week) {
        // Add click effect
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
          card.style.transform = '';
          window.location.href = `take-quiz.html?week=${week}`;
        }, 150);
      }
    });

    // Add hover sound effect (optional)
    card.addEventListener('mouseenter', () => {
      // You can add audio feedback here if needed
      card.style.boxShadow = `
        0 15px 35px rgba(0, 0, 0, 0.6),
        0 0 30px rgba(0, 255, 255, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.1)
      `;
    });

    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = '';
    });
  });
}

/**
 * Setup modal functionality for profile settings
 */
function setupModals() {
  // Edit Name Modal
  const editNameBtn = document.getElementById('edit-name');
  const modalEditName = document.getElementById('modal-edit-name');
  const inputNewName = document.getElementById('input-new-name');
  const saveNameBtn = document.getElementById('save-name-btn');
  const cancelNameBtn = document.getElementById('cancel-name-btn');

  if (editNameBtn && modalEditName) {
    editNameBtn.addEventListener('click', () => {
      modalEditName.style.display = 'flex';
      inputNewName.value = currentUser?.displayName || '';
      inputNewName.focus();
    });

    cancelNameBtn?.addEventListener('click', () => {
      modalEditName.style.display = 'none';
    });

    saveNameBtn?.addEventListener('click', async () => {
      const newName = inputNewName.value.trim();
      if (!newName || !currentUser) return;

      try {
        await updateProfile(currentUser, { displayName: newName });
        await updateDoc(doc(db, "users", currentUser.uid), { displayName: newName });
        
        document.getElementById('username-navbar').textContent = newName;
        modalEditName.style.display = 'none';
        
        // Show success feedback
        showNotification('✅ Name updated successfully!', 'success');
      } catch (error) {
        console.error('Error updating name:', error);
        showNotification('❌ Failed to update name', 'error');
      }
    });
  }

  // Change Avatar Modal
  const changeAvatarBtn = document.getElementById('change-avatar');
  const modalChangeAvatar = document.getElementById('modal-change-avatar');
  const inputAvatarUrl = document.getElementById('input-avatar-url');
  const saveAvatarBtn = document.getElementById('save-avatar-btn');
  const cancelAvatarBtn = document.getElementById('cancel-avatar-btn');

  if (changeAvatarBtn && modalChangeAvatar) {
    changeAvatarBtn.addEventListener('click', () => {
      modalChangeAvatar.style.display = 'flex';
      inputAvatarUrl.value = currentUser?.photoURL || '';
      inputAvatarUrl.focus();
    });

    cancelAvatarBtn?.addEventListener('click', () => {
      modalChangeAvatar.style.display = 'none';
    });

    saveAvatarBtn?.addEventListener('click', async () => {
      const newAvatarUrl = inputAvatarUrl.value.trim();
      if (!currentUser) return;

      try {
        const photoURL = newAvatarUrl || DEFAULT_AVATAR;
        await updateProfile(currentUser, { photoURL });
        await updateDoc(doc(db, "users", currentUser.uid), { photoURL });
        
        document.getElementById('profile-img').src = photoURL;
        modalChangeAvatar.style.display = 'none';
        
        showNotification('✅ Avatar updated successfully!', 'success');
      } catch (error) {
        console.error('Error updating avatar:', error);
        showNotification('❌ Failed to update avatar', 'error');
      }
    });
  }

  // Close modals when clicking outside
  [modalEditName, modalChangeAvatar].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    }
  });
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-family: 'Orbitron', monospace;
    font-weight: 600;
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
    background: ${type === 'success' ? 'linear-gradient(45deg, #00ff88, #00cc66)' : 
                type === 'error' ? 'linear-gradient(45deg, #ff0066, #cc0044)' : 
                'linear-gradient(45deg, #0088ff, #0066cc)'};
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Initialize page
 */
document.addEventListener("DOMContentLoaded", () => {
  const profileImg = document.getElementById("profile-img");
  const usernameNavbar = document.getElementById("username-navbar");

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    
    currentUser = user;

    // Check role from Firestore and get updated user data
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists() || userDoc.data().role !== "user") {
        window.location.href = "index.html";
        return;
      }
      
      // Initialize user display consistently
      await initializeUserDisplay(user);
      
    } catch (error) {
      console.error('Error checking user role:', error);
      // Initialize with fallback data
      await initializeUserDisplay(user);
    }
  });

  // Setup all functionality
  setupProfileDropdown();
  setupWeekCards();
  setupModals();

  // Logout functionality
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        showNotification('👋 Logged out successfully!', 'success');
        setTimeout(() => {
          window.location.href = "index.html";
        }, 1000);
      } catch (error) {
        console.error('Error logging out:', error);
        showNotification('❌ Error logging out', 'error');
      }
    });
  }

  // Theme toggle (placeholder)
  const themeToggle = document.getElementById('toggle-theme');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      showNotification('🌗 Theme toggle coming soon!', 'info');
    });
  }

  // Navigation links
  const viewProfile = document.getElementById('view-profile');
  const viewAchievements = document.getElementById('view-achievements');
  
  if (viewProfile) {
    viewProfile.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'profile.html';
    });
  }
  
  if (viewAchievements) {
    viewAchievements.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'achievement.html';
    });
  }
});

// Add notification animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
