// Builder server logic ka test (fake Firestore + fake Gemini). Chalao: node scripts/test-builder.mjs
import { createHash } from "node:crypto";
import { handleBuilder, maybeSecret, codeMatches, _resetSecretCache } from "../api/_builder.js";

let ok = 0, bad = 0;
const t = (n, c) => { c ? ok++ : (bad++, console.log("FAIL", n)); };
const denied = async (n, p, status) => { try { await p; t(n, false); } catch (e) { t(n, e.status === status); } };

function fakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));
  const ref = (path) => ({
    path,
    get: async () => ({ exists: store.has(path), data: () => (store.has(path) ? structuredClone(store.get(path)) : undefined) }),
    set: async (d) => { store.set(path, structuredClone(d)); },
    delete: async () => { store.delete(path); },
  });
  return {
    store,
    doc: ref,
    runTransaction: async (fn) => {
      const writes = [];
      const tx = { get: (r) => r.get(), set: (r, d) => writes.push([r, d]) };
      const out = await fn(tx);
      for (const [r, d] of writes) await r.set(d);
      return out;
    },
  };
}

const owner = { uid: "o1", email: "workwithpryielle@gmail.com", email_verified: true };
const fakeOwner = { uid: "x9", email: "workwithpryielle@gmail.com", email_verified: false };
const builder = { uid: "b1", email: "b@x.com", email_verified: true };
const plain = { uid: "p1", email: "p@x.com", email_verified: true };

const db = fakeDb({ "builderAdmins/b1": { approved: true }, "builderAdmins/p1": { approved: false } });
let quotaCalls = 0, geminiOut = "", lastSys = "", lastGen = null;
const ctx = (user, body = {}) => ({
  db, user, body, c: {}, quota: async () => { quotaCalls++; },
  gemini: async (_c, _contents, _max, _extra, gen, sys) => { lastSys = sys; lastGen = gen; return geminiOut; },
  partsFor: (text) => [{ text }],
});
const run = (action, user, body) => handleBuilder(action, ctx(user, body));

// --- access ---
t("owner status", (await run("builderStatus", owner)).owner === true);
t("unverified owner email is NOT owner", (await run("builderStatus", fakeOwner)).builder === false);
t("approved builder status", (await run("builderStatus", builder)).builder === true && (await run("builderStatus", builder)).owner === false);
t("plain status no data leak", (await run("builderStatus", plain)).liveVersion === undefined);
await denied("plain cannot generate", run("builderGenerate", plain, { prompt: "x" }), 403);
await denied("unapproved (approved:false) cannot generate", run("builderGenerate", plain, { prompt: "x" }), 403);
await denied("builder cannot publish", run("builderPublish", builder), 403);
await denied("builder cannot unpublish", run("builderUnpublish", builder), 403);
await denied("builder cannot rollback", run("builderRollback", builder, { version: 1 }), 403);
await denied("unknown action", run("builderNope", owner), 400);

// --- generate ---
await denied("empty prompt", run("builderGenerate", builder, { prompt: "  " }), 400);
geminiOut = JSON.stringify({ title: "Orange", notes: "ok", theme: { accent: "#ff7a1a" }, blocks: [{ type: "banner", slot: "home-top", text: "Hi <b>there</b>", tone: "promo" }, { type: "script", slot: "home-top" }] });
const g = await run("builderGenerate", builder, { prompt: "orange theme + banner" });
t("generate ok + quota used", g.ok && quotaCalls === 1);
t("validator ran (script dropped, html stripped)", g.config.blocks.length === 1 && g.config.blocks[0].text === "Hi there" && g.warnings.length === 1);
t("draft saved with meta", db.store.get("appFeatures/draft").updatedBy === "b1" && db.store.get("appFeatures/draft").title === "Orange");
t("json mode + low temp + system override", lastGen.responseMimeType === "application/json" && lastGen.temperature < 0.6 && /Output ONLY one JSON/.test(lastSys));
t("no live config yet -> fresh start", /start fresh/.test(lastSys));
t("generate did not touch live", !db.store.has("appFeatures/live"));
geminiOut = "ye JSON nahi hai";
await denied("garbage AI output -> 422, draft untouched", run("builderGenerate", builder, { prompt: "x" }), 422);
t("draft still old after failure", db.store.get("appFeatures/draft").title === "Orange");
geminiOut = JSON.stringify({ title: "Orange2", theme: { accent: "#ff7a1a" } });
await run("builderGenerate", owner, { prompt: "edit" });
t("edit sends current draft as base", /"title":"Orange"/.test(lastSys));

// --- publish ---
const d = db.store.get("appFeatures/draft");
await denied("stale draft -> 409", run("builderPublish", owner, { expectUpdatedAt: d.updatedAt - 1 }), 409);
const p1 = await run("builderPublish", owner, { expectUpdatedAt: d.updatedAt });
t("publish v1", p1.version === 1 && db.store.get("appFeatures/live").publishedBy === "o1" && db.store.get("appFeatures/live").active === true);
t("history v1 written", db.store.get("appFeaturesHistory/1").title === "Orange2");
t("live has no prompt/warnings leak", db.store.get("appFeatures/live").prompt === undefined);
geminiOut = JSON.stringify({ title: "Blue", theme: { accent: "#0a84ff" } });
await run("builderGenerate", builder, { prompt: "blue" });
t("base live when asked", (await run("builderGenerate", builder, { prompt: "x", base: "live" }), /"title":"Orange2"/.test(lastSys)));
geminiOut = JSON.stringify({ title: "Blue", theme: { accent: "#0a84ff" } });
await run("builderGenerate", builder, { prompt: "blue" });
const p2 = await run("builderPublish", owner, {});
t("publish v2", p2.version === 2);

// --- unpublish + rollback ---
const u3 = await run("builderUnpublish", owner);
t("unpublish v3 empty+inactive", u3.version === 3 && u3.active === false && db.store.get("appFeatures/live").blocks.length === 0);
t("status after unpublish", (await run("builderStatus", builder)).liveActive === false && (await run("builderStatus", builder)).liveVersion === 3);
geminiOut = JSON.stringify({ title: "FromNew", theme: { accent: "#111111" } });
await run("builderGenerate", builder, { prompt: "x", base: "live" });
t("inactive live is not used as base", /start fresh/.test(lastSys));
const r4 = await run("builderRollback", owner, { version: 1 });
t("rollback v1 -> new v4", r4.version === 4 && r4.rolledBackFrom === 1 && db.store.get("appFeatures/live").title === "Orange2");
const r5 = await run("builderRollback", owner, { version: 3 });
t("rollback to an unpublish version -> inactive v5", r5.version === 5 && r5.active === false);
await denied("rollback missing version", run("builderRollback", owner, { version: 99 }), 404);
await denied("rollback bad version", run("builderRollback", owner, { version: "abc" }), 400);

// poisoned history doc re-validated
db.store.set("appFeaturesHistory/7", { title: "evil", theme: { accent: "red" }, blocks: [{ type: "script", slot: "home-top" }], active: true });
await denied("poisoned history rejected", run("builderRollback", owner, { version: 7 }), 422);

// --- discard / publish without draft ---
await run("builderDiscard", builder);
t("discard removes draft", !db.store.has("appFeatures/draft"));
await denied("publish without draft -> 404", run("builderPublish", owner, {}), 404);

// ================= Batch 4: secret code + approval request =================
const SALT = "testsalt123", CODE = "open sesame 42";
const HASH = createHash("sha256").update(`${SALT}:${CODE}`).digest("hex");
const sdb = fakeDb({ "aiAdmin/builder": { salt: SALT, codeHash: HASH } });
const newUser = { uid: "n1", email: "new@x.com", email_verified: true, name: "New Person" };
const S = (u, text, atts) => maybeSecret(sdb, u, text, atts);

t("codeMatches ok / wrong", codeMatches({ salt: SALT, codeHash: HASH }, CODE) && !codeMatches({ salt: SALT, codeHash: HASH }, "open sesame 43"));
t("codeMatches bad hash format never matches", !codeMatches({ salt: SALT, codeHash: "zz" }, CODE) && !codeMatches({ salt: SALT, codeHash: "" }, ""));
t("uppercase hash in Firestore still ok", codeMatches({ salt: SALT, codeHash: HASH.toUpperCase().toLowerCase() }, CODE));

t("normal chat => null (goes to Gemini)", (await S(newUser, "hello kaise ho")) === null);
t("wrong code => null, no request", (await S(newUser, "open sesame 41")) === null && !sdb.store.has("builderRequests/n1"));
t("code with attachment => ignored", (await S(newUser, CODE, [{ kind: "text", text: "x", name: "a" }])) === null);
t("long message containing code => ignored", (await S(newUser, "please " + CODE + " ".repeat(120))) === null);
t("empty => null", (await S(newUser, "   ")) === null);

let rs = await S(newUser, "  " + CODE + "  ");
t("right code => request created", rs && rs.secret === true && /owner ko bhej/.test(rs.text));
let req = sdb.store.get("builderRequests/n1");
t("request fields", req.status === "pending" && req.count === 1 && req.email === "new@x.com" && req.displayName === "New Person" && req.requestedAt > 0);
t("request never stores the code", !JSON.stringify(req).includes(CODE) && !JSON.stringify(req).includes("sesame"));
rs = await S(newUser, CODE);
t("again while pending => pending text, count unchanged", /pending/.test(rs.text) && sdb.store.get("builderRequests/n1").count === 1);

// owner rejects (client side does this in the app) -> user may re-request, up to 3 total
sdb.store.set("builderRequests/n1", { ...sdb.store.get("builderRequests/n1"), status: "rejected" });
rs = await S(newUser, CODE);
t("re-request after reject => count 2", /owner ko bhej/.test(rs.text) && sdb.store.get("builderRequests/n1").count === 2 && sdb.store.get("builderRequests/n1").status === "pending");
sdb.store.set("builderRequests/n1", { ...sdb.store.get("builderRequests/n1"), status: "revoked" });
await S(newUser, CODE);
t("3rd request ok", sdb.store.get("builderRequests/n1").count === 3);
sdb.store.set("builderRequests/n1", { ...sdb.store.get("builderRequests/n1"), status: "rejected" });
rs = await S(newUser, CODE);
t("4th request blocked", /nayi request nahi/.test(rs.text) && sdb.store.get("builderRequests/n1").status === "rejected");

// owner / builder shortcuts
t("owner => already open", /owner ho/.test((await S(owner, CODE)).text) && !sdb.store.has("builderRequests/o1"));
sdb.store.set("builderAdmins/n2", { approved: true });
const n2 = { uid: "n2", email: "n2@x.com", email_verified: true };
t("approved builder => already has access, no request", /pehle se hai/.test((await S(n2, CODE)).text) && !sdb.store.has("builderRequests/n2"));
sdb.store.set("builderAdmins/n2", { approved: false });
t("revoked builder (approved:false) can request again", /owner ko bhej/.test((await S(n2, CODE)).text));

// config missing / cache
const emptyDb = fakeDb();
_resetSecretCache();
t("no aiAdmin/builder doc => never matches", (await maybeSecret(emptyDb, newUser, CODE)) === null);
await emptyDb.doc("aiAdmin/builder").set({ salt: SALT, codeHash: HASH });
t("negative result cached briefly (no hammering)", (await maybeSecret(emptyDb, newUser, CODE)) === null);
_resetSecretCache();
t("works after cache reset", (await maybeSecret(emptyDb, newUser, CODE)) !== null);

// builderStatus shows own request state to non-builders (nothing else)
const st = (u) => handleBuilder("builderStatus", { db: sdb, user: u, body: {}, c: {}, quota: async () => {}, gemini: async () => "", partsFor: (x) => [{ text: x }] });
let ss = await st(newUser);
t("status: request state for requester", ss.builder === false && ss.request === "rejected" && ss.liveVersion === undefined);
ss = await st({ uid: "zz", email: "z@x.com", email_verified: true });
t("status: no request => null", ss.request === null);
sdb.store.set("builderAdmins/n1", { approved: true });
ss = await st(newUser);
t("status after approval => builder, full data", ss.builder === true && ss.liveVersion === 0 && ss.request === undefined);

console.log(ok, "pass", bad, "fail");
process.exit(bad ? 1 : 0);
