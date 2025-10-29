// Exported fetchLeaderboard() — tries backend endpoints then optional Firebase fallback.

const RELATIVE_PATHS = [
  "/api/leaderboard",
  "/api/admin/leaderboard",
  "/leaderboard",
  "/api/v1/leaderboard"
];

// absolute host fallbacks (override with window.BACKEND_BASE if needed)
const ABS_HOSTS = [
  window.BACKEND_BASE || null,
  "http://localhost:4000",
  "http://127.0.0.1:4000"
].filter(Boolean);

export const LB_CANDIDATES = [
  ...RELATIVE_PATHS,
  ...ABS_HOSTS.flatMap(h => RELATIVE_PATHS.map(p => `${h}${p}`))
].filter((v,i,a) => a.indexOf(v) === i);

async function tryFetch(url) {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

const firebaseConfig = window.FIREBASE_CONFIG || null;

async function loadFirebaseCompat() {
  if (window.firebase) return window.firebase;
  const load = src => new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  await load("https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js");
  await load("https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js");
  await load("https://www.gstatic.com/firebasejs/9.22.1/firebase-database-compat.js");
  return window.firebase;
}

async function fetchFromFirebase() {
  if (!firebaseConfig) return { error: "No firebaseConfig provided" };
  try {
    const firebase = await loadFirebaseCompat();
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

    if (firebase.firestore) {
      const db = firebase.firestore();
      const snap = await db.collection("leaderboard").orderBy("score", "desc").get();
      return snap.docs.map((d,i)=>{
        const data = d.data() || {};
        return {
          rank: data.rank ?? (i+1),
          username: data.username ?? data.name ?? d.id,
          score: data.score ?? data.totalScore ?? 0,
          lastActive: data.lastActive ?? data.lastSeen
        };
      });
    }

    if (firebase.database) {
      const db = firebase.database();
      const snap = await db.ref("/leaderboard").once("value");
      const val = snap.val() || {};
      const arr = Object.keys(val).map((k,i)=>{
        const it = val[k] || {};
        return {
          rank: it.rank ?? (i+1),
          username: it.username ?? it.name ?? k,
          score: it.score ?? it.totalScore ?? 0,
          lastActive: it.lastActive ?? it.lastSeen
        };
      }).sort((a,b)=> (b.score||0)-(a.score||0));
      return arr;
    }

    return { error: "Firebase loaded but no Firestore/Database available" };
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

export async function fetchLeaderboard() {
  for (const url of LB_CANDIDATES) {
    const r = await tryFetch(url);
    if (r.ok) return Array.isArray(r.data) ? r.data : [];
    console.warn("leaderboard try failed:", url, r.error && r.error.message);
  }

  // backend failed -> try firebase if configured
  if (firebaseConfig) {
    const fb = await fetchFromFirebase();
    if (Array.isArray(fb)) return fb;
    return { error: fb && fb.error ? fb.error : "Firebase fallback failed" };
  }

  return { error: "No leaderboard endpoint found (tried: " + LB_CANDIDATES.join(", ") + "). Provide backend or set window.FIREBASE_CONFIG." };
}