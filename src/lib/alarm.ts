import { Capacitor, registerPlugin } from "@capacitor/core";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { UserDoc } from "./types";
import { relTime } from "./util";

/* ---------- alarm (admin -> user) ---------- */
export type AlarmDoc = { id: string; seconds: number; at: number; by: string; ack: boolean };
export const ALARM_PRESETS = [5, 30, 60] as const;
export const MAX_ALARM_SECONDS = 3600; // 1 ghanta

type AlarmNativePlugin = {
  ring(o: { id: string; seconds: number }): Promise<{ already: boolean; remaining: number }>;
  stop(): Promise<void>;
  adminStop(): Promise<void>;
  setCustomSound(o: { base64: string }): Promise<{ ok: boolean; bytes: number }>;
  clearCustomSound(): Promise<void>;
  hasCustomSound(): Promise<{ has: boolean; bytes: number }>;
};
export const AlarmNative = registerPlugin<AlarmNativePlugin>("Alarm");
export const isNative = Capacitor.isNativePlatform();

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export async function sendAlarm(uid: string, seconds: number, by: string) {
  const s = Math.max(1, Math.min(MAX_ALARM_SECONDS, Math.round(seconds) || 30));
  await setDoc(doc(db, "alarms", uid), { id: rid(), seconds: s, at: Date.now(), by: by.slice(0, 40), ack: false });
}

/** Admin-only: clear alarm doc so target stops (hard mode listens for missing/ack). */
export async function stopAlarm(uid: string) {
  try {
    await deleteDoc(doc(db, "alarms", uid));
  } catch {
    await updateDoc(doc(db, "alarms", uid), { ack: true, stop: true, ackAt: Date.now() }).catch(() => undefined);
  }
}

const toAlarm = (d: Record<string, unknown>): AlarmDoc => ({
  id: String(d.id ?? ""), seconds: Number(d.seconds ?? 30), at: Number(d.at ?? 0), by: String(d.by ?? ""), ack: Boolean(d.ack),
});

export const watchAlarm = (uid: string, cb: (a: AlarmDoc | null) => void) =>
  onSnapshot(doc(db, "alarms", uid), (s) => cb(s.exists() ? toAlarm(s.data()) : null), () => cb(null));

export const watchAllAlarms = (cb: (m: Record<string, AlarmDoc>) => void) =>
  onSnapshot(collection(db, "alarms"), (s) => {
    const out: Record<string, AlarmDoc> = {};
    s.docs.forEach((d) => { out[d.id] = toAlarm(d.data()); });
    cb(out);
  }, () => cb({}));

export const ackAlarm = (uid: string) => updateDoc(doc(db, "alarms", uid), { ack: true, ackAt: Date.now() }).catch(() => undefined);

/* ---------- custom sound (device-local) ---------- */
export async function importCustomAlarmSound(file: File): Promise<{ ok: boolean; bytes?: number; error?: string }> {
  if (!isNative) return { ok: false, error: "native only" };
  try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    const r = await AlarmNative.setCustomSound({ base64: b64 });
    return { ok: true, bytes: r.bytes };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function clearCustomAlarmSound() {
  if (isNative) await AlarmNative.clearCustomSound().catch(() => undefined);
}

export async function hasCustomAlarmSound() {
  if (!isNative) return { has: false, bytes: 0 };
  try { return await AlarmNative.hasCustomSound(); } catch { return { has: false, bytes: 0 }; }
}

/* ---------- Emergency: kaun online, kisne app band kiya, kiska phone off ---------- */
export const watchEmergencyUsers = (cb: (u: UserDoc[]) => void) =>
  onSnapshot(query(collection(db, "users"), orderBy("lastSeen", "desc"), limit(200)), (s) => cb(s.docs.map((d) => ({ ...(d.data() as UserDoc), uid: (d.data() as UserDoc).uid || d.id }))), () => cb([]));

export type LiveState = "online" | "closed" | "off" | "never";
export const LIVE_FRESH_MS = 120_000;

/**
 * Online = abhi heartbeat aa raha hai.
 * App band = user ne app background/band kiya (app ne khud bataya).
 * Switch Off = app khula tha, phir bina bataye gayab (phone off / net band / crash / force stop).
 */
export function liveState(u: UserDoc, now = Date.now()): { state: LiveState; label: string } {
  if (!u.lastSeen) return { state: "never", label: "Kabhi online nahi aaya" };
  const age = now - u.lastSeen;
  const ago = relTime(u.lastSeen) || "now";
  if (age < LIVE_FRESH_MS && u.appState !== "background") return { state: "online", label: "Online" };
  if (u.appState === "background") return { state: "closed", label: `App band · ${ago} pehle` };
  return { state: "off", label: `Switch Off · ${ago} pehle` };
}
