import { doc, getDoc } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { db } from "../firebase";
import { Updater } from "./device";
import type { AiConfig } from "./appConfig";

export const AI_PACKAGE = "com.pryielle.ai";
/** AI APK pieces: updates/ai-<version>/parts/0000.. (MSG ke versions se alag) */
const docId = (version: string) => `ai-${version}`;
const pid = (i: number) => String(i).padStart(4, "0");

/** Google Drive / Dropbox share link -> direct download link */
export function directLink(raw: string): string {
  const u = raw.trim();
  const drive = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ?? u.match(/drive\.google\.com\/open\?id=([\w-]+)/);
  if (drive) return `https://drive.google.com/uc?export=download&confirm=t&id=${drive[1]}`;
  if (/dropbox\.com/.test(u)) return u.replace(/[?&]dl=0/, "").replace(/(\?|$)/, (m) => (m === "?" ? "?dl=1&" : "?dl=1"));
  return u;
}

/** Update phone me download karo (Firestore pieces ya link). */
export async function downloadUpdate(cfg: AiConfig, onProgress: (pct: number) => void): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    if (cfg.aiUpdateUrl) window.open(directLink(cfg.aiUpdateUrl), "_blank");
    throw new Error("Update sirf Android app ke andar se hota hai");
  }
  if (cfg.aiUpdateParts > 0) {
    const total = cfg.aiUpdateParts;
    const get = (i: number) => getDoc(doc(db, "updates", docId(cfg.aiUpdateVersion), "parts", pid(i)));
    const pending: Promise<Awaited<ReturnType<typeof get>>>[] = [];
    for (let i = 0; i < Math.min(3, total); i += 1) pending.push(get(i));
    for (let i = 0; i < total; i += 1) {
      const snap = await pending[i];
      if (!snap.exists()) throw new Error("Update file adhoori hai, owner se dobara publish karne bolo");
      if (i + 3 < total) pending.push(get(i + 3));
      await Updater.writeChunk({ index: i, data: String(snap.data().d) });
      onProgress(Math.round(((i + 1) / total) * 100));
    }
  } else if (cfg.aiUpdateUrl) {
    const h = await Updater.addListener("progress", (e) => onProgress(e.total > 0 ? Math.min(99, Math.round((e.done / e.total) * 100)) : 0));
    try {
      await Updater.download({ url: directLink(cfg.aiUpdateUrl) });
    } finally {
      void h.remove();
    }
    onProgress(100);
  } else {
    throw new Error("Update file set nahi hai");
  }
}

/* ---- "update ho chuka" yaad rakhna: wahi popup baar baar na aaye ---- */
const K_PENDING = "pryai-upd-pending";
const K_DONE = "pryai-upd-done";

export function getDoneVersion(): string {
  try { return localStorage.getItem(K_DONE) ?? ""; } catch { return ""; }
}
function markDone(version: string) {
  try {
    localStorage.setItem(K_DONE, version);
    localStorage.removeItem(K_PENDING);
  } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event("pryai-upd-done"));
}

/** Start/resume par: installer kholne ke baad app replace ho gayi ho to update pakka done. */
export async function reconcileUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const raw = localStorage.getItem(K_PENDING);
    if (!raw) return;
    const p = JSON.parse(raw) as { v: string; last: number };
    const info = await Updater.info();
    if (info.lastUpdate !== p.last) markDone(p.v);
  } catch { /* agli baar dekhenge */ }
}

/** APK ke andar ka asli version check karo, phir installer kholo. */
export async function installDownloaded(version: string): Promise<void> {
  const [info, apk] = await Promise.all([Updater.info(), Updater.inspect({ expectPackage: AI_PACKAGE })]);
  if (apk.versionCode <= info.versionCode) {
    markDone(version);
    throw new Error(`Is APK ka version v${apk.versionName} hai aur phone par v${info.versionName} pehle se hai, isliye install nahi hoga. (Naye APK me package.json ka version badhana bhool gaye the.) Ye popup ab dobara nahi aayega.`);
  }
  try { localStorage.setItem(K_PENDING, JSON.stringify({ v: version, last: info.lastUpdate })); } catch { /* ignore */ }
  await Updater.install();
}
