/** Spam detector: 1st spam = "Don't Spam" warning, 2nd = voice + animation, 3rd = warning, 4th = voice ... aise hi chalta rehta hai. */
export type SpamLevel = "warn" | "voice";
type Listener = (level: SpamLevel, strike: number) => void;

const listeners = new Set<Listener>();
export const onSpam = (cb: Listener) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

const KEY = "pry-spam-strikes";
const BURST_COUNT = 5; // itne message ...
const BURST_MS = 4_000; // ... itne time mein = spam
const SAME_COUNT = 3; // ek hi text itni baar ...
const SAME_MS = 8_000; // ... itne time mein = spam

let log: { at: number; text: string }[] = [];
let lockUntil = 0;

function nextStrike(): number {
  let n = 0;
  try { n = Number(localStorage.getItem(KEY) ?? 0) || 0; } catch { /* ignore */ }
  n += 1;
  try { localStorage.setItem(KEY, String(n)); } catch { /* ignore */ }
  return n;
}

/** true = ye message spam hai, bhejna mat. */
export function checkSpam(text: string): boolean {
  const now = Date.now();
  if (now < lockUntil) return true;
  log = log.filter((x) => now - x.at < BURST_MS * 2);
  log.push({ at: now, text: text.trim().toLowerCase() });
  const burst = log.filter((x) => now - x.at < BURST_MS).length >= BURST_COUNT;
  const same = text.trim() !== "" && log.filter((x) => now - x.at < SAME_MS && x.text === text.trim().toLowerCase()).length >= SAME_COUNT;
  if (!burst && !same) return false;
  const strike = nextStrike();
  const level: SpamLevel = strike % 2 === 1 ? "warn" : "voice";
  lockUntil = now + (level === "warn" ? 3_500 : 5_000);
  log = [];
  listeners.forEach((l) => l(level, strike));
  return true;
}
