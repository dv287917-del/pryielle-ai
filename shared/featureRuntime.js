// Pryielle AI Builder — client runtime ke pure helpers (Batch 3). React/Firebase nahi: Node me test hota hai.
// Server in ko use nahi karta; app (src/lib/features.tsx, components/Blocks.tsx) karta hai.
import { validateFeatureConfig } from "./featureSchema.js";

/** App jin flags ka asar khud jaanta hai (html par `fx-<name>` class lagti hai). */
export const BUILTIN_FLAGS = ["hideUpgrade", "compact", "hideCopy"];

export const DEFAULTS = { bg: "#141414", text: "#f4f1e8", muted: "#9a968c", surface: "#1e1e1c", accent: "#d97757" };
export const THEME_VAR_NAMES = ["--bg", "--ink", "--mute", "--accent", "--on-accent", "--surface", "--field", "--raise", "--raise2", "--line", "--drawer", "--r", "--pill", "--sans", "--serif"];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const isHex = (h) => typeof h === "string" && HEX.test(h);

export function parseHex(h) {
  if (!isHex(h)) return null;
  let s = h.slice(1);
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}
export const toHex = (rgb) => "#" + rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
/** a se b ki taraf t (0..1) mix */
export function mix(a, b, t) {
  const x = parseHex(a), y = parseHex(b);
  if (!x || !y) return a;
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}
export function luminance(h) {
  const c = parseHex(h);
  if (!c) return 0;
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** colour ke upar likhne ke liye kaala ya safed (jo zyada padhne layak ho) */
export const onColor = (bg) => (contrast(bg, "#141414") >= contrast(bg, "#ffffff") ? "#141414" : "#ffffff");

export const FONT_STACKS = {
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, Menlo, Consolas, "Courier New", monospace',
  rounded: 'ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif',
};

/**
 * theme -> CSS variables. Safety: agar rang padhne layak nahi (contrast kam) to wo override ignore hota hai
 * (taaki koi bhi publish app ko "andha" na bana sake). notes me bata deta hai kya ignore hua.
 */
export function themeToVars(theme) {
  const t = theme && typeof theme === "object" ? theme : {};
  const vars = {}, notes = [];
  const pick = (k) => (isHex(t[k]) ? t[k] : undefined);
  let bg = pick("bg"), text = pick("text"), muted = pick("muted"), surface = pick("surface");
  const accent = pick("accent");

  if (bg || text) {
    if (contrast(bg || DEFAULTS.bg, text || DEFAULTS.text) < 3) {
      if (text) { notes.push("text rang bg par padha nahi jata, ignore kiya"); text = undefined; muted = undefined; }
      else { notes.push("bg rang default text ke saath padha nahi jata, ignore kiya"); bg = undefined; }
    }
  }
  const effBg = bg || DEFAULTS.bg, effText = text || DEFAULTS.text;
  if (muted && contrast(effBg, muted) < 2) { notes.push("muted rang bahut halka, ignore kiya"); muted = undefined; }
  if (!surface && bg) surface = mix(effBg, effText, 0.07);
  if (surface && contrast(surface, effText) < 3) { notes.push("surface rang text ke saath nahi chalta, auto badla"); surface = mix(effBg, effText, 0.07); }

  if (bg) { vars["--bg"] = bg; vars["--drawer"] = mix(effBg, effText, 0.04); }
  if (text) vars["--ink"] = text;
  if (muted) vars["--mute"] = muted;
  if (accent) { vars["--accent"] = accent; vars["--on-accent"] = onColor(accent); }
  if (surface) {
    vars["--surface"] = surface; vars["--field"] = surface;
    vars["--raise"] = mix(surface, effText, 0.09); vars["--raise2"] = mix(surface, effText, 0.06);
    vars["--line"] = mix(surface, effText, 0.16);
  }
  if (Number.isFinite(t.radius)) {
    const r = Math.max(0, Math.min(28, Math.round(t.radius)));
    vars["--r"] = r + "px";
    vars["--pill"] = r >= 22 ? "999px" : Math.round(r * 1.6) + "px";
  }
  if (typeof t.font === "string" && FONT_STACKS[t.font]) { vars["--sans"] = FONT_STACKS[t.font]; vars["--serif"] = FONT_STACKS[t.font]; }
  return { vars, notes };
}

/** live Firestore doc -> {version, active, revert, config, bad}. Client me dobara validate hota hai. */
export function parseLive(raw) {
  if (!raw || typeof raw !== "object") return null;
  const version = Number(raw.version) || 0;
  const revert = raw.unpublished === true || (raw.rolledBackFrom !== undefined && raw.rolledBackFrom !== null);
  if (raw.active === false) return { version, active: false, revert: true, config: null, bad: version < 1 };
  const v = validateFeatureConfig(raw);
  if (!v.ok || version < 1) return { version, active: true, revert, config: null, bad: true };
  return { version, active: true, revert, config: v.config, bad: false };
}

/**
 * Naya live version mila to kya karein?
 *  "none"   kuch nahi
 *  "apply"  chupchap laga do (pehli baar, ya unpublish/rollback = purane/default look par wapas — safety)
 *  "prompt" naya version: "Update now" popup dikhao
 */
export function decideUpdate(appliedVersion, live) {
  if (!live || live.bad || live.version < 1) return "none";
  if (appliedVersion === null || appliedVersion === undefined) return live.active ? "apply" : "none";
  if (live.version === appliedVersion) return "none";
  if (!live.active || live.revert || live.version < appliedVersion) return "apply";
  return "prompt";
}

/** user override (sirf jin flags ka toggle block hai) > config.flags > toggle default */
export function effectiveFlags(config, overrides) {
  const out = {};
  if (!config) return out;
  for (const [k, v] of Object.entries(config.flags || {})) out[k] = !!v;
  for (const b of config.blocks || []) {
    if (b.type !== "toggle") continue;
    if (!(b.flag in out)) out[b.flag] = !!b.default;
    if (overrides && typeof overrides[b.flag] === "boolean") out[b.flag] = overrides[b.flag];
  }
  return out;
}

/** "{name}" jaise placeholders bharo; anjaan placeholder jaisa hai waisa chhod do */
export const interpolate = (text, vars) => String(text ?? "").replace(/\{(\w{1,20})\}/g, (m, k) => (vars && typeof vars[k] === "string" ? vars[k] : m));

export const safeUrl = (u) => {
  try { const x = new URL(String(u)); return x.protocol === "https:" ? x.href : null; } catch { return null; }
};

/** Builder screen ke liye: config ka chhota insaani summary (text-only, kuch render nahi hota) */
export function summarizeConfig(config) {
  const c = config && typeof config === "object" ? config : {};
  const th = c.theme && typeof c.theme === "object" ? c.theme : {};
  const blocks = (Array.isArray(c.blocks) ? c.blocks : []).map((b) => ({
    type: String(b.type || ""),
    slot: String(b.slot || ""),
    label: String(b.text || b.title || b.label || (Array.isArray(b.items) ? b.items.map((i) => i.label).join(", ") : "") || "").slice(0, 40),
  }));
  return {
    title: String(c.title || ""),
    notes: String(c.notes || ""),
    accent: isHex(th.accent) ? th.accent : null,
    bg: isHex(th.bg) ? th.bg : null,
    themeKeys: Object.keys(th).length,
    flags: Object.keys(c.flags || {}).length,
    blocks,
  };
}

/** draft jis live version par bana tha, live ab usse aage nikal gaya? */
export const draftStale = (basedOnVersion, liveVersion) => Number(basedOnVersion || 0) !== Number(liveVersion || 0);

