// ===== View Profile Script =====
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ===== Firebase Config =====
const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.appspot.com",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e"
};

// ===== Initialize Firebase =====
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const auth = getAuth(app);
const db = getFirestore(app);

// Backend API URL
const API_BASE = "https://oswarrior-backend.onrender.com";

// ===== Element UI =====
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileLevel = document.getElementById('profile-level');
const profileXP = document.getElementById('profile-xp');
const profileAchievements = document.getElementById('profile-achievements');
const profilePicture = document.getElementById('profile-picture');
const backBtn = document.querySelector('.btn-back');
const editNameBtn = document.getElementById('profile-edit-name');
const changeAvatarBtn = document.getElementById('profile-change-avatar');

// Modal Elements
const modalName = document.getElementById('modal-name');
const modalNameInput = document.getElementById('modal-name-input');
const modalNameSave = document.getElementById('modal-name-save');
const modalNameCancel = document.getElementById('modal-name-cancel');

const modalAvatar = document.getElementById('modal-avatar');
const modalAvatarInput = document.getElementById('modal-avatar-input');
const modalAvatarPreview = document.getElementById('modal-avatar-preview');
const modalAvatarSave = document.getElementById('modal-avatar-save');
const modalAvatarCancel = document.getElementById('modal-avatar-cancel');

let currentUser;

// ===== Load User Profile =====
onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = 'index.html';

  currentUser = user;
  console.log("Loading profile for user:", user.uid, user.displayName, user.email);

  // Initialize with Firebase Auth data first
  let displayName = user.displayName || user.email?.split('@')[0] || "Warrior";
  let photoURL = user.photoURL || "image/default-profile.png";
  let userDocSnap = null; // Declare in broader scope
  
  // Try to get more complete data from Firestore
  try {
    const userDocRef = doc(db, "users", user.uid);
    userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      console.log("Firestore user data:", userData);
      
      // Use Firestore data if available, fallback to Firebase Auth
      displayName = userData.name || userData.displayName || displayName;
      photoURL = userData.photoURL || userData.avatar || photoURL;
    } else {
      console.log("No Firestore document found for user");
    }
  } catch (firestoreError) {
    console.warn("Failed to fetch Firestore data:", firestoreError);
  }

  // Update UI with the best available data
  profileName.textContent = displayName;
  profileEmail.textContent = user.email || "No Email";
  profilePicture.src = photoURL;

  // Also update navbar elements if they exist
  const usernameNavbar = document.getElementById("username-navbar");
  const profileImgNavbar = document.getElementById("profile-img-navbar");
  if (usernameNavbar) usernameNavbar.textContent = displayName;
  if (profileImgNavbar) profileImgNavbar.src = photoURL;

  // Get additional data from backend API
  try {
    const res = await fetch(`${API_BASE}/api/user/${encodeURIComponent(user.uid)}`, {
      credentials: 'include'
    });
    
    if (res.ok) {
      const userData = await res.json();
      console.log("Backend user data:", userData);
      
      profileLevel.textContent = userData.level || 1;
      profileXP.textContent = userData.xp || 0;
      profileAchievements.textContent = userData.achievements?.length || 0;
      
      // Update name if available from backend and not already set from Firestore
      if (userData.name && !userDocSnap?.exists()) {
        displayName = userData.name;
        profileName.textContent = displayName;
        if (usernameNavbar) usernameNavbar.textContent = displayName;
      }
    } else {
      console.log("User not found in backend, using defaults");
      // Fallback values
      profileLevel.textContent = 1;
      profileXP.textContent = 0;
      profileAchievements.textContent = 0;
    }
  } catch (err) {
    console.error("Error getting user data from backend:", err);
    // Fallback values
    profileLevel.textContent = 1;
    profileXP.textContent = 0;
    profileAchievements.textContent = 0;
  }
});

// ===== Event Listeners =====

// Kembali ke home-user
backBtn?.addEventListener('click', () => window.location.href = 'home-user.html');

// ===== Edit Nama =====
editNameBtn?.addEventListener('click', () => {
  modalNameInput.value = profileName.textContent;
  modalName.classList.remove('hidden');
});

modalNameSave?.addEventListener('click', async () => {
  const newName = modalNameInput.value.trim();
  if (!newName) return;

  try {
    // Update Firebase Auth profile
    await updateProfile(currentUser, { displayName: newName });
    profileName.textContent = newName;

    // Update navbar if it exists
    const usernameNavbar = document.getElementById("username-navbar");
    if (usernameNavbar) usernameNavbar.textContent = newName;

    // Update or create Firestore document
    const docRef = doc(db, "users", currentUser.uid);
    try {
      await updateDoc(docRef, { name: newName });
    } catch (firestoreError) {
      // If document doesn't exist, create it
      if (firestoreError.code === 'not-found') {
        await setDoc(docRef, { 
          name: newName,
          email: currentUser.email,
          uid: currentUser.uid,
          createdAt: new Date()
        });
      } else {
        throw firestoreError;
      }
    }

    modalName.classList.add('hidden');
    alert("Nama berjaya dikemaskini!");
  } catch (err) {
    console.error("Gagal kemaskini nama:", err);
    alert("Gagal kemaskini nama. Cuba lagi.");
  }
});

modalNameCancel?.addEventListener('click', () => modalName.classList.add('hidden'));

// ===== Tukar Avatar =====
changeAvatarBtn?.addEventListener('click', () => {
  modalAvatarInput.value = profilePicture.src;
  modalAvatarPreview.src = profilePicture.src;
  modalAvatar.classList.remove('hidden');
});

modalAvatarInput?.addEventListener('input', () => {
  modalAvatarPreview.src = modalAvatarInput.value;
});

modalAvatarSave?.addEventListener('click', async () => {
  const newAvatar = modalAvatarInput.value.trim();
  if (!newAvatar) return;

  try {
    // Update Firebase Auth profile
    await updateProfile(currentUser, { photoURL: newAvatar });
    profilePicture.src = newAvatar;

    // Update navbar if it exists
    const profileImgNavbar = document.getElementById("profile-img-navbar");
    if (profileImgNavbar) profileImgNavbar.src = newAvatar;

    // Update or create Firestore document
    const docRef = doc(db, "users", currentUser.uid);
    try {
      await updateDoc(docRef, { avatar: newAvatar, photoURL: newAvatar });
    } catch (firestoreError) {
      // If document doesn't exist, create it
      if (firestoreError.code === 'not-found') {
        await setDoc(docRef, { 
          avatar: newAvatar,
          photoURL: newAvatar,
          name: currentUser.displayName || currentUser.email?.split('@')[0] || "Warrior",
          email: currentUser.email,
          uid: currentUser.uid,
          createdAt: new Date()
        });
      } else {
        throw firestoreError;
      }
    }

    modalAvatar.classList.add('hidden');
    alert("Avatar berjaya dikemaskini!");
  } catch (err) {
    console.error("Gagal tukar avatar:", err);
    alert("Gagal tukar avatar. Cuba lagi.");
  }
});

modalAvatarCancel?.addEventListener('click', () => modalAvatar.classList.add('hidden'));

// ===== Close Modal on Outside Click =====
modalName?.addEventListener('click', (e) => {
  if (e.target === modalName) {
    modalName.classList.add('hidden');
  }
});

modalAvatar?.addEventListener('click', (e) => {
  if (e.target === modalAvatar) {
    modalAvatar.classList.add('hidden');
  }
});

// ===== Close Modal on Escape Key =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!modalName.classList.contains('hidden')) {
      modalName.classList.add('hidden');
    }
    if (!modalAvatar.classList.contains('hidden')) {
      modalAvatar.classList.add('hidden');
    }
  }
});
