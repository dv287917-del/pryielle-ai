/**
 * Performance tiers. Phone ki RAM/CPU dekh kar animation ka level tay hota hai:
 *  low  → 512MB–2GB phones: sirf GPU-friendly transform/opacity, canvas OFF, infinite loops OFF
 *  mid  → normal phones: fluid canvas 30fps, saare transitions
 *  high → flagship: same as mid (extra smooth)
 * Agar app chalte waqt FPS gir jaye to apne aap "low" par shift ho jata hai.
 */
export type PerfTier = "low" | "mid" | "high";
const KEY_USER = "pry-perf"; // user ne Settings se Lite mode ON kiya
const KEY_AUTO = "pry-perf-auto"; // watchdog ne slow detect kiya

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } };

function detect(): PerfTier {
  if (get(KEY_USER) === "low" || get(KEY_AUTO) === "low") return "low";
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const mem = nav.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (mem <= 2 || nav.connection?.saveData || (cores <= 4 && mem <= 3)) return "low";
  if (mem <= 4 || cores <= 6) return "mid";
  return "high";
}

export function initPerf() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.perf = detect();
}

export const perfTier = (): PerfTier => (document.documentElement.dataset.perf as PerfTier) || "mid";
export const isLite = () => perfTier() === "low";

/** Settings toggle: Lite mode ON/OFF. */
export function setLiteMode(on: boolean) {
  set(KEY_USER, on ? "low" : null);
  if (!on) set(KEY_AUTO, null);
  initPerf();
}
export const liteModeOn = () => get(KEY_USER) === "low";

/** FPS watchdog yahan report karta hai. */
export function reportSlow() {
  set(KEY_AUTO, "low");
  document.documentElement.dataset.perf = "low";
}
