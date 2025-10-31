/**
 * Shared User Utilities for OSwarrior
 * Provides consistent user data loading across all pages
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.appspot.com",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e",
};

// Initialize Firebase if not already initialized
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

/**
 * Get user display name from multiple sources with fallbacks
 * Priority: Firestore displayName -> Firestore name -> Firebase Auth displayName -> email prefix -> "Warrior"
 */
export async function getUserDisplayName(user) {
  if (!user) return "Warrior";
  
  try {
    // Try Firestore first
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      if (userData.displayName) return userData.displayName;
      if (userData.name) return userData.name;
    }
  } catch (error) {
    console.warn("Failed to fetch user data from Firestore:", error);
  }
  
  // Fallback to Firebase Auth data
  if (user.displayName) return user.displayName;
  if (user.email) return user.email.split('@')[0];
  
  return "Warrior";
}

/**
 * Get user photo URL from multiple sources with fallbacks
 * Priority: Firestore photoURL -> Firebase Auth photoURL -> default avatar
 */
export async function getUserPhotoURL(user, defaultAvatar = "image/default-profile.png") {
  if (!user) return defaultAvatar;
  
  try {
    // Try Firestore first
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      if (userData.photoURL) return userData.photoURL;
    }
  } catch (error) {
    console.warn("Failed to fetch user photo from Firestore:", error);
  }
  
  // Fallback to Firebase Auth data
  return user.photoURL || defaultAvatar;
}

/**
 * Update user profile in both Firebase Auth and Firestore
 */
export async function updateUserProfile(user, updates) {
  const { updateProfile } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js");
  const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
  
  try {
    // Update Firebase Auth if needed
    const authUpdates = {};
    if (updates.displayName !== undefined) authUpdates.displayName = updates.displayName;
    if (updates.photoURL !== undefined) authUpdates.photoURL = updates.photoURL;
    
    if (Object.keys(authUpdates).length > 0) {
      await updateProfile(user, authUpdates);
    }
    
    // Update Firestore
    const userDocRef = doc(db, "users", user.uid);
    await updateDoc(userDocRef, updates);
    
    return true;
  } catch (error) {
    console.error("Failed to update user profile:", error);
    throw error;
  }
}

/**
 * Initialize user display in navbar and other UI elements
 */
export async function initializeUserDisplay(user) {
  if (!user) return;
  
  const [displayName, photoURL] = await Promise.all([
    getUserDisplayName(user),
    getUserPhotoURL(user)
  ]);
  
  // Update navbar username
  const usernameNavbar = document.getElementById("username-navbar");
  if (usernameNavbar) usernameNavbar.textContent = displayName;
  
  // Update profile image
  const profileImg = document.getElementById("profile-img");
  if (profileImg) profileImg.src = photoURL;
  
  // Update welcome message if exists
  const usernameWelcome = document.getElementById("username");
  if (usernameWelcome) usernameWelcome.textContent = displayName;
  
  // Update player name if exists
  const playerName = document.getElementById("player-name");
  if (playerName) playerName.textContent = displayName + " 👑";
  
  return { displayName, photoURL };
}