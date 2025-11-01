import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import admin from "firebase-admin";

dotenv.config();

const PORT = process.env.PORT || 4000;
const app = express();

// CORS: reflect origin and allow credentials for dev and production hosts
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = [
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://localhost:4000',
      'http://127.0.0.1:4000',
      'https://oswarrior.com',
      'https://www.oswarrior.com',
      'https://frontendd-zne8.onrender.com',
      'https://oswarrior-iyii.onrender.com'
    ];
    if (allowed.includes(origin) || /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','X-User-Id','X-Request-Id']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// memoryStorage for uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// try initialize Firestore using service account (env GOOGLE_APPLICATION_CREDENTIALS or known filenames)
let useFirestore = false;
let db = null;

// Skip Firebase initialization if explicitly disabled
if (process.env.DISABLE_FIREBASE === "true") {
  console.log("Firebase disabled via DISABLE_FIREBASE environment variable");
  useFirestore = false;
} else {
  try {
    const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const candidatePaths = [
      envPath,
      path.join(process.cwd(), "firebase-service-account.json"),
      path.join(process.cwd(), "serviceAccountKey.json"),
      path.join(process.cwd(), "service-account.json")
    ].filter(Boolean);
  let found = null;
  for (const p of candidatePaths) {
    if (p && fs.existsSync(p)) { found = p; break; }
  }
  if (found) {
    const sa = JSON.parse(fs.readFileSync(found, "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    db = admin.firestore();
    useFirestore = true;
    console.log("✅ Firebase Admin initialized — using Firestore (", found, ")");
  } else {
    try {
      admin.initializeApp();
      db = admin.firestore();
      useFirestore = true;
      console.log("✅ Firebase Admin initialized — using application default credentials");
    } catch (e) {
      console.log("⚠️ Firebase credentials not found — using local DB");
      useFirestore = false;
    }
  }
} catch (e) {
  console.warn("⚠️ Firebase init failed — falling back to local DB:", e?.message || e);
  useFirestore = false;
}
}

// ensure local data folder
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const localDbPath = path.join(dataDir, "quizzes.json");
if (!fs.existsSync(localDbPath)) fs.writeFileSync(localDbPath, "[]", "utf8");

function readLocalQuizzes() {
  try { return JSON.parse(fs.readFileSync(localDbPath, "utf8") || "[]"); } catch { return []; }
}
function saveLocalQuiz(q) {
  const arr = readLocalQuizzes();
  const id = String(Date.now());
  arr.push({ id, ...q });
  fs.writeFileSync(localDbPath, JSON.stringify(arr, null, 2), "utf8");
  return id;
}

async function extractTextFromBuffer(file) {
  if (!file || !file.buffer) throw new Error("No uploaded file buffer");
  const buffer = file.buffer;
  const name = (file.originalname || "").toLowerCase();
  const ext = path.extname(name).replace(".", "");

  if (ext === "pdf") {
    try {
      const mod = await import("pdf-parse");
      const pdfParse = mod?.default || mod;
      const data = await pdfParse(buffer);
      return String(data.text || "").trim();
    } catch (err) {
      console.warn("pdf-parse failed, fallback to utf8:", err?.message || err);
      return buffer.toString("utf8");
    }
  }

  if (ext === "docx" || ext === "doc") {
    try {
      const mammothMod = await import("mammoth");
      const mammoth = mammothMod?.default || mammothMod;
      const res = await mammoth.extractRawText({ buffer });
      return String(res.value || "").trim();
    } catch (err) {
      console.warn("mammoth failed, fallback to utf8:", err?.message || err);
      return buffer.toString("utf8");
    }
  }

  return buffer.toString("utf8").trim();
}

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
async function callOpenAI(prompt) {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not set");
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are an assistant that returns STRICT JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1500
    })
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${t}`);
  }
  const j = await resp.json();
  return j.choices?.[0]?.message?.content || "";
}

// Validate if OpenAI response contains good questions
function isValidOpenAIResponse(parsed) {
  if (!parsed || !parsed.questions || !Array.isArray(parsed.questions)) return false;
  if (parsed.questions.length !== 5) return false; // Must have exactly 5 questions
  
  for (const q of parsed.questions) {
    if (!q.question || !q.options || !Array.isArray(q.options)) return false;
    if (q.options.length !== 4) return false;
    if (typeof q.answerIndex !== 'number' || q.answerIndex < 0 || q.answerIndex > 3) return false;
    
    // Check if options are meaningful (not just single letters)
    if (q.options.some(opt => opt.length < 5)) return false;
  }
  
  return true;
}

// routes
app.get("/", (req, res) => res.send("Server OK"));
app.get("/api/health", (req, res) => res.json({ ok: true, port: PORT, storage: useFirestore ? "firestore" : "local" }));

app.post("/api/upload-notes", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded (use field 'file')" });

    let weeks = null;
    if (req.body?.weeks) {
      try {
        weeks = JSON.parse(req.body.weeks);
        if (!Array.isArray(weeks)) weeks = [String(weeks)];
      } catch {
        weeks = String(req.body.weeks).split(",").map(s => s.trim()).filter(Boolean);
        if (!weeks.length) weeks = null;
      }
    } else if (req.body?.week) {
      weeks = [String(req.body.week)];
    }

    let extractedText = "";
    try {
      extractedText = await extractTextFromBuffer(req.file);
    } catch (e) {
      console.error("extract error:", e);
      return res.status(500).json({ error: "Failed to extract text: " + String(e.message) });
    }

    // 100% OpenAI - No fallback questions
    if (!OPENAI_KEY) {
      return res.status(500).json({ 
        error: "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable." 
      });
    }

    console.log("Using OpenAI for quiz generation...");
    const prompt = `You are an expert Operating Systems instructor. Based on the lecture notes provided, create exactly 5 high-quality multiple choice questions.

Return ONLY valid JSON in this exact format:
{
  "title": "Operating Systems Quiz - Week [X]",
  "sourcePreview": "${extractedText.slice(0, 200).replace(/"/g, '\\"')}",
  "questions": [
    {
      "question": "Clear, specific Operating Systems question",
      "type": "mcq",
      "options": [
        "Detailed correct answer with proper OS terminology",
        "Plausible but incorrect option with OS concepts",
        "Another plausible but incorrect option",
        "Fourth plausible but incorrect option"
      ],
      "answerIndex": 0
    }
  ]
}

CRITICAL REQUIREMENTS:
1. Generate EXACTLY 5 questions
2. Questions must cover Operating Systems concepts: processes, threads, memory management, file systems, CPU scheduling, deadlocks, synchronization, I/O systems
3. Each question must have 4 detailed options (minimum 20 characters each)
4. Only one correct answer per question (indicated by answerIndex 0-3)
5. Use proper technical terminology
6. Questions should test understanding, not just memorization
7. Avoid generic or placeholder text

Lecture Notes Content:
${extractedText.slice(0, 4000)}

Remember: Return ONLY the JSON object, no additional text.`;

    let parsed = null;
    try {
      const modelOutput = await callOpenAI(prompt);
      console.log("OpenAI raw response length:", modelOutput.length);
      
      // Extract JSON from response
      const jsonMatch = modelOutput.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in OpenAI response");
      }
      
      const jsonText = jsonMatch[0];
      parsed = JSON.parse(jsonText);
      
      // Validate response quality
      if (!isValidOpenAIResponse(parsed)) {
        throw new Error("OpenAI response failed quality validation");
      }
      
      console.log("✅ OpenAI generated", parsed.questions.length, "valid questions");
      
    } catch (e) {
      console.error("OpenAI generation failed:", e.message);
      return res.status(500).json({ 
        error: `Quiz generation failed: ${e.message}. Please try again or check your lecture notes content.`
      });
    }

    async function expandShortOptions(questionText, shortOptions) {
      if (!OPENAI_KEY) return null;
      const prompt = `
You are an Operating Systems expert. Given a multiple choice question and short option labels, create detailed, meaningful options.

IMPORTANT: Generate STRICT JSON only with this structure:
{"options":["Full detailed option A for OS concept","Full detailed option B for OS concept","Full detailed option C for OS concept","Full detailed option D for OS concept"], "answerIndex": <0-3>}

Requirements:
- Make options comprehensive and technically accurate for Operating Systems
- Each option should be a complete, meaningful statement about OS concepts
- Options must be plausible but clearly distinguishable
- Use proper OS terminology (processes, threads, memory, scheduling, etc.)
- Only one option should be clearly correct
- If short labels suggest content, expand appropriately

Question: ${questionText}
Short labels: ${JSON.stringify(shortOptions)}
`;
      try {
        const out = await callOpenAI(prompt);
        const m = out.match(/\{[\s\S]*\}/m);
        const jsonText = m ? m[0] : out;
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed.options) && parsed.options.length === 4 && Number.isFinite(parsed.answerIndex)) {
          return { options: parsed.options.map(String), answerIndex: Number(parsed.answerIndex) };
        }
      } catch (e) {
        console.warn("expandShortOptions failed:", e?.message || e);
      }
      return null;
    }

    const normalizedQuestions = [];
    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    for (let idx = 0; idx < Math.min(5, rawQuestions.length); idx++) {
      const q = rawQuestions[idx] || {};
      const qq = {};
      qq.question = String(q.question || (`Question ${idx+1}`)).trim();
      qq.type = "mcq";

      let opts = Array.isArray(q.options) ? q.options.map(s => String(s||"").trim()) : [];
      const allSingleLetter = opts.length && opts.every(o => /^[A-Za-z]{1,2}$/.test(o));
      if (allSingleLetter) {
        const expanded = await expandShortOptions(qq.question, opts).catch(()=>null);
        if (expanded) {
          opts = expanded.options;
          qq.answerIndex = expanded.answerIndex;
        }
      }

      opts = opts.filter(Boolean).slice(0,4);
      while (opts.length < 4) opts.push(`Option ${opts.length+1}`);
      qq.options = opts;

      if (typeof qq.answerIndex !== "number") {
        let ai = (q && Number.isFinite(Number(q.answerIndex))) ? Number(q.answerIndex) : null;
        if (ai === null && q && q.answer) {
          const found = opts.findIndex(o => o.trim() === String(q.answer).trim());
          ai = found >= 0 ? found : 0;
        }
        if (ai === null) ai = 0;
        if (ai < 0 || ai > 3) ai = 0;
        qq.answerIndex = ai;
      }

      normalizedQuestions.push(qq);
    }

    while (normalizedQuestions.length < 5) {
      const i = normalizedQuestions.length + 1;
      normalizedQuestions.push({ question: `Extra question ${i}?`, type: "mcq", options: ["A","B","C","D"], answerIndex: 0 });
    }

    const quizDoc = {
      title: parsed.title || `Quiz from ${req.file.originalname || "notes"}`,
      sourcePreview: parsed.sourcePreview || extractedText.slice(0, 200),
      questions: normalizedQuestions,
      weeks: weeks || null,
      sourceFileName: req.file.originalname || null,
      createdAt: new Date().toISOString()
    };

    let quizId = null;
    if (useFirestore && db) {
      const docRef = await db.collection("quizzes").add(quizDoc);
      quizId = docRef.id;
    } else {
      quizId = saveLocalQuiz(quizDoc);
    }

    return res.json({ ok: true, quizId, quiz: quizDoc });
  } catch (err) {
    console.error("upload error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

// session store + quiz handlers (unchanged)
const QUESTIONS_PER_QUIZ = 5;
const activeQuizzes = {};

function shuffle(array) {
  return array
    .map(v => ({ v, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map(x => x.v);
}

async function findQuizByWeekParam(weekParam) {
  const w = String(weekParam || "").trim();
  const maybeNum = Number(w);
  const matches = [];

  if (useFirestore && db) {
    const snap = await db.collection("quizzes").where("published", "==", true).get();
    snap.forEach(d => matches.push({ id: d.id, data: d.data() || {} }));
  } else {
    const p = path.join(process.cwd(), "data", "quizzes.json");
    const arr = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8") || "[]") : [];
    arr.filter(q => q && q.published).forEach(q => matches.push({ id: q.id || q.quizId, data: q }));
  }

  if (!Number.isNaN(maybeNum) && maybeNum >= 1) {
    const byNum = matches.find(x => Number(x.data.weekNumber) === maybeNum || Number(x.data.week) === maybeNum);
    if (byNum) return byNum;
  }

  for (const m of matches) {
    const wk = m.data.weekKey || m.data.week || m.data.weeks;
    if (!wk) continue;
    if (typeof wk === "string" && wk === w) return m;
    if (typeof wk === "string") {
      const mm = wk.match(/-(\d{1,2})$/);
      if (mm && mm[1] === w) return m;
    }
    if (Array.isArray(wk)) {
      if (wk.includes(w)) return m;
      if (wk.find(x => String(x) === w)) return m;
    }
  }

  return matches.length ? matches[0] : null;
}

app.get("/api/week/:week/take", async (req, res) => {
  try {
    const week = String(req.params.week);
    if (!week) return res.status(400).json({ error: "Week required" });

    const userId = req.query.userId ? String(req.query.userId) : `anon_${Math.random().toString(36).slice(2,8)}`;
    const sessionKey = `${userId}_${week}`;

    let quiz = null;
    let quizId = null;

    if (useFirestore && db) {
      let snap = await db.collection("quizzes").where("published", "==", true).where("weeks", "array-contains", week).get();
      if (!snap.empty) {
        const docs = snap.docs;
        const chosen = docs[Math.floor(Math.random() * docs.length)];
        quizId = chosen.id;
        quiz = chosen.data();
      } else {
        let snap2 = await db.collection("quizzes").where("published", "==", true).where("week", "==", week).get();
        if (!snap2.empty) {
          const docs = snap2.docs;
          const chosen = docs[Math.floor(Math.random() * docs.length)];
          quizId = chosen.id;
          quiz = chosen.data();
        }
      }
    } else {
      const all = readLocalQuizzes();
      const candidates = all.filter(q => {
        if (!q || !q.published) return false;
        if (Array.isArray(q.weeks)) return q.weeks.map(String).includes(week);
        return String(q.week || q.weeks) === week;
      });
      if (candidates.length) {
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        quizId = chosen.id;
        quiz = chosen;
      }
    }

    if (!quiz) return res.status(404).json({ error: "No quizzes found for this week" });

    const allQuestions = Array.isArray(quiz.questions) ? quiz.questions : [];
    if (!allQuestions.length) return res.status(404).json({ error: "Quiz has no questions" });

    const indices = allQuestions.map((_, i) => i);
    const shuffled = shuffle(indices);
    const pickCount = Math.min(QUESTIONS_PER_QUIZ, allQuestions.length);
    const selected = shuffled.slice(0, pickCount);

    const questions = selected.map(i => {
      const q = allQuestions[i] || {};
      let opts = Array.isArray(q.options) ? q.options.slice() : [];
      if (!Array.isArray(opts) || opts.length === 0) opts = ["A","B","C","D"];
      for (let a = opts.length - 1; a > 0; a--) {
        const r = Math.floor(Math.random() * (a + 1));
        [opts[a], opts[r]] = [opts[r], opts[a]];
      }
      return {
        index: i,
        question: q.question || "",
        options: opts,
        type: "mcq"
      };
    });

    const correctAnswers = selected.map((i, idx) => {
      const origQ = allQuestions[i] || {};
      const origOptions = Array.isArray(origQ.options) ? origQ.options : null;
      const origCorrectText = (origOptions && typeof origQ.answerIndex === "number") ? String(origOptions[origQ.answerIndex]) : null;
      const returned = questions[idx];
      if (returned && Array.isArray(returned.options) && origCorrectText !== null) {
        const found = returned.options.find(o => String(o).trim() === String(origCorrectText).trim());
        return found !== undefined ? String(found) : null;
      }
      return null;
    });

    activeQuizzes[sessionKey] = {
      quizId,
      indices: selected,
      correctAnswers,
      expiresAt: Date.now() + 15 * 60 * 1000
    };

    return res.json({ quizId, sessionKey, questions });
  } catch (err) {
    console.error("take quiz error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.post("/api/week/:week/submit", async (req, res) => {
  try {
    const week = String(req.params.week);
    const {
      userId,
      username,
      displayName,
      email,
      userEmail,
      answers,
      quizId,
      questionIndexes,
      sessionKey: bodySessionKey
    } = req.body || {};

    if (!userId || !Array.isArray(answers)) return res.status(400).json({ error: "userId and answers array required" });

    const sessionKey = bodySessionKey || `${userId}_${week}`;
    let correctAnswers = null;

    if (activeQuizzes[sessionKey] && Array.isArray(activeQuizzes[sessionKey].correctAnswers)) {
      correctAnswers = activeQuizzes[sessionKey].correctAnswers;
    } else {
      let quizDoc = null;
      if (useFirestore && db && quizId) {
        const doc = await db.collection("quizzes").doc(String(quizId)).get();
        if (doc.exists) quizDoc = doc.data();
      } else if (quizId) {
        const all = readLocalQuizzes();
        quizDoc = all.find(q => String(q.id) === String(quizId)) || null;
      }
      if (quizDoc && Array.isArray(questionIndexes)) {
        correctAnswers = questionIndexes.map(idx => {
          const q = quizDoc.questions?.[idx];
          if (!q) return null;
          if (Array.isArray(q.options) && typeof q.answerIndex === "number") return String(q.options[q.answerIndex]);
          return null;
        });
      }
    }

    if (!correctAnswers) return res.status(400).json({ error: "No correct answers available for this session (session expired or invalid quizId)" });

    const total = Math.min(answers.length, correctAnswers.length);
    let score = 0;
    const details = [];

    for (let i = 0; i < total; i++) {
      const userAns = answers[i] == null ? null : String(answers[i]).trim();
      const corr = correctAnswers[i] == null ? null : String(correctAnswers[i]).trim();
      const correct = userAns && corr && userAns.toLowerCase() === corr.toLowerCase();
      if (correct) score++;
      details.push({ questionIndex: questionIndexes?.[i] ?? null, userAnswer: userAns, correctAnswer: corr, correct: !!correct });
    }

    const normalizedUsername =
      (displayName && String(displayName).trim()) ||
      (username && String(username).trim()) ||
      (email && String(email).includes("@") ? String(email).split("@")[0] : null) ||
      (userEmail && String(userEmail).includes("@") ? String(userEmail).split("@")[0] : null) ||
      (userId ? `User-${String(userId).slice(0,6)}` : "Anonymous");

    const resultDoc = {
      userId,
      username: normalizedUsername,
      userDisplayName: displayName || null,
      userEmail: email || userEmail || null,
      quizId: quizId || null,
      week,
      score,
      total,
      details,
      createdAt: new Date().toISOString()
    };

    let resultId = null;
    if (useFirestore && db) {
      const rRef = await db.collection("results").add(resultDoc);
      resultId = rRef.id;
    } else {
      const resultsPath = path.join(process.cwd(), "data", "results.json");
      try {
        let arr = [];
        if (fs.existsSync(resultsPath)) arr = JSON.parse(fs.readFileSync(resultsPath, "utf8") || "[]");
        const id = String(Date.now());
        arr.push({ id, ...resultDoc });
        fs.writeFileSync(resultsPath, JSON.stringify(arr, null, 2), "utf8");
        resultId = id;
      } catch (e) {
        console.warn("Failed to save local result:", e?.message || e);
      }
    }

    try {
      const xpGain = (Number(score) || 0) * 10 + ((Number(score) === Number(total)) ? 20 : 0);
      console.log(`XP Calculation: score=${score}, total=${total}, xpGain=${xpGain}`);
      console.log(`useFirestore=${useFirestore}, userId=${userId}`);
      
      if (useFirestore && db) {
        console.log("Using Firestore for XP update");
        const userRef = db.collection("users").doc(String(userId));
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(userRef);
          const curXp = snap.exists ? Number(snap.data().xp || 0) : 0;
          const newXp = curXp + xpGain;
          const newLevel = Math.floor(newXp / 100) + 1;
          tx.set(userRef, {
            xp: newXp,
            level: newLevel,
            displayName: resultDoc.userDisplayName || resultDoc.username || null,
            email: resultDoc.userEmail || null,
            lastXpAt: new Date().toISOString()
          }, { merge: true });
        });
        console.log(`Firestore XP updated for user ${userId}`);
      } else {
        console.log("Using JSON file for XP update");
        const usersPath = path.join(process.cwd(), "data", "users.json");
        console.log("Users file path:", usersPath);
        
        let users = {};
        if (fs.existsSync(usersPath)) {
          try { 
            users = JSON.parse(fs.readFileSync(usersPath, "utf8") || "{}"); 
            console.log("Current users data:", Object.keys(users));
          } catch { 
            console.log("Failed to parse users.json, using empty object");
            users = {}; 
          }
        } else {
          console.log("users.json doesn't exist, creating new");
        }
        
        const uid = String(userId);
        const cur = users[uid] || { xp: 0, level: 1, displayName: resultDoc.userDisplayName || resultDoc.username || `User-${uid.slice(0,6)}` };
        const oldXp = Number(cur.xp || 0);
        cur.xp = oldXp + xpGain;
        cur.level = Math.floor(cur.xp / 100) + 1;
        cur.displayName = resultDoc.userDisplayName || resultDoc.username || cur.displayName;
        cur.email = resultDoc.userEmail || cur.email || null;
        users[uid] = cur;
        
        console.log(`XP Update: ${uid} ${oldXp} -> ${cur.xp} (gained ${xpGain})`);
        
        try { 
          fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), "utf8"); 
          console.log("Successfully saved users.json");
        } catch(e){ 
          console.warn("save users.json failed", e?.message || e); 
        }
      }
    } catch (e) {
      console.warn("award xp failed:", e?.message || e);
    }

    const lbEntry = {
      id: resultId || String(Date.now()),
      userId,
      username: normalizedUsername || null,
      score,
      total,
      quizId: quizId || null,
      createdAt: new Date().toISOString()
    };

    if (useFirestore && db) {
      const docRef = db.collection("leaderboards").doc(String(week));
      const snap = await docRef.get();
      let board = [];
      if (snap.exists) board = snap.data().items || [];
      board.push(lbEntry);
      board.sort((a,b) => (b.score - a.score) || (new Date(b.createdAt) - new Date(a.createdAt)));
      board = board.slice(0, 10);
      await docRef.set({ items: board }, { merge: true });
    } else {
      const lbPath = path.join(process.cwd(), "data", "leaderboard.json");
      let dbObj = {};
      if (fs.existsSync(lbPath)) {
        try { dbObj = JSON.parse(fs.readFileSync(lbPath, "utf8") || "{}"); } catch { dbObj = {}; }
      }
      const weekArr = Array.isArray(dbObj[week]) ? dbObj[week] : [];
      weekArr.push(lbEntry);
      weekArr.sort((a,b) => (b.score - a.score) || (new Date(b.createdAt) - new Date(a.createdAt)));
      dbObj[week] = weekArr.slice(0, 10);
      try { fs.writeFileSync(lbPath, JSON.stringify(dbObj, null, 2), "utf8"); } catch (e) { console.warn("Failed to save local leaderboard:", e?.message || e); }
    }

    if (activeQuizzes[sessionKey]) delete activeQuizzes[sessionKey];

    return res.json({ ok: true, score, total, resultId, details });
  } catch (err) {
    console.error("submit error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    if (useFirestore && db) {
      const snap = await db.collection("leaderboards").get();
      const totals = {};
      snap.forEach(doc => {
        const data = doc.data() || {};
        const items = Array.isArray(data.items) ? data.items : [];
        items.forEach(it => {
          const uid = String(it.userId || it.id || it.username || "anon");
          totals[uid] = totals[uid] || { userId: uid, username: it.username || it.name || uid, totalScore: 0, totalAttempts: 0 };
          totals[uid].totalScore += Number(it.score || 0);
          totals[uid].totalAttempts += 1;
        });
      });
      const arr = Object.values(totals).sort((a,b) => b.totalScore - a.totalScore);
      return res.json(arr);
    } else {
      const lbPath = path.join(process.cwd(), "data", "leaderboard.json");
      let dbObj = {};
      if (fs.existsSync(lbPath)) {
        try { dbObj = JSON.parse(fs.readFileSync(lbPath, "utf8") || "{}"); } catch { dbObj = {}; }
      }
      const totals = {};
      Object.values(dbObj).forEach((weekArr) => {
        if (!Array.isArray(weekArr)) return;
        weekArr.forEach(it => {
          const uid = String(it.userId || it.id || it.username || "anon");
          totals[uid] = totals[uid] || { userId: uid, username: it.username || it.name || uid, totalScore: 0, totalAttempts: 0 };
          totals[uid].totalScore += Number(it.score || 0);
          totals[uid].totalAttempts += 1;
        });
      });
      const arr = Object.values(totals).sort((a,b) => b.totalScore - a.totalScore);
      return res.json(arr);
    }
  } catch (err) {
    console.error("/api/leaderboard error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.get("/api/leaderboard/:week", async (req, res) => {
  try {
    const week = String(req.params.week);
    if (!week) return res.status(400).json({ error: "Week required" });

    if (useFirestore && db) {
      const doc = await db.collection("leaderboards").doc(String(week)).get();
      if (!doc.exists) return res.status(404).json({ error: "Not found" });
      return res.json({ week, items: doc.data().items || [] });
    } else {
      const lbPath = path.join(process.cwd(), "data", "leaderboard.json");
      let dbObj = {};
      if (fs.existsSync(lbPath)) {
        try { dbObj = JSON.parse(fs.readFileSync(lbPath, "utf8") || "{}"); } catch { dbObj = {}; }
      }
      const items = Array.isArray(dbObj[week]) ? dbObj[week] : [];
      return res.json({ week, items });
    }
  } catch (err) {
    console.error("/api/leaderboard/:week error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.post("/api/admin/set-role", async (req, res) => {
  try {
    const { targetUid, role } = req.body || {};
    if (!targetUid || !role) return res.status(400).json({ error: "targetUid and role required" });

    if (useFirestore && db) {
      await db.collection("users").doc(String(targetUid)).set({ role }, { merge: true });
      return res.json({ ok: true, method: "firestore" });
    } else {
      const usersPath = path.join(process.cwd(), "data", "users.json");
      let arr = [];
      if (fs.existsSync(usersPath)) {
        try { arr = JSON.parse(fs.readFileSync(usersPath, "utf8") || "[]"); } catch { arr = []; }
      }
      let found = arr.find(u => String(u.id) === String(targetUid) || String(u.uid) === String(targetUid));
      if (found) {
        found.role = role;
      } else {
        arr.push({ id: String(targetUid), uid: String(targetUid), role });
      }
      fs.writeFileSync(usersPath, JSON.stringify(arr, null, 2), "utf8");
      return res.json({ ok: true, method: "local" });
    }
  } catch (err) {
    console.error("/api/admin/set-role error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.get("/api/top3", async (req, res) => {
  try {
    let top = [];

    if (typeof useFirestore !== "undefined" && useFirestore && db) {
      const q = await db.collection("users").orderBy("xp", "desc").limit(3).get();
      for (const doc of q.docs) {
        const d = doc.data() || {};
        let email = d.email || null;
        if (!email) {
          try { const au = await admin.auth().getUser(doc.id); email = au.email || null; } catch (e) { /* ignore */ }
        }
        top.push({
          userId: doc.id,
          name: d.name || d.displayName || d.username || `User-${String(doc.id).slice(0,6)}`,
          email,
          photoURL: d.photoURL || d.profileURL || d.avatar || null,
          xp: Number(d.xp || 0),
          level: Number(d.level || Math.floor((d.xp || 0) / 100) + 1)
        });
      }
    } else {
      // Fallback: return default demo users if file issues
      top = [
        {
          userId: "demo-user-1",
          name: "Ahmad Ali",
          email: "ahmad@example.com",
          photoURL: null,
          xp: 250,
          level: 3
        },
        {
          userId: "demo-user-2", 
          name: "Siti Sarah",
          email: "siti@example.com",
          photoURL: null,
          xp: 180,
          level: 2
        },
        {
          userId: "demo-user-3",
          name: "Rahman Ibrahim", 
          email: "rahman@example.com",
          photoURL: null,
          xp: 120,
          level: 2
        }
      ];

      // Try to read from file if available
      try {
        const usersPath = path.join(process.cwd(), "data", "users.json");
        console.log("Looking for users.json at:", usersPath);
        console.log("File exists:", fs.existsSync(usersPath));
        
        if (fs.existsSync(usersPath)) {
          const fileContent = fs.readFileSync(usersPath, "utf8");
          const usersObj = JSON.parse(fileContent || "{}");
          
          if (Object.keys(usersObj).length > 0) {
            top = Object.entries(usersObj)
              .map(([uid, u]) => ({
                userId: uid,
                name: u.displayName || u.name || u.username || `User-${String(uid).slice(0,6)}`,
                email: u.email || null,
                photoURL: u.photoURL || u.avatar || null,
                xp: Number(u.xp || 0),
                level: Number(u.level || Math.floor((u.xp || 0) / 100) + 1)
              }))
              .sort((a, b) => b.xp - a.xp)
              .slice(0, 3);
          }
        }
      } catch (err) {
        console.error("Error reading users.json, using fallback:", err);
        // Keep the default demo users
      }
    }

    return res.json({ top });
  } catch (err) {
    console.error("/api/top3 error:", err);
    
    // Return fallback data even on error
    const fallbackTop = [
      { userId: "demo-1", name: "Demo User 1", email: "demo1@example.com", photoURL: null, xp: 100, level: 1 },
      { userId: "demo-2", name: "Demo User 2", email: "demo2@example.com", photoURL: null, xp: 80, level: 1 },
      { userId: "demo-3", name: "Demo User 3", email: "demo3@example.com", photoURL: null, xp: 60, level: 1 }
    ];
    
    return res.json({ top: fallbackTop });
  }
});

// Get single user by ID
app.get("/api/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    let user = null;

    if (useFirestore && db) {
      const doc = await db.collection("users").doc(userId).get();
      if (doc.exists) {
        const data = doc.data();
        user = {
          userId: doc.id,
          name: data.name || data.displayName || data.username || `User-${String(doc.id).slice(0,6)}`,
          email: data.email || null,
          photoURL: data.photoURL || data.profileURL || data.avatar || null,
          xp: Number(data.xp || 0),
          level: Number(data.level || Math.floor((data.xp || 0) / 100) + 1)
        };
      }
    } else {
      const usersPath = path.join(process.cwd(), "data", "users.json");
      let usersObj = {};
      
      // Read existing users
      if (fs.existsSync(usersPath)) {
        try {
          usersObj = JSON.parse(fs.readFileSync(usersPath, "utf8") || "{}");
        } catch (err) {
          console.error("Error reading users.json:", err);
          usersObj = {};
        }
      }
      
      const userData = usersObj[userId];
      if (userData) {
        user = {
          userId,
          name: userData.displayName || userData.name || userData.username || `User-${String(userId).slice(0,6)}`,
          email: userData.email || null,
          photoURL: userData.photoURL || userData.avatar || null,
          xp: Number(userData.xp || 0),
          level: Number(userData.level || Math.floor((userData.xp || 0) / 100) + 1)
        };
      } else {
        // Auto-create user if not exists
        console.log(`Auto-creating user for ID: ${userId}`);
        const newUser = {
          displayName: `Warrior-${String(userId).slice(0,6)}`,
          email: null,
          xp: 0,
          level: 1,
          photoURL: null,
          createdAt: new Date().toISOString()
        };
        
        // Save to users.json
        usersObj[userId] = newUser;
        try {
          fs.writeFileSync(usersPath, JSON.stringify(usersObj, null, 2));
          console.log(`User ${userId} created successfully`);
        } catch (writeErr) {
          console.error("Error writing users.json:", writeErr);
        }
        
        user = {
          userId,
          name: newUser.displayName,
          email: newUser.email,
          photoURL: newUser.photoURL,
          xp: newUser.xp,
          level: newUser.level
        };
      }
    }

    if (!user) {
      return res.status(404).json({ error: "User not found and could not be created" });
    }

    return res.json(user);
  } catch (err) {
    console.error("/api/user/:userId error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

// Get users (with query support)
app.get("/api/users", async (req, res) => {
  try {
    const { id } = req.query;
    
    // If specific ID requested, redirect to single user endpoint
    if (id) {
      return res.redirect(`/api/user/${id}`);
    }

    let users = [];

    if (useFirestore && db) {
      const snap = await db.collection("users").orderBy("xp", "desc").get();
      snap.forEach(doc => {
        const data = doc.data();
        users.push({
          userId: doc.id,
          name: data.name || data.displayName || data.username || `User-${String(doc.id).slice(0,6)}`,
          email: data.email || null,
          photoURL: data.photoURL || data.profileURL || data.avatar || null,
          xp: Number(data.xp || 0),
          level: Number(data.level || Math.floor((data.xp || 0) / 100) + 1)
        });
      });
    } else {
      const usersPath = path.join(process.cwd(), "data", "users.json");
      if (fs.existsSync(usersPath)) {
        try {
          const usersObj = JSON.parse(fs.readFileSync(usersPath, "utf8") || "{}");
          users = Object.entries(usersObj)
            .map(([uid, userData]) => ({
              userId: uid,
              name: userData.displayName || userData.name || userData.username || `User-${String(uid).slice(0,6)}`,
              email: userData.email || null,
              photoURL: userData.photoURL || userData.avatar || null,
              xp: Number(userData.xp || 0),
              level: Number(userData.level || Math.floor((userData.xp || 0) / 100) + 1)
            }))
            .sort((a, b) => b.xp - a.xp);
        } catch (err) {
          console.error("Error reading users.json:", err);
        }
      }
    }

    return res.json({ users });
  } catch (err) {
    console.error("/api/users error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

// Alternative endpoint for users by ID
app.get("/api/users/:userId", async (req, res) => {
  return res.redirect(`/api/user/${req.params.userId}`);
});

app.get("/api/quizzes", async (req, res) => {
  try {
    let arr = [];
    if (useFirestore && db) {
      const snap = await db.collection("quizzes").orderBy("createdAt","desc").get();
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    } else {
      const p = path.join(process.cwd(), "data", "quizzes.json");
      if (fs.existsSync(p)) arr = JSON.parse(fs.readFileSync(p, "utf8") || "[]");
    }
    res.json(arr);
  } catch (e) { console.error(e); res.status(500).json({ error: String(e) }); }
});

app.get("/api/quizzes/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    if (useFirestore && db) {
      const docSnap = await db.collection("quizzes").doc(id).get();
      if (!docSnap.exists) return res.status(404).json({ error: "Not found" });
      return res.json({ id: docSnap.id, ...docSnap.data() });
    } else {
      const p = path.join(process.cwd(), "data", "quizzes.json");
      const arr = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8") || "[]") : [];
      const found = arr.find(x => (x.id||x.quizId) === id);
      if (!found) return res.status(404).json({ error: "Not found" });
      return res.json(found);
    }
  } catch (e) { console.error(e); res.status(500).json({ error: String(e) }); }
});

app.post("/api/quizzes", async (req, res) => {
  try {
    const body = req.body || {};
    if (useFirestore && db) {
      const r = await db.collection("quizzes").add(body);
      return res.json({ id: r.id });
    } else {
      const p = path.join(process.cwd(), "data", "quizzes.json");
      const arr = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8") || "[]") : [];
      const id = String(Date.now());
      arr.unshift({ id, ...body });
      fs.writeFileSync(p, JSON.stringify(arr, null, 2), "utf8");
      return res.json({ id });
    }
  } catch (e) { console.error(e); res.status(500).json({ error: String(e) }); }
});

app.put("/api/quizzes/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const payload = req.body || {};
    if (useFirestore && db) {
      await db.collection("quizzes").doc(id).set(payload, { merge: true });
      return res.json({ ok: true });
    } else {
      const p = path.join(process.cwd(), "data", "quizzes.json");
      const arr = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8") || "[]") : [];
      const idx = arr.findIndex(x => (x.id||x.quizId) === id);
      if (idx === -1) return res.status(404).json({ error: "Not found" });
      arr[idx] = Object.assign({}, arr[idx], payload);
      fs.writeFileSync(p, JSON.stringify(arr, null, 2), "utf8");
      return res.json({ ok: true });
    }
  } catch (e) { console.error(e); res.status(500).json({ error: String(e) }); }
});

app.delete("/api/quizzes/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    if (useFirestore && db) {
      await db.collection("quizzes").doc(id).delete();
      return res.json({ ok: true });
    } else {
      const p = path.join(process.cwd(), "data", "quizzes.json");
      let arr = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8") || "[]") : [];
      arr = arr.filter(x => (x.id||x.quizId) !== id);
      fs.writeFileSync(p, JSON.stringify(arr, null, 2), "utf8");
      return res.json({ ok: true });
    }
  } catch (e) { console.error(e); res.status(500).json({ error: String(e) }); }
});

app.post("/api/quizzes/:id/generate", async (req, res) => {
  try {
    const id = String(req.params.id);
    
    // 100% OpenAI regeneration - No static questions
    if (!OPENAI_KEY) {
      return res.status(500).json({ 
        error: "OpenAI API key not configured. Cannot regenerate quiz without OpenAI." 
      });
    }

    console.log("Regenerating quiz using OpenAI...");
    
    // Create prompt for regenerating general OS quiz
    const prompt = `You are an expert Operating Systems instructor. Generate exactly 5 brand new, high-quality multiple choice questions about Operating Systems.

Return ONLY valid JSON in this exact format:
{
  "title": "Operating Systems Quiz (Regenerated)",
  "questions": [
    {
      "question": "Specific, clear Operating Systems question",
      "type": "mcq",
      "options": [
        "Detailed correct answer with proper OS terminology",
        "Plausible but incorrect option with OS concepts",
        "Another plausible but incorrect option",
        "Fourth plausible but incorrect option"
      ],
      "answerIndex": 0
    }
  ]
}

REQUIREMENTS:
1. Generate EXACTLY 5 unique questions
2. Cover diverse OS topics: processes, threads, memory management, file systems, CPU scheduling, deadlocks, synchronization, I/O systems, virtual memory
3. Each option must be detailed (minimum 20 characters)
4. Only one correct answer per question (answerIndex 0-3)
5. Use proper technical terminology
6. Questions should test deep understanding
7. Make questions different from typical textbook examples

Return ONLY the JSON object, no additional text.`;

    let newQuestions = null;
    try {
      const modelOutput = await callOpenAI(prompt);
      console.log("OpenAI regeneration response length:", modelOutput.length);
      
      // Extract JSON from response
      const jsonMatch = modelOutput.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in OpenAI response");
      }
      
      const jsonText = jsonMatch[0];
      const parsed = JSON.parse(jsonText);
      
      // Validate response quality
      if (!isValidOpenAIResponse(parsed)) {
        throw new Error("OpenAI response failed quality validation");
      }
      
      newQuestions = parsed.questions;
      console.log("✅ OpenAI regenerated", newQuestions.length, "valid questions");
      
    } catch (e) {
      console.error("OpenAI regeneration failed:", e.message);
      return res.status(500).json({ 
        error: `Quiz regeneration failed: ${e.message}. Please try again.`
      });
    }

    // Update quiz with new OpenAI generated questions
    if (useFirestore && db) {
      const docRef = db.collection("quizzes").doc(id);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return res.status(404).json({ error: "Quiz not found" });
      
      const data = docSnap.data() || {};
      
      await docRef.set({ 
        ...data,
        title: (data.title || "Operating Systems Quiz").replace(" (regenerated)", "") + " (regenerated)",
        questions: newQuestions, 
        regeneratedAt: new Date().toISOString() 
      }, { merge: true });
      
      return res.json({ ok: true, message: "Quiz regenerated successfully with OpenAI" });
    } else {
      const p = path.join(process.cwd(), "data", "quizzes.json");
      const arr = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8") || "[]") : [];
      const idx = arr.findIndex(x => (x.id||x.quizId) === id);
      if (idx === -1) return res.status(404).json({ error: "Quiz not found" });
      
      arr[idx].title = (arr[idx].title || "Operating Systems Quiz").replace(" (regenerated)", "") + " (regenerated)";
      arr[idx].questions = newQuestions;
      arr[idx].regeneratedAt = new Date().toISOString();
      
      fs.writeFileSync(p, JSON.stringify(arr, null, 2), "utf8");
      return res.json({ ok: true, message: "Quiz regenerated successfully with OpenAI" });
    }
  } catch (e) { 
    console.error("Regenerate endpoint error:", e); 
    res.status(500).json({ error: "Internal server error: " + String(e.message) }); 
  }
});

app.get("/api/reports", async (req, res) => {
  try {
    const { from, to, type = "summary" } = req.query || {};
    const fromTs = from ? new Date(String(from)) : null;
    const toTs = to ? new Date(String(to)) : null;

    if (useFirestore && db) {
      const snap = await db.collection("results").get();
      const byUser = {};
      snap.forEach(doc => {
        const d = doc.data() || {};
        const created = d.createdAt ? new Date(d.createdAt) : null;
        if (fromTs && created && created < fromTs) return;
        if (toTs && created && created > toTs) return;
        const user = d.username || d.userId || "anon";
        byUser[user] = byUser[user] || { attempts: 0, totalScore: 0 };
        byUser[user].attempts++;
        byUser[user].totalScore += Number(d.score || 0);
      });
      const resultRows = Object.keys(byUser).map(u => [u, byUser[u].attempts, +(byUser[u].totalScore / byUser[u].attempts).toFixed(2)]);
      return res.json({
        meta: { title: "Summary Report", columns: ["User", "Attempts", "Avg Score"] },
        rows: resultRows,
        chart: { labels: resultRows.map(r => r[0]), values: resultRows.map(r => r[2]) }
      });
    }

    const resultsPath = path.join(process.cwd(), "data", "results.json");
    let results = [];
    if (fs.existsSync(resultsPath)) {
      try { results = JSON.parse(fs.readFileSync(resultsPath, "utf8") || "[]"); } catch { results = []; }
    }

    if ((fromTs || toTs) && Array.isArray(results)) {
      results = results.filter(r => {
        const created = r.createdAt ? new Date(r.createdAt) : null;
        if (!created) return true;
        if (fromTs && created < fromTs) return false;
        if (toTs && created > toTs) return false;
        return true;
      });
    }

    if (type === "by-quiz") {
      const byQuiz = {};
      results.forEach(r => {
        const k = r.quizId || "unknown";
        byQuiz[k] = byQuiz[k] || { attempts: 0, totalScore: 0 };
        byQuiz[k].attempts++;
        byQuiz[k].totalScore += Number(r.score || 0);
      });
      const rows = Object.keys(byQuiz).map(k => [k, byQuiz[k].attempts, +(byQuiz[k].totalScore / byQuiz[k].attempts).toFixed(2)]);
      return res.json({ meta: { title: "By Quiz", columns: ["QuizId", "Attempts", "Avg Score"] }, rows, chart: { labels: rows.map(r => r[0]), values: rows.map(r => r[2]) } });
    }

    if (type === "by-user") {
      const byUser = {};
      results.forEach(r => {
        const u = r.username || r.userId || "anon";
        byUser[u] = byUser[u] || { attempts: 0, totalScore: 0 };
        byUser[u].attempts++;
        byUser[u].totalScore += Number(r.score || 0);
      });
      const rows = Object.keys(byUser).map(u => [u, byUser[u].attempts, +(byUser[u].totalScore / byUser[u].attempts).toFixed(2)]);
      return res.json({ meta: { title: "By User", columns: ["User", "Attempts", "Avg Score"] }, rows, chart: { labels: rows.map(r => r[0]), values: rows.map(r => r[2]) } });
    }

    const byUser = {};
    results.forEach(r => {
      const u = r.username || r.userId || "anon";
      byUser[u] = byUser[u] || { attempts: 0, totalScore: 0 };
      byUser[u].attempts++;
      byUser[u].totalScore += Number(r.score || 0);
    });
    const rows = Object.keys(byUser).map(u => [u, byUser[u].attempts, +(byUser[u].totalScore / byUser[u].attempts).toFixed(2)]);
    return res.json({
      meta: { title: "Summary Report", columns: ["User", "Attempts", "Avg Score"] },
      rows,
      chart: { labels: rows.map(r => r[0]), values: rows.map(r => r[2]) }
    });
  } catch (err) {
    console.error("/api/reports error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
