import { collection, deleteDoc, doc, getDoc, onSnapshot, query, setDoc, updateDoc, where, limit } from "firebase/firestore";
import { db } from "../firebase";
import { getDeviceId, getPublicIp } from "./device";
import type { BanDoc, UserDoc } from "./types";

/* ---------- device / IP ---------- */
/** Saves this phone's device id + IP on the profile (device id is written once and then locked by the rules). */
export async function syncDevice(me: UserDoc): Promise<{ deviceId: string; ip: string }> {
  const [deviceId, ip] = await Promise.all([getDeviceId(), getPublicIp()]);
  const patch: Record<string, string> = {};
  if (!me.deviceId) patch.deviceId = deviceId;
  if (ip && ip !== me.lastIp) patch.lastIp = ip;
  if (Object.keys(patch).length) await updateDoc(doc(db, "users", me.uid), patch).catch(() => undefined);
  return { deviceId, ip };
}

const toBan = (id: string, d: Record<string, unknown>): BanDoc => ({
  id, kind: d.kind === "ip" ? "ip" : "device", uid: String(d.uid ?? ""), name: String(d.name ?? ""), reason: String(d.reason ?? ""), at: Number(d.at ?? 0),
});

/** Is this phone (or its current IP) banned? Used on launch and before signup. */
export async function findBan(deviceId: string, ip: string): Promise<BanDoc | null> {
  const keys = [`d_${deviceId}`, ...(ip ? [`ip_${ip}`] : [])];
  for (const k of keys) {
    const s = await getDoc(doc(db, "bans", k)).catch(() => null);
    if (s?.exists()) return toBan(k, s.data());
  }
  return null;
}

/** Why a new account cannot be created from this phone ("" = fine). */
export async function signupBlock(deviceId: string, ip: string, uid: string): Promise<string> {
  const ban = await findBan(deviceId, ip);
  if (ban) return "Is device / IP ko ban kiya gaya hai. Contact Pryielle :)";
  const own = await getDoc(doc(db, "deviceOwners", deviceId)).catch(() => null);
  const cfg = await getDoc(doc(db, "config", "app")).catch(() => null);
  const one = cfg?.exists() ? cfg.data().oneAccountPerDevice !== false : true;
  if (one && own?.exists() && own.data().uid !== uid) return "Is phone par pehle se ek account bana hua hai. Ek phone par ek hi account allowed hai.";
  return "";
}

/* ---------- admin: ban / unban ---------- */
export async function adminBan(u: UserDoc, opt: { reason: string; device: boolean; ip: boolean }) {
  const reason = opt.reason.trim().slice(0, 200);
  await updateDoc(doc(db, "users", u.uid), { banned: true, banReason: reason });
  const base = { uid: u.uid, name: u.displayName, reason, at: Date.now() };
  if (opt.device && u.deviceId) await setDoc(doc(db, "bans", `d_${u.deviceId}`), { ...base, kind: "device" });
  if (opt.ip && u.lastIp) await setDoc(doc(db, "bans", `ip_${u.lastIp}`), { ...base, kind: "ip" });
}

export async function adminUnban(u: UserDoc) {
  await updateDoc(doc(db, "users", u.uid), { banned: false, banReason: "" });
  for (const k of [u.deviceId ? `d_${u.deviceId}` : "", u.lastIp ? `ip_${u.lastIp}` : ""]) {
    if (k) await deleteDoc(doc(db, "bans", k)).catch(() => undefined);
  }
}

export function watchBans(cb: (b: BanDoc[]) => void) {
  return onSnapshot(query(collection(db, "bans"), limit(100)), (s) => cb(s.docs.map((d) => toBan(d.id, d.data())).sort((a, b) => b.at - a.at)), () => cb([]));
}
export const removeBan = (id: string) => deleteDoc(doc(db, "bans", id));
/** frees a phone so its owner can create a new account (admin) */
export const releaseDevice = (deviceId: string) => deleteDoc(doc(db, "deviceOwners", deviceId));

/* ---------- signup approval ---------- */
export const adminApprove = (uid: string) => updateDoc(doc(db, "users", uid), { approval: "approved", rejectReason: "", appeal: "", appealAt: 0 });
export const adminReject = (uid: string, reason: string) =>
  updateDoc(doc(db, "users", uid), { approval: "rejected", rejectReason: reason.trim().slice(0, 200), appeal: "", appealAt: 0 });
export const submitAppeal = (uid: string, text: string) => updateDoc(doc(db, "users", uid), { appeal: text.trim().slice(0, 300), appealAt: Date.now() });

export function watchRequests(cb: (u: UserDoc[]) => void) {
  return onSnapshot(
    query(collection(db, "users"), where("approval", "in", ["pending", "rejected"]), limit(100)),
    (s) => cb(s.docs.map((d) => d.data() as UserDoc).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))),
    () => cb([]),
  );
}
