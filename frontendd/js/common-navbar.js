// Common navbar functionality for all user pages
// This handles profile dropdown, theme toggle, and modals

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.appspot.com",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Default avatar
const DEFAULT_AVATAR = "image/default-profile.png";

/**
 * Setup profile dropdown toggle (top-right). Adds click-outside to close.
 */
function setupProfileDropdown() {
  const profileContainer = document.querySelector('.profile-container');
  const profileDropdown = document.getElementById('profile-dropdown');
  if (!profileContainer || !profileDropdown) return;

  // ensure initial state
  profileDropdown.classList.add('hidden');
  profileDropdown.classList.remove('show');

  let open = false;
  profileContainer.addEventListener('click', (ev) => {
    ev.stopPropagation();
    open = !open;
    if (open) {
      profileDropdown.classList.remove('hidden');
      // small delay to allow CSS transition if any
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

// Setup dropdown button functions
function setupDropdownButtons() {
  // Theme toggle
  const toggleThemeBtn = document.getElementById("toggle-theme");
  if (toggleThemeBtn) {
    toggleThemeBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark-theme");
      const isDark = document.body.classList.contains("dark-theme");
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });
  }
  
  // Change avatar
  const changeAvatarBtn = document.getElementById("change-avatar");
  if (changeAvatarBtn) {
    changeAvatarBtn.addEventListener("click", () => {
      const modal = document.getElementById("modal-change-avatar");
      const input = document.getElementById("input-avatar-url");
      
      if (modal && input) {
        input.value = "";
        modal.style.display = "flex";
        input.focus();
      }
    });
  }
  
  // Edit name
  const editNameBtn = document.getElementById("edit-name");
  if (editNameBtn) {
    editNameBtn.addEventListener("click", () => {
      const modal = document.getElementById("modal-edit-name");
      const input = document.getElementById("input-new-name");
      
      if (modal && input) {
        input.value = "";
        modal.style.display = "flex";
        input.focus();
      }
    });
  }
  
  // Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        localStorage.clear();
        window.location.href = "index.html";
      } catch (error) {
        console.error("Logout error:", error);
        alert("Logout failed: " + error.message);
      }
    });
  }
}

// Setup modal functionality
function setupModals() {
  // Avatar modal save
  const saveAvatarBtn = document.getElementById("save-avatar-btn");
  if (saveAvatarBtn) {
    saveAvatarBtn.addEventListener("click", async () => {
      const input = document.getElementById("input-avatar-url");
      const modal = document.getElementById("modal-change-avatar");
      
      if (input && input.value.trim() && auth.currentUser) {
        const newAvatarUrl = input.value.trim();
        const uid = auth.currentUser.uid;
        
        try {
          // Update Firebase user profile
          await updateProfile(auth.currentUser, { photoURL: newAvatarUrl });
          
          // Update Firestore if available
          try {
            await updateDoc(doc(db, "users", uid), { profileURL: newAvatarUrl });
          } catch (firestoreErr) {
            console.warn("Firestore update failed, continuing with local update:", firestoreErr);
          }
          
          // Update UI
          const profileImgs = document.querySelectorAll("#profile-img, #profile-img-navbar");
          profileImgs.forEach(img => img.src = newAvatarUrl);
          
          // Save to localStorage as backup
          localStorage.setItem("avatar", newAvatarUrl);
          
          if (modal) modal.style.display = "none";
          alert("Avatar berjaya ditukar!");
        } catch (err) {
          console.error("Avatar update error:", err);
          alert("Gagal kemaskini avatar: " + err.message);
        }
      } else {
        alert("Sila masukkan URL gambar yang sah");
      }
    });
  }
  
  // Avatar modal cancel
  const cancelAvatarBtn = document.getElementById("cancel-avatar-btn");
  if (cancelAvatarBtn) {
    cancelAvatarBtn.onclick = () => {
      const modal = document.getElementById("modal-change-avatar");
      if (modal) modal.style.display = "none";
    };
  }
  
  // Name modal save
  const saveNameBtn = document.getElementById("save-name-btn");
  if (saveNameBtn) {
    saveNameBtn.addEventListener("click", async () => {
      const input = document.getElementById("input-new-name");
      const modal = document.getElementById("modal-edit-name");
      
      if (input && input.value.trim() && auth.currentUser) {
        const newName = input.value.trim();
        const uid = auth.currentUser.uid;
        
        try {
          // Update Firebase user profile
          await updateProfile(auth.currentUser, { displayName: newName });
          
          // Update Firestore if available  
          try {
            await updateDoc(doc(db, "users", uid), { name: newName });
          } catch (firestoreErr) {
            console.warn("Firestore update failed, continuing with local update:", firestoreErr);
          }
          
          // Update all name displays in UI
          const usernameElements = document.querySelectorAll("#username-navbar, #username, #player-name, #profile-name");
          usernameElements.forEach(el => {
            if (el.id === "player-name") {
              el.textContent = newName + " 👑";
            } else {
              el.textContent = newName;
            }
          });
          
          // Save to localStorage as backup
          localStorage.setItem("displayName", newName);
          
          if (modal) modal.style.display = "none";
          alert("Nama berjaya ditukar!");
        } catch (err) {
          console.error("Name update error:", err);
          alert("Gagal kemaskini nama: " + err.message);
        }
      } else {
        alert("Sila masukkan nama yang sah");
      }
    });
  }
  
  // Name modal cancel
  const cancelNameBtn = document.getElementById("cancel-name-btn");
  if (cancelNameBtn) {
    cancelNameBtn.onclick = () => {
      const modal = document.getElementById("modal-edit-name");
      if (modal) modal.style.display = "none";
    };
  }
  
  // Close modals when clicking outside
  window.addEventListener("click", (event) => {
    const nameModal = document.getElementById("modal-edit-name");
    const avatarModal = document.getElementById("modal-change-avatar");
    
    if (event.target === nameModal) nameModal.style.display = "none";
    if (event.target === avatarModal) avatarModal.style.display = "none";
  });
}

// Auth handler
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      console.log("User not authenticated, redirecting to login");
      window.location.href = "index.html";
      return;
    }
    
    console.log("User authenticated:", user.uid, user.displayName || user.email);
    
    // Update UI with user info
    const usernameNavbar = document.getElementById("username-navbar");
    const profileImgs = document.querySelectorAll("#profile-img, #profile-img-navbar");
    
    const displayName = user.displayName || user.email?.split('@')[0] || "Warrior";
    if (usernameNavbar) usernameNavbar.textContent = displayName;
    
    profileImgs.forEach(img => {
      if (user.photoURL) {
        img.src = user.photoURL;
      }
    });
    
  } catch (err) {
    console.error("Auth handler error:", err);
  }
});

// Initialize everything when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  setupProfileDropdown();
  setupDropdownButtons();
  setupModals();
  
  // Load saved theme
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
  }
  
  // Load saved avatar
  const savedAvatar = localStorage.getItem("avatar");
  if (savedAvatar) {
    const profileImgs = document.querySelectorAll("#profile-img, #profile-img-navbar");
    profileImgs.forEach(img => img.src = savedAvatar);
  }
  
  // Load saved name
  const savedName = localStorage.getItem("displayName");
  if (savedName) {
    const usernameElements = document.querySelectorAll("#username-navbar, #username, #player-name, #profile-name");
    usernameElements.forEach(el => {
      if (el.id === "player-name") {
        el.textContent = savedName + " 👑";
      } else {
        el.textContent = savedName;
      }
    });
  }
});

// Export for global use
window.CommonNavbar = {
  setupProfileDropdown,
  setupDropdownButtons,
  setupModals
};