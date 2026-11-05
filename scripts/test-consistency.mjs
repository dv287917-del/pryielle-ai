// Static cross-checks: schema <-> renderer <-> CSS <-> rules <-> server. Chalao: node scripts/test-consistency.mjs
// Kisi ek jagah naya block/slot/flag/CSS variable jode aur dusri jagah bhool jao to ye pakadta hai.
import { readFileSync } from "node:fs";
import { SCHEMA_PROMPT, BLOCK_TYPES, SLOTS, SLOT_RULES } from "../shared/featureSchema.js";
import { BUILTIN_FLAGS, THEME_VAR_NAMES } from "../shared/featureRuntime.js";

const r = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const blocks = r("src/components/Blocks.tsx"), home = r("src/components/Home.tsx"), css = r("src/styles.css");
const rules = r("firestore.rules"), ai = r("api/ai.js"), bld = r("api/_builder.js");

let ok = 0, bad = 0;
const t = (n, c) => { c ? ok++ : (bad++, console.log("FAIL", n)); };

for (const type of BLOCK_TYPES) {
  t(`prompt mentions block "${type}"`, SCHEMA_PROMPT.includes(type));
  t(`renderer handles "${type}"`, type === "hero" ? /useHero/.test(blocks) : blocks.includes(`case "${type}"`));
}
for (const slot of SLOTS) t(`Home uses slot "${slot}"`, slot === "home-hero" ? /useHero\(\)/.test(home) : home.includes(`name="${slot}"`));
for (const [type, slots] of Object.entries(SLOT_RULES)) {
  t(`SLOT_RULES "${type}" is a block type`, BLOCK_TYPES.includes(type));
  t(`SLOT_RULES "${type}" slots known`, slots.every((s) => SLOTS.includes(s)));
}
for (const f of BUILTIN_FLAGS) {
  t(`flag "${f}" in prompt`, SCHEMA_PROMPT.includes(f));
  t(`flag "${f}" has CSS`, new RegExp(`\\.fx-${f}\\b`).test(css));
}
for (const v of THEME_VAR_NAMES) t(`theme var ${v} used in CSS`, css.includes(v));

const rootBlock = (css.match(/:root\s*\{([^}]*)\}/) || [, ""])[1];
const defined = new Set([...rootBlock.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/gi)].map((m) => m[1]));
for (const u of used) t(`CSS var ${u} defined in :root (or has fallback)`, defined.has(u) || u === "--r" || u === "--pill");
t("--r/--pill never read without fallback", ![...css.matchAll(/var\(--(r|pill)\)/g)].length);

for (const col of ["appFeatures", "appFeaturesHistory", "builderRequests", "builderAdmins"]) t(`rules cover ${col}`, rules.includes(`match /${col}/`));
t("rules: no client write to appFeatures", /match \/appFeatures\/\{doc\}[\s\S]*?allow list, write: if false/.test(rules));
t("rules: no client create on builderRequests", /match \/builderRequests[\s\S]*?allow create, delete: if false/.test(rules));

t("ai.js wires builder", /from "\.\/_builder\.js"/.test(ai) && ai.includes("handleBuilder(") && ai.includes("maybeSecret("));
t("secret check runs after quota in ask", ai.indexOf("await quota(db,user.uid,c);\n   const sec=await maybeSecret") > 0);
t("_builder.js never logs", !/console\./.test(bld));
t("_builder.js owner-only guards present", ["builderPublish", "builderUnpublish", "builderRollback"].every((a) => new RegExp(`case "${a}": needOwner`).test(bld)));

for (const [name, src] of [["Blocks", blocks], ["BuilderScreen", r("src/components/BuilderScreen.tsx")], ["BuilderAdmin", r("src/components/BuilderAdmin.tsx")], ["features", r("src/lib/features.tsx")]])
  t(`${name}: no raw HTML injection`, !/dangerouslySetInnerHTML|\.innerHTML|eval\(|new Function/.test(src));

const pkg = JSON.parse(r("package.json"));
t("package.json has test script", /test-builder/.test(pkg.scripts?.test || "") && /test-consistency/.test(pkg.scripts?.test || ""));

console.log(ok, "pass", bad, "fail");
process.exit(bad ? 1 : 0);
