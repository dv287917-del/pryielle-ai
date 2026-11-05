// Client runtime helpers ka test. Chalao: node scripts/test-runtime.mjs
import { summarizeConfig, draftStale, themeToVars, parseLive, decideUpdate, effectiveFlags, interpolate, safeUrl, contrast, mix, onColor, THEME_VAR_NAMES } from "../shared/featureRuntime.js";

let ok = 0, bad = 0;
const t = (n, c) => { c ? ok++ : (bad++, console.log("FAIL", n)); };

// ---- theme ----
let r = themeToVars({ accent: "#ff7a1a", radius: 8, font: "mono" });
t("accent + on-accent", r.vars["--accent"] === "#ff7a1a" && r.vars["--on-accent"] === "#141414");
t("dark accent -> white text", themeToVars({ accent: "#102a6b" }).vars["--on-accent"] === "#ffffff");
t("radius small => square-ish pill", r.vars["--r"] === "8px" && r.vars["--pill"] === "13px");
t("radius big => full pill", themeToVars({ radius: 28 }).vars["--pill"] === "999px");
t("radius 0", themeToVars({ radius: 0 }).vars["--r"] === "0px");
t("font mono sets both", r.vars["--sans"].includes("monospace") && r.vars["--serif"].includes("monospace"));
t("font system => nothing", themeToVars({ font: "system" }).vars["--sans"] === undefined);
t("empty theme => no vars", Object.keys(themeToVars({}).vars).length === 0 && Object.keys(themeToVars(null).vars).length === 0);
t("garbage colours ignored", Object.keys(themeToVars({ accent: "red", bg: "url(x)", text: "#12" }).vars).length === 0);

// light theme: bg light + dark text -> surface auto derived, everything readable
r = themeToVars({ bg: "#ffffff", text: "#111111" });
t("light theme applied", r.vars["--bg"] === "#ffffff" && r.vars["--ink"] === "#111111" && r.notes.length === 0);
t("light theme surface derived & readable", r.vars["--surface"] && contrast(r.vars["--surface"], "#111111") >= 3);
t("light theme line/raise set", r.vars["--line"] && r.vars["--raise"] && r.vars["--drawer"]);

// safety: unreadable combos
r = themeToVars({ bg: "#111111", text: "#151515" });
t("text==bg ignored (text dropped, bg kept)", r.vars["--ink"] === undefined && r.vars["--bg"] === "#111111" && r.notes.length >= 1);
r = themeToVars({ bg: "#ffffff" });
t("light bg alone (default light text) -> bg dropped", r.vars["--bg"] === undefined && r.notes.length === 1);
r = themeToVars({ text: "#161616" });
t("dark text on default dark bg -> dropped", r.vars["--ink"] === undefined);
r = themeToVars({ bg: "#000000", muted: "#050505" });
t("invisible muted dropped", r.vars["--mute"] === undefined);
r = themeToVars({ surface: "#f4f1e8" });
t("surface equal to text colour auto-fixed", contrast(r.vars["--surface"], "#f4f1e8") >= 3);
t("every var name known", Object.keys(themeToVars({ accent: "#ff0000", bg: "#101010", text: "#eeeeee", muted: "#aaaaaa", surface: "#222222", radius: 10, font: "serif" }).vars).every((k) => THEME_VAR_NAMES.includes(k)));
t("mix endpoints", mix("#000000", "#ffffff", 0) === "#000000" && mix("#000000", "#ffffff", 1) === "#ffffff");
t("3-digit hex ok", onColor("#fff") === "#141414");

// ---- parseLive ----
const good = { schemaVersion: 1, title: "A", notes: "n", theme: { accent: "#ff7a1a" }, flags: {}, blocks: [], version: 3, active: true };
let p = parseLive(good);
t("parseLive ok", p && p.version === 3 && p.active && !p.bad && p.config.theme.accent === "#ff7a1a");
t("parseLive null", parseLive(null) === null && parseLive("x") === null);
p = parseLive({ ...good, active: false });
t("inactive => revert, no config", p.active === false && p.revert === true && p.config === null && !p.bad);
t("rolledBackFrom => revert", parseLive({ ...good, rolledBackFrom: 1 }).revert === true);
t("poisoned live doc => bad", parseLive({ ...good, blocks: [{ type: "script", slot: "home-top" }], theme: {}, title: "" }).bad === true || parseLive({ title: "x", theme: {}, blocks: [{ type: "script", slot: "home-top" }], version: 4 }).bad === true);
t("version 0 => bad", parseLive({ ...good, version: 0 }).bad === true);
t("script block dropped on client too", parseLive({ ...good, blocks: [{ id: "a", type: "banner", slot: "home-top", text: "<b>hi</b>", tone: "info" }, { type: "script", slot: "home-top" }] }).config.blocks.length === 1);

// ---- decideUpdate ----
const L = (o) => ({ version: 5, active: true, revert: false, config: {}, bad: false, ...o });
t("first time => apply silently", decideUpdate(null, L()) === "apply");
t("first time inactive => none", decideUpdate(null, L({ active: false, revert: true })) === "none");
t("same version => none", decideUpdate(5, L()) === "none");
t("newer => prompt", decideUpdate(4, L()) === "prompt");
t("unpublish => apply (revert)", decideUpdate(4, L({ active: false, revert: true, config: null })) === "apply");
t("rollback (higher number) => apply", decideUpdate(4, L({ revert: true })) === "apply");
t("older => apply", decideUpdate(9, L()) === "apply");
t("bad/null => none", decideUpdate(4, L({ bad: true })) === "none" && decideUpdate(4, null) === "none");

// ---- flags ----
const cfg = { flags: { compact: true, x: false }, blocks: [{ type: "toggle", flag: "dark2", default: true }, { type: "toggle", flag: "x", default: true }] };
let f = effectiveFlags(cfg, {});
t("flags: config > toggle default", f.compact === true && f.x === false && f.dark2 === true);
f = effectiveFlags(cfg, { dark2: false, x: true, compact: false, ghost: true });
t("flags: override only for toggled flags", f.dark2 === false && f.x === true && f.compact === true && f.ghost === undefined);
t("flags: null config", Object.keys(effectiveFlags(null, {})).length === 0);

// ---- text / url ----
t("interpolate", interpolate("Hi {name}!", { name: "Raj" }) === "Hi Raj!" && interpolate("Hi {who}", { name: "Raj" }) === "Hi {who}" && interpolate("a", undefined) === "a");
t("safeUrl", safeUrl("https://a.com/x") && !safeUrl("http://a.com") && !safeUrl("javascript:alert(1)") && !safeUrl("nope"));

// ---- summarizeConfig / draftStale ----
const sm = summarizeConfig({ title: "T", notes: "N", theme: { accent: "#ff7a1a", bg: "nope", font: "mono" }, flags: { a: true }, blocks: [
  { type: "banner", slot: "home-top", text: "Hello world" }, { type: "hero", slot: "home-hero", title: "Hi {name}" },
  { type: "chips", slot: "home-suggestions", items: [{ label: "A", prompt: "x" }, { label: "B", prompt: "y" }] }, { type: "toggle", slot: "drawer", label: "Compact" }] });
t("summary basics", sm.title === "T" && sm.accent === "#ff7a1a" && sm.bg === null && sm.themeKeys === 3 && sm.flags === 1 && sm.blocks.length === 4);
t("summary labels", sm.blocks[0].label === "Hello world" && sm.blocks[1].label === "Hi {name}" && sm.blocks[2].label === "A, B" && sm.blocks[3].label === "Compact");
t("summary tolerates junk", summarizeConfig(null).blocks.length === 0 && summarizeConfig({ blocks: "x", theme: 5 }).themeKeys === 0);
t("long label cut", summarizeConfig({ blocks: [{ type: "banner", slot: "home-top", text: "x".repeat(200) }] }).blocks[0].label.length === 40);
t("draftStale", draftStale(2, 2) === false && draftStale(2, 3) === true && draftStale(undefined, 0) === false && draftStale(undefined, 1) === true);

console.log(ok, "pass", bad, "fail");
process.exit(bad ? 1 : 0);
