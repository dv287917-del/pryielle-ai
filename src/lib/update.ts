import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { db } from "../firebase";
import { Updater } from "./device";
import type { AppConfig } from "./types";

/** ~360 KB of APK per Firestore document (becomes ~480 KB of base64, safely under the 1 MB document limit) */
const PART_BYTES = 360_000;
export const MAX_APK_MB = 100;
const pid = (i: number) => String(i).padStart(4, "0");

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("File padh nahi paya"));
    r.readAsDataURL(blob);
  });
}

/** Admin: store an APK inside Firestore in small pieces. Returns the number of pieces. */
export async function uploadApk(file: File, version: string, onProgress: (done: number, total: number) => void): Promise<number> {
  if (file.size > MAX_APK_MB * 1_000_000) throw new Error(`APK ${MAX_APK_MB}MB se badi hai. Link wala option use karo.`);
  const total = Math.ceil(file.size / PART_BYTES);
  for (let i = 0; i < total; i += 1) {
    const d = await toBase64(file.slice(i * PART_BYTES, (i + 1) * PART_BYTES));
    let tries = 0;
    for (;;) {
      try {
        await setDoc(doc(db, "updates", version, "parts", pid(i)), { i, d });
        break;
      } catch (e) {
        tries += 1;
        if (tries >= 3) throw e;
        await new Promise((r) => window.setTimeout(r, 800 * tries));
      }
    }
    onProgress(i + 1, total);
  }
  await setDoc(doc(db, "updates", version), { parts: total, size: file.size, at: Date.now() });
  return total;
}

/** Admin: remove the pieces of every older APK so Firestore stays small. */
export async function deleteOldApks(keep: string) {
  const list = await getDocs(collection(db, "updates")).catch(() => null);
  if (!list) return;
  for (const v of list.docs) {
    if (v.id === keep) continue;
    const parts = await getDocs(collection(db, "updates", v.id, "parts")).catch(() => null);
    if (parts) await Promise.all(parts.docs.map((p) => deleteDoc(p.ref).catch(() => undefined)));
    await deleteDoc(v.ref).catch(() => undefined);
  }
}

/** Google Drive / Dropbox share links → direct download links */
export function directLink(raw: string): string {
  const u = raw.trim();
  const drive = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ?? u.match(/drive\.google\.com\/open\?id=([\w-]+)/);
  if (drive) return `https://drive.google.com/uc?export=download&confirm=t&id=${drive[1]}`;
  if (/dropbox\.com/.test(u)) return u.replace(/[?&]dl=0/, "").replace(/(\?|$)/, (m) => (m === "?" ? "?dl=1&" : "?dl=1"));
  return u;
}

export type UpdatePhase = "idle" | "downloading" | "ready" | "error";

/** App: download the update (Firestore pieces or link) into the phone and open the installer. */
export async function downloadUpdate(cfg: AppConfig, onProgress: (pct: number) => void): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    if (cfg.updateUrl) window.open(directLink(cfg.updateUrl), "_blank");
    throw new Error("Update sirf Android app ke andar se hota hai");
  }
  if (cfg.updateParts > 0) {
    const total = cfg.updateParts;
    const get = (i: number) => getDoc(doc(db, "updates", cfg.updateVersion, "parts", pid(i)));
    const pending: Promise<Awaited<ReturnType<typeof get>>>[] = [];
    for (let i = 0; i < Math.min(3, total); i += 1) pending.push(get(i));
    for (let i = 0; i < total; i += 1) {
      const snap = await pending[i];
      if (!snap.exists()) throw new Error("Update file adhoori hai, owner se dobara publish karne bolo");
      if (i + 3 < total) pending.push(get(i + 3));
      await Updater.writeChunk({ index: i, data: String(snap.data().d) });
      onProgress(Math.round(((i + 1) / total) * 100));
    }
  } else if (cfg.updateUrl) {
    const h = await Updater.addListener("progress", (e) => onProgress(e.total > 0 ? Math.min(99, Math.round((e.done / e.total) * 100)) : 0));
    try {
      await Updater.download({ url: directLink(cfg.updateUrl) });
    } finally {
      void h.remove();
    }
    onProgress(100);
  } else {
    throw new Error("Update file set nahi hai");
  }
}

/* ---- "update already installed" memory: stops the same popup coming back again and again ---- */
const K_PENDING = "pry-upd-pending";
const K_DONE = "pry-upd-done";

export function getDoneVersion(): string {
  try { return localStorage.getItem(K_DONE) ?? ""; } catch { return ""; }
}
function markDone(version: string) {
  try {
    localStorage.setItem(K_DONE, version);
    localStorage.removeItem(K_PENDING);
  } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event("pry-upd-done"));
}

/** Call on start and on resume: if the app was replaced since we opened the installer, the update is done for good. */
export async function reconcileUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const raw = localStorage.getItem(K_PENDING);
    if (!raw) return;
    const p = JSON.parse(raw) as { v: string; last: number };
    const info = await Updater.info();
    if (info.lastUpdate !== p.last) markDone(p.v);
  } catch { /* try again next time */ }
}

/** Checks the real version inside the downloaded APK, then opens the installer. */
export async function installDownloaded(version: string): Promise<void> {
  const [info, apk] = await Promise.all([Updater.info(), Updater.inspect()]);
  if (apk.versionCode <= info.versionCode) {
    markDone(version);
    throw new Error(`Is APK ka version v${apk.versionName} hai aur phone par pehle se v${info.versionName} installed hai, isliye install nahi hoga. (Naye APK mein package.json ka version badhana bhool gaye the.) Ye popup ab dobara nahi aayega.`);
  }
  try { localStorage.setItem(K_PENDING, JSON.stringify({ v: version, last: info.lastUpdate })); } catch { /* ignore */ }
  await Updater.install();
}
