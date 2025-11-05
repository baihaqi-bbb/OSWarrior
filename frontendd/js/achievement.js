// Import Firebase SDK
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

// 🏆 COMPREHENSIVE ACHIEVEMENT SYSTEM
const achievementTypes = {
  // 📚 BEGINNER ACHIEVEMENTS
  FIRST_STEPS: {
    id: 'first_steps',
    title: '🎯 First Steps',
    description: 'Complete your first quiz',
    icon: '🎯',
    points: 50,
    tier: 'bronze'
  },
  QUICK_LEARNER: {
    id: 'quick_learner',
    title: '⚡ Quick Learner',
    description: 'Complete quiz in under 50 seconds with 80%+ score',
    icon: '⚡',
    points: 25,
    tier: 'bronze'
  },
  KNOWLEDGE_SEEKER: {
    id: 'knowledge_seeker',
    title: '📖 Knowledge Seeker',
    description: 'Complete 3 quizzes',
    icon: '📖',
    points: 75,
    tier: 'bronze'
  },

  // 💯 PERFORMANCE ACHIEVEMENTS
  PERFECT_SCORE: {
    id: 'perfect_score',
    title: '🎖️ Perfect Score',
    description: 'Get 100% on any quiz',
    icon: '🎖️',
    points: 100,
    tier: 'silver'
  },
  HAT_TRICK: {
    id: 'hat_trick',
    title: '🔥 Hat Trick',
    description: 'Score 100% on 3 different quizzes',
    icon: '🔥',
    points: 200,
    tier: 'silver'
  },
  PERFECTIONIST: {
    id: 'perfectionist',
    title: '🏅 Perfectionist',
    description: 'Score 100% on 5 different quizzes',
    icon: '🏅',
    points: 350,
    tier: 'gold'
  },
  ELITE_SCORER: {
    id: 'elite_scorer',
    title: '⭐ Elite Scorer',
    description: 'Maintain 90%+ average across 5 quizzes',
    icon: '⭐',
    points: 300,
    tier: 'gold'
  },

  // ⚡ SPEED ACHIEVEMENTS
  SPEED_DEMON: {
    id: 'speed_demon',
    title: '🚀 Speed Demon',
    description: 'Complete quiz in under 2 minutes with 70%+ score',
    icon: '🚀',
    points: 150,
    tier: 'silver'
  },
  LIGHTNING_FAST: {
    id: 'lightning_fast',
    title: '⌛ Lightning Fast',
    description: 'Complete quiz in under 1 minute with 60%+ score',
    icon: '⌛',
    points: 250,
    tier: 'gold'
  },
  RUSH_HOUR: {
    id: 'rush_hour',
    title: '🏃 Rush Hour',
    description: 'Complete quiz in under 75 seconds with 70%+ score',
    icon: '🏃',
    points: 200,
    tier: 'silver'
  },

  // 📅 CONSISTENCY ACHIEVEMENTS
  CONSISTENT_LEARNER: {
    id: 'consistent_learner',
    title: '📚 Consistent Learner',
    description: 'Complete quizzes for 3 consecutive weeks',
    icon: '📚',
    points: 200,
    tier: 'silver'
  },
  WEEKLY_WARRIOR: {
    id: 'weekly_warrior',
    title: '🎯 Weekly Warrior',
    description: 'Complete quizzes for 5 consecutive weeks',
    icon: '🎯',
    points: 400,
    tier: 'gold'
  },
  QUIZ_MASTER: {
    id: 'quiz_master',
    title: '👑 Quiz Master',
    description: 'Complete 10 quizzes total',
    icon: '👑',
    points: 300,
    tier: 'gold'
  },
  SCHOLAR: {
    id: 'scholar',
    title: '🎓 Scholar',
    description: 'Complete 25 quizzes total',
    icon: '🎓',
    points: 500,
    tier: 'platinum'
  },

  // 🌟 MASTERY ACHIEVEMENTS
  KNOWLEDGE_EXPLORER: {
    id: 'knowledge_explorer',
    title: '🧠 Knowledge Explorer',
    description: 'Complete quizzes from 5 different weeks',
    icon: '🧠',
    points: 300,
    tier: 'gold'
  },
  QUIZ_CONQUEROR: {
    id: 'quiz_conqueror',
    title: '🌍 Quiz Conqueror',
    description: 'Complete all available week quizzes',
    icon: '🌍',
    points: 600,
    tier: 'platinum'
  },
  DIAMOND_LEAGUE: {
    id: 'diamond_league',
    title: '💎 Diamond League',
    description: 'Achieve top 3 in leaderboard',
    icon: '💎',
    points: 750,
    tier: 'diamond'
  },
  QUIZ_EMPEROR: {
    id: 'quiz_emperor',
    title: '👑 Quiz Emperor',
    description: 'Complete 50 quizzes',
    icon: '👑',
    points: 1000,
    tier: 'diamond'
  },

  // 🎊 SPECIAL ACHIEVEMENTS
  LUCKY_STRIKE: {
    id: 'lucky_strike',
    title: '🎲 Lucky Strike',
    description: 'Score 100% on your very first quiz attempt',
    icon: '🎲',
    points: 100,
    tier: 'silver'
  },
  SECOND_CHANCE: {
    id: 'second_chance',
    title: '🔄 Second Chance',
    description: 'Improve score by 20%+ when retaking same week quiz',
    icon: '🔄',
    points: 75,
    tier: 'bronze'
  },
  ACCURACY_EXPERT: {
    id: 'accuracy_expert',
    title: '🎯 Accuracy Expert',
    description: 'Maintain 95%+ accuracy over 10 quizzes',
    icon: '🎯',
    points: 400,
    tier: 'gold'
  },
  TIME_MASTER: {
    id: 'time_master',
    title: '⏰ Time Master',
    description: 'Complete 10 quizzes under 3 minutes with 70%+ score',
    icon: '⏰',
    points: 350,
    tier: 'gold'
  }
};

// Backend API URL (same as quiz system)
const API_BASE = "https://oswarrior-backend.onrender.com";

async function loadUserAchievements(userId) {
  try {
    console.log("=== ACHIEVEMENT SYSTEM DEBUG ===");
    console.log("Loading achievements for user:", userId);
    
    // PRIORITY 1: Query Firestore results collection directly (most accurate)
    let attempts = [];
    let foundData = false;
    
    try {
      console.log("🔍 Querying Firestore results collection...");
      const resultsQuery = query(
        collection(db, "results"),
        where("userId", "==", userId)
      );
      
      const resultsSnapshot = await getDocs(resultsQuery);
      console.log(`📊 Firestore query found ${resultsSnapshot.size} results`);
      
      if (!resultsSnapshot.empty) {
        resultsSnapshot.forEach(doc => {
          const result = doc.data();
          attempts.push({
            score: Number(result.score || 0),
            totalQuestions: Number(result.total || result.totalQuestions || 10),
            timeSpent: Number(result.timeSpent || result.duration || 0),
            week: Number(result.week || result.weekNumber || 1),
            timestamp: result.createdAt || result.timestamp || Date.now(),
            source: 'firestore_results'
          });
        });
        foundData = true;
        console.log(`✅ Loaded ${attempts.length} attempts from Firestore`);
      }
    } catch (firestoreError) {
      console.warn("⚠️ Firestore query failed:", firestoreError);
    }
    
    // FALLBACK: Try backend API endpoints if Firestore query fails
    if (!foundData) {
      console.log("⚠️ No Firestore data, trying backend endpoints...");
      const endpoints = [
        `${API_BASE}/api/user/${encodeURIComponent(userId)}`,
        `${API_BASE}/api/user/${encodeURIComponent(userId)}/stats`,
        `${API_BASE}/api/user/${encodeURIComponent(userId)}/attempts`,
        `${API_BASE}/api/users/${encodeURIComponent(userId)}`,
      ];
      
      for (const endpoint of endpoints) {
        try {
          console.log("Trying endpoint:", endpoint);
          const response = await fetch(endpoint, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          console.log("Response status:", response.status, "for", endpoint);
          
          if (response.ok) {
            const data = await response.json();
            console.log("Response data:", data);
            
            // Try to extract attempts from different possible data structures
            if (data) {
              if (data.attempts && Array.isArray(data.attempts)) {
                attempts = attempts.concat(data.attempts);
                foundData = true;
              }
              if (data.quizzes && Array.isArray(data.quizzes)) {
                attempts = attempts.concat(data.quizzes);
                foundData = true;
              }
              if (data.quizAttempts && Array.isArray(data.quizAttempts)) {
                attempts = attempts.concat(data.quizAttempts);
                foundData = true;
              }
              if (data.submissions && Array.isArray(data.submissions)) {
                attempts = attempts.concat(data.submissions);
                foundData = true;
              }
            }
          }
        } catch (endpointError) {
          console.warn("Endpoint failed:", endpoint, endpointError.message);
        }
      }
    }
    
    console.log("Total attempts found:", attempts.length);
    console.log("Found data:", foundData);
    console.log("Attempts array:", attempts);
    
    // If user has completed quizzes but we can't access the data, create a basic achievement
    if (!foundData || attempts.length === 0) {
      console.log("No backend data found - checking if user should have achievements");
      
      // Since you've mentioned completing quizzes, let's create a basic achievement for testing
      // This is temporary until the backend data sync is working properly
      const testAchievement = confirm("You mentioned completing quizzes but no data was found. Would you like to see how achievements work with test data?");
      
      if (testAchievement) {
        attempts = [
          {
            score: 100,
            totalQuestions: 10,
            timeSpent: 95,
            week: 1,
            timestamp: { seconds: Date.now() / 1000 - 86400 },
            source: 'manual_test'
          }
        ];
        console.log("Created test achievement data");
      } else {
        displayPlaceholderAchievements();
        return;
      }
    }
    
    // Calculate achievements based on attempts
    console.log("Calculating achievements...");
    const earnedAchievements = calculateAchievements(attempts);
    console.log("Earned achievements:", earnedAchievements);
    
    // Display achievements
    console.log("Displaying achievements...");
    displayAchievements(earnedAchievements, attempts.length);
    console.log("Display function completed");
    
  } catch (error) {
    console.error("Error loading achievements:", error);
    displayPlaceholderAchievements();
  }
}

function calculateAchievements(attempts) {
  const earned = [];
  
  if (!attempts || attempts.length === 0) {
    console.log("No attempts to calculate achievements from");
    return earned;
  }

  console.log("Calculating achievements for", attempts.length, "attempts:", attempts);

  // Normalize attempts data - handle different backend formats
  const normalizedAttempts = attempts.map(attempt => {
    // Handle different timestamp formats
    let timestamp = attempt.timestamp;
    if (typeof timestamp === 'string') {
      timestamp = { seconds: new Date(timestamp).getTime() / 1000 };
    } else if (timestamp instanceof Date) {
      timestamp = { seconds: timestamp.getTime() / 1000 };
    } else if (typeof timestamp === 'number') {
      timestamp = { seconds: timestamp };
    }
    
    // Normalize score data
    let score = attempt.score || 0;
    let totalQuestions = attempt.totalQuestions || attempt.total || 0;
    let timeSpent = attempt.timeSpent || attempt.duration || 0;
    let week = attempt.week || attempt.weekNumber || 1;
    
    // Calculate percentage if needed
    let percentage = score;
    if (totalQuestions > 0 && score <= totalQuestions) {
      percentage = (score / totalQuestions) * 100;
    }
    
    return {
      ...attempt,
      timestamp,
      score: percentage, // Use percentage for consistency
      totalQuestions,
      timeSpent,
      week
    };
  });

  // Sort attempts by timestamp for proper calculation
  normalizedAttempts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  
  console.log("Normalized attempts:", normalizedAttempts);

  // 📚 BEGINNER ACHIEVEMENTS
  
  // First Steps - Complete first quiz
  if (normalizedAttempts.length >= 1) {
    earned.push({
      ...achievementTypes.FIRST_STEPS,
      dateEarned: normalizedAttempts[normalizedAttempts.length - 1].timestamp,
      week: normalizedAttempts[normalizedAttempts.length - 1].week || 1
    });
  }
  
  // Quick Learner - Answer under 5 seconds per question on average with good score (10 questions × 5s = 50s total, need 80%+)
  const quickAnswers = normalizedAttempts.filter(a => {
    // Calculate percentage correctly
    const percentage = a.totalQuestions > 0 && a.score <= a.totalQuestions 
      ? (a.score / a.totalQuestions) * 100 
      : a.score;
    return percentage >= 80 && a.timeSpent > 0 && a.timeSpent < 50;
  });
  if (quickAnswers.length >= 1) {
    earned.push({
      ...achievementTypes.QUICK_LEARNER,
      dateEarned: quickAnswers[0].timestamp,
      week: quickAnswers[0].week || 1
    });
  }
  
  // Knowledge Seeker - Complete 3 quizzes
  if (normalizedAttempts.length >= 3) {
    earned.push({
      ...achievementTypes.KNOWLEDGE_SEEKER,
      dateEarned: normalizedAttempts[2].timestamp,
      week: normalizedAttempts[2].week || 1
    });
  }

  // 💯 PERFORMANCE ACHIEVEMENTS
  
  // Perfect Score calculations - STRICT 100% only (10/10)
  const perfectScores = normalizedAttempts.filter(a => {
    // Check if raw score equals total questions (e.g., 10/10)
    if (a.totalQuestions > 0 && a.score === a.totalQuestions) {
      return true;
    }
    // Or check if already percentage and is 100%
    const percentage = a.totalQuestions > 0 && a.score <= a.totalQuestions
      ? (a.score / a.totalQuestions) * 100
      : a.score;
    return percentage === 100;
  });
  
  console.log("Perfect scores found:", perfectScores.length);
  
  // Perfect Score - Get 100% on any quiz
  if (perfectScores.length >= 1) {
    earned.push({
      ...achievementTypes.PERFECT_SCORE,
      dateEarned: perfectScores[0].timestamp,
      week: perfectScores[0].week || 1
    });
  }
  
  // Hat Trick - 3 perfect scores
  if (perfectScores.length >= 3) {
    earned.push({
      ...achievementTypes.HAT_TRICK,
      dateEarned: perfectScores[2].timestamp,
      week: perfectScores[2].week || 1
    });
  }
  
  // Perfectionist - 5 perfect scores
  if (perfectScores.length >= 5) {
    earned.push({
      ...achievementTypes.PERFECTIONIST,
      dateEarned: perfectScores[4].timestamp,
      week: perfectScores[4].week || 1
    });
  }
  
  // Elite Scorer - 90%+ average across 5 quizzes
  if (normalizedAttempts.length >= 5) {
    const recent5 = normalizedAttempts.slice(0, 5);
    // Calculate proper percentage average
    const totalCorrect = recent5.reduce((sum, a) => sum + (a.score || 0), 0);
    const totalQuestions = recent5.reduce((sum, a) => sum + (a.totalQuestions || 10), 0);
    const avgPercentage = (totalCorrect / totalQuestions) * 100;
    
    if (avgPercentage >= 90) {
      earned.push({
        ...achievementTypes.ELITE_SCORER,
        dateEarned: recent5[4].timestamp,
        week: recent5[4].week || 1
      });
    }
  }

  // ⚡ SPEED ACHIEVEMENTS
  
  // Speed Demon - Under 2 minutes (120 seconds) with minimum 70% score
  const speedAttempts = normalizedAttempts.filter(a => {
    const percentage = a.totalQuestions > 0 && a.score <= a.totalQuestions
      ? (a.score / a.totalQuestions) * 100
      : a.score;
    return a.timeSpent && a.timeSpent < 120 && percentage >= 70;
  });
  if (speedAttempts.length >= 1) {
    earned.push({
      ...achievementTypes.SPEED_DEMON,
      dateEarned: speedAttempts[0].timestamp,
      week: speedAttempts[0].week || 1
    });
  }
  
  // Lightning Fast - Under 1 minute (60 seconds) with minimum 60% score
  const lightningAttempts = normalizedAttempts.filter(a => {
    const percentage = a.totalQuestions > 0 && a.score <= a.totalQuestions
      ? (a.score / a.totalQuestions) * 100
      : a.score;
    return a.timeSpent && a.timeSpent < 60 && percentage >= 60;
  });
  if (lightningAttempts.length >= 1) {
    earned.push({
      ...achievementTypes.LIGHTNING_FAST,
      dateEarned: lightningAttempts[0].timestamp,
      week: lightningAttempts[0].week || 1
    });
  }
  
  // Rush Hour - Complete quiz quickly with good score (10 questions × 15s = 150s max, complete in under 75s = fast, 70%+ score)
  const rushAttempts = normalizedAttempts.filter(a => {
    const percentage = a.totalQuestions > 0 && a.score <= a.totalQuestions
      ? (a.score / a.totalQuestions) * 100
      : a.score;
    return a.timeSpent && a.timeSpent < 75 && percentage >= 70;
  });
  if (rushAttempts.length >= 1) {
    earned.push({
      ...achievementTypes.RUSH_HOUR,
      dateEarned: rushAttempts[0].timestamp,
      week: rushAttempts[0].week || 1
    });
  }

  // 📅 CONSISTENCY ACHIEVEMENTS
  
  // Group attempts by week for consistency checks
  const weeklyAttempts = groupAttemptsByWeek(normalizedAttempts);
  const consecutiveWeeks = findConsecutiveWeeks(weeklyAttempts);
  const uniqueWeeks = [...new Set(normalizedAttempts.map(a => a.week).filter(w => w))];
  
  // Consistent Learner - 3 consecutive weeks
  if (consecutiveWeeks >= 3) {
    earned.push({
      ...achievementTypes.CONSISTENT_LEARNER,
      dateEarned: normalizedAttempts[0].timestamp,
      week: `${consecutiveWeeks} weeks`
    });
  }
  
  // Weekly Warrior - 5 consecutive weeks
  if (consecutiveWeeks >= 5) {
    earned.push({
      ...achievementTypes.WEEKLY_WARRIOR,
      dateEarned: normalizedAttempts[0].timestamp,
      week: `${consecutiveWeeks} weeks`
    });
  }
  
  // Quiz Master - 10 total quizzes
  if (normalizedAttempts.length >= 10) {
    earned.push({
      ...achievementTypes.QUIZ_MASTER,
      dateEarned: normalizedAttempts[9].timestamp,
      week: normalizedAttempts[9].week || 10
    });
  }
  
  // Scholar - 25 total quizzes
  if (normalizedAttempts.length >= 25) {
    earned.push({
      ...achievementTypes.SCHOLAR,
      dateEarned: normalizedAttempts[24].timestamp,
      week: normalizedAttempts[24].week || 25
    });
  }

  // 🌟 MASTERY ACHIEVEMENTS
  
  // Knowledge Explorer - 5 different weeks
  if (uniqueWeeks.length >= 5) {
    earned.push({
      ...achievementTypes.KNOWLEDGE_EXPLORER,
      dateEarned: normalizedAttempts[0].timestamp,
      week: `${uniqueWeeks.length} weeks`
    });
  }
  
  // Quiz Conqueror - All available weeks (assume 8+ weeks)
  if (uniqueWeeks.length >= 8) {
    earned.push({
      ...achievementTypes.QUIZ_CONQUEROR,
      dateEarned: normalizedAttempts[0].timestamp,
      week: `${uniqueWeeks.length} weeks`
    });
  }
  
  // Quiz Emperor - 50 total quizzes
  if (normalizedAttempts.length >= 50) {
    earned.push({
      ...achievementTypes.QUIZ_EMPEROR,
      dateEarned: normalizedAttempts[49].timestamp,
      week: normalizedAttempts[49].week || 50
    });
  }

  // 🎊 SPECIAL ACHIEVEMENTS
  
  // Lucky Strike - Perfect score on FIRST attempt only (only if first quiz was perfect)
  if (perfectScores.length >= 1 && normalizedAttempts.length === 1 && normalizedAttempts[0].score === normalizedAttempts[0].totalQuestions) {
    earned.push({
      ...achievementTypes.LUCKY_STRIKE,
      dateEarned: perfectScores[0].timestamp,
      week: perfectScores[0].week || 1
    });
  }
  
  // Second Chance - Significant improvement over previous attempt (need 20%+ improvement)
  if (normalizedAttempts.length >= 2) {
    for (let i = 1; i < normalizedAttempts.length; i++) {
      const current = normalizedAttempts[i-1];
      const previous = normalizedAttempts[i];
      
      const currentPercent = current.totalQuestions > 0 && current.score <= current.totalQuestions
        ? (current.score / current.totalQuestions) * 100
        : current.score;
      const previousPercent = previous.totalQuestions > 0 && previous.score <= previous.totalQuestions
        ? (previous.score / previous.totalQuestions) * 100
        : previous.score;
      
      // Need at least 20% improvement and same week
      if (currentPercent > previousPercent + 20 && current.week === previous.week) {
        earned.push({
          ...achievementTypes.SECOND_CHANCE,
          dateEarned: current.timestamp,
          week: current.week || 1
        });
        break;
      }
    }
  }
  
  // Accuracy Expert - 95%+ accuracy over 10 quizzes
  if (normalizedAttempts.length >= 10) {
    const recent10 = normalizedAttempts.slice(0, 10);
    const totalCorrect = recent10.reduce((sum, a) => sum + (a.score || 0), 0);
    const totalQuestions = recent10.reduce((sum, a) => sum + (a.totalQuestions || 10), 0);
    const avgAccuracy = (totalCorrect / totalQuestions) * 100;
    
    if (avgAccuracy >= 95) {
      earned.push({
        ...achievementTypes.ACCURACY_EXPERT,
        dateEarned: recent10[9].timestamp,
        week: recent10[9].week || 10
      });
    }
  }
  
  // Time Master - Complete 10 quizzes with time remaining (under 3 minutes with good 70%+ score)
  const timelyAttempts = normalizedAttempts.filter(a => {
    const percentage = a.totalQuestions > 0 && a.score <= a.totalQuestions
      ? (a.score / a.totalQuestions) * 100
      : a.score;
    return a.timeSpent && a.timeSpent < 180 && percentage >= 70;
  });
  if (timelyAttempts.length >= 10) {
    earned.push({
      ...achievementTypes.TIME_MASTER,
      dateEarned: timelyAttempts[9].timestamp,
      week: timelyAttempts[9].week || 10
    });
  }
  
  console.log("Earned achievements:", earned.length, earned);
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
  console.log("=== displayAchievements called ===");
  console.log("Achievements to display:", achievements.length, achievements);
  console.log("Total attempts:", totalAttempts);
  
  const achievementList = document.getElementById("achievement-list");
  console.log("Achievement list element:", achievementList);
  if (!achievementList) {
    console.error("Achievement list element not found!");
    return;
  }
  
  // Clear the loading placeholder immediately
  const loadingPlaceholder = document.getElementById("loading-placeholder");
  if (loadingPlaceholder) {
    console.log("Removing loading placeholder");
    loadingPlaceholder.remove();
  }
  
  // Clear existing content
  achievementList.innerHTML = "";
  
  if (achievements.length === 0) {
    console.log("No achievements to display - showing empty state");
    achievementList.innerHTML = `
      <div class="no-achievements">
        <h3>🎯 Start Your Journey!</h3>
        <p>Complete your first quiz to unlock achievements</p>
        <div class="achievement-preview">
          <div class="preview-achievement">
            <span class="preview-icon">🎯</span>
            <span class="preview-text">First Steps awaits...</span>
          </div>
        </div>
        <a href="home-user.html" class="start-button">Take a Quiz</a>
      </div>
    `;
    return;
  }
  
  // Calculate total points and sort by tier
  console.log("Displaying achievements - sorting and calculating points");
  const totalPoints = achievements.reduce((sum, ach) => sum + ach.points, 0);
  console.log("Total points:", totalPoints);
  const tierOrder = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
  achievements.sort((a, b) => (tierOrder[b.tier] || 0) - (tierOrder[a.tier] || 0));
  console.log("Sorted achievements:", achievements);
  
  // Add achievements header with stats
  const header = document.createElement("div");
  header.className = "achievements-header";
  
  // Calculate tier distribution
  const tierCounts = achievements.reduce((counts, ach) => {
    counts[ach.tier] = (counts[ach.tier] || 0) + 1;
    return counts;
  }, {});
  
  const tierDisplay = Object.entries(tierCounts)
    .map(([tier, count]) => {
      const tierIcon = getTierIcon(tier);
      return `<span class="tier-count ${tier}">${tierIcon} ${count}</span>`;
    })
    .join(' ');
  
  header.innerHTML = `
    <div class="stats-overview">
      <h3>🏆 Achievement Progress</h3>
      <div class="achievement-stats">
        <div class="stat-item">
          <span class="stat-number">${achievements.length}</span>
          <span class="stat-label">Earned</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${totalAttempts}</span>
          <span class="stat-label">Quizzes</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${totalPoints}</span>
          <span class="stat-label">Points</span>
        </div>
      </div>
      <div class="tier-distribution">
        ${tierDisplay}
      </div>
    </div>
  `;
  achievementList.appendChild(header);
  
  // Group achievements by category
  const categories = {
    beginner: achievements.filter(a => ['first_steps', 'quick_learner', 'knowledge_seeker'].includes(a.id)),
    performance: achievements.filter(a => ['perfect_score', 'hat_trick', 'perfectionist', 'elite_scorer'].includes(a.id)),
    speed: achievements.filter(a => ['speed_demon', 'lightning_fast', 'rush_hour'].includes(a.id)),
    consistency: achievements.filter(a => ['consistent_learner', 'weekly_warrior', 'quiz_master', 'scholar'].includes(a.id)),
    mastery: achievements.filter(a => ['knowledge_explorer', 'quiz_conqueror', 'diamond_league', 'quiz_emperor'].includes(a.id)),
    special: achievements.filter(a => ['lucky_strike', 'second_chance', 'accuracy_expert', 'time_master'].includes(a.id))
  };
  
  // Display achievements by category
  Object.entries(categories).forEach(([categoryName, categoryAchievements]) => {
    if (categoryAchievements.length > 0) {
      const categorySection = document.createElement("div");
      categorySection.className = "achievement-category";
      
      const categoryHeader = document.createElement("h4");
      categoryHeader.className = "category-header";
      categoryHeader.innerHTML = getCategoryIcon(categoryName) + getCategoryTitle(categoryName);
      categorySection.appendChild(categoryHeader);
      
      const categoryGrid = document.createElement("div");
      categoryGrid.className = "category-grid";
      
      categoryAchievements.forEach((achievement, index) => {
        const card = createAchievementCard(achievement, index);
        categoryGrid.appendChild(card);
      });
      
      categorySection.appendChild(categoryGrid);
      achievementList.appendChild(categorySection);
    }
  });
  
  // Add locked achievements preview
  const lockedAchievements = Object.values(achievementTypes).filter(
    type => !achievements.some(earned => earned.id === type.id)
  );
  
  if (lockedAchievements.length > 0) {
    const lockedSection = document.createElement("div");
    lockedSection.className = "achievement-category locked-section";
    
    const lockedHeader = document.createElement("h4");
    lockedHeader.className = "category-header locked";
    lockedHeader.innerHTML = `🔒 Locked Achievements (${lockedAchievements.length})`;
    lockedSection.appendChild(lockedHeader);
    
    const lockedGrid = document.createElement("div");
    lockedGrid.className = "category-grid locked-grid";
    
    // Show ALL locked achievements
    lockedAchievements.forEach((locked, index) => {
      const card = document.createElement("div");
      card.className = `achievement-card locked ${locked.tier}`;
      card.style.animationDelay = `${(achievements.length + index) * 0.1}s`;
      
      card.innerHTML = `
        <div class="achievement-tier-badge ${locked.tier}">
          ${getTierIcon(locked.tier)}
        </div>
        <div class="achievement-icon locked-icon">🔒</div>
        <h3>${locked.title}</h3>
        <p>${locked.description}</p>
        <div class="achievement-details">
          <small class="points">💎 ${locked.points} points</small>
        </div>
      `;
      
      lockedGrid.appendChild(card);
    });
    
    lockedSection.appendChild(lockedGrid);
    achievementList.appendChild(lockedSection);
  }
}

function createAchievementCard(achievement, index) {
  const card = document.createElement("div");
  card.className = `achievement-card earned ${achievement.tier}`;
  card.style.animationDelay = `${index * 0.1}s`;
  
  const dateStr = achievement.dateEarned ? 
    new Date(achievement.dateEarned.seconds * 1000).toLocaleDateString() : 
    new Date().toLocaleDateString();
  
  card.innerHTML = `
    <div class="achievement-tier-badge ${achievement.tier}">
      ${getTierIcon(achievement.tier)}
    </div>
    <div class="achievement-icon">${achievement.icon}</div>
    <h3>${achievement.title}</h3>
    <p>${achievement.description}</p>
    <div class="achievement-details">
      <small class="date">📅 ${dateStr}</small>
      <small class="week">🏷️ Week: ${achievement.week}</small>
      <small class="points">💎 ${achievement.points} points</small>
    </div>
  `;
  
  return card;
}

function getTierIcon(tier) {
  const tierIcons = {
    bronze: '🥉',
    silver: '🥈',
    gold: '🥇',
    platinum: '💎',
    diamond: '💠'
  };
  return tierIcons[tier] || '🏅';
}

function getCategoryIcon(category) {
  const categoryIcons = {
    beginner: '📚 ',
    performance: '💯 ',
    speed: '⚡ ',
    consistency: '📅 ',
    mastery: '🌟 ',
    special: '🎊 '
  };
  return categoryIcons[category] || '🏆 ';
}

function getCategoryTitle(category) {
  const categoryTitles = {
    beginner: 'Beginner Achievements',
    performance: 'Performance Achievements',
    speed: 'Speed Achievements',
    consistency: 'Consistency Achievements',
    mastery: 'Mastery Achievements',
    special: 'Special Achievements'
  };
  return categoryTitles[category] || 'Achievements';
}

function displayPlaceholderAchievements() {
  const achievementList = document.getElementById("achievement-list");
  if (!achievementList) return;
  
  achievementList.innerHTML = `
    <div class="no-achievements">
      <h3>🎯 Complete Your First Quiz!</h3>
      <p>Your achievements will appear here after completing quizzes.</p>
      <div class="achievement-preview">
        <div class="preview-achievement">
          <span class="preview-icon">🎯</span>
          <span class="preview-text">First Steps - Complete your first quiz (50 points)</span>
        </div>
        <div class="preview-achievement">
          <span class="preview-icon">⚡</span>
          <span class="preview-text">Quick Learner - Answer quickly (25 points)</span>
        </div>
        <div class="preview-achievement">
          <span class="preview-icon">🎖️</span>
          <span class="preview-text">Perfect Score - Get 100% on a quiz (100 points)</span>
        </div>
      </div>
      <a href="home-user.html" class="start-button">Take Your First Quiz</a>
      <button onclick="testAchievements()" class="start-button" style="margin-left: 10px; background: linear-gradient(145deg, #FF6B35, #F7931E);">
        🧪 Test Mode (Demo)
      </button>
      <p style="margin-top: 15px; font-size: 0.8rem; opacity: 0.7;">
        💡 Tip: Complete quizzes from the home page to unlock achievements!<br>
        🔧 If you've completed quizzes but don't see achievements, try Test Mode to see how it works.
      </p>
    </div>
  `;
}

// Test function to demo achievements
window.testAchievements = function() {
  console.log("Testing achievements with mock data...");
  
  // Create mock quiz attempts for testing
  const mockAttempts = [
    {
      score: 100, // Perfect score
      totalQuestions: 10,
      timeSpent: 45, // Fast completion
      week: 1,
      timestamp: { seconds: Date.now() / 1000 - 86400 } // Yesterday
    },
    {
      score: 85,
      totalQuestions: 10,
      timeSpent: 90,
      week: 1,
      timestamp: { seconds: Date.now() / 1000 - 3600 } // 1 hour ago
    },
    {
      score: 95,
      totalQuestions: 10,
      timeSpent: 60,
      week: 2,
      timestamp: { seconds: Date.now() / 1000 } // Now
    }
  ];
  
  console.log("Mock attempts:", mockAttempts);
  
  const earnedAchievements = calculateAchievements(mockAttempts);
  console.log("Mock achievements earned:", earnedAchievements);
  
  displayAchievements(earnedAchievements, mockAttempts.length);
  
  // Show notification
  showMissionAlert("🧪 Test Mode Activated! Showing demo achievements based on mock quiz data.", "🎯");
};

// Manual override function for debugging
window.forceAchievements = function() {
  console.log("=== FORCE ACHIEVEMENTS DEBUG ===");
  
  // Create realistic achievement data
  const attempts = [
    {
      score: 100,
      totalQuestions: 10,
      timeSpent: 95,
      week: 1,
      timestamp: { seconds: Date.now() / 1000 - 86400 }
    }
  ];
  
  const earned = calculateAchievements(attempts);
  console.log("Forced achievements:", earned);
  displayAchievements(earned, attempts.length);
  
  showMissionAlert("🎯 Achievements manually loaded! You should see your First Steps achievement.", "🏆");
};

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

const changeAvatarBtn = document.getElementById("change-avatar");
if(changeAvatarBtn) changeAvatarBtn.addEventListener("click", () => {
  const modal = document.getElementById("modal-change-avatar");
  if(modal) {
    // Reset avatar preview to current user avatar
    const preview = document.getElementById("avatar-preview");
    if(preview && auth.currentUser) {
      preview.src = auth.currentUser.photoURL || "image/default-profile.png";
    }
    showModal(modal);
  }
});

const editNameBtn = document.getElementById("edit-name");
if(editNameBtn) editNameBtn.addEventListener("click", () => {
  const modal = document.getElementById("modal-edit-name");
  if(modal) {
    const input = document.getElementById("input-new-name");
    if(input && auth.currentUser) {
      input.value = auth.currentUser.displayName || "";
    }
    showModal(modal);
  }
});

// Modal functionality
function showModal(modal) {
  modal.style.display = "flex";
  setTimeout(() => modal.classList.add("show"), 10);
}

function hideModal(modal) {
  modal.classList.remove("show");
  setTimeout(() => modal.style.display = "none", 300);
}

// Edit Name Modal Handlers
const saveNameBtn = document.getElementById("save-name-btn");
if(saveNameBtn) saveNameBtn.addEventListener("click", async () => {
  const input = document.getElementById("input-new-name");
  const modal = document.getElementById("modal-edit-name");
  
  if (input && input.value.trim() && auth.currentUser) {
    const trimmedName = input.value.trim();
    const uid = auth.currentUser.uid;
    
    try {
      saveNameBtn.disabled = true;
      saveNameBtn.textContent = "Saving...";
      
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
      
      hideModal(modal);
      showMissionAlert("✅ Name updated successfully!", "🎉");
      
    } catch (error) {
      console.error("Error updating name:", error);
      showMissionAlert("❌ Failed to update name: " + error.message, "😞");
    } finally {
      saveNameBtn.disabled = false;
      saveNameBtn.textContent = "💾 Save";
    }
  }
});

const cancelNameBtn = document.getElementById("cancel-name-btn");
if(cancelNameBtn) cancelNameBtn.addEventListener("click", () => {
  const modal = document.getElementById("modal-edit-name");
  hideModal(modal);
});

// Change Avatar Modal Handlers
const saveAvatarBtn = document.getElementById("save-avatar-btn");
if(saveAvatarBtn) saveAvatarBtn.addEventListener("click", async () => {
  const input = document.getElementById("input-avatar-url");
  const modal = document.getElementById("modal-change-avatar");
  
  if (input && input.value.trim() && auth.currentUser) {
    const avatarUrl = input.value.trim();
    
    try {
      saveAvatarBtn.disabled = true;
      saveAvatarBtn.textContent = "Saving...";
      
      // Update Firebase user profile
      await updateProfile(auth.currentUser, { photoURL: avatarUrl });
      
      // Update Firestore document
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userDocRef, { 
        photoURL: avatarUrl
      });
      
      // Update UI immediately
      const profileImg = document.getElementById("profile-img");
      if(profileImg) profileImg.src = avatarUrl;
      
      hideModal(modal);
      showMissionAlert("✅ Avatar updated successfully!", "🎉");
      
    } catch (error) {
      console.error("Error updating avatar:", error);
      showMissionAlert("❌ Failed to update avatar: " + error.message, "😞");
    } finally {
      saveAvatarBtn.disabled = false;
      saveAvatarBtn.textContent = "💾 Save";
    }
  } else {
    showMissionAlert("❌ Please enter an avatar URL", "🖼️");
  }
});

const cancelAvatarBtn = document.getElementById("cancel-avatar-btn");
if(cancelAvatarBtn) cancelAvatarBtn.addEventListener("click", () => {
  const modal = document.getElementById("modal-change-avatar");
  hideModal(modal);
});

// Close modal when clicking outside
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    hideModal(e.target);
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
    showMissionAlert("❌ Logout failed: " + error.message, "😞");
  }
});

// Debug helper - you can call this from browser console
window.debugAchievements = function() {
  console.log("=== ACHIEVEMENT SYSTEM DEBUG ===");
  console.log("Current user:", auth.currentUser);
  console.log("Available achievement types:", Object.keys(achievementTypes));
  console.log("To test achievements, call: testAchievements()");
  console.log("To force show achievements, call: forceAchievements()");
  
  if (auth.currentUser) {
    loadUserAchievements(auth.currentUser.uid);
  } else {
    console.log("No user logged in");
  }
};

console.log("Achievement system loaded. Type debugAchievements() in console for debug info.");

// Add timeout to clear loading placeholder if it takes too long
setTimeout(() => {
  const loadingPlaceholder = document.getElementById("loading-placeholder");
  if (loadingPlaceholder && loadingPlaceholder.parentElement) {
    console.log("Timeout: Clearing persistent loading placeholder");
    const achievementList = document.getElementById("achievement-list");
    if (achievementList) {
      achievementList.innerHTML = `
        <div class="no-achievements">
          <h3>⚠️ Loading Issue</h3>
          <p>There was an issue loading your achievements. Please refresh the page or check your connection.</p>
          <button onclick="window.location.reload()" class="start-button">🔄 Reload Page</button>
        </div>
      `;
    }
  }
}, 10000); // 10 second timeout
