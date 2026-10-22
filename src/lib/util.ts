import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (/permission-denied|Missing or insufficient/i.test(msg)) return "Permission denied. Firestore rules check karo (SETUP.md step 5).";
  if (/network|offline|unavailable|timeout|deadline/i.test(msg)) return "Internet connection check karo.";
  return msg || "Something went wrong";
}

export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let id = 0;
  const timer = new Promise<never>((_, reject) => {
    id = window.setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([p, timer]).finally(() => window.clearTimeout(id));
}

export function compressImage(file: File, maxEdge = 960, quality = 0.7, maxLen = 400_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Photos only"));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Could not read that photo"));
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let q = quality;
      let data = canvas.toDataURL("image/jpeg", q);
      while (data.length > maxLen && q > 0.35) {
        q -= 0.08;
        data = canvas.toDataURL("image/jpeg", q);
      }
      if (data.length > maxLen) return reject(new Error("Photo bahut badi hai, chhoti try karo"));
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo"));
    };
    img.src = url;
  });
}

export function relTime(ms: number): string {
  if (!ms) return "";
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 45) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function dayLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export function lastSeenText(ms: number): string {
  if (!ms) return "offline";
  if (Date.now() - ms < 90_000) return "online";
  const d = new Date(ms);
  const same = d.toDateString() === new Date().toDateString();
  return `last seen ${same ? "" : d.toLocaleDateString([], { day: "numeric", month: "short" }) + " "}${clock(ms)}`;
}

export const isOnline = (ms: number) => Date.now() - ms < 90_000;

let audioCtx: AudioContext | null = null;
export function chime() {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    [660, 990].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.11;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  } catch {
    /* audio blocked */
  }
}

export function buzz() {
  try {
    if (Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Medium });
    else navigator.vibrate?.(40);
  } catch {
    /* no haptics */
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Audio read failed"));
    r.readAsDataURL(blob);
  });
}

/* ---------- theme ---------- */
export const THEMES = [
  { id: "haunted", label: "Haunted", colors: ["#ff5a1f", "#e11d48", "#7c3aed"] },
  { id: "bloodmoon", label: "Blood Moon", colors: ["#ff3b30", "#c1121f", "#6d0b2c"] },
  { id: "phantom", label: "Phantom", colors: ["#67e8f9", "#a855f7", "#ec4899"] },
  { id: "neon", label: "Neon", colors: ["#ff7a1a", "#ff2e7e", "#8b5cf6"] },
  { id: "ocean", label: "Ocean", colors: ["#22d3ee", "#3b82f6", "#8b5cf6"] },
  { id: "toxic", label: "Toxic", colors: ["#a3e635", "#22c55e", "#06b6d4"] },
  { id: "crimson", label: "Crimson", colors: ["#fb923c", "#ef4444", "#be123c"] },
  { id: "aurora", label: "Northern Lights", colors: ["#34d399", "#22d3ee", "#a78bfa"], art: true },
  { id: "galaxy", label: "Galaxy", colors: ["#a78bfa", "#6366f1", "#ec4899"], art: true },
  { id: "sakura", label: "Sakura", colors: ["#f9a8d4", "#f472b6", "#c084fc"], art: true },
  { id: "cyber", label: "Synthwave", colors: ["#f0abfc", "#ec4899", "#22d3ee"], art: true },
  { id: "sunset", label: "Sunset", colors: ["#fbbf24", "#fb7185", "#a855f7"], art: true },
  { id: "matrix", label: "Matrix", colors: ["#4ade80", "#16a34a", "#065f46"], art: true },
  { id: "frost", label: "Frost", colors: ["#bae6fd", "#60a5fa", "#a5b4fc"], art: true },
  { id: "hearts", label: "Love", colors: ["#fb7185", "#f43f5e", "#e879f9"], art: true },
  { id: "gold", label: "Royal Gold", colors: ["#fcd34d", "#f59e0b", "#b45309"], art: true },
  { id: "forest", label: "Dark Forest", colors: ["#86efac", "#22c55e", "#0f766e"], art: true },
  { id: "candy", label: "Candy", colors: ["#fda4af", "#67e8f9", "#fde047"], art: true },
  { id: "lava", label: "Lava", colors: ["#fdba74", "#ef4444", "#7f1d1d"], art: true },
] as { id: string; label: string; colors: readonly [string, string, string]; art?: boolean }[];

export function loadTheme() {
  const theme = localStorage.getItem("pry-theme") ?? "haunted";
  const amoled = localStorage.getItem("pry-amoled") === "1";
  applyTheme(theme, amoled);
  document.documentElement.dataset.motion = localStorage.getItem("iron-motion") === "reduced" ? "reduced" : "full";
  document.documentElement.dataset.bigtext = localStorage.getItem("iron-bigtext") === "1" ? "true" : "false";
  return { theme, amoled };
}

export function applyTheme(theme: string, amoled: boolean) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.amoled = amoled ? "true" : "false";
  localStorage.setItem("pry-theme", theme);
  localStorage.setItem("pry-amoled", amoled ? "1" : "0");
}

/* ---------- app lock ---------- */
async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pryielle:${text}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const hasPin = () => Boolean(localStorage.getItem("pry-pin"));
export async function setPin(pin: string) {
  localStorage.setItem("pry-pin", await sha(pin));
}
export function clearPin() {
  localStorage.removeItem("pry-pin");
}
export async function checkPin(pin: string) {
  return (await sha(pin)) === localStorage.getItem("pry-pin");
}

/* ---------- back button stack ---------- */
const backStack: Array<() => void> = [];
export function pushBack(fn: () => void) {
  backStack.push(fn);
  return () => {
    const i = backStack.lastIndexOf(fn);
    if (i >= 0) backStack.splice(i, 1);
  };
}
export function popBack(): boolean {
  const fn = backStack.pop();
  if (!fn) return false;
  fn();
  return true;
}

import { declineChat } from "./data";
export function declineAndLeave(chatId: string) {
  void declineChat(chatId).catch(() => undefined);
}
