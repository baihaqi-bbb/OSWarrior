import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
const API_BASE = "http://localhost:4000";
import {
  getFirestore, collection, getDocs, query, orderBy,
  updateDoc, doc, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Use already-initialized Firebase app from js/home-admin.js
const auth = getAuth();
const db = getFirestore();

let usersCache = [];

// require admin role and load users
onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "index.html";
  try {
    const meDoc = await getDoc(doc(db, "users", user.uid));
    const me = meDoc.exists() ? meDoc.data() : null;
    if (!me || me.role !== "admin") return window.location.href = "index.html";
    await loadUsers();
  } catch (e) {
    console.error("Role check / load users error:", e);
    window.location.href = "index.html";
  }
});

async function loadUsers() {
  try {
    const q = query(collection(db, "users"), orderBy("email"));
    const snap = await getDocs(q);
    usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTable(usersCache);
  } catch (err) {
    console.error("loadUsers error:", err);
    const tbody = document.querySelector("#usersTable tbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="5">Gagal memuat pengguna</td></tr>`;
  }
}

function renderTable(list) {
  const tbody = document.querySelector("#usersTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  list.forEach(u => {
    const tr = document.createElement("tr");
    tr.dataset.uid = u.id;
    tr.innerHTML = `
      <td>${u.email||""}</td>
      <td>${u.name||""}</td>
      <td>
        <select class="role-select">
          <option value="user" ${u.role==='user'?'selected':''}>user</option>
          <option value="moderator" ${u.role==='moderator'?'selected':''}>moderator</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
        </select>
      </td>
      <td class="disabled-cell">${u.disabled? 'Yes' : 'No'}</td>
      <td>
        <button class="toggle-disable">${u.disabled? 'Enable' : 'Disable'}</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// event delegation for role changes and disable toggle
document.querySelector("#usersTable tbody")?.addEventListener("change", async (e) => {
  const target = e.target;
  if (target.classList && target.classList.contains("role-select")) {
    const tr = target.closest("tr");
    const uid = tr?.dataset.uid;
    const newRole = target.value;
    if (!uid) return;
    if (!confirm(`Tukar role pengguna ini ke "${newRole}"?`)) {
      const u = usersCache.find(x => x.id === uid);
      if (u) target.value = u.role || "user";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/set-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUid: uid, role: newRole })
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Request failed");

      alert("Role berjaya dikemaskini (server). Pengguna perlu sign out & sign in semula.");
      await loadUsers();
    } catch (err) {
      console.error("set role via backend error:", err);
      alert("Gagal update role: " + (err.message || err));
      const u = usersCache.find(x => x.id === uid);
      if (u) target.value = u.role || "user";
    }
  }
});

document.querySelector("#usersTable tbody")?.addEventListener("click", async (e) => {
  const target = e.target;
  if (target.classList && target.classList.contains("toggle-disable")) {
    const tr = target.closest("tr");
    const uid = tr?.dataset.uid;
    if (!uid) return;
    const u = usersCache.find(x => x.id === uid);
    if (!u) return;
    const newDisabled = !u.disabled;
    if (!confirm(`${newDisabled ? 'Disable' : 'Enable'} user ${u.email || u.name}?`)) return;
    try {
      await updateDoc(doc(db, "users", uid), { disabled: newDisabled });
      await loadUsers();
    } catch (err) {
      console.error("toggle disable error:", err);
      alert("Gagal kemaskini status. Periksa permission / security rules.");
    }
  }
});

// search safe attach
const searchEl = document.getElementById("search");
if (searchEl) {
  searchEl.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    renderTable(usersCache.filter(u => (u.email||"").toLowerCase().includes(q) || (u.name||"").toLowerCase().includes(q)));
  });
}

// export CSV
const exportBtn = document.getElementById("exportCsv");
if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    const rows = usersCache.map(u => [u.email||"", u.name||"", u.role||"", u.disabled ? "1" : "0"]);
    const csv = [["email","name","role","disabled"], ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "users.csv";
    a.click();
  });
}

// expose signOut for admin-common.js
window.firebaseSignOut = async function () {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("firebaseSignOut error:", e);
    throw e;
  }
};