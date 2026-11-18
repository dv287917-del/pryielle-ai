import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const PART = 600_000;
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export const chatMedia = (chatId: string) => ["chats", chatId, "media"];
export const storyMedia = (uid: string) => ["stories", uid, "media"];
const key = (base: string[], id: string) => `${base.join("/")}/${id}`;

export const cachedMedia = (base: string[], id: string) => cache.get(key(base, id)) ?? null;
export const primeMedia = (base: string[], id: string, url: string) => void cache.set(key(base, id), url);

export function dataUrlToBlob(u: string): Blob {
  const [head, body] = u.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] ?? "application/octet-stream";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("File read nahi hui"));
    r.readAsDataURL(file);
  });
}

export async function uploadMedia(base: string[], dataUrl: string, kind: string): Promise<string> {
  const id = doc(collection(db, base.join("/"))).id;
  const parts: string[] = [];
  for (let i = 0; i < dataUrl.length; i += PART) parts.push(dataUrl.slice(i, i + PART));
  const path = key(base, id);
  await setDoc(doc(db, path), { kind, n: parts.length, at: Date.now() });
  for (let i = 0; i < parts.length; i += 4) {
    await Promise.all(parts.slice(i, i + 4).map((d, j) => setDoc(doc(db, `${path}/parts/${i + j}`), { i: i + j, d })));
  }
  return id;
}

export function fetchMedia(base: string[], id: string): Promise<string> {
  const k = key(base, id);
  const hit = cache.get(k);
  if (hit) return Promise.resolve(hit);
  const running = inflight.get(k);
  if (running) return running;
  const p = (async () => {
    const snap = await getDocs(collection(db, `${k}/parts`));
    const parts = snap.docs.map((d) => d.data() as { i: number; d: string }).sort((a, b) => a.i - b.i);
    if (!parts.length) throw new Error("Media nahi mila");
    const url = URL.createObjectURL(dataUrlToBlob(parts.map((x) => x.d).join("")));
    cache.set(k, url);
    return url;
  })().finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

export function videoThumb(file: Blob): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const done = (out: string) => {
      URL.revokeObjectURL(url);
      resolve(out);
    };
    const timer = window.setTimeout(() => done(""), 4000);
    v.muted = true;
    v.preload = "metadata";
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.2, (v.duration || 1) / 2);
    };
    v.onseeked = () => {
      try {
        const c = document.createElement("canvas");
        const s = 180 / Math.max(v.videoWidth || 180, v.videoHeight || 180);
        c.width = Math.max(1, Math.round((v.videoWidth || 180) * s));
        c.height = Math.max(1, Math.round((v.videoHeight || 180) * s));
        c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
        window.clearTimeout(timer);
        done(c.toDataURL("image/jpeg", 0.6));
      } catch {
        done("");
      }
    };
    v.onerror = () => done("");
    v.src = url;
  });
}
