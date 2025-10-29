import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const auth = getAuth();
const WEEKS_COUNT = 14;
const API_BASE = "http://localhost:4000"; // adjust jika backend di host/port lain

document.addEventListener("DOMContentLoaded", () => {
  const fileEl = document.getElementById("file");
  const weeksEl = document.getElementById("weeks");
  const btn = document.getElementById("uploadBtn");
  const out = document.getElementById("uploadOut") || (() => {
    const p = document.createElement("pre"); p.id = "uploadOut"; document.body.appendChild(p); return p;
  })();

  if (!btn) {
    console.warn("#uploadBtn not found in page");
    return;
  }

  btn.addEventListener("click", async () => {
    try {
      if (!fileEl || !fileEl.files || !fileEl.files[0]) {
        alert("Sila pilih fail untuk diupload.");
        return;
      }

      // pastikan weeks ditakrifkan
      let weeks = ["1"];
      if (weeksEl && String(weeksEl.value).trim()) {
        try {
          // terima input sama ada "1" atau "1,2" atau JSON array
          const raw = String(weeksEl.value).trim();
          if (raw.startsWith("[")) weeks = JSON.parse(raw);
          else weeks = raw.split(",").map(s => s.trim()).filter(Boolean);
          if (!Array.isArray(weeks) || weeks.length === 0) weeks = ["1"];
        } catch (e) {
          weeks = [String(weeksEl.value).trim() || "1"];
        }
      }

      const form = new FormData();
      form.append("file", fileEl.files[0]);
      form.append("weeks", JSON.stringify(weeks));

      const res = await fetch(`${API_BASE}/api/upload-notes`, { method: "POST", body: form });
      const text = await res.text();
      if (!res.ok) {
        out.textContent = `Upload failed (${res.status}):\n${text}`;
        throw new Error(text || `Status ${res.status}`);
      }

      try { out.textContent = JSON.stringify(JSON.parse(text), null, 2); } catch { out.textContent = text; }
      alert("Upload berjaya");
    } catch (err) {
      console.error(err);
      alert("Ralat upload: " + (err.message || err));
    }
  });
});

const weekDropdownBtn = document.getElementById("week-dropdown-btn");
const weekDropdownPanel = document.getElementById("week-dropdown-panel");
const weekListEl = document.getElementById("week-list");
const selectAllBtn = document.getElementById("select-all");
const clearAllBtn = document.getElementById("clear-all");
const doneWeeksBtn = document.getElementById("done-weeks");
const selectedCountEl = document.getElementById("selected-count");
const selectedChipsEl = document.getElementById("selected-chips");

const chooseFileBtn = document.getElementById("choose-file");
const fileNameEl = document.getElementById("file-name");
const uploadBtn = document.getElementById("upload-btn");
const statusEl = document.getElementById("upload-status");

const uploadTableBody = document.querySelector("#uploadTable tbody");

let selectedWeeks = new Set();
let selectedFile = null;
let currentUser = null;

function buildWeekList(){
  weekListEl.innerHTML = "";
  for (let i = 1; i <= WEEKS_COUNT; i++){
    const row = document.createElement("label");
    row.className = "week-row";
    row.innerHTML = `<input type="checkbox" data-week="${i}"> <span>Week ${i}</span>`;
    weekListEl.appendChild(row);
  }
}
function updateUI(){
  selectedCountEl.textContent = `(${selectedWeeks.size})`;
  selectedChipsEl.innerHTML = "";
  Array.from(selectedWeeks).sort((a,b)=>Number(a)-Number(b)).forEach(w=>{
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `<span>Week ${w}</span><button data-week="${w}" aria-label="remove">✕</button>`;
    selectedChipsEl.appendChild(chip);
  });
  uploadBtn.disabled = !(selectedWeeks.size && selectedFile && currentUser);
}

buildWeekList();
updateUI();

/* dropdown behaviour */
weekDropdownBtn?.addEventListener("click", (e)=>{ e.stopPropagation(); weekDropdownPanel.classList.toggle("hidden"); });
window.addEventListener("click", ()=> weekDropdownPanel?.classList.add("hidden"));

weekListEl?.addEventListener("click", (e)=>{
  const lab = e.target.closest(".week-row");
  if (!lab) return;
  const cb = lab.querySelector("input[type=checkbox]");
  cb.checked = !cb.checked;
  cb.dispatchEvent(new Event("change", { bubbles:true }));
});

weekListEl?.addEventListener("change", (e)=>{
  const cb = e.target;
  const wk = cb.dataset.week;
  if (!wk) return;
  if (cb.checked) selectedWeeks.add(wk); else selectedWeeks.delete(wk);
  updateUI();
});

/* panel shortcuts */
selectAllBtn?.addEventListener("click", ()=>{
  selectedWeeks = new Set(); for (let i=1;i<=WEEKS_COUNT;i++) selectedWeeks.add(String(i));
  weekListEl.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = true);
  updateUI();
});
clearAllBtn?.addEventListener("click", ()=>{
  selectedWeeks.clear();
  weekListEl.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
  updateUI();
});
doneWeeksBtn?.addEventListener("click", ()=> weekDropdownPanel.classList.add("hidden"));

/* chip remove */
selectedChipsEl?.addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-week]");
  if (!btn) return;
  const wk = btn.dataset.week;
  selectedWeeks.delete(wk);
  const cb = weekListEl.querySelector(`input[data-week="${wk}"]`);
  if (cb) cb.checked = false;
  updateUI();
});

/* auth state */
onAuthStateChanged(auth, user => {
  currentUser = user;
  uploadBtn.disabled = !(selectedWeeks.size && selectedFile && currentUser);
});

/* choose file */
chooseFileBtn?.addEventListener("click", ()=>{
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".pdf,.docx,.txt";
  inp.onchange = ()=> {
    selectedFile = inp.files[0] || null;
    fileNameEl.textContent = selectedFile ? selectedFile.name : "No file chosen";
    uploadBtn.disabled = !(selectedWeeks.size && selectedFile && currentUser);
  };
  inp.click();
});

/* add row to table */
function addQuizRow(quiz){
  uploadTableBody.querySelectorAll(".empty-row").forEach(r=>r.remove());
  const tr = document.createElement("tr");
  const created = quiz.createdAt || new Date().toLocaleString();
  tr.innerHTML = `
    <td>${(quiz.weeks||[]).join(", ")}</td>
    <td>${quiz.title || "Quiz"}</td>
    <td>${quiz.sourceFileName || "-"}</td>
    <td>${created}</td>
    <td>${(quiz.questions||[]).length}</td>
    <td><a href="admin-quizzes.html">Open</a></td>
  `;
  uploadTableBody.prepend(tr);
}

/* upload handler */
uploadBtn?.addEventListener("click", async ()=>{
  if (!currentUser) return alert("Not authenticated as admin.");
  if (!selectedFile) return alert("Choose a file first.");
  if (!selectedWeeks.size) return alert("Select at least one week.");

  uploadBtn.disabled = true;
  statusEl.textContent = "Uploading…";

  try {
    const idToken = await currentUser.getIdToken(true);
    const form = new FormData();
    form.append("file", selectedFile);
    form.append("weeks", JSON.stringify(Array.from(selectedWeeks)));

    const res = await fetch(`${API_BASE}/api/upload-notes`, {
      method: "POST",
      headers: { "Authorization": "Bearer " + idToken },
      body: form
    });

    const data = await res.json().catch(()=>null);
    if (!res.ok) {
      throw new Error(data?.error || data?.detail || "Upload failed");
    }

    // add to table using returned quiz if provided
    const quiz = data?.quiz || { weeks: Array.from(selectedWeeks), title: data?.title || selectedFile.name, sourceFileName: selectedFile.name, questions: data?.questions || [] };
    addQuizRow(quiz);
    alert("Quiz generated: " + (data.quizId || ""));
  } catch (err) {
    console.error(err);
    alert("Upload error: " + (err.message || err));
  } finally {
    uploadBtn.disabled = false;
    statusEl.textContent = "";
  }
});