// modular, fetches quizzes for given week from backend and renders simple UI
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDofTjaWk5M8m_hyrDRqxOGofzOV7Qlitw",
  authDomain: "test-4fdf4.firebaseapp.com",
  projectId: "test-4fdf4",
};
initializeApp(firebaseConfig);
const auth = getAuth();

// backend base
const API_BASE = "https://oswarrior-backend.onrender.com";

function qs(sel){ return document.querySelector(sel); }

const params = new URLSearchParams(window.location.search);
const week = params.get("week");

let questions = [];
let quizId = null;
let answers = [];
let current = 0;

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

function renderQuestion(idx, container, metaEl) {
  container.innerHTML = "";
  const q = questions[idx];
  metaEl.textContent = `Week ${week} — Question ${idx+1} of ${questions.length}`;

  const card = createEl("div", { className: "quiz-card" });
  const title = createEl("div", { className: "quiz-question" }, [`${idx+1}. ${q.question}`]);
  card.appendChild(title);

  const body = createEl("div", { className: "quiz-body" });

  if (q.type === "mcq" && Array.isArray(q.options)) {
    const opts = createEl("div", { className: "quiz-options" });
    q.options.forEach((opt, i) => {
      const id = `q${idx}_opt${i}`;
      const label = createEl("label", { className: "opt-label" });
      const input = createEl("input", { type: "radio", name: `q${idx}`, value: opt, id });
      if (answers[idx] !== undefined && String(answers[idx]) === String(opt)) input.checked = true;
      input.addEventListener("change", () => { answers[idx] = input.value; });
      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + opt));
      opts.appendChild(label);
    });
    body.appendChild(opts);
  } else {
    const ta = createEl("textarea", { className: "quiz-textarea", rows: 5 });
    ta.value = answers[idx] || "";
    ta.addEventListener("input", () => { answers[idx] = ta.value.trim(); });
    body.appendChild(ta);
  }

  card.appendChild(body);

  const nav = createEl("div", { className: "quiz-nav" });
  const prevBtn = createEl("button", { type: "button", className: "btn" }, ["Prev"]);
  const nextBtn = createEl("button", { type: "button", className: "btn primary" }, [ idx === questions.length - 1 ? "Submit" : "Next" ]);

  prevBtn.disabled = idx === 0;
  prevBtn.addEventListener("click", () => {
    current = Math.max(0, current - 1);
    renderQuestion(current, container, metaEl);
  });

  nextBtn.addEventListener("click", async () => {
    const ans = answers[idx];
    if (ans == null || ans === "") { alert("Sila jawab soalan sebelum teruskan."); return; }

    if (idx === questions.length - 1) {
      // submit
      try {
        const user = auth.currentUser;
        const payload = {
          userId: user ? user.uid : `anon_${Math.random().toString(36).slice(2,8)}`,
          username: user ? (user.displayName || user.email) : null,
          answers,
          quizId,
          questionIndexes: questions.map(q => q.index)
        };
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
        alert(`Score: ${out.score} / ${out.total}`);
        window.location.href = "home-user.html";
      } catch (e) {
        console.error(e);
        alert("Submit failed: " + (e.message || e));
      }
      return;
    }

    current = Math.min(questions.length - 1, current + 1);
    renderQuestion(current, container, metaEl);
  });

  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  card.appendChild(nav);

  const prog = createEl("div", { className: "quiz-progress" }, [`${idx+1} / ${questions.length}`]);
  card.appendChild(prog);

  container.appendChild(card);
}

document.addEventListener("DOMContentLoaded", () => {
  const meta = qs("#quiz-meta") || (() => { const d = document.createElement("div"); d.id = "quiz-meta"; document.body.prepend(d); return d; })();
  const container = qs("#quizzes-list") || (() => { const d = document.createElement("div"); d.id = "quizzes-list"; document.body.appendChild(d); return d; })();
  const noEl = qs("#no-quizzes") || (() => { const d = document.createElement("div"); d.id = "no-quizzes"; d.style.display="none"; d.textContent="No quizzes for this week yet."; document.body.appendChild(d); return d; })();

  if (!week) { meta.textContent = "No week selected."; noEl.style.display = "block"; return; }
  meta.textContent = `Week ${week} — Loading quiz…`;

  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }

    try {
      const res = await fetch(`${API_BASE}/api/week/${encodeURIComponent(week)}/take?userId=${encodeURIComponent(user.uid)}`);
      if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        meta.textContent = "Error: " + (txt || res.status);
        return;
      }
      const data = await res.json();
      if (!data || !Array.isArray(data.questions) || !data.questions.length) {
        meta.textContent = "No quiz available for this week.";
        return;
      }

      questions = data.questions;
      quizId = data.quizId;
      answers = Array(questions.length).fill(null);
      current = 0;

      meta.textContent = `Week ${week} — Take Quiz`;
      container.innerHTML = "";
      renderQuestion(current, container, meta);
    } catch (err) {
      console.error("Fetch quiz failed:", err);
      meta.textContent = "Error loading quiz.";
    }
  });
});