// modular, fetches quizzes for given week from backend and renders simple UI
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  projectId: "test-4fdf4",
};

// Initialize Firebase only if not already initialized
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const auth = getAuth(app);

// backend base
const API_BASE = "https://oswarrior-backend.onrender.com";

function qs(sel){ return document.querySelector(sel); }

const params = new URLSearchParams(window.location.search);
const week = params.get("week");

let questions = [];
let quizId = null;
let answers = [];
let current = 0;
let questionTimer = null;
let timeLeft = 30; // 30 seconds per question
let isAnswered = false;

function createEl(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  });
  return el;
}

function startTimer() {
  // Clear any existing timer
  if (questionTimer) {
    clearInterval(questionTimer);
  }
  
  timeLeft = 30; // Reset to 30 seconds
  isAnswered = false;
  updateTimerDisplay();
  
  questionTimer = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    
    if (timeLeft <= 0) {
      clearInterval(questionTimer);
      if (!isAnswered) {
        autoAdvanceQuestion("⏰ Time's up! Moving to next question...");
      }
    }
  }, 1000);
}

function updateTimerDisplay() {
  const timerDisplay = document.getElementById('timer-display');
  const timerBadge = document.querySelector('.timer-badge');
  
  if (timerDisplay) {
    timerDisplay.textContent = `${timeLeft}s`;
  }
  
  if (timerBadge) {
    // Remove previous classes
    timerBadge.classList.remove('warning', 'danger');
    
    // Add warning/danger classes based on time left
    if (timeLeft <= 5) {
      timerBadge.classList.add('danger');
    } else if (timeLeft <= 10) {
      timerBadge.classList.add('warning');
    }
  }
}

function showNotification(message) {
  // Remove any existing notification
  const existing = document.querySelector('.auto-next-notification');
  if (existing) {
    existing.remove();
  }
  
  const notification = createEl('div', { 
    className: 'auto-next-notification' 
  }, [message]);
  
  document.body.appendChild(notification);
  
  // Remove notification after animation completes
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 2000);
}

function autoAdvanceQuestion(message = "✅ Answer selected! Moving to next question...") {
  isAnswered = true;
  clearInterval(questionTimer);
  
  showNotification(message);
  
  setTimeout(() => {
    if (current === questions.length - 1) {
      // Last question - submit the quiz
      submitQuiz();
    } else {
      // Move to next question
      current = Math.min(questions.length - 1, current + 1);
      const container = document.querySelector("#quizzes-list");
      const metaEl = document.querySelector("#quiz-meta");
      renderQuestion(current, container, metaEl);
    }
  }, 1500); // Wait 1.5 seconds before advancing
}

async function submitQuiz() {
  clearInterval(questionTimer); // Stop any running timer
  
  try {
    const user = auth.currentUser;
    const payload = {
      userId: user ? user.uid : `anon_${Math.random().toString(36).slice(2,8)}`,
      username: user ? (user.displayName || user.email) : null,
      answers,
      quizId,
      questionIndexes: questions.map(q => q.index)
    };
    
    showNotification("🚀 Submitting quiz...");
    
    const r = await fetch(`${API_BASE}/api/week/${encodeURIComponent(week)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!r.ok) {
      const txt = await r.text().catch(()=>null);
      alert("Submit error: " + (txt || r.status));
      return;
    }
    
    const out = await r.json();
    
    // Show quiz results and review instead of immediate redirect
    showQuizReview(out);
    
  } catch (e) {
    console.error(e);
    alert("❌ Submit failed: " + (e.message || e));
  }
}

function showQuizReview(results) {
  clearInterval(questionTimer); // Make sure timer is stopped
  
  const container = document.querySelector("#quizzes-list");
  const metaEl = document.querySelector("#quiz-meta");
  
  // Update header
  const weekInfo = document.querySelector('.week-info');
  if (weekInfo) {
    weekInfo.textContent = `Week ${week} - Quiz Results`;
  }
  
  // Update stats
  const statBadges = document.querySelectorAll('.stat-badge');
  if (statBadges.length >= 3) {
    statBadges[0].innerHTML = `📊 Final Score: ${results.score}/${results.total}`;
    statBadges[1].innerHTML = `� ${Math.round((results.score/results.total)*100)}% Accuracy`;
    statBadges[2].innerHTML = `💎 ${results.score * 10} XP Earned`;
  }
  
  container.innerHTML = "";
  
  // Results header
  const resultsHeader = createEl("div", { className: "results-header" });
  resultsHeader.innerHTML = `
    <h2>�🎉 Quiz Complete!</h2>
    <div class="score-display">
      <div class="score-big">${results.score} / ${results.total}</div>
      <div class="score-percentage">${Math.round((results.score/results.total)*100)}% Correct</div>
    </div>
  `;
  container.appendChild(resultsHeader);
  
  // Review each question using results.details
  if (results.details && Array.isArray(results.details)) {
    results.details.forEach((detail, idx) => {
      const q = questions[idx];
      if (!q) return;
      
      const userAnswer = detail.userAnswer;
      const correctAnswer = detail.correctAnswer;
      const isCorrect = detail.correct;
    
    const reviewCard = createEl("div", { 
      className: `review-card ${isCorrect ? 'correct' : 'incorrect'}` 
    });
    
    // Question header
    const questionHeader = createEl("div", { className: "review-question" });
    const badge = createEl("div", { 
      className: `review-badge ${isCorrect ? 'correct' : 'incorrect'}` 
    }, [isCorrect ? "✅" : "❌"]);
    const title = createEl("div", { className: "review-title" }, [`Q${idx+1}: ${q.question}`]);
    questionHeader.appendChild(badge);
    questionHeader.appendChild(title);
    reviewCard.appendChild(questionHeader);
    
    // Answers section
    const answersSection = createEl("div", { className: "review-answers" });
    
    // User's answer
    const userAnswerDiv = createEl("div", { className: "user-answer" });
    userAnswerDiv.innerHTML = `
      <div class="answer-label">Your Answer:</div>
      <div class="answer-text ${isCorrect ? 'correct' : 'incorrect'}">${userAnswer || "No answer"}</div>
    `;
    answersSection.appendChild(userAnswerDiv);
    
    // Correct answer (only show if user was wrong)
    if (!isCorrect) {
      const correctAnswerDiv = createEl("div", { className: "correct-answer" });
      correctAnswerDiv.innerHTML = `
        <div class="answer-label">Correct Answer:</div>
        <div class="answer-text correct">${correctAnswer}</div>
      `;
      answersSection.appendChild(correctAnswerDiv);
    }
    
    // Show all options for MCQ
    if (q.type === "mcq" && Array.isArray(q.options)) {
      const optionsDiv = createEl("div", { className: "review-options" });
      optionsDiv.innerHTML = '<div class="answer-label">All Options:</div>';
      
      q.options.forEach(opt => {
        const isUserChoice = String(opt) === String(userAnswer);
        const isCorrectChoice = String(opt) === String(correctAnswer);
        
        let optionClass = "option-item";
        if (isCorrectChoice) optionClass += " correct-option";
        if (isUserChoice && !isCorrectChoice) optionClass += " wrong-choice";
        if (isUserChoice && isCorrectChoice) optionClass += " correct-choice";
        
        const optionEl = createEl("div", { className: optionClass }, [
          `${isCorrectChoice ? "✅" : isUserChoice ? "❌" : "○"} ${opt}`
        ]);
        optionsDiv.appendChild(optionEl);
      });
      
      answersSection.appendChild(optionsDiv);
    }
    
      reviewCard.appendChild(answersSection);
      container.appendChild(reviewCard);
    });
  }  // Navigation buttons
  const navSection = createEl("div", { className: "review-navigation" });
  
  const homeBtn = createEl("button", { 
    type: "button", 
    className: "btn primary" 
  }, ["🏠 Back to Home"]);
  
  homeBtn.addEventListener("click", () => {
    window.location.href = "home-user.html";
  });
  
  navSection.appendChild(homeBtn);
  container.appendChild(navSection);
}

function renderQuestion(idx, container, metaEl) {
  container.innerHTML = "";
  const q = questions[idx];
  
  // Update header info
  const weekInfo = document.querySelector('.week-info');
  if (weekInfo) {
    weekInfo.textContent = `Week ${week} - Question ${idx+1} of ${questions.length}`;
  }
  
  // Update quiz stats
  const statBadges = document.querySelectorAll('.stat-badge');
  if (statBadges.length >= 3) {
    statBadges[0].innerHTML = `📊 Question ${idx+1}/${questions.length}`;
    statBadges[1].innerHTML = `⏱️ <span id="timer-display">30s</span>`;
    statBadges[2].innerHTML = `💎 ${questions.length * 10} XP Max`;
  }

  const card = createEl("div", { className: "quiz-card" });
  
  // Question header with badge and title
  const questionHeader = createEl("div", { className: "quiz-question" });
  const badge = createEl("div", { className: "q-badge" }, [`Q${idx+1}`]);
  const title = createEl("div", { className: "q-title" }, [q.question]);
  questionHeader.appendChild(badge);
  questionHeader.appendChild(title);
  card.appendChild(questionHeader);

  const body = createEl("div", { className: "quiz-body" });

  if (q.type === "mcq" && Array.isArray(q.options)) {
    const opts = createEl("div", { className: "quiz-options" });
    q.options.forEach((opt, i) => {
      const id = `q${idx}_opt${i}`;
      const label = createEl("label", { className: "opt-label" });
      const input = createEl("input", { type: "radio", name: `q${idx}`, value: opt, id });
      if (answers[idx] !== undefined && String(answers[idx]) === String(opt)) input.checked = true;
      
      // Add auto-next functionality for MCQ
      input.addEventListener("change", () => { 
        answers[idx] = input.value;
        
        // Add visual feedback
        label.classList.add('option-selected');
        
        // Auto advance to next question after short delay
        setTimeout(() => {
          autoAdvanceQuestion();
        }, 800);
      });
      
      const optText = createEl("span", { className: "opt-text" }, [opt]);
      label.appendChild(input);
      label.appendChild(optText);
      opts.appendChild(label);
    });
    body.appendChild(opts);
  } else {
    const ta = createEl("textarea", { 
      className: "quiz-textarea", 
      rows: 5,
      placeholder: "Enter your answer here..."
    });
    ta.value = answers[idx] || "";
    ta.addEventListener("input", () => { 
      answers[idx] = ta.value.trim();
    });
    
    // Add submit button for textarea questions
    const submitContainer = createEl("div", { 
      style: "margin-top: 15px; text-align: center;" 
    });
    
    const submitBtn = createEl("button", { 
      type: "button", 
      className: "btn primary",
      style: "padding: 12px 24px; font-size: 1.1em;"
    }, [idx === questions.length - 1 ? "🚀 Submit Quiz" : "✅ Submit Answer"]);
    
    submitBtn.addEventListener("click", () => {
      const ans = answers[idx];
      if (!ans || ans.trim() === "") { 
        alert("⚠️ Please enter your answer before continuing."); 
        return; 
      }
      
      if (idx === questions.length - 1) {
        submitQuiz();
      } else {
        autoAdvanceQuestion("✅ Answer submitted! Moving to next question...");
      }
    });
    
    submitContainer.appendChild(submitBtn);
    body.appendChild(ta);
    body.appendChild(submitContainer);
  }

  card.appendChild(body);

  // Only show progress info, no navigation buttons
  const nav = createEl("div", { className: "quiz-nav" });
  
  // Progress info only
  const navLeft = createEl("div", { className: "nav-left" }, [
    `Progress: ${idx+1} of ${questions.length}`
  ]);
  
  nav.appendChild(navLeft);
  card.appendChild(nav);

  container.appendChild(card);
  
  // Start timer for this question
  startTimer();
}

document.addEventListener("DOMContentLoaded", () => {
  const meta = qs("#quiz-meta");
  const container = qs("#quizzes-list");
  const noEl = qs("#no-quizzes");

  if (!week) { 
    const weekInfo = document.querySelector('.week-info');
    if (weekInfo) weekInfo.textContent = "No week selected";
    if (noEl) {
      noEl.innerHTML = `
        <div class="no-quiz-icon">⚠️</div>
        <div class="no-quiz-title">No Week Selected</div>
        <div class="no-quiz-message">Please select a week from the quiz menu.</div>
      `;
      noEl.style.display = "block";
    }
    return; 
  }
  
  // Update header with loading state
  const weekInfo = document.querySelector('.week-info');
  if (weekInfo) weekInfo.textContent = `Week ${week} - Loading quiz...`;

  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }

    try {
      const res = await fetch(`${API_BASE}/api/week/${encodeURIComponent(week)}/take?userId=${encodeURIComponent(user.uid)}`);
      if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        const weekInfo = document.querySelector('.week-info');
        if (weekInfo) weekInfo.textContent = "Error: " + (txt || res.status);
        return;
      }
      const data = await res.json();
      if (!data || !Array.isArray(data.questions) || !data.questions.length) {
        const weekInfo = document.querySelector('.week-info');
        if (weekInfo) weekInfo.textContent = "No quiz available for this week";
        if (noEl) {
          noEl.innerHTML = `
            <div class="no-quiz-icon">🎯</div>
            <div class="no-quiz-title">No Active Missions</div>
            <div class="no-quiz-message">No quiz questions are currently available for Week ${week}.</div>
          `;
          noEl.style.display = "block";
        }
        return;
      }

      questions = data.questions;
      quizId = data.quizId;
      answers = Array(questions.length).fill(null);
      current = 0;

      // Update header with quiz info
      const weekInfo = document.querySelector('.week-info');
      if (weekInfo) weekInfo.textContent = `Week ${week} - ${questions.length} Questions Available`;
      
      // Hide no-quiz message if visible
      if (noEl) noEl.style.display = "none";
      
      // Start the quiz
      if (container) {
        container.innerHTML = "";
        renderQuestion(current, container, meta);
      }
    } catch (err) {
      console.error("Fetch quiz failed:", err);
      const weekInfo = document.querySelector('.week-info');
      if (weekInfo) weekInfo.textContent = "Error loading quiz";
      if (noEl) {
        noEl.innerHTML = `
          <div class="no-quiz-icon">❌</div>
          <div class="no-quiz-title">Connection Error</div>
          <div class="no-quiz-message">Failed to load quiz data. Please check your connection and try again.</div>
        `;
        noEl.style.display = "block";
      }
    }
  });
});