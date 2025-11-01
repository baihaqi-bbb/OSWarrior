// Import Firebase SDK
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ✅ Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  projectId: "test-4fdf4",
  storageBucket: "test-4fdf4.appspot.com",
  messagingSenderId: "346273796107",
  appId: "1:346273796107:web:f6fcc32860025bf406770e"
};

// ✅ Initialize Firebase only if not already initialized
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ Check login & role
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const profileImg = document.getElementById("profile-img");
    if(profileImg) profileImg.src = user.photoURL || "image/default-profile.png";

    const displayName = user.displayName || user.email?.split('@')[0] || "Warrior";
    
    // Try to get updated name from Firestore first
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      let finalDisplayName = displayName;
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const role = userData.role;
        
        // Check role access
        if (role !== "user") {
          window.location.href = "index.html";
          return;
        }
        
        // Get final display name from Firestore
        finalDisplayName = userData.displayName || userData.name || displayName;
        
        // Update profile image if available in Firestore
        if (userData.photoURL && profileImg) {
          profileImg.src = userData.photoURL;
        }
      } else {
        window.location.href = "index.html";
        return;
      }
      
      // Update navbar username with final name
      const usernameNavbar = document.getElementById("username-navbar");
      if (usernameNavbar) usernameNavbar.textContent = finalDisplayName;
      
      // Load achievements for this user
      await loadUserAchievements(user.uid);
      
    } catch (firestoreError) {
      console.warn("Firestore name fetch failed, using fallback:", firestoreError);
      
      // Fallback to original logic
      const usernameNavbar = document.getElementById("username-navbar");
      if (usernameNavbar) usernameNavbar.textContent = displayName;
      
      // Still try to load achievements
      await loadUserAchievements(user.uid);
    }

    // Show mission alert
    showMissionAlert("Welcome back! Check your achievements 🏆");
  } else {
    window.location.href = "index.html";
  }
});

// 🏆 ACHIEVEMENT SYSTEM
const achievementTypes = {
  FIRST_QUIZ: {
    id: 'first_quiz',
    title: '🎯 First Steps',
    description: 'Complete your first quiz',
    icon: '🎯',
    points: 50
  },
  PERFECT_SCORE: {
    id: 'perfect_score',
    title: '💯 Perfect Score',
    description: 'Get 100% on any quiz',
    icon: '💯',
    points: 100
  },
  SPEED_DEMON: {
    id: 'speed_demon',
    title: '⚡ Speed Demon',
    description: 'Complete a quiz in under 2 minutes',
    icon: '⚡',
    points: 75
  },
  CONSISTENT_LEARNER: {
    id: 'consistent_learner',
    title: '📚 Consistent Learner',
    description: 'Complete quizzes for 5 consecutive weeks',
    icon: '📚',
    points: 150
  },
  TOP_SCORER: {
    id: 'top_scorer',
    title: '👑 Top Scorer',
    description: 'Achieve top score in weekly leaderboard',
    icon: '👑',
    points: 200
  },
  QUIZ_MASTER: {
    id: 'quiz_master',
    title: '🎓 Quiz Master',
    description: 'Complete 10 quizzes',
    icon: '🎓',
    points: 250
  },
  PERFECTIONIST: {
    id: 'perfectionist',
    title: '⭐ Perfectionist',
    description: 'Get perfect scores on 3 different quizzes',
    icon: '⭐',
    points: 300
  },
  KNOWLEDGE_SEEKER: {
    id: 'knowledge_seeker',
    title: '🔍 Knowledge Seeker',
    description: 'Complete quizzes from all available weeks',
    icon: '🔍',
    points: 500
  }
};

async function loadUserAchievements(userId) {
  try {
    // Get user's quiz attempts to calculate achievements
    const attemptsQuery = query(
      collection(db, "attempts"), 
      where("userId", "==", userId),
      orderBy("timestamp", "desc")
    );
    
    const attemptsSnapshot = await getDocs(attemptsQuery);
    const attempts = attemptsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Calculate achievements based on attempts
    const earnedAchievements = calculateAchievements(attempts);
    
    // Display achievements
    displayAchievements(earnedAchievements, attempts.length);
    
  } catch (error) {
    console.error("Error loading achievements:", error);
    displayPlaceholderAchievements();
  }
}

function calculateAchievements(attempts) {
  const earned = [];
  
  if (attempts.length === 0) {
    return earned;
  }
  
  // First Quiz
  if (attempts.length >= 1) {
    earned.push({
      ...achievementTypes.FIRST_QUIZ,
      dateEarned: attempts[attempts.length - 1].timestamp,
      week: attempts[attempts.length - 1].week || 1
    });
  }
  
  // Perfect Score
  const perfectScores = attempts.filter(a => a.score === 100 || a.score === a.totalQuestions);
  if (perfectScores.length >= 1) {
    earned.push({
      ...achievementTypes.PERFECT_SCORE,
      dateEarned: perfectScores[0].timestamp,
      week: perfectScores[0].week || 1
    });
  }
  
  // Speed Demon (if timeSpent < 120 seconds)
  const speedAttempts = attempts.filter(a => a.timeSpent && a.timeSpent < 120);
  if (speedAttempts.length >= 1) {
    earned.push({
      ...achievementTypes.SPEED_DEMON,
      dateEarned: speedAttempts[0].timestamp,
      week: speedAttempts[0].week || 1
    });
  }
  
  // Quiz Master (10+ quizzes)
  if (attempts.length >= 10) {
    earned.push({
      ...achievementTypes.QUIZ_MASTER,
      dateEarned: attempts[9].timestamp,
      week: attempts[9].week || 10
    });
  }
  
  // Perfectionist (3+ perfect scores)
  if (perfectScores.length >= 3) {
    earned.push({
      ...achievementTypes.PERFECTIONIST,
      dateEarned: perfectScores[2].timestamp,
      week: perfectScores[2].week || 3
    });
  }
  
  // Consistent Learner (check for consecutive weeks)
  const weeklyAttempts = groupAttemptsByWeek(attempts);
  const consecutiveWeeks = findConsecutiveWeeks(weeklyAttempts);
  if (consecutiveWeeks >= 5) {
    earned.push({
      ...achievementTypes.CONSISTENT_LEARNER,
      dateEarned: attempts[0].timestamp,
      week: `${consecutiveWeeks} weeks`
    });
  }
  
  // Knowledge Seeker (attempts from multiple weeks)
  const uniqueWeeks = [...new Set(attempts.map(a => a.week).filter(w => w))];
  if (uniqueWeeks.length >= 5) {
    earned.push({
      ...achievementTypes.KNOWLEDGE_SEEKER,
      dateEarned: attempts[0].timestamp,
      week: `${uniqueWeeks.length} weeks`
    });
  }
  
  return earned;
}

function groupAttemptsByWeek(attempts) {
  const weeks = {};
  attempts.forEach(attempt => {
    if (attempt.week) {
      weeks[attempt.week] = weeks[attempt.week] || [];
      weeks[attempt.week].push(attempt);
    }
  });
  return weeks;
}

function findConsecutiveWeeks(weeklyAttempts) {
  const weeks = Object.keys(weeklyAttempts).map(w => parseInt(w)).sort((a, b) => a - b);
  let maxConsecutive = 0;
  let currentConsecutive = 1;
  
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i] === weeks[i - 1] + 1) {
      currentConsecutive++;
    } else {
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      currentConsecutive = 1;
    }
  }
  
  return Math.max(maxConsecutive, currentConsecutive);
}

function displayAchievements(achievements, totalAttempts) {
  const achievementList = document.getElementById("achievement-list");
  if (!achievementList) return;
  
  // Clear existing content
  achievementList.innerHTML = "";
  
  if (achievements.length === 0) {
    achievementList.innerHTML = `
      <div class="no-achievements">
        <h3>🎯 Start Your Journey!</h3>
        <p>Complete your first quiz to earn achievements</p>
        <a href="home-user.html" class="start-button">Take a Quiz</a>
      </div>
    `;
    return;
  }
  
  // Calculate total points
  const totalPoints = achievements.reduce((sum, ach) => sum + ach.points, 0);
  
  // Add achievements header
  const header = document.createElement("div");
  header.className = "achievements-header";
  header.innerHTML = `
    <h3>🏆 Achievements Earned: ${achievements.length}</h3>
    <p>📊 Total Quizzes: ${totalAttempts} | 💎 Points: ${totalPoints}</p>
  `;
  achievementList.appendChild(header);
  
  // Add achievement cards
  achievements.forEach((achievement, index) => {
    const card = document.createElement("div");
    card.className = "achievement-card earned";
    card.style.animationDelay = `${index * 0.2}s`;
    
    const dateStr = achievement.dateEarned ? 
      new Date(achievement.dateEarned.seconds * 1000).toLocaleDateString() : 
      new Date().toLocaleDateString();
    
    card.innerHTML = `
      <div class="achievement-icon">${achievement.icon}</div>
      <h3>${achievement.title}</h3>
      <p>${achievement.description}</p>
      <div class="achievement-details">
        <small>📅 ${dateStr}</small>
        <small>🏷️ Week: ${achievement.week}</small>
        <small>💎 ${achievement.points} points</small>
      </div>
    `;
    
    achievementList.appendChild(card);
  });
  
  // Add locked achievements preview
  const lockedAchievements = Object.values(achievementTypes).filter(
    type => !achievements.some(earned => earned.id === type.id)
  );
  
  if (lockedAchievements.length > 0) {
    const lockedHeader = document.createElement("div");
    lockedHeader.className = "locked-header";
    lockedHeader.innerHTML = `<h3>🔒 Locked Achievements</h3>`;
    achievementList.appendChild(lockedHeader);
    
    lockedAchievements.forEach((locked, index) => {
      const card = document.createElement("div");
      card.className = "achievement-card locked";
      card.style.animationDelay = `${(achievements.length + index) * 0.2}s`;
      
      card.innerHTML = `
        <div class="achievement-icon locked-icon">🔒</div>
        <h3>${locked.title}</h3>
        <p>${locked.description}</p>
        <div class="achievement-details">
          <small>💎 ${locked.points} points</small>
        </div>
      `;
      
      achievementList.appendChild(card);
    });
  }
}

function displayPlaceholderAchievements() {
  const achievementList = document.getElementById("achievement-list");
  if (!achievementList) return;
  
  achievementList.innerHTML = `
    <div class="achievement-card">
      <div class="achievement-icon">🎯</div>
      <h3>Getting Started...</h3>
      <p>Complete your first quiz to unlock achievements!</p>
      <div class="achievement-details">
        <small>📅 Ready to start</small>
      </div>
    </div>
  `;
}

//  Mission Alert
function showMissionAlert(message, icon = "🏆") {
  const alertBox = document.getElementById("mission-alert");
  const text = document.getElementById("mission-text");
  const iconBox = document.getElementById("mission-icon");

  if(!alertBox || !text || !iconBox) return;

  text.textContent = message;
  iconBox.textContent = icon;
  alertBox.classList.remove("hidden");

  setTimeout(() => alertBox.classList.add("show"), 10);
  setTimeout(() => hideMissionAlert(), 5000);
}

function hideMissionAlert() {
  const alertBox = document.getElementById("mission-alert");
  if(!alertBox) return;
  alertBox.classList.remove("show");
  setTimeout(() => alertBox.classList.add("hidden"), 400);
}

const missionClose = document.getElementById("mission-close");
if(missionClose) missionClose.addEventListener("click", hideMissionAlert);

// === Profile Dropdown ===
const profileContainer = document.querySelector(".profile-container");
const profileDropdown = document.getElementById("profile-dropdown");

let dropdownOpen = false;

if(profileContainer) {
  profileContainer.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dropdownOpen) {
      profileDropdown.classList.remove("show");
      setTimeout(() => profileDropdown.classList.add("hidden"), 300);
    } else {
      profileDropdown.classList.remove("hidden");
      setTimeout(() => profileDropdown.classList.add("show"), 10);
    }
    dropdownOpen = !dropdownOpen;
  });

  document.addEventListener("click", (e) => {
    if (dropdownOpen && !profileContainer.contains(e.target)) {
      profileDropdown.classList.remove("show");
      setTimeout(() => profileDropdown.classList.add("hidden"), 300);
      dropdownOpen = false;
    }
  });
}

// PROFILE DROPDOWN BUTTONS
const viewProfileBtn = document.getElementById("view-profile");
if(viewProfileBtn) viewProfileBtn.addEventListener("click", () => window.location.href="profile.html");

const viewAchievementsBtn = document.getElementById("view-achievements");
if(viewAchievementsBtn) viewAchievementsBtn.addEventListener("click", () => window.location.href="achievements.html");

const toggleThemeBtn = document.getElementById("toggle-theme");
if(toggleThemeBtn) toggleThemeBtn.addEventListener("click", () => document.body.classList.toggle("dark-mode"));

const changeAvatarBtn = document.getElementById("change-avatar");
if(changeAvatarBtn) changeAvatarBtn.addEventListener("click", () => alert("🚧 Feature coming soon: Avatar changer!"));

const editNameBtn = document.getElementById("edit-name");
if(editNameBtn) editNameBtn.addEventListener("click", async () => {
  const newName = prompt("Masukkan nama baru:");
  if(newName && newName.trim() && auth.currentUser) {
    const trimmedName = newName.trim();
    const uid = auth.currentUser.uid;
    
    try {
      // Update Firebase user profile
      await updateProfile(auth.currentUser, { displayName: trimmedName });
      
      // Update Firestore document
      const userDocRef = doc(db, "users", uid);
      await updateDoc(userDocRef, { 
        displayName: trimmedName,
        name: trimmedName 
      });
      
      // Update UI immediately
      const usernameNavbar = document.getElementById("username-navbar");
      if(usernameNavbar) usernameNavbar.textContent = trimmedName;
      
      alert("✅ Nama berjaya dikemaskini!");
      
    } catch (error) {
      console.error("Error updating name:", error);
      alert("❌ Gagal mengemas kini nama: " + error.message);
    }
  }
});

// LOGOUT
const logoutBtn = document.getElementById("logout-btn");
if(logoutBtn) logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("❌ Logout error:", error);
    alert("Gagal logout: " + error.message);
  }
});
