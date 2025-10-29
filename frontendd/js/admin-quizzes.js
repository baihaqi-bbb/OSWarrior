// Simple admin manage quizzes UI (uses /api/quizzes endpoints)
const API_BASE = "https://oswarrior-backend.onrender.com";

// global modal state
let currentEditingId = null;
let modalMode = "view"; // "view" | "edit" | "create"

// client-side cache + debounce + simple filter
let quizzesCache = [];
function debounce(fn, wait = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
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

// replace loadQuizzes to fill client cache
async function loadQuizzes() {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/quizzes`, { headers });
  if (!res.ok) {
    console.error("Failed loading quizzes", await res.text().catch(()=>""));
    quizzesCache = [];
    renderTable([]);
    return [];
  }
  const list = await res.json();
  quizzesCache = Array.isArray(list) ? list : [];
  renderTable(quizzesCache);
  return quizzesCache;
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

async function fetchQuiz(id) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/quizzes/${encodeURIComponent(id)}`, { headers });
  if (!res.ok) throw new Error("Not found");
  return await res.json();
}

// ensure modal form HTML exists (used by view/edit if create modal not opened yet)
function ensureQuizFormExists() {
  const modalBody = $el("modalBody");
  if (!modalBody) return;
  if ($el("quizTitle")) return; // already present

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

// unified render table
function renderTable(list) {
  const tbody = document.querySelector("#quizzesTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  list.forEach(q => {
    const weekLabel = parseWeekLabel(q);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(q.id || q.quizId || "")}</td>
      <td>${escapeHtml(q.title || "(untitled)")}</td>
      <td>${escapeHtml(q.createdBy || q.owner || "")}</td>
      <td>${escapeHtml(weekLabel)}</td>
      <td>${q.published ? "Yes" : "No"}</td>
      <td>${Array.isArray(q.questions) ? q.questions.length : "-"}</td>
      <td>
        <button class="btn-view" data-id="${escapeHtml(q.id||q.quizId)}">View</button>
        <button class="btn-edit" data-id="${escapeHtml(q.id||q.quizId)}">Edit</button>
        <button class="btn-pub" data-id="${escapeHtml(q.id||q.quizId)}">${q.published ? "Unpublish" : "Publish"}</button>
        <button class="btn-reg" data-id="${escapeHtml(q.id||q.quizId)}">Regenerate</button>
        <button class="btn-del" data-id="${escapeHtml(q.id||q.quizId)}" style="color:#c00">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // use the button element itself to read dataset.id (avoid e.target issues)
  document.querySelectorAll(".btn-view").forEach(b => b.addEventListener("click", () => viewQuiz(b.dataset.id)));
  document.querySelectorAll(".btn-edit").forEach(b => b.addEventListener("click", () => editQuiz(b.dataset.id)));
  document.querySelectorAll(".btn-pub").forEach(b => b.addEventListener("click", () => togglePublish(b.dataset.id)));
  document.querySelectorAll(".btn-reg").forEach(b => b.addEventListener("click", () => regenerateQuiz(b.dataset.id)));
  document.querySelectorAll(".btn-del").forEach(b => b.addEventListener("click", () => deleteQuiz(b.dataset.id)));
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
    <div style="border:1px solid #e6e6e6;padding:10px;border-radius:8px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong>Question ${idx+1}</strong>
        <button type="button" class="remove-question" style="background:transparent;color:#c00;border:0">Remove</button>
      </div>
      <div style="margin-top:8px">
        <textarea class="q-text" style="width:100%;height:64px;padding:8px">${escapeHtml(text)}</textarea>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
        ${choices.map((c,i)=>`
          <label style="display:flex;align-items:center;gap:8px">
            <input type="radio" name="answer-${idx}" value="${i}" ${i===answerIndex ? "checked":""}/>
            <input class="choice-input" type="text" value="${escapeHtml(c)}" style="flex:1;padding:6px"/>
          </label>`).join("")}
      </div>
    </div>
  `.trim();

  wrapper.querySelector(".remove-question").addEventListener("click", () => {
    wrapper.remove();
    // renumber labels
    document.querySelectorAll("#questionsList .question-block").forEach((b,i)=> {
      b.querySelector("strong").textContent = "Question " + (i+1);
      b.dataset.idx = String(i);
      // update radio names
      const radios = b.querySelectorAll('input[type="radio"]');
      radios.forEach((r,ri) => r.name = `answer-${i}`);
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

  // initial load AFTER DOM ready
  loadQuizzes();
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
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
          ${opts.map((o,i)=>`
            <label style="display:flex;align-items:center;gap:8px">
              <input type="radio" name="answer-${idx}" value="${i}" ${i===answerIndex ? "checked":""}/>
              <input class="choice-input" type="text" value="${escapeHtml(o)}" style="flex:1;padding:6px"/>
            </label>`).join("")}
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
    if (showAlert) alert("Regenerated");
    await loadQuizzes();
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

// Expose functions to window and start initial load (moved to file end)
window.loadQuizzes = loadQuizzes;
window.createNewQuiz = createNewQuiz;
window.editQuiz = editQuiz;
window.viewQuiz = viewQuiz;
window.saveQuizEdits = saveQuizEdits;
window.togglePublish = togglePublish;
window.deleteQuiz = deleteQuiz;
window.regenerateQuiz = regenerateQuiz;

// call loadQuizzes once DOM ready (only once)
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => { loadQuizzes(); });
} else {
  loadQuizzes();
}