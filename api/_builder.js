// Pryielle AI Builder — server side (v1.4.0 / Batch 2).
// `_` se shuru hone ki wajah se Vercel ise alag API route nahi banata; sirf api/ai.js import karta hai.
// Firestore me SAB likhna yahin se (Admin SDK). Client se kuch nahi likha jata (firestore.rules).
//
// Permission:
//   chat me secret code (maybeSecret)    -> builder request banti hai (owner approve karta hai, app me)
//   builderStatus                        -> koi bhi approved user (apna access dekhne ke liye)
//   builderGenerate / builderDiscard     -> owner ya approved builder
//   builderPublish / Unpublish / Rollback -> SIRF owner (workwithpryielle@gmail.com, verified email)
import { createHash, timingSafeEqual } from "node:crypto";
import { validateFeatureConfig, SCHEMA_PROMPT, SCHEMA_VERSION } from "../shared/featureSchema.js";

export const OWNER_EMAIL = "workwithpryielle@gmail.com";
const DRAFT = "appFeatures/draft";
const LIVE = "appFeatures/live";

const err = (status, message) => Object.assign(new Error(message), { status });
export const isBuilderAction = (a) => typeof a === "string" && a.startsWith("builder");

export const emptyConfig = () => ({ schemaVersion: SCHEMA_VERSION, title: "", notes: "", theme: {}, flags: {}, blocks: [] });

// Firestore doc -> sirf config wale fields (meta hata ke)
function pick(d) {
  d = d || {};
  return {
    schemaVersion: SCHEMA_VERSION,
    title: typeof d.title === "string" ? d.title : "",
    notes: typeof d.notes === "string" ? d.notes : "",
    theme: d.theme && typeof d.theme === "object" && !Array.isArray(d.theme) ? d.theme : {},
    flags: d.flags && typeof d.flags === "object" && !Array.isArray(d.flags) ? d.flags : {},
    blocks: Array.isArray(d.blocks) ? d.blocks : [],
  };
}

export async function builderAccess(db, user) {
  const owner = user.email_verified === true && String(user.email || "").toLowerCase() === OWNER_EMAIL;
  if (owner) return { owner: true, builder: true };
  const s = await db.doc(`builderAdmins/${user.uid}`).get().catch(() => null);
  return { owner: false, builder: !!(s && s.exists && s.data().approved === true) };
}

function needBuilder(acc) { if (!acc.builder) throw err(403, "Builder access nahi hai."); }
function needOwner(acc) { if (!acc.owner) throw err(403, "Publish / Unpublish / Rollback sirf owner kar sakta hai."); }

// live + history dono me ek hi transaction me likhta hai, version +1
async function writeLive(db, config, by, active, extra) {
  const liveRef = db.doc(LIVE);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(liveRef);
    const version = (Number(s.exists ? s.data().version : 0) || 0) + 1;
    const doc = { ...config, version, publishedAt: Date.now(), publishedBy: by, active, ...(extra || {}) };
    tx.set(liveRef, doc);
    tx.set(db.doc(`appFeaturesHistory/${version}`), doc);
    return doc;
  });
}

/* ---------- secret code (Batch 4) ----------
 * Code plain text me kahin nahi. Firestore `aiAdmin/builder` = { salt, codeHash } ; check: sha256(`${salt}:${code}`).
 * Chat ka sirf chhota (<=100 char), bina attachment wala message check hota hai. Sahi code = sirf REQUEST banti hai;
 * access tab milta hai jab owner approve kare (builderAdmins/{uid}.approved).
 */
const MAX_REQUESTS = 3; // reject/revoke ke baad aur kitni baar request ban sakti hai (total)
let secretCache = { at: 0, cfg: null };
export const _resetSecretCache = () => { secretCache = { at: 0, cfg: null }; };

async function secretCfg(db) {
  if (Date.now() - secretCache.at < 30000) return secretCache.cfg;
  const s = await db.doc("aiAdmin/builder").get().catch(() => null);
  const d = s && s.exists ? s.data() : null;
  const cfg = d && typeof d.salt === "string" && d.salt && typeof d.codeHash === "string" ? { salt: d.salt, codeHash: d.codeHash.trim().toLowerCase() } : null;
  secretCache = { at: Date.now(), cfg };
  return cfg;
}
export function codeMatches(cfg, code) {
  const a = createHash("sha256").update(`${cfg.salt}:${code}`).digest();
  const bb = /^[0-9a-f]{64}$/.test(cfg.codeHash) ? Buffer.from(cfg.codeHash, "hex") : null;
  return !!bb && bb.length === a.length && timingSafeEqual(a, bb);
}

/**
 * api/ai.js ke "ask" me (quota ke baad) call hota hai. null => normal chat, Gemini ko jaao.
 * Object => `{text, secret:true}` seedha jawab (Gemini ko code kabhi nahi jaata).
 */
export async function maybeSecret(db, user, text, attachments) {
  const t = String(text || "").trim();
  if (!t || t.length > 100 || (Array.isArray(attachments) && attachments.length)) return null;
  const cfg = await secretCfg(db);
  if (!cfg || !codeMatches(cfg, t)) return null;

  const acc = await builderAccess(db, user);
  if (acc.owner) return { secret: true, text: "✅ Tum owner ho — Builder pehle se khula hai." };
  if (acc.builder) return { secret: true, text: "✅ Tumhare paas Builder access pehle se hai." };

  const ref = db.doc(`builderRequests/${user.uid}`);
  const s = await ref.get();
  const cur = s.exists ? s.data() : null;
  if (cur && cur.status === "pending") return { secret: true, text: "⏳ Tumhari request owner ke paas pending hai. Approve hote hi access mil jayega." };
  const count = (cur ? Number(cur.count) || 1 : 0) + 1;
  if (count > MAX_REQUESTS) return { secret: true, text: "🚫 Ab nayi request nahi ban sakti. Owner se seedha baat karo." };
  const now = Date.now();
  await ref.set({
    uid: user.uid,
    email: String(user.email || "").slice(0, 120),
    displayName: String(user.name || user.displayName || "").slice(0, 60),
    status: "pending",
    count,
    requestedAt: now,
    updatedAt: now,
  });
  return { secret: true, text: "📨 Request owner ko bhej di. Approve hote hi Builder access mil jayega." };
}

const summary = (d) => ({ version: d.version, title: d.title || "", notes: d.notes || "", active: d.active !== false, publishedAt: d.publishedAt || 0 });

async function generate({ db, user, body, c, quota, gemini, partsFor }) {
  const prompt = String(body.prompt || "").trim().slice(0, 2000);
  if (!prompt) throw err(400, "Kya banana hai woh likho.");
  const baseKind = ["draft", "live", "new"].includes(body.base) ? body.base : "draft";

  const [ds, ls] = await Promise.all([db.doc(DRAFT).get(), db.doc(LIVE).get()]);
  const liveVersion = ls.exists ? Number(ls.data().version) || 0 : 0;
  let base = null;
  if (baseKind === "draft" && ds.exists) base = pick(ds.data());
  else if (baseKind !== "new" && ls.exists && ls.data().active !== false) base = pick(ls.data());

  await quota(db, user.uid, c);

  const sys = [
    "You configure the UI of the Pryielle AI mobile app by writing ONE JSON config. You can ONLY use the schema below. If the request needs something the schema cannot do (new screens, code, backend, HTML, other links), do the closest safe thing with theme/flags/blocks and say in `notes` what was not possible.",
    SCHEMA_PROMPT,
    base
      ? `CURRENT CONFIG (apply the user's request on top of this; keep everything the user did not ask to change):\n${JSON.stringify(base)}`
      : "There is no current config; start fresh.",
    "Write `title` and `notes` in the same language as the user's request. `notes` = 1-2 short lines: what changed, and anything requested that is not possible.",
  ].join("\n\n");

  const contents = [{ role: "user", parts: partsFor(prompt, body.attachments) }];
  const raw = await gemini(c, contents, 3500, "", { responseMimeType: "application/json", temperature: 0.4 }, sys);

  const v = validateFeatureConfig(raw);
  if (!v.ok) throw err(422, "AI ka config sahi nahi bana: " + (v.warnings.slice(-3).join("; ") || "phir se try karo") + ".");

  const updatedAt = Date.now();
  await db.doc(DRAFT).set({ ...v.config, updatedAt, updatedBy: user.uid, basedOnVersion: liveVersion, prompt: prompt.slice(0, 300), warnings: v.warnings });
  return { ok: true, config: v.config, warnings: v.warnings, updatedAt, basedOnVersion: liveVersion };
}

async function publish({ db, user, body }) {
  const ds = await db.doc(DRAFT).get();
  if (!ds.exists) throw err(404, "Draft nahi hai. Pehle AI se banwao.");
  const d = ds.data();
  if (body.expectUpdatedAt !== undefined && Number(body.expectUpdatedAt) !== Number(d.updatedAt))
    throw err(409, "Draft badal gaya hai. Preview dobara dekho, phir publish karo.");
  const v = validateFeatureConfig(pick(d));
  if (!v.ok) throw err(422, "Draft me kuch sahi nahi mila, publish nahi ho sakta.");
  const doc = await writeLive(db, v.config, user.uid, true, { fromDraftAt: d.updatedAt || 0 });
  return { ok: true, ...summary(doc) };
}

async function unpublish({ db, user }) {
  const doc = await writeLive(db, emptyConfig(), user.uid, false, { unpublished: true });
  return { ok: true, ...summary(doc) };
}

async function rollback({ db, user, body }) {
  const ver = Number(body.version);
  if (!Number.isInteger(ver) || ver < 1) throw err(400, "Version galat hai.");
  const hs = await db.doc(`appFeaturesHistory/${ver}`).get();
  if (!hs.exists) throw err(404, `Version ${ver} history me nahi mila.`);
  const h = hs.data();
  let config;
  if (h.active === false) config = emptyConfig(); // purana "unpublish" wala version
  else {
    const v = validateFeatureConfig(pick(h));
    if (!v.ok) throw err(422, `Version ${ver} ab valid nahi hai.`);
    config = v.config;
  }
  const doc = await writeLive(db, config, user.uid, h.active !== false, { rolledBackFrom: ver });
  return { ok: true, ...summary(doc), rolledBackFrom: ver };
}

/**
 * api/ai.js se call hota hai. ctx = { db, user, body, c, quota, gemini, partsFor }.
 * Errors `{status,message}` ke saath throw hote hain; api/ai.js ka catch unhe JSON bana deta hai.
 */
export async function handleBuilder(action, ctx) {
  const { db, user } = ctx;
  const acc = await builderAccess(db, user);

  if (action === "builderStatus") {
    const out = { ok: true, owner: acc.owner, builder: acc.builder };
    if (!acc.builder) {
      const rs = await db.doc(`builderRequests/${user.uid}`).get().catch(() => null);
      out.request = rs && rs.exists ? String(rs.data().status || "") : null;
    }
    if (acc.builder) {
      const [ls, ds] = await Promise.all([db.doc(LIVE).get(), db.doc(DRAFT).get()]);
      out.liveVersion = ls.exists ? Number(ls.data().version) || 0 : 0;
      out.liveActive = ls.exists ? ls.data().active !== false && out.liveVersion > 0 : false;
      out.hasDraft = ds.exists;
      out.draftUpdatedAt = ds.exists ? Number(ds.data().updatedAt) || 0 : 0;
    }
    return out;
  }

  needBuilder(acc);
  switch (action) {
    case "builderGenerate": return generate(ctx);
    case "builderDiscard": await db.doc(DRAFT).delete(); return { ok: true };
    case "builderPublish": needOwner(acc); return publish(ctx);
    case "builderUnpublish": needOwner(acc); return unpublish(ctx);
    case "builderRollback": needOwner(acc); return rollback(ctx);
  }
  throw err(400, "Unknown builder action.");
}
