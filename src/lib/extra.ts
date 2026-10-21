import {
  collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where,
} from "firebase/firestore";
import { db } from "../firebase";
import { ADMIN_EMAIL, EMPTY_CONFIG, type AppConfig, type NewsItem, type NoteDoc, type Role, type StoryItem, type UserDoc } from "./types";

export const isAdminEmail = (email: string | null | undefined) => (email ?? "").toLowerCase() === ADMIN_EMAIL;

/* ---------- app config / maintenance ---------- */
export function watchConfig(cb: (c: AppConfig) => void) {
  return onSnapshot(
    doc(db, "config", "app"),
    (s) => {
      const d = (s.data() ?? {}) as Partial<AppConfig>;
      cb({
        maintenance: Boolean(d.maintenance), message: d.message ?? "", banner: d.banner ?? "", bannerOn: Boolean(d.bannerOn),
        updateVersion: d.updateVersion ?? "", updateUrl: d.updateUrl ?? "", updateNotes: d.updateNotes ?? "", updateForce: Boolean(d.updateForce),
        updateTitle: d.updateTitle ?? "", updateParts: Number(d.updateParts ?? 0), updateSize: Number(d.updateSize ?? 0),
        blockVpn: d.blockVpn ?? true, autoDetect: d.autoDetect ?? true, oneAccountPerDevice: d.oneAccountPerDevice ?? true,
      });
    },
    () => cb(EMPTY_CONFIG),
  );
}
export const setConfig = (c: AppConfig) => setDoc(doc(db, "config", "app"), { ...c, at: Date.now() });

/* ---------- admin ---------- */
export async function adminStats() {
  const users = collection(db, "users");
  const [all, banned, online, pro, verified] = await Promise.all([
    getCountFromServer(users),
    getCountFromServer(query(users, where("banned", "==", true))),
    getCountFromServer(query(users, where("lastSeen", ">", Date.now() - 90_000))),
    getCountFromServer(query(users, where("pro", "==", true))),
    getCountFromServer(query(users, where("verified", "==", true))),
  ]);
  return { total: all.data().count, banned: banned.data().count, online: online.data().count, pro: pro.data().count, verified: verified.data().count };
}
export async function adminRecentUsers(): Promise<UserDoc[]> {
  const snap = await getDocs(query(collection(db, "users"), orderBy("lastSeen", "desc"), limit(40)));
  return snap.docs.map((d) => d.data() as UserDoc);
}
export const adminSetUser = (uid: string, patch: Partial<Pick<UserDoc, "banned" | "pro" | "verified" | "role">>) => updateDoc(doc(db, "users", uid), patch);

export type Report = { id: string; by: string; target: string; chatId: string; reason: string; at: number };
export function watchReports(cb: (r: Report[]) => void) {
  return onSnapshot(query(collection(db, "reports"), orderBy("at", "desc"), limit(50)), (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Report, "id">) }))), () => cb([]));
}
export const deleteReport = (id: string) => deleteDoc(doc(db, "reports", id));

/* ---------- news ---------- */
export function watchNews(cb: (n: NewsItem[]) => void) {
  return onSnapshot(query(collection(db, "news"), orderBy("at", "desc"), limit(30)), (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NewsItem, "id">) }))), () => cb([]));
}
export async function postNews(by: string, title: string, text: string) {
  const ref = doc(collection(db, "news"));
  await setDoc(ref, { title: title.trim().slice(0, 80), text: text.trim().slice(0, 1500), at: Date.now(), by });
}
export const deleteNews = (id: string) => deleteDoc(doc(db, "news", id));

/* ---------- stories ---------- */
export async function getStories(uid: string): Promise<StoryItem[]> {
  const s = await getDoc(doc(db, "stories", uid));
  const now = Date.now();
  return s.exists() ? ((s.data().items as StoryItem[]) ?? []).filter((i) => i.expiresAt > now) : [];
}
export async function publishStory(uid: string, item: StoryItem) {
  const cur = await getStories(uid);
  await setDoc(doc(db, "stories", uid), { uid, items: [...cur, item].slice(-20), updatedAt: Date.now() });
  // Posts count (Instagram jaisa): har nayi story ek post
  await updateDoc(doc(db, "users", uid), { postsCount: increment(1) }).catch(() => undefined);
}
export async function deleteStory(uid: string, id: string) {
  const cur = await getStories(uid);
  await setDoc(doc(db, "stories", uid), { uid, items: cur.filter((i) => i.id !== id), updatedAt: Date.now() });
}
export const markStoryView = (owner: string, sid: string, viewer: string, name: string) =>
  setDoc(doc(db, "stories", owner, "views", `${sid}_${viewer}`), { sid, viewer, name, at: Date.now() }).catch(() => undefined);
export async function getStoryViews(owner: string, sid: string) {
  const s = await getDocs(query(collection(db, "stories", owner, "views"), where("sid", "==", sid)));
  return s.docs.map((d) => d.data() as { viewer: string; name: string; at: number });
}

/* ---------- roles ---------- */
export const setRole = (uid: string, role: Role) => updateDoc(doc(db, "users", uid), { role });

/* ---------- notes (Instagram jaise, song ke saath) ---------- */
export async function getNote(uid: string): Promise<NoteDoc | null> {
  const s = await getDoc(doc(db, "notes", uid));
  if (!s.exists()) return null;
  const d = s.data() as Partial<NoteDoc>;
  const n: NoteDoc = { uid, text: String(d.text ?? ""), songTitle: d.songTitle ?? null, musicId: d.musicId ?? null, place: d.place ?? null, gif: d.gif ?? null, tone: Number(d.tone ?? 0), audience: d.audience === "close" ? "close" : "all", createdAt: Number(d.createdAt ?? 0), expiresAt: Number(d.expiresAt ?? 0) };
  return n.expiresAt > Date.now() && (n.text || n.songTitle || n.place || n.gif) ? n : null;
}
export async function publishNote(uid: string, input: { text: string; songTitle: string | null; musicId: string | null; place?: string | null; gif?: string | null; tone?: number; audience?: "all" | "close" }, hours: number) {
  const now = Date.now();
  const text = input.text.replace(/\s+/g, " ").trim().slice(0, 60);
  if (!text && !input.songTitle && !input.place && !input.gif) throw new Error("Kuch likho, song, jagah ya GIF chuno");
  await setDoc(doc(db, "notes", uid), { uid, text, songTitle: input.songTitle, musicId: input.musicId, place: input.place ?? null, gif: input.gif ?? null, tone: input.tone ?? 0, audience: input.audience ?? "all", createdAt: now, expiresAt: now + hours * 3_600_000 });
}
export const deleteNote = (uid: string) => deleteDoc(doc(db, "notes", uid));
