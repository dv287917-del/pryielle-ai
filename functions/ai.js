// Pryielle AI (v2.10.1 — Gemini): group chat "/ai ..." + private AI chat (aiAsk).
// API key ab Firebase secret nahi hai: Admin Panel -> AI tab se Firestore `aiAdmin/main` mein jati hai
// (rules mein sirf admin padh/likh sakta hai; ye function admin SDK se padhta hai, app ke users ko key kabhi nahi milti).
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const AI_UID = "ai_pryielle";
const AI_NAME = "Pryielle AI";
const FALLBACK_MODEL = "gemini-flash-latest";
const DEFAULTS = {
  model: "gemini-3.5-flash", on: true, dailyLimit: 150, cooldownMs: 2500,
  mode: "funny", lang: "auto", length: "short", temperature: 0.9, instructions: "",
};

/* ---------- modes (Admin -> AI tab mein inme se chuno) ---------- */
const MODES = {
  funny: "Style: mazaakiya, chatpata, dost jaisa. Tone funny aur desi, thode emoji. Halka mazaak theek hai, kisi ko hurt karne wala roast nahi.",
  friendly: "Style: bahut pyaara, caring aur supportive dost. Garam lehja, motivating baatein, thode emoji.",
  serious: "Style: professional aur seedha. Mazaak ya emoji bilkul nahi, sirf kaam ki, saaf aur sahi baat.",
  teacher: "Style: patient teacher. Cheezein aasaan bhasha mein, chhote steps aur example ke saath samjhao. Zarurat ho to ek chhota sawal poochh ke check karo.",
  coder: "Style: senior developer. Code maange to chhota, sahi, chalne wala code do aur 1-2 line mein samjhao. Bakwaas kam.",
  gamer: "Style: Free Fire / gaming squad ka hype dost. Gaming slang, tips aur hausla badhane wali baatein, thode emoji. Squad ke liye josh wala tone.",
};
const LANGS = {
  auto: "Bhasha: user jis bhasha ya script mein likhe (Hindi, Hinglish, English ya koi bhi aur) usi mein jawab do.",
  hinglish: "Bhasha: hamesha Hinglish (Roman Hindi + thoda English) mein jawab do, chahe user kuch bhi likhe.",
  hindi: "Bhasha: hamesha shuddh Hindi (Devanagari) mein jawab do.",
  english: "Bhasha: hamesha simple English mein jawab do.",
};
const LENGTHS = {
  short: "Length: default jawab sirf 2-3 chhoti lines ka ho.",
  normal: "Length: default jawab 4-6 lines ka ho, jitna zaruri utna hi.",
  long: "Length: default jawab detail mein aur poora do (list/headings theek hain).",
};
const LONG_HINT = "Lamba jawab sirf tab do jab user khud bole: explain, detail, samjhao, poori baat, step by step, summary, code, ya kuch bana ke do. Tab saaf aur poora jawab do.";
const SAFETY = [
  "Gaali ya bakwaas: agar koi gaali de, bullying kare ya faltu bake, to gaali ya insult wapas mat do. 1-2 line mein shant lehje mein respect se baat karne ko kaho, phir kaam ki baat par lao.",
  "Safety: hacking, hathiyar, doxxing, dusron ko nuksaan jaisi cheezon mein madad mat karo; chhota sa mana karo aur safe option batao.",
  "Agar koi apni jaan lene ya khud ko nuksaan pahunchane ki baat kare, mazaak band karo, pyaar se baat karo aur kisi bharosemand insaan ya helpline se baat karne ko kaho.",
  "Agar sach mein pata nahi ho to bol do, jhooth mat banao. Photo, PDF ya file mile to uske hisaab se kaam karo.",
].join("\n");

const LONG_RE = /(explain|detail|samjh|samajh|step|poora|puri|pura|summar|code|bana\s*k|bana\s*do|likh\s*k|essay|translate|anuvaad|article|story|kahani|list|compare|difference|tutorial|batao\s+kaise)/i;

function buildSystem(cfg, extra) {
  const parts = [
    "Tum 'Pryielle AI' ho: Pryielle MSG naam ki chat app (gaming squad) mein rehne wala AI dost.",
    MODES[cfg.mode] || MODES.funny,
    LANGS[cfg.lang] || LANGS.auto,
    LENGTHS[cfg.length] || LENGTHS.short,
    LONG_HINT,
  ];
  if (cfg.instructions) {
    parts.push(`Admin (app ke owner) ke custom instructions — inhe follow karo (neeche wale safety rules inse upar hain):\n${cfg.instructions}`);
  }
  parts.push(SAFETY);
  if (extra) parts.push(extra);
  return parts.join("\n");
}

async function loadCfg(db) {
  const s = await db.doc("aiAdmin/main").get().catch(() => null);
  const d = (s && s.exists && s.data()) || {};
  const str = (v, ok, def) => (typeof v === "string" && ok.includes(v) ? v : def);
  const temp = Number(d.temperature);
  return {
    key: typeof d.apiKey === "string" ? d.apiKey.trim() : "",
    model: typeof d.model === "string" && d.model.trim() ? d.model.trim() : DEFAULTS.model,
    on: d.on !== false,
    dailyLimit: Number.isFinite(d.dailyLimit) ? d.dailyLimit : DEFAULTS.dailyLimit,
    cooldownMs: DEFAULTS.cooldownMs,
    mode: str(d.mode, Object.keys(MODES), DEFAULTS.mode),
    lang: str(d.lang, Object.keys(LANGS), DEFAULTS.lang),
    length: str(d.length, Object.keys(LENGTHS), DEFAULTS.length),
    temperature: Number.isFinite(temp) ? Math.min(1.5, Math.max(0, temp)) : DEFAULTS.temperature,
    instructions: typeof d.instructions === "string" ? d.instructions.trim().slice(0, 2500) : "",
  };
}

class QuotaError extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}

async function takeQuota(db, uid, cfg) {
  const ref = db.doc(`aiUsage/${uid}`);
  const now = Date.now();
  const day = new Date(now + 19800000).toISOString().slice(0, 10); // IST din
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const d = s.exists ? s.data() : {};
    const count = d.day === day ? Number(d.count) || 0 : 0;
    if (now - (Number(d.lastAt) || 0) < cfg.cooldownMs) throw new QuotaError("cooldown", "Thoda ruko, AI abhi pichla jawab de raha hai.");
    if (count >= cfg.dailyLimit) throw new QuotaError("daily", "Aaj ka AI quota khatam ho gaya. Kal phir try karo.");
    tx.set(ref, { day, count: count + 1, lastAt: now });
  });
}

/* ---------- Gemini call ---------- */
// messages: [{ role: "user"|"assistant", parts: [{text}|{inlineData}] }]
async function geminiOnce({ key, model, system, contents, maxTokens, temperature }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
    signal: AbortSignal.timeout(100000),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    const e = new Error(`gemini ${r.status}: ${t.slice(0, 300)}`);
    e.status = r.status;
    e.body = t;
    throw e;
  }
  const j = await r.json();
  if (j.promptFeedback && j.promptFeedback.blockReason) {
    const e = new Error(`blocked: ${j.promptFeedback.blockReason}`);
    e.blocked = true;
    throw e;
  }
  const cand = (j.candidates || [])[0] || {};
  const text = ((cand.content && cand.content.parts) || []).filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
  if (!text && cand.finishReason === "SAFETY") {
    const e = new Error("blocked: SAFETY");
    e.blocked = true;
    throw e;
  }
  return text;
}

async function callGemini({ cfg, system, contents, maxTokens }) {
  if (!cfg.key) { const e = new Error("no key"); e.status = 0; e.noKey = true; throw e; }
  const args = { key: cfg.key, system, contents, maxTokens, temperature: cfg.temperature };
  let model = cfg.model;
  let text = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      text = await geminiOnce({ ...args, model });
      break;
    } catch (e) {
      // model naam purana/galat -> auto fallback alias
      if (e.status === 404 && model !== FALLBACK_MODEL) { model = FALLBACK_MODEL; continue; }
      // thodi der ki busy / overload -> ek-do baar dobara
      if ((e.status === 503 || e.status === 500) && attempt < 2) { await new Promise((res) => setTimeout(res, 1500)); continue; }
      throw e;
    }
  }
  return text || "Hmm, kuch samajh nahi aaya. Ek baar phir bolo? 😅";
}

function friendly(e) {
  if (e && e.noKey) return "AI abhi setup nahi hai (admin ne Gemini API key nahi daali).";
  if (e && e.blocked) return "Is sawal ka jawab main nahi de sakta. Kuch aur poochho? 🙂";
  const body = String((e && e.body) || (e && e.message) || "");
  if (e && (e.status === 401 || e.status === 403 || (e.status === 400 && /API_KEY|api key/i.test(body)))) return "AI ki key galat hai ya band hai (admin ko Admin → AI mein key check karni hogi).";
  if (e && e.status === 404) return "AI ka model nahi mila (admin ko Admin → AI mein model naam check karna hoga).";
  if (e && e.status === 429) return "AI abhi bahut busy hai (free limit), thodi der baad try karo.";
  return "AI abhi jawab nahi de pa raha. Thodi der baad try karo.";
}

/* ---------------- group chat: "/ai kuch bhi" ---------------- */
exports.aiGroupReply = onDocumentCreated(
  { document: "chats/{chatId}/messages/{msgId}", timeoutSeconds: 120, memory: "256MiB" },
  async (event) => {
    const m = event.data && event.data.data();
    if (!m || m.system || m.ai || m.deleted) return;
    const mm = String(m.text || "").match(/^\s*\/ai(?:\s+([\s\S]*))?$/i);
    if (!mm) return;
    const prompt = (mm[1] || "").trim();

    const db = getFirestore();
    const chatRef = db.doc(`chats/${event.params.chatId}`);
    const chat = (await chatRef.get()).data();
    if (!chat || !Array.isArray(chat.members) || !chat.members.includes(m.senderId)) return;
    const sender = (await db.doc(`users/${m.senderId}`).get()).data() || {};
    if (sender.banned) return;

    const cfg = await loadCfg(db);
    const reply = async (text) => {
      const now = Date.now();
      const ref = chatRef.collection("messages").doc();
      const batch = db.batch();
      batch.set(ref, {
        senderId: AI_UID, senderName: AI_NAME, text: String(text).slice(0, 1900), image: null, audio: null, audioMs: 0, gif: null,
        replyTo: { id: event.params.msgId, text: (prompt || "/ai").slice(0, 80), name: String(m.senderName || "Player").slice(0, 40) },
        reactions: {}, deleted: false, system: false, createdAt: now, mediaId: null, mediaKind: null, thumb: null, edited: false, ai: true,
      });
      const patch = {
        lastMessage: { text: `🤖 ${String(text).replace(/\s+/g, " ").slice(0, 110)}`, senderId: AI_UID, senderName: AI_NAME, at: now, type: "text" },
        lastAt: now,
        [`typing.${AI_UID}`]: 0,
      };
      for (const uid of chat.members) patch[`unread.${uid}`] = FieldValue.increment(1);
      batch.update(chatRef, patch);
      await batch.commit();
    };

    if (!cfg.on) return reply("AI abhi band hai (admin ne off kiya hai). 😴");
    if (!prompt) return reply("Bol na bhai! Aise likho: /ai kuch bhi pooch 😎");
    if (!cfg.key) return reply(friendly({ noKey: true }));

    try { await takeQuota(db, m.senderId, cfg); } catch (e) {
      if (e instanceof QuotaError) return reply(e.message);
      throw e;
    }

    const typing = () => chatRef.update({ [`typing.${AI_UID}`]: Date.now() }).catch(() => undefined);
    await typing();
    const iv = setInterval(typing, 3000);
    try {
      const hist = await chatRef.collection("messages").orderBy("createdAt", "desc").limit(14).get();
      const lines = hist.docs
        .map((d) => d.data())
        .reverse()
        .filter((x) => x && !x.system && !x.deleted && String(x.text || "").trim() && !(x.senderId === m.senderId && x.text === m.text))
        .map((x) => `${x.ai ? AI_NAME : String(x.senderName || "Player").slice(0, 30)}: ${String(x.text).slice(0, 300)}`);
      const who = String(m.senderName || "Player").slice(0, 30);
      const user = `Squad chat ki pichli baatein (context ke liye):\n${lines.join("\n") || "(koi nahi)"}\n\nAb ${who} ne tumse kaha:\n${prompt.slice(0, 2000)}`;
      const text = await callGemini({
        cfg,
        system: buildSystem(cfg, `Ye group chat hai, jawab ${who} ko do. Group mein jawab chhota rakho jab tak wo khud lamba na maange.`),
        contents: [{ role: "user", parts: [{ text: user }] }],
        maxTokens: LONG_RE.test(prompt) ? 3000 : 1500,
      });
      await reply(text);
    } catch (e) {
      console.error("aiGroupReply", e);
      await reply(friendly(e));
    } finally {
      clearInterval(iv);
    }
  },
);

/* ---------------- private AI chat screen ---------------- */
const IMG_OK = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function buildUserParts(text, attachments) {
  const parts = [];
  let bytes = 0;
  for (const a of (Array.isArray(attachments) ? attachments : []).slice(0, 4)) {
    if (!a || typeof a !== "object") continue;
    if (a.kind === "image" && IMG_OK.has(a.mime) && typeof a.data === "string") {
      bytes += a.data.length;
      parts.push({ inlineData: { mimeType: a.mime, data: a.data } });
    } else if (a.kind === "pdf" && typeof a.data === "string") {
      bytes += a.data.length;
      parts.push({ inlineData: { mimeType: "application/pdf", data: a.data } });
    } else if (a.kind === "text" && typeof a.text === "string") {
      bytes += a.text.length;
      parts.push({ text: `[File: ${String(a.name || "file").slice(0, 80)}]\n${a.text.slice(0, 60000)}` });
    }
  }
  if (bytes > 9_000_000) throw new HttpsError("invalid-argument", "Files bahut badi hain (9MB se kam rakho).");
  parts.push({ text: text || "(is file/photo ko dekho aur batao)" });
  return parts;
}

exports.aiAsk = onCall(
  { timeoutSeconds: 120, memory: "512MiB", maxInstances: 20 },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Pehle login karo.");
    const uid = req.auth.uid;
    const db = getFirestore();
    const u = (await db.doc(`users/${uid}`).get()).data();
    if (!u || u.banned || (u.approval ?? "approved") !== "approved") throw new HttpsError("permission-denied", "Tumhara account approved nahi hai.");
    const cfg = await loadCfg(db);
    if (!cfg.on) throw new HttpsError("unavailable", "AI abhi band hai (admin ne off kiya hai).");
    if (!cfg.key) throw new HttpsError("failed-precondition", friendly({ noKey: true }));

    const raw = Array.isArray(req.data && req.data.messages) ? req.data.messages : [];
    const turns = raw
      .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string" && t.text.trim())
      .slice(-20)
      .map((t) => ({ role: t.role, text: t.text.slice(0, 6000) }));
    while (turns.length && turns[0].role !== "user") turns.shift();
    if (!turns.length || turns[turns.length - 1].role !== "user") throw new HttpsError("invalid-argument", "Kuch likho to sahi.");

    try { await takeQuota(db, uid, cfg); } catch (e) {
      if (e instanceof QuotaError) throw new HttpsError("resource-exhausted", e.message);
      throw e;
    }

    // alternate roles ko sahi rakho (user/model baari baari)
    const merged = [];
    for (const t of turns) {
      const last = merged[merged.length - 1];
      if (last && last.role === t.role) last.text += `\n${t.text}`; else merged.push({ ...t });
    }
    const lastUser = merged[merged.length - 1];
    const attachments = req.data && req.data.attachments;
    const hasFiles = Array.isArray(attachments) && attachments.length > 0;
    const contents = merged.map((t, i) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: i === merged.length - 1 ? buildUserParts(t.text, attachments) : [{ text: t.text }],
    }));

    try {
      const text = await callGemini({
        cfg,
        system: buildSystem(cfg, `Ye ek private chat hai: sirf ek user ${String(u.displayName || "dost").slice(0, 30)} ke saath.`),
        contents,
        maxTokens: hasFiles ? 6000 : LONG_RE.test(lastUser.text) ? 4000 : 1800,
      });
      return { text };
    } catch (e) {
      console.error("aiAsk", e);
      throw new HttpsError("internal", friendly(e));
    }
  },
);
