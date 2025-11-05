// Enhanced admin manage quizzes UI with cyberpunk styling and notifications
const API_BASE = "https://oswarrior-backend.onrender.com";

// Global state
let currentEditingId = null;
let modalMode = "view"; // "view" | "edit" | "create"
let quizzesCache = [];

// Enhanced notification system - EXACT COPY from home-admin.js
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.admin-notification');
  existingNotifications.forEach(notification => notification.remove());
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `admin-notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${getNotificationIcon(type)}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;
  
  // Add styles - EXACT COPY from home-admin
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--card-bg);
    border: 1px solid var(--border-glow);
    border-radius: 10px;
    padding: 15px 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    z-index: 10000;
    max-width: 400px;
    animation: slideInRight 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

function getNotificationIcon(type) {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  return icons[type] || '📢';
}

// Enhanced loading state management
function setLoadingState(element, isLoading) {
  if (isLoading) {
    element.classList.add('loading');
    element.style.pointerEvents = 'none';
  } else {
    element.classList.remove('loading');
    element.style.pointerEvents = 'auto';
  }
}

// Debounce utility
function debounce(fn, wait = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

// Enhanced search filter
function applySearchFilter(term) {
  term = String(term || "").trim().toLowerCase();
  if (!term) return quizzesCache.slice();
  return quizzesCache.filter(q => {
    const parts = [
      q.id, q.quizId, q.title, q.createdBy, q.owner,
      Array.isArray(q.weeks) ? q.weeks.join(" ") : q.week, q.weekNumber
    ].filter(Boolean).join(" ").toLowerCase();
    return parts.indexOf(term) !== -1;
  });
}

// collect questions from modal form
function collectQuestionsFromForm() {
  const list = document.getElementById("questionsList");
  if (!list) return [];
  const blocks = Array.from(list.querySelectorAll(".question-block"));
  return blocks.map((b, idx) => {
    const text = b.querySelector(".q-text")?.value || "";
    const choices = Array.from(b.querySelectorAll(".choice-input")).map(i => i.value || "");
    const answer = Number(b.querySelector(`input[name="answer-${idx}"]:checked`)?.value ?? 0);
    return {
      question: text.trim(),
      options: choices,
      answerIndex: Number.isFinite(answer) ? answer : 0,
      type: "mcq",
      points: 10
    };
  }).filter(q => q.question && q.question.length);
}

// safe wrapper so HTML inline onclick or early calls won't throw
if (!window.createNewQuiz) {
  window.createNewQuiz = (...args) => {
    if (typeof createNewQuiz === "function") return createNewQuiz(...args);
    console.warn("createNewQuiz not initialised yet");
  };
}
if (!window.loadQuizzes) {
  window.loadQuizzes = (...args) => {
    if (typeof loadQuizzes === "function") return loadQuizzes(...args);
    console.warn("loadQuizzes not initialised yet");
  };
}

async function authHeaders() {
  try {
    if (window.firebase && firebase.auth) {
      const user = firebase.auth().currentUser;
      if (user) {
        const t = await user.getIdToken();
        return { Authorization: "Bearer " + t, "Content-Type": "application/json" };
      }
    }
  } catch (e) { /* ignore */ }
  return { "Content-Type": "application/json" };
}

// Enhanced loadQuizzes with better feedback
async function loadQuizzes(showSuccessNotification = true) {
  try {
    const table = document.querySelector("#quizzesTable");
    if (table) setLoadingState(table, true);
    
    const headers = await authHeaders();
    const timestamp = Date.now();
    const res = await fetch(`${API_BASE}/api/quizzes?_t=${timestamp}`, { headers });
    
    if (!res.ok) {
      throw new Error(`Failed to load quizzes: ${res.status} ${res.statusText}`);
    }
    
    const list = await res.json();
    quizzesCache = Array.isArray(list) ? list : [];
    renderTable(quizzesCache);
    
    if (showSuccessNotification) {
      showNotification(`🎯 Loaded ${quizzesCache.length} quiz${quizzesCache.length !== 1 ? 'es' : ''}`, 'success');
    }
    return quizzesCache;
    
  } catch (err) {
    console.error("Failed loading quizzes", err);
    showNotification(`Failed to load quizzes: ${err.message}`, 'error');
    quizzesCache = [];
    renderTable([]);
    return [];
  } finally {
    const table = document.querySelector("#quizzesTable");
    if (table) setLoadingState(table, false);
  }
}

// helper: return user-friendly week label (prefer numeric 1..14, else show original)
function parseWeekLabel(q) {
  if (!q) return "";
  // direct numeric weekNumber
  if (Number.isFinite(Number(q.weekNumber))) {
    const n = Number(q.weekNumber);
    if (n >= 1 && n <= 14) return "Week " + n;
    return String(q.weekNumber);
  }

  // if weeks is array, try find simple numeric 1..14
  if (Array.isArray(q.weeks) && q.weeks.length) {
    for (const w of q.weeks) {
      const n = Number(String(w).trim());
      if (Number.isFinite(n) && n >= 1 && n <= 14) return "Week " + n;
    }
    // fallback: try pattern YYYY-WW -> take last part
    for (const w of q.weeks) {
      const s = String(w);
      const m = s.match(/(\d{4})-(\d{1,2})$/);
      if (m) {
        const num = Number(m[2]);
        if (num >= 1 && num <= 14) return "Week " + num;
        return s;
      }
    }
    return String(q.weeks[0]);
  }

  // if weekKey like 2025-42
  if (q.weekKey && typeof q.weekKey === "string") {
    const m = q.weekKey.match(/(\d{4})-(\d{1,2})$/);
    if (m) {
      const num = Number(m[2]);
      if (num >= 1 && num <= 14) return "Week " + num;
      return q.weekKey;
    }
    return q.weekKey;
  }

  // fallback to week / weekStart / createdAt date
  if (q.week) return String(q.week);
  if (q.weekStart) return String(q.weekStart);
  if (q.createdAt) return String(q.createdAt).slice(0,10);
  return "";
}

function getWeekKeyFromDate(d) {
  try {
    const dt = d ? new Date(d) : new Date();
    const tmp = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    const dayNr = (tmp.getUTCDay() + 6) % 7; // Monday=0
    tmp.setUTCDate(tmp.getUTCDate() - dayNr + 3);
    const firstThursday = tmp.valueOf();
    tmp.setUTCMonth(0, 1);
    if (tmp.getUTCDay() !== 4) tmp.setUTCMonth(0, 1 + ((4 - tmp.getUTCDay()) + 7) % 7);
    const weekNumber = 1 + Math.round((firstThursday - tmp) / (7 * 24 * 3600 * 1000));
    const year = dt.getFullYear();
    return `${year}-${String(weekNumber).padStart(2,'0')}`;
  } catch (e) {
    return "";
  }
}

// --- REPLACE existing week helper / selector logic with fixed weeks 1..14 ---
// ensure week selector 1..14
function ensureWeekSelectorReady(defaultWeek) {
  const sel = document.getElementById("quizWeek");
  if (!sel) return;
  if (!sel._populated) {
    sel.innerHTML = "";
    for (let i = 1; i <= 14; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = "Week " + i;
      sel.appendChild(opt);
    }
    sel._populated = true;
  }
  if (typeof defaultWeek !== "undefined" && defaultWeek !== null) sel.value = String(defaultWeek);
  else sel.selectedIndex = 0;
}

function getSelectedWeekMetadata() {
  const sel = document.getElementById("quizWeek");
  if (!sel) return null;
  const weekNumber = Number(sel.value || 0);
  if (!weekNumber) return null;
  // only store numeric week; server can map to dates if needed
  return { weekNumber };
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function fetchQuiz(id, forceRefresh = false) {
  // If force refresh, skip cache
  if (!forceRefresh) {
    // Try to get from cache first
    const cachedQuiz = quizzesCache.find(q => q.id === id);
    if (cachedQuiz) {
      return cachedQuiz;
    }
  }
  
  // If not in cache or force refresh, fetch from API
  const headers = await authHeaders();
  // Add cache-busting parameter to ensure fresh data
  const timestamp = Date.now();
  const res = await fetch(`${API_BASE}/api/quizzes/${encodeURIComponent(id)}?_t=${timestamp}`, { headers });
  if (!res.ok) throw new Error("Not found");
  const quiz = await res.json();
  
  // Update cache with the fetched quiz
  const existingIndex = quizzesCache.findIndex(q => q.id === id);
  if (existingIndex >= 0) {
    quizzesCache[existingIndex] = quiz;
  } else {
    quizzesCache.push(quiz);
  }
  
  return quiz;
}

// ensure modal form HTML exists (used by view/edit if create modal not opened yet)
function ensureQuizFormExists() {
  const modalBody = $el("modalBody");
  if (!modalBody) return;
  if ($el("quizTitle")) return; // already present

  modalBody.innerHTML = `
    <div id="quizForm">
      <div class="form-group">
        <label>Quiz Title</label>
        <input id="quizTitle" type="text" placeholder="Enter quiz title..." />
      </div>

      <div class="form-group">
        <label>Description</label>
        <textarea id="quizDesc" placeholder="Enter quiz description..."></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Week</label>
          <select id="quizWeek"></select>
        </div>
        
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;margin-top:20px">
            <input id="quizPublish" type="checkbox" />
            <span style="color:#E2E8F0;font-size:13px">Publish immediately</span>
          </label>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin:30px 0 20px 0;padding-bottom:15px;border-bottom:1px solid rgba(0,255,255,0.2)">
        <h3 style="margin:0;color:#00FFFF;font-family:'Orbitron',monospace;font-size:18px">📝 Questions</h3>
        <div style="display:flex;gap:12px">
          <button id="addQuestionBtn" type="button" style="padding:8px 16px;background:linear-gradient(135deg,#00AA00,#008800);border:1px solid #00FF00;color:white;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">+ Add Question</button>
          <button id="resetQuestionsBtn" type="button" style="padding:8px 16px;background:linear-gradient(135deg,#FF6600,#DD4400);border:1px solid #FF8800;color:white;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">Reset All</button>
        </div>
      </div>

      <div id="questionsList" style="display:flex;flex-direction:column;gap:20px"></div>
    </div>
  `.trim();

  ensureWeekSelectorReady();
  // wire add/reset handlers
  const qList = $el("questionsList");
  if (qList) {
    qList.innerHTML = "";
    qList.appendChild(renderQuestionBlock({}, 0));
    qList.appendChild(renderQuestionBlock({}, 1));
  }
  $el("addQuestionBtn")?.addEventListener("click", () => {
    const list = $el("questionsList");
    if (!list) return;
    const idx = list.children.length;
    list.appendChild(renderQuestionBlock({}, idx));
  });
  $el("resetQuestionsBtn")?.addEventListener("click", () => {
    const list = $el("questionsList");
    if (!list) return;
    list.innerHTML = "";
    list.appendChild(renderQuestionBlock({}, 0));
  });
}

// modified populate to ensure form exists first
function populateQuizForm(q) {
  // ensure form skeleton present
  ensureQuizFormExists();

  // guard missing DOM nodes
  const titleEl = $el("quizTitle");
  const descEl = $el("quizDesc");
  const weekSel = $el("quizWeek");
  const list = $el("questionsList");

  if (titleEl) titleEl.value = q.title || "";
  if (descEl) descEl.value = q.description || q.sourcePreview || "";
  if (weekSel) ensureWeekSelectorReady(q.weekNumber || q.week || (Array.isArray(q.weeks) && q.weeks[0]) || null);

  if (!list) return; // nothing to render (modal missing)
  list.innerHTML = "";
  (Array.isArray(q.questions) ? q.questions : []).forEach((qq, i) => {
    list.appendChild(renderQuestionBlock(qq, i));
  });
  if (list.children.length === 0) list.appendChild(renderQuestionBlock({}, 0));
}

// Enhanced render table with cyberpunk styling
function renderTable(list) {
  const tbody = document.querySelector("#quizzesTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  if (list.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="7" style="text-align:center;padding:40px;color:rgba(0,255,255,0.6);font-style:italic;">
        🔍 No quizzes found. Create your first quiz to get started!
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }
  
  list.forEach(q => {
    const weekLabel = parseWeekLabel(q);
    const publishedStatus = q.published ? 
      `<span class="status-published">✅ Published</span>` : 
      `<span class="status-draft">📝 Draft</span>`;
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(q.id || q.quizId || "")}</td>
      <td>${escapeHtml(q.title || "(untitled)")}</td>
      <td>${escapeHtml(q.createdBy || q.owner || "")}</td>
      <td>${escapeHtml(weekLabel)}</td>
      <td>${publishedStatus}</td>
      <td><span style="color:#DDA0DD;font-weight:600;">${Array.isArray(q.questions) ? q.questions.length : "0"}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-view" data-id="${escapeHtml(q.id||q.quizId)}" title="View Quiz">👁️ View</button>
          <button class="btn-edit" data-id="${escapeHtml(q.id||q.quizId)}" title="Edit Quiz">✏️ Edit</button>
          <button class="btn-pub" data-id="${escapeHtml(q.id||q.quizId)}" title="${q.published ? 'Unpublish Quiz' : 'Publish Quiz'}">${q.published ? "📤 Unpub" : "🌐 Pub"}</button>
          <button class="btn-reg" data-id="${escapeHtml(q.id||q.quizId)}" title="Regenerate Questions">🔄 Regen</button>
          <button class="btn-del" data-id="${escapeHtml(q.id||q.quizId)}" title="Delete Quiz">🗑️ Del</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Enhanced event listeners with loading states
  document.querySelectorAll(".btn-view").forEach(b => {
    b.addEventListener("click", () => {
      b.classList.add("loading");
      viewQuiz(b.dataset.id).finally(() => b.classList.remove("loading"));
    });
  });
  
  document.querySelectorAll(".btn-edit").forEach(b => {
    b.addEventListener("click", () => {
      b.classList.add("loading");
      editQuiz(b.dataset.id).finally(() => b.classList.remove("loading"));
    });
  });
  
  document.querySelectorAll(".btn-pub").forEach(b => {
    b.addEventListener("click", () => {
      b.classList.add("loading");
      togglePublish(b.dataset.id).finally(() => b.classList.remove("loading"));
    });
  });
  
  document.querySelectorAll(".btn-reg").forEach(b => {
    b.addEventListener("click", () => {
      if (confirm("🔄 Are you sure you want to regenerate this quiz? This will replace all existing questions.")) {
        b.classList.add("loading");
        regenerateQuiz(b.dataset.id).finally(() => b.classList.remove("loading"));
      }
    });
  });
  
  document.querySelectorAll(".btn-del").forEach(b => {
    b.addEventListener("click", () => {
      if (confirm("🗑️ Are you sure you want to delete this quiz? This action cannot be undone.")) {
        b.classList.add("loading");
        deleteQuiz(b.dataset.id).finally(() => b.classList.remove("loading"));
      }
    });
  });
}

// render one editable question block (human-friendly)
function renderQuestionBlock(q = {}, idx) {
  const wrapper = document.createElement("div");
  wrapper.className = "question-block";
  wrapper.dataset.idx = String(idx);
  const text = q.question || q.text || "";
  const choices = Array.isArray(q.options) && q.options.length ? q.options.slice(0,4) : ["", "", "", ""];
  const answerIndex = (typeof q.answerIndex === "number") ? q.answerIndex : 0;

  wrapper.innerHTML = `
    <div class="question-item">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
        <h4 style="margin:0;color:#00DDFF;font-family:'Orbitron',monospace;font-size:16px">❓ Question ${idx+1}</h4>
        <button type="button" class="btn-remove-question">Remove</button>
      </div>
      
      <div class="form-group">
        <label>Question Text</label>
        <textarea class="q-text" placeholder="Enter your question here...">${escapeHtml(text)}</textarea>
      </div>
      
      <div class="form-group">
        <label>Answer Options (Click the radio button to select the correct answer)</label>
        <div style="background:rgba(0,100,200,0.2);padding:10px;border-radius:8px;margin-bottom:10px;border-left:4px solid #00FFFF">
          <small style="color:#B0E0FF;font-size:12px">💡 <strong>How to set correct answer:</strong> Fill in all 4 options, then click the radio button (●) next to the CORRECT answer</small>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">
          ${choices.map((c,i)=>`
            <div class="option-group">
              <input type="radio" name="answer-${idx}" value="${i}" ${i===answerIndex ? "checked":""} id="answer-${idx}-${i}"/>
              <label for="answer-${idx}-${i}" style="margin:0;color:#00FFFF;font-size:14px;min-width:60px;font-weight:700">Option ${String.fromCharCode(65+i)}</label>
              <input class="choice-input" type="text" value="${escapeHtml(c)}" placeholder="Enter option ${String.fromCharCode(65+i)} text..." style="flex:1"/>
            </div>`).join("")}
        </div>
      </div>
    </div>
  `.trim();

  wrapper.querySelector(".btn-remove-question").addEventListener("click", () => {
    wrapper.remove();
    // renumber labels
    document.querySelectorAll("#questionsList .question-block").forEach((b,i)=> {
      b.querySelector("h4").textContent = `❓ Question ${i+1}`;
      b.dataset.idx = String(i);
      // update radio names and IDs
      const radios = b.querySelectorAll('input[type="radio"]');
      radios.forEach((r,ri) => {
        r.name = `answer-${i}`;
        r.id = `answer-${i}-${ri}`;
        const label = r.nextElementSibling;
        if (label) label.setAttribute('for', `answer-${i}-${ri}`);
      });
    });
  });

  return wrapper;
}


// safe getter
function $el(id) { return document.getElementById(id) || null; }

// ensure show/hide exist (safe)
function showModal(){ const m=$el("quizModal"); const b=$el("modalBackdrop"); if(m) m.style.display="block"; if(b) b.style.display="block"; }
function hideModal(){ const m=$el("quizModal"); const b=$el("modalBackdrop"); if(m) m.style.display="none"; if(b) b.style.display="none"; }

// move wiring to DOMContentLoaded (avoid early DOM access)
window.addEventListener("DOMContentLoaded", () => {
  // toolbar buttons
  $el("btn-new")?.addEventListener("click", createNewQuiz);

  // modal helpers
  $el("modalClose")?.addEventListener("click", hideModal);
  $el("modalBackdrop")?.addEventListener("click", hideModal);
  $el("addQuestionBtn")?.addEventListener("click", () => {
    const list = $el("questionsList");
    if (!list) return;
    const idx = list.children.length;
    list.appendChild(renderQuestionBlock({}, idx));
  });

  // wire search input (debounced)
  const searchEl = document.getElementById("search");
  if (searchEl) {
    // replace node to avoid duplicated listeners
    const clone = searchEl.cloneNode(true);
    searchEl.parentNode.replaceChild(clone, searchEl);
    const onSearch = debounce(() => {
      const term = String(clone.value || "").trim();
      const filtered = applySearchFilter(term);
      renderTable(filtered);
    }, 180);
    clone.addEventListener("input", onSearch);
    clone.addEventListener("keydown", (e) => { if (e.key === "Escape") { clone.value = ""; onSearch(); } });
  }

  // table delegation — avoid handling direct button clicks here (buttons have their own listeners)
  const tbody = document.querySelector("#quizzesTable tbody");
  if (tbody) {
    tbody.addEventListener("click", (ev) => {
      // if a button was clicked, let that button's handler run (it is wired in renderTable)
      const btn = ev.target.closest("button");
      if (btn) return;

      // otherwise treat row click as "view" (open the quiz)
      const tr = ev.target.closest("tr");
      if (!tr) return;
      const viewBtn = tr.querySelector(".btn-view");
      const id = viewBtn?.dataset?.id;
      if (id) viewQuiz(id);
    });
  }

  // initial load AFTER DOM ready (without success notification)
  loadQuizzes(false);
});

// create flow (friendly form)
async function createNewQuiz() {
  try {
    currentEditingId = null;
    modalMode = "create";

    const modalBody = document.getElementById("modalBody");
    if (!modalBody) throw new Error("modalBody not found");

    // build form HTML
    modalBody.innerHTML = `
      <div id="quizForm" style="min-width:320px">
        <label>Title</label>
        <input id="quizTitle" type="text" style="width:100%;padding:8px;margin:6px 0" />

        <label>Description</label>
        <textarea id="quizDesc" style="width:100%;height:72px;padding:8px;margin:6px 0"></textarea>

        <label>Week</label>
        <select id="quizWeek" style="width:160px;padding:6px;margin:6px 0"></select>

        <label style="display:inline-flex;align-items:center;gap:8px;margin-top:6px">
          <input id="quizPublish" type="checkbox" />
          <span> Publish immediately (visible to users)</span>
        </label>

        <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0">
          <strong>Questions</strong>
          <div style="display:flex;gap:8px">
            <button id="addQuestionBtn" type="button">+ Add question</button>
            <button id="resetQuestionsBtn" type="button">Reset</button>
          </div>
        </div>

        <div id="questionsList" style="display:flex;flex-direction:column;gap:12px"></div>
      </div>
    `;

    // populate week selector 1..14
    const sel = document.getElementById("quizWeek");
    if (sel) {
      sel.innerHTML = "";
      for (let i = 1; i <= 14; i++) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = "Week " + i;
        sel.appendChild(opt);
      }
    }

    // helper to create question block element
    function makeQuestionBlock(data = {}, idx = 0) {
      const wrapper = document.createElement("div");
      wrapper.className = "question-block";
      wrapper.dataset.idx = String(idx);
      const qText = data.question || "";
      const opts = Array.isArray(data.options) ? data.options.slice(0,4) : ["", "", "", ""];
      const answerIndex = (typeof data.answerIndex === "number") ? data.answerIndex : 0;

      wrapper.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong class="q-label">Question ${idx+1}</strong>
          <button type="button" class="remove-question" style="background:transparent;border:0;color:#c00">Remove</button>
        </div>
        <div style="margin-top:8px">
          <textarea class="q-text" style="width:100%;height:64px;padding:8px">${escapeHtml(qText)}</textarea>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
          ${opts.map((o,i)=>{
            const optionLabel = String.fromCharCode(65 + i); // A, B, C, D
            return `
            <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;background:rgba(0,30,60,0.6);border:2px solid rgba(0,255,255,0.4);border-radius:10px">
              <input type="radio" name="answer-${idx}" value="${i}" ${i===answerIndex ? "checked":""} style="width:20px;height:20px;cursor:pointer"/>
              <span style="font-weight:700;color:#00FFFF;font-size:15px;min-width:80px;letter-spacing:1px">OPTION ${optionLabel}</span>
              <input class="choice-input" type="text" placeholder="" value="${escapeHtml(o)}" style="flex:1;padding:12px 16px;font-size:15px;background:rgba(0,50,100,0.5);border:1px solid rgba(0,255,255,0.5);color:#fff;border-radius:8px;outline:none"/>
            </div>`;
          }).join("")}
        </div>
      `.trim();

      // remove handler
      wrapper.querySelector(".remove-question").addEventListener("click", () => {
        wrapper.remove();
        // re-index labels & radio names
        document.querySelectorAll("#questionsList .question-block").forEach((b,i)=>{
          b.dataset.idx = String(i);
          const lbl = b.querySelector(".q-label");
          if (lbl) lbl.textContent = "Question " + (i+1);
          b.querySelectorAll('input[type="radio"]').forEach((r,ri)=> r.name = `answer-${i}`);
        });
      });

      return wrapper;
    }

    // add initial two questions
    const qList = document.getElementById("questionsList");
    if (!qList) throw new Error("questionsList not found");
    qList.innerHTML = "";
    qList.appendChild(makeQuestionBlock({}, 0));
    qList.appendChild(makeQuestionBlock({}, 1));

    // handlers
    document.getElementById("addQuestionBtn")?.addEventListener("click", () => {
      const idx = qList.children.length;
      qList.appendChild(makeQuestionBlock({}, idx));
    });
    document.getElementById("resetQuestionsBtn")?.addEventListener("click", () => {
      qList.innerHTML = "";
      qList.appendChild(makeQuestionBlock({}, 0));
    });

    // show modal
    showModal();
    document.getElementById("modalTitle") && (document.getElementById("modalTitle").textContent = "Create New Quiz");

    // modal action bindings
    document.getElementById("modalClose")?.addEventListener("click", hideModal);
    document.getElementById("modalBackdrop")?.addEventListener("click", hideModal);

    // Save handler
    document.getElementById("modalSave").onclick = async () => {
      try {
        const title = (document.getElementById("quizTitle")?.value || "").trim() || "Untitled quiz";
        const description = (document.getElementById("quizDesc")?.value || "").trim();
        const weekNum = Number(document.getElementById("quizWeek")?.value || 0);
        const publishChecked = !!document.getElementById("quizPublish")?.checked;

        // collect questions
        const blocks = Array.from(document.querySelectorAll("#questionsList .question-block"));
        const questions = blocks.map((b, idx) => {
          const text = b.querySelector(".q-text")?.value || "";
          const choices = Array.from(b.querySelectorAll(".choice-input")).map(i=>i.value||"");
          const ans = Number(b.querySelector(`input[name="answer-${idx}"]:checked`)?.value ?? 0);
          return { question: text.trim(), options: choices.slice(0,4), answerIndex: Number.isFinite(ans)?ans:0, type: "mcq" };
        }).filter(q => q.question && q.question.length);

        const payload = {
          title, description,
          createdBy: (window.firebase && firebase.auth && firebase.auth().currentUser) ? firebase.auth().currentUser.uid : "admin",
          createdAt: new Date().toISOString(),
          published: publishChecked,
          questions
        };
        if (weekNum >= 1 && weekNum <= 14) {
          payload.weekNumber = weekNum;
          payload.weeks = [String(weekNum)];
        }

        const headers = await authHeaders();
        const res = await fetch(`${API_BASE}/api/quizzes`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });
        const text = await res.text();
        if (!res.ok) throw new Error(text || res.statusText);
        hideModal();
        await loadQuizzes();
      } catch (err) {
        alert("Create failed: " + (err.message || err));
      }
    };

    // delete/regenerate/publish buttons behavior for create modal (delete will just close)
    document.getElementById("modalDelete").onclick = () => { if (confirm("Discard draft?")) hideModal(); };
    setModalButtonHandler("modalPublish", () => {
      const cb = document.getElementById("quizPublish");
      if (cb) cb.checked = !cb.checked;
      alert("Publish checkbox toggled");
    });
    document.getElementById("modalRegenerate").onclick = () => alert("Regenerate available after create");

  } catch (e) {
    alert("Create failed: " + (e.message || e));
  }
}

// edit using the friendly form
async function editQuiz(id) {
  try {
    const q = await fetchQuiz(id);
    currentEditingId = id;
    modalMode = "edit";
    document.getElementById("modalTitle") && (document.getElementById("modalTitle").textContent = "Edit: " + (q.title || id));
    populateQuizForm(q);
    // set publish checkbox if present
    const pubEl = document.getElementById("quizPublish");
    if (pubEl) pubEl.checked = !!q.published;
    showModal();

    document.getElementById("modalSave").onclick = async () => { await saveQuizEdits(id); };
    setModalButtonHandler("modalPublish", async () => { await togglePublish(id, true); });
    document.getElementById("modalRegenerate").onclick = async () => { await regenerateQuiz(id, true); };
    document.getElementById("modalDelete").onclick = async () => { if (confirm("Delete quiz?")) await deleteQuiz(id, true); };
  } catch (e) {
    alert("Failed to load quiz: " + (e.message || e));
  }
}

// viewQuiz: show read-only in the same modal (populate form but disable inputs)
async function viewQuiz(id) {
  try {
    const q = await fetchQuiz(id);
    document.getElementById("modalTitle") && (document.getElementById("modalTitle").textContent = q.title || id);
    populateQuizForm(q);
    // disable inputs for read-only
    document.querySelectorAll("#quizForm input, #quizForm textarea, #quizForm select, #quizForm .choice-input").forEach(el => el.disabled = true);
    document.querySelectorAll("#quizForm input[type=radio]").forEach(r => r.disabled = true);
    showModal();
    document.getElementById("modalSave").onclick = () => editQuiz(id);
    setModalButtonHandler("modalPublish", async () => { await togglePublish(id, true); });
    document.getElementById("modalRegenerate").onclick = async () => { await regenerateQuiz(id, true); };
    document.getElementById("modalDelete").onclick = async () => { if (confirm("Delete quiz?")) await deleteQuiz(id, true); };
  } catch (e) {
    alert("Failed to load quiz: " + (e.message || e));
  }
}

// single saveQuizEdits implementation
async function saveQuizEdits(id) {
  try {
    const title = document.getElementById("quizTitle")?.value || "";
    const description = document.getElementById("quizDesc")?.value || "";
    const questions = collectQuestionsFromForm();
    const wk = getSelectedWeekMetadata();
    const payload = { title, description, questions };
    if (wk && Number.isFinite(Number(wk.weekNumber))) {
      payload.weekNumber = Number(wk.weekNumber);
      payload.weeks = wk.weeks || [String(wk.weekNumber)];
    }
    const pubEl = document.getElementById("quizPublish");
    if (pubEl) payload.published = !!pubEl.checked;
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api/quizzes/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    alert("Saved");
    hideModal();
    await loadQuizzes();
  } catch (e) {
    alert("Save failed: " + (e.message || e));
  }
}

// toggle publish state for a quiz
async function togglePublish(id, publish = undefined) {
  try {
    if (!id) throw new Error("missing id");
    const q = await fetchQuiz(id);
    const newState = (publish === true) ? true : (publish === false ? false : !Boolean(q.published));
    const payload = { published: newState };
    if (!q.weekNumber) {
      if (Array.isArray(q.weeks) && q.weeks.length) {
        const found = q.weeks.find(w => /^[1-9]\d*$/.test(String(w)));
        if (found) payload.weekNumber = Number(found);
        payload.weeks = q.weeks.map(String);
      } else if (q.weekKey && typeof q.weekKey === "string") {
        const m = q.weekKey.match(/-(\d{1,2})$/);
        if (m) {
          const num = Number(m[1]);
          if (num >= 1 && num <= 14) {
            payload.weekNumber = num;
            payload.weeks = [String(num)];
          }
        }
      } else if (q.week && Number.isFinite(Number(q.week))) {
        payload.weekNumber = Number(q.week);
        payload.weeks = [String(q.week)];
      }
    }
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api/quizzes/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    alert(newState ? "Quiz published — now visible to users" : "Quiz unpublished");
    await loadQuizzes();
  } catch (err) {
    console.error("togglePublish error:", err);
    alert("Publish failed: " + (err.message || err));
  }
}

// delete quiz (confirm) and refresh list
async function deleteQuiz(id, skipConfirm = false) {
  try {
    if (!id) throw new Error("missing id");
    if (!skipConfirm && !confirm("Delete quiz? This cannot be undone.")) return;
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api/quizzes/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers
    });
    if (!res.ok) throw new Error(await res.text());
    alert("Deleted");
    await loadQuizzes();
  } catch (err) {
    console.error("deleteQuiz error:", err);
    alert("Delete failed: " + (err.message || err));
  }
}

// regenerate quiz (calls backend generate endpoint, then refresh)
async function regenerateQuiz(id, showAlert = true) {
  try {
    if (!id) throw new Error("missing id");
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api/quizzes/${encodeURIComponent(id)}/generate`, {
      method: "POST",
      headers
    });
    if (!res.ok) throw new Error(await res.text());
    
    // Clear the specific quiz from cache to force fresh fetch
    const existingIndex = quizzesCache.findIndex(q => q.id === id);
    if (existingIndex >= 0) {
      quizzesCache.splice(existingIndex, 1);
    }
    
    if (showAlert) alert("Regenerated");
    await loadQuizzes();
    
    // If modal is open and showing this quiz, refresh it with force refresh
    if (currentEditingId === id) {
      const refreshedQuiz = await fetchQuiz(id, true); // Force refresh
      populateQuizForm(refreshedQuiz);
    }
  } catch (err) {
    console.error("regenerateQuiz error:", err);
    alert("Regenerate failed: " + (err.message || err));
  }
}

// helper: replace button node to remove existing event listeners, then set new handler
function setModalButtonHandler(buttonId, handler) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  // clone to remove ALL previous listeners, keep attributes
  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);
  clone.onclick = handler;
}

// --- Place this block at the VERY END of the file, after all functions (createNewQuiz, editQuiz, viewQuiz, saveQuizEdits, togglePublish, deleteQuiz, regenerateQuiz) ---

// Enhanced initialization with cyberpunk welcome message
window.loadQuizzes = loadQuizzes;
window.createNewQuiz = createNewQuiz;
window.editQuiz = editQuiz;
window.viewQuiz = viewQuiz;
window.saveQuizEdits = saveQuizEdits;
window.togglePublish = togglePublish;
window.deleteQuiz = deleteQuiz;
window.regenerateQuiz = regenerateQuiz;

// Enhanced DOM ready handler
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initializeQuizManager);
} else {
  initializeQuizManager();
}

async function initializeQuizManager() {
  // Initialize quiz management system silently
  // showNotification("🚀 Quiz Management System Initialized", 'info', 3000);
  
  // Setup enhanced search with debounce
  const searchInput = document.getElementById("search");
  if (searchInput) {
    const debouncedSearch = debounce((term) => {
      const filtered = applySearchFilter(term);
      renderTable(filtered);
      if (term && filtered.length === 0) {
        showNotification(`🔍 No results found for "${term}"`, 'warning', 2000);
      }
    }, 300);
    
    searchInput.addEventListener("input", (e) => debouncedSearch(e.target.value));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.target.value = "";
        debouncedSearch("");
      }
    });
  }
  
  // Setup refresh button with enhanced feedback
  const refreshBtn = document.getElementById("btn-refresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      // Show initial refresh notification
      showNotification('🔄 Refreshing quiz data...', 'info');
      
      setLoadingState(refreshBtn, true);
      
      try {
        await loadQuizzes(false); // Don't show default success notification
        
        // Success notification after load completes
        setTimeout(() => {
          showNotification('✅ Quiz data refreshed successfully', 'success');
        }, 1000);
        
      } catch (error) {
        console.error('Refresh failed:', error);
        showNotification('❌ Failed to refresh quiz data', 'error');
      } finally {
        setLoadingState(refreshBtn, false);
      }
    });
  }
  
  // Enhanced modal controls
  const modalBackdrop = document.getElementById("modalBackdrop");
  const modalClose = document.getElementById("modalClose");
  const modal = document.getElementById("quizModal");
  
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", closeModal);
  }
  
  if (modalClose) {
    modalClose.addEventListener("click", closeModal);
  }
  
  // Escape key to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.style.display !== "none") {
      closeModal();
    }
  });
  
  // Load initial data silently
  try {
    await loadQuizzes(false);
  } catch (err) {
    showNotification("Failed to initialize quiz data", 'error');
  }
}

function closeModal() {
  const modal = document.getElementById("quizModal");
  const backdrop = document.getElementById("modalBackdrop");
  
  if (modal) {
    modal.style.display = "none";
    modal.style.transform = "translate(-50%, -50%) scale(0.8)";
    modal.style.opacity = "0";
    setTimeout(() => {
      modal.style.transform = "translate(-50%, -50%) scale(1)";
      modal.style.opacity = "1";
    }, 200);
  }
  
  if (backdrop) backdrop.style.display = "none";
  currentEditingId = null;
  modalMode = "view";
}

function openModal() {
  const modal = document.getElementById("quizModal");
  const backdrop = document.getElementById("modalBackdrop");
  
  if (backdrop) backdrop.style.display = "block";
  if (modal) {
    modal.style.display = "block";
    modal.style.transform = "translate(-50%, -50%) scale(0.8)";
    modal.style.opacity = "0";
    setTimeout(() => {
      modal.style.transform = "translate(-50%, -50%) scale(1)";
      modal.style.opacity = "1";
    }, 50);
  }
}