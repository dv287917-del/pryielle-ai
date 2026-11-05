// Pryielle AI Builder — feature config schema + validator (v1).
// Client (src) aur server (api/ai.js) DONO yahi file use karte hain. Koi dependency nahi.
// AI sirf data (JSON) banata hai; yahan whitelist se bahar kuch bhi nahi nikalta.

export const SCHEMA_VERSION = 1;

export const SLOTS = ["home-top", "home-hero", "home-suggestions", "chat-top", "drawer"];
export const BLOCK_TYPES = ["banner", "badge", "button", "card", "hero", "chips", "toggle"];
export const FONTS = ["system", "serif", "mono", "rounded"];
export const TONES = ["info", "success", "warn", "promo"];
export const BUTTON_ACTIONS = ["openUrl", "sendPrompt", "copyText"];

// Har block type kin slots me ja sakta hai
export const SLOT_RULES = {
  banner: ["home-top", "chat-top"],
  badge: ["home-top", "chat-top", "drawer"],
  button: ["home-top", "home-suggestions", "drawer"],
  card: ["home-top", "home-suggestions", "drawer"],
  hero: ["home-hero"],
  chips: ["home-suggestions"],
  toggle: ["drawer"],
};

export const LIMITS = {
  blocks: 12, flags: 20, chips: 6, title: 60, text: 240, label: 40, emoji: 8, url: 300, value: 300, notes: 400, id: 32,
  radiusMin: 0, radiusMax: 28,
};

const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ID_RE = /^[a-z][a-zA-Z0-9_-]{0,31}$/;
const FLAG_RE = /^[a-z][a-zA-Z0-9]{1,30}$/;
// control chars + zero-width/bidi tricks hatao
// eslint-disable-next-line no-control-regex
const BAD_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;

function str(v, max) {
  if (typeof v !== "string") return "";
  return v.replace(BAD_CHARS, "").replace(/<[^>]*>/g, "").trim().slice(0, max);
}
function color(v) { return typeof v === "string" && COLOR_RE.test(v.trim()) ? v.trim().toLowerCase() : ""; }
function url(v) {
  if (typeof v !== "string") return "";
  const s = v.trim().slice(0, LIMITS.url);
  try { const u = new URL(s); return u.protocol === "https:" ? u.toString() : ""; } catch { return ""; }
}

function normTheme(t, warn) {
  const out = {};
  if (!t || typeof t !== "object") return out;
  for (const k of ["accent", "bg", "surface", "text", "muted"]) {
    if (t[k] === undefined) continue;
    const c = color(t[k]);
    if (c) out[k] = c; else warn(`theme.${k}: galat color, hata diya`);
  }
  if (t.font !== undefined) { if (FONTS.includes(t.font)) out.font = t.font; else warn("theme.font: galat, hata diya"); }
  if (t.radius !== undefined) {
    const r = Number(t.radius);
    if (Number.isFinite(r)) out.radius = Math.max(LIMITS.radiusMin, Math.min(LIMITS.radiusMax, Math.round(r)));
    else warn("theme.radius: galat, hata diya");
  }
  return out;
}

function normBlock(b, i, warn, seen) {
  const at = `blocks[${i}]`;
  if (!b || typeof b !== "object") { warn(`${at}: object nahi hai, hata diya`); return null; }
  if (!BLOCK_TYPES.includes(b.type)) { warn(`${at}: type "${String(b.type).slice(0, 20)}" allowed nahi, hata diya`); return null; }
  const slot = b.slot;
  if (!SLOT_RULES[b.type].includes(slot)) { warn(`${at}: ${b.type} ko slot "${String(slot).slice(0, 20)}" me nahi rakh sakte, hata diya`); return null; }
  let id = typeof b.id === "string" && ID_RE.test(b.id) ? b.id : `${b.type}${i + 1}`;
  while (seen.has(id)) id += "x";
  id = id.slice(0, LIMITS.id); seen.add(id);
  const base = { id, type: b.type, slot };

  switch (b.type) {
    case "banner": {
      const text = str(b.text, LIMITS.text);
      if (!text) { warn(`${at}: banner ka text khali, hata diya`); return null; }
      const o = { ...base, text, tone: TONES.includes(b.tone) ? b.tone : "info" };
      const emoji = str(b.emoji, LIMITS.emoji); if (emoji) o.emoji = emoji;
      const label = str(b.actionLabel, LIMITS.label), link = url(b.actionUrl);
      if (label && link) { o.actionLabel = label; o.actionUrl = link; }
      return o;
    }
    case "badge": {
      const text = str(b.text, LIMITS.label);
      if (!text) { warn(`${at}: badge ka text khali, hata diya`); return null; }
      const o = { ...base, text }; const c = color(b.color); if (c) o.color = c; return o;
    }
    case "button": {
      const label = str(b.label, LIMITS.label);
      if (!label) { warn(`${at}: button ka label khali, hata diya`); return null; }
      if (!BUTTON_ACTIONS.includes(b.action)) { warn(`${at}: button action allowed nahi, hata diya`); return null; }
      let value = b.action === "openUrl" ? url(b.value) : str(b.value, LIMITS.value);
      if (!value) { warn(`${at}: button value galat/khali (openUrl ke liye https link chahiye), hata diya`); return null; }
      const o = { ...base, label, action: b.action, value }; const emoji = str(b.emoji, LIMITS.emoji); if (emoji) o.emoji = emoji; return o;
    }
    case "card": {
      const title = str(b.title, LIMITS.title), body = str(b.body, LIMITS.text);
      if (!title && !body) { warn(`${at}: card khali, hata diya`); return null; }
      const o = { ...base, title, body }; const emoji = str(b.emoji, LIMITS.emoji); if (emoji) o.emoji = emoji; return o;
    }
    case "hero": {
      const title = str(b.title, LIMITS.title);
      if (!title) { warn(`${at}: hero ka title khali, hata diya`); return null; }
      return { ...base, title, subtitle: str(b.subtitle, LIMITS.text) };
    }
    case "chips": {
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, LIMITS.chips).map((c) => {
        const label = str(c && c.label, LIMITS.label), prompt = str(c && c.prompt, LIMITS.value);
        return label && prompt ? { label, prompt } : null;
      }).filter(Boolean);
      if (!items.length) { warn(`${at}: chips me koi sahi item nahi, hata diya`); return null; }
      return { ...base, items };
    }
    case "toggle": {
      const label = str(b.label, LIMITS.label);
      if (!label || typeof b.flag !== "string" || !FLAG_RE.test(b.flag)) { warn(`${at}: toggle ko label + sahi flag chahiye, hata diya`); return null; }
      return { ...base, label, flag: b.flag, default: b.default === true };
    }
  }
  return null;
}

/**
 * AI/admin ka diya hua raw JSON -> saaf, safe config.
 * Return: { ok, config, warnings }. ok=false sirf tab jab input bilkul bekaar ho.
 * Meta (version/publishedAt/by) server baad me lagata hai; yahan sirf content.
 */
export function validateFeatureConfig(input) {
  const warnings = [];
  const warn = (m) => { if (warnings.length < 40) warnings.push(m); };
  let raw = input;
  if (typeof raw === "string") { try { raw = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim()); } catch { return { ok: false, config: null, warnings: ["JSON parse nahi hua"] }; } }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, config: null, warnings: ["Config object hona chahiye"] };

  const config = { schemaVersion: SCHEMA_VERSION, title: str(raw.title, LIMITS.title), notes: str(raw.notes, LIMITS.notes) };
  config.theme = normTheme(raw.theme, warn);

  const flags = {};
  if (raw.flags && typeof raw.flags === "object" && !Array.isArray(raw.flags)) {
    for (const [k, v] of Object.entries(raw.flags).slice(0, LIMITS.flags)) {
      if (FLAG_RE.test(k) && typeof v === "boolean") flags[k] = v; else warn(`flags.${String(k).slice(0, 20)}: galat, hata diya`);
    }
  }
  config.flags = flags;

  const seen = new Set();
  const list = Array.isArray(raw.blocks) ? raw.blocks : [];
  if (list.length > LIMITS.blocks) warn(`blocks ${LIMITS.blocks} se zyada the, extra hata diye`);
  config.blocks = list.slice(0, LIMITS.blocks).map((b, i) => normBlock(b, i, warn, seen)).filter(Boolean);

  const empty = !Object.keys(config.theme).length && !Object.keys(flags).length && !config.blocks.length;
  if (empty) return { ok: false, config: null, warnings: [...warnings, "Config me koi bhi sahi cheez nahi mili"] };
  return { ok: true, config, warnings };
}

/** AI ko prompt me dene ke liye schema ka chhota description (Batch 2 me use hoga). */
export const SCHEMA_PROMPT = `Output ONLY one JSON object, no markdown. Shape:
{"title":"short name","notes":"what changed",
"theme":{"accent":"#RRGGBB","bg":"#RRGGBB","surface":"#RRGGBB","text":"#RRGGBB","muted":"#RRGGBB","font":"system|serif|mono|rounded","radius":0-28},
"flags":{"camelCaseName":true},
"blocks":[{"id":"a-z0-9","type":"banner|badge|button|card|hero|chips|toggle","slot":"...", ...fields}]}
Allowed slots per type: banner[home-top,chat-top] badge[home-top,chat-top,drawer] button[home-top,home-suggestions,drawer] card[home-top,home-suggestions,drawer] hero[home-hero] chips[home-suggestions] toggle[drawer].
Fields: banner{text,tone:info|success|warn|promo,emoji?,actionLabel?,actionUrl? https}; badge{text,color?}; button{label,action:openUrl|sendPrompt|copyText,value,emoji?}; card{title,body,emoji?}; hero{title,subtitle?}; chips{items:[{label,prompt}] max 6}; toggle{label,flag,default?}.
Max 12 blocks, 20 flags. Colors only hex. Links only https. No HTML, no code.
Built-in flags the app understands (set true): hideUpgrade (hides the Upgrade pill), compact (tighter chat), hideCopy (hides copy buttons). Any other flag only matters if a toggle block uses it. Text may use {name} for the user's first name.`;
