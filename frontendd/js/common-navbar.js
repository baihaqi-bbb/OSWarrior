// Common navbar functionality for all user pages
// This handles profile dropdown, theme toggle, and modals

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

// Default avatar
const DEFAULT_AVATAR = "image/default-profile.png";

/**
 * Setup profile dropdown toggle (top-right). Adds click-outside to close.
 */
function setupProfileDropdown() {
  const profileContainer = document.querySelector('.profile-container');
  const profileDropdown = document.getElementById('profile-dropdown');
  
  if (!profileContainer || !profileDropdown) {
    console.warn("Profile dropdown elements not found:", { profileContainer: !!profileContainer, profileDropdown: !!profileDropdown });
    return;
  }

  console.log("Setting up profile dropdown...");

  // Ensure initial state
  profileDropdown.classList.add('hidden');
  profileDropdown.classList.remove('show');

  let open = false;

  // Profile container click handler
  profileContainer.addEventListener('click', (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    
    console.log("Profile container clicked, current state:", open);
    
    open = !open;
    if (open) {
      profileDropdown.classList.remove('hidden');
      // Small delay to allow CSS transition if any
      setTimeout(() => {
        profileDropdown.classList.add('show');
        console.log("Dropdown should now be visible");
      }, 10);
    } else {
      profileDropdown.classList.remove('show');
      setTimeout(() => {
        profileDropdown.classList.add('hidden');
        console.log("Dropdown hidden");
      }, 200);
    }
  });

  // Click outside closes dropdown
  document.addEventListener('click', (ev) => {
    if (!open) return;
    if (!profileContainer.contains(ev.target)) {
      console.log("Clicked outside, closing dropdown");
      open = false;
      profileDropdown.classList.remove('show');
      setTimeout(() => profileDropdown.classList.add('hidden'), 200);
    }
  });

  // Keyboard: Esc closes
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && open) {
      console.log("Escape pressed, closing dropdown");
      open = false;
      profileDropdown.classList.remove('show');
      setTimeout(() => profileDropdown.classList.add('hidden'), 200);
    }
  });

  console.log("Profile dropdown setup complete");
}

// Setup dropdown button functions
function setupDropdownButtons() {
  let uploadedAvatarData = null; // Store uploaded image data
  
  // Change avatar
  const changeAvatarBtn = document.getElementById("change-avatar");
  if (changeAvatarBtn) {
    changeAvatarBtn.addEventListener("click", () => {
      const modal = document.getElementById("modal-change-avatar");
      const input = document.getElementById("input-avatar-url");
      const fileInput = document.getElementById("input-avatar-file");
      const previewContainer = document.getElementById("avatar-preview-container");
      
      if (modal && input) {
        input.value = "";
        if (fileInput) fileInput.value = "";
        if (previewContainer) previewContainer.style.display = "none";
        uploadedAvatarData = null;
        modal.style.display = "flex";
        input.focus();
      }
    });
  }
  
  // Handle upload button click
  const uploadBtn = document.getElementById("upload-from-device");
  const fileInput = document.getElementById("input-avatar-file");
  
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => {
      fileInput.click();
    });
  }
  
  // Handle file upload with compression
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          // Compress image before storing
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Resize to max 300x300 for avatar
            const maxSize = 300;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
              if (width > maxSize) {
                height *= maxSize / width;
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width *= maxSize / height;
                height = maxSize;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to compressed JPEG
            uploadedAvatarData = canvas.toDataURL('image/jpeg', 0.7);
            
            console.log(`✅ Image compressed: ${Math.round(uploadedAvatarData.length / 1024)}KB`);
            
            // Show preview
            const previewImg = document.getElementById("avatar-preview-img");
            const previewContainer = document.getElementById("avatar-preview-container");
            if (previewImg && previewContainer) {
              previewImg.src = uploadedAvatarData;
              previewContainer.style.display = "block";
            }
            
            // Clear URL input
            const urlInput = document.getElementById("input-avatar-url");
            if (urlInput) urlInput.value = "";
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        alert("Please select a valid image file!");
      }
    });
  }
  
  // Avatar modal save with upload support
  const saveAvatarBtn = document.getElementById("save-avatar-btn");
  if (saveAvatarBtn) {
    saveAvatarBtn.addEventListener("click", async () => {
      const input = document.getElementById("input-avatar-url");
      const modal = document.getElementById("modal-change-avatar");
      
      if (!auth.currentUser) {
        alert("User not authenticated!");
        return;
      }
      
      const uid = auth.currentUser.uid;
      let newAvatarUrl = null;
      
      try {
        // Priority: URL input > uploaded file
        if (input && input.value.trim()) {
          newAvatarUrl = input.value.trim();
          console.log("💾 Using URL from input:", newAvatarUrl);
        } else if (uploadedAvatarData) {
          // For uploaded files, save to localStorage
          console.log("💾 Saving uploaded image to localStorage...");
          localStorage.setItem("avatar", uploadedAvatarData);
          
          // Update UI directly
          const profileImgs = document.querySelectorAll("#profile-img, #profile-img-navbar");
          profileImgs.forEach(img => {
            if (img) img.src = uploadedAvatarData;
          });
          
          // Clear Firebase photoURL
          try {
            await updateProfile(auth.currentUser, { photoURL: null });
          } catch (e) {
            console.warn("Could not clear Firebase photoURL:", e);
          }
          
          if (modal) modal.style.display = "none";
          uploadedAvatarData = null;
          alert("✅ Avatar berjaya ditukar!");
          return;
        }
        
        if (newAvatarUrl) {
          console.log("💾 Updating Firebase profile with URL:", newAvatarUrl);
          
          // Update Firebase user profile
          await updateProfile(auth.currentUser, { photoURL: newAvatarUrl });
          
          // Update Firestore
          try {
            await updateDoc(doc(db, "users", uid), { photoURL: newAvatarUrl });
          } catch (firestoreErr) {
            console.warn("Firestore update failed:", firestoreErr);
          }
          
          // Update UI
          const profileImgs = document.querySelectorAll("#profile-img, #profile-img-navbar");
          profileImgs.forEach(img => {
            if (img) img.src = newAvatarUrl;
          });
          
          // Save to localStorage
          localStorage.setItem("avatar", newAvatarUrl);
          
          if (modal) modal.style.display = "none";
          uploadedAvatarData = null;
          alert("✅ Avatar berjaya ditukar!");
        } else {
          alert("Sila masukkan URL gambar atau pilih gambar dari device");
        }
      } catch (err) {
        console.error("❌ Avatar update error:", err);
        alert("Gagal kemaskini avatar: " + err.message);
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
    
    let displayName = user.displayName || user.email?.split('@')[0] || "Warrior";
    let photoURL = user.photoURL || DEFAULT_AVATAR;
    
    // PRIORITY 1: Check localStorage for uploaded avatar (base64)
    const savedAvatar = localStorage.getItem("avatar");
    if (savedAvatar && savedAvatar.startsWith('data:image')) {
      photoURL = savedAvatar;
      console.log("✅ Using uploaded avatar from localStorage");
    }
    
    // PRIORITY 2: Try to get additional user data from Firestore
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        console.log("Firestore user data found:", userData);
        
        // Use Firestore data if available (but localStorage uploaded image takes priority)
        displayName = userData.name || userData.displayName || displayName;
        if (!savedAvatar || !savedAvatar.startsWith('data:image')) {
          photoURL = userData.photoURL || userData.avatar || photoURL;
        }
      }
    } catch (firestoreError) {
      console.warn("Failed to fetch Firestore user data:", firestoreError);
    }
    
    // Update UI with user info
    const usernameNavbar = document.getElementById("username-navbar");
    const profileImgs = document.querySelectorAll("#profile-img, #profile-img-navbar");
    
    if (usernameNavbar) {
      usernameNavbar.textContent = displayName;
      console.log("Updated username display to:", displayName);
    }
    
    profileImgs.forEach((img, index) => {
      if (img) {
        img.src = photoURL;
        console.log(`Updated profile image ${index + 1} to:`, photoURL);
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