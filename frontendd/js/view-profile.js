// ===== View Profile Script =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== Element UI =====
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileLevel = document.getElementById('profile-level');
const profileXP = document.getElementById('profile-xp');
const profileAchievements = document.getElementById('profile-achievements');
const profilePicture = document.getElementById('profile-picture');
const backBtn = document.querySelector('.btn-back');
const editNameBtn = document.getElementById('edit-name');
const changeAvatarBtn = document.getElementById('change-avatar');

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

  // Update UI dari Firebase Auth
  profileName.textContent = user.displayName || "Nama Tidak Ditetapkan";
  profileEmail.textContent = user.email || "Tiada Email";
  profilePicture.src = user.photoURL || "image/default-profile.png";

  // Ambil data level, XP, achievements dari Firestore
  try {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      profileLevel.textContent = data.level || 0;
      profileXP.textContent = data.xp || 0;
      profileAchievements.textContent = data.achievements?.length || 0;
    }
  } catch (err) {
    console.error("Error ambil data Firestore:", err);
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
    await updateProfile(currentUser, { displayName: newName });
    profileName.textContent = newName;

    const docRef = doc(db, "users", currentUser.uid);
    await updateDoc(docRef, { name: newName });

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
    await updateProfile(currentUser, { photoURL: newAvatar });
    profilePicture.src = newAvatar;

    const docRef = doc(db, "users", currentUser.uid);
    await updateDoc(docRef, { avatar: newAvatar });

    modalAvatar.classList.add('hidden');
    alert("Avatar berjaya dikemaskini!");
  } catch (err) {
    console.error("Gagal tukar avatar:", err);
    alert("Gagal tukar avatar. Cuba lagi.");
  }
});

modalAvatarCancel?.addEventListener('click', () => modalAvatar.classList.add('hidden'));
