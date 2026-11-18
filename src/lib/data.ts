import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, increment,
  limit, onSnapshot, orderBy, query, runTransaction, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { checkSpam } from "./spam";
import { db } from "../firebase";
import { plainEmoji } from "./emoji";
import type { ChatDoc, LastMsg, Msg, Presence, UserDoc } from "./types";
import { auditOriginal, scanMessage } from "./moderation";
import { auth } from "../firebase";
import { AI_API_URL } from "./aiUrl";
import { AI_UID } from "./types";

/* ---------- helpers ---------- */
export const cleanUsername = (raw: string) => {
  const u = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,16}$/.test(u)) throw new Error("Username: 3–16 letters, numbers ya _");
  return u;
};
const cleanName = (raw: string) => {
  const n = raw.replace(/\s+/g, " ").trim();
  if (n.length < 1 || n.length > 24) throw new Error("Naam 1–24 characters ka hona chahiye");
  return n;
};
const code = (n: number) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};
export const dmId = (a: string, b: string) => [a, b].sort().join("_");

const userDefaults = (d: Partial<UserDoc>): UserDoc => ({
  uid: "", publicId: "", username: "", usernameLower: "", displayName: "Player", avatar: null,
  ffUid: "", ffRank: "", status: "free", lastSeen: 0, pinned: [], muted: [], blocked: [], pro: false, banned: false, verified: false, private: false, closeFriends: [], role: "member", bio: "", appState: "",
  approval: "approved", rejectReason: "", appeal: "", appealAt: 0, banReason: "", deviceId: "", lastIp: "", postsCount: 0, followersCustom: null, followingCustom: null, postsCustom: null, ...d,
});

export const chatDefaults = (id: string, d: Partial<ChatDoc>): ChatDoc => ({
  id, kind: "dm", members: [], admins: [], title: "", logo: null, createdBy: "", createdAt: 0, lastMessage: null, lastAt: 0,
  reads: {}, unread: {}, typing: {}, accepted: true, requestFrom: null, declined: false, inviteCode: null,
  disappearHours: 0, ...d,
});

/* ---------- profile ---------- */
export async function getUser(uid: string): Promise<UserDoc | null> {
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? userDefaults(s.data() as Partial<UserDoc>) : null;
}

export function watchUser(uid: string, cb: (u: UserDoc | null) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    doc(db, "users", uid),
    { includeMetadataChanges: true },
    (s) => {
      // an empty cache-only snapshot is not proof that the profile is missing, wait for the server
      if (!s.exists() && s.metadata.fromCache) return;
      cb(s.exists() ? userDefaults(s.data() as Partial<UserDoc>) : null);
    },
    (e) => onError?.(e),
  );
}

export async function checkUsername(raw: string, uid: string): Promise<{ ok: boolean; text: string }> {
  let lower: string;
  try {
    lower = cleanUsername(raw);
  } catch (e) {
    return { ok: false, text: (e as Error).message };
  }
  const s = await getDoc(doc(db, "usernames", lower));
  if (s.exists() && s.data().uid !== uid) return { ok: false, text: "Yeh username le liya gaya hai" };
  return { ok: true, text: "Available" };
}

export async function createProfile(
  uid: string,
  input: { username: string; displayName: string; avatar: string | null; deviceId: string; lastIp: string; isOwner: boolean },
) {
  const lower = cleanUsername(input.username);
  const displayName = cleanName(input.displayName);
  for (let i = 0; i < 8; i += 1) {
    const publicId = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
    try {
      return await runTransaction(db, async (tx) => {
        const uRef = doc(db, "usernames", lower);
        const pRef = doc(db, "publicIds", publicId);
        const [u, p] = await Promise.all([tx.get(uRef), tx.get(pRef)]);
        if (u.exists() && u.data().uid !== uid) throw new Error("Username already taken");
        if (p.exists()) throw new Error("RETRY");
        tx.set(uRef, { uid });
        tx.set(pRef, { uid });
        // v2.3: every new account waits for the owner's approval (the owner himself is auto-approved)
        const profile = userDefaults({
          uid, publicId, username: input.username.trim().toLowerCase(), usernameLower: lower, displayName, avatar: input.avatar, lastSeen: Date.now(),
          approval: input.isOwner ? "approved" : "pending", deviceId: input.deviceId, lastIp: input.lastIp,
        });
        tx.set(doc(db, "users", uid), profile);
        tx.set(doc(db, "deviceOwners", input.deviceId), { uid, at: Date.now() });
        return profile;
      });
    } catch (e) {
      if ((e as Error).message !== "RETRY") throw e;
    }
  }
  throw new Error("ID nahi ban payi, dobara try karo");
}

export async function updateProfile(me: UserDoc, patch: { username: string; displayName: string; avatar: string | null; ffUid: string; ffRank: string; bio?: string }) {
  const lower = cleanUsername(patch.username);
  const displayName = cleanName(patch.displayName);
  if (lower !== me.usernameLower) {
    await runTransaction(db, async (tx) => {
      const nRef = doc(db, "usernames", lower);
      const n = await tx.get(nRef);
      if (n.exists() && n.data().uid !== me.uid) throw new Error("Username already taken");
      tx.set(nRef, { uid: me.uid });
      tx.delete(doc(db, "usernames", me.usernameLower));
    });
  }
  await updateDoc(doc(db, "users", me.uid), {
    username: lower, usernameLower: lower, displayName, avatar: patch.avatar,
    ffUid: patch.ffUid.replace(/\D/g, "").slice(0, 14), ffRank: patch.ffRank.slice(0, 20),
    bio: (patch.bio ?? me.bio ?? "").slice(0, 150),
  });
}

export const setPrivate = (uid: string, on: boolean) => updateDoc(doc(db, "users", uid), { private: on });
export const setCloseFriends = (uid: string, list: string[]) => updateDoc(doc(db, "users", uid), { closeFriends: list });
export const setStatus = (uid: string, status: Presence) => updateDoc(doc(db, "users", uid), { status });
export const heartbeat = (uid: string, appState: "active" | "background" = "active") => updateDoc(doc(db, "users", uid), { lastSeen: Date.now(), appState }).catch(() => undefined);
export const saveToken = (uid: string, token: string) => updateDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) }).catch(() => undefined);

export async function togglePref(uid: string, key: "pinned" | "muted" | "blocked", id: string, on: boolean) {
  await updateDoc(doc(db, "users", uid), { [key]: on ? arrayUnion(id) : arrayRemove(id) });
}

export async function searchUsers(q: string, myUid: string): Promise<UserDoc[]> {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  if (/^\d{8}$/.test(term)) {
    const p = await getDoc(doc(db, "publicIds", term));
    if (!p.exists()) return [];
    const u = await getUser(p.data().uid);
    return u && u.uid !== myUid ? [u] : [];
  }
  const snap = await getDocs(query(collection(db, "users"), where("usernameLower", ">=", term), where("usernameLower", "<=", `${term}\uf8ff`), limit(10)));
  return snap.docs.map((d) => userDefaults(d.data() as Partial<UserDoc>)).filter((u) => u.uid !== myUid);
}

export async function reportUser(me: string, target: string, chatId: string, reason: string) {
  await addDoc(collection(db, "reports"), { by: me, target, chatId, reason, at: Date.now() });
}

/* ---------- chats ---------- */
export function watchChats(uid: string, cb: (chats: ChatDoc[]) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    query(collection(db, "chats"), where("members", "array-contains", uid)),
    (snap) => cb(snap.docs.map((d) => chatDefaults(d.id, d.data() as Partial<ChatDoc>)).filter((c) => !c.declined)),
    (e) => onError?.(e),
  );
}

export function watchChat(id: string, cb: (c: ChatDoc | null) => void) {
  return onSnapshot(doc(db, "chats", id), (s) => cb(s.exists() ? chatDefaults(s.id, s.data() as Partial<ChatDoc>) : null));
}

export async function openDm(me: UserDoc, peer: UserDoc): Promise<string> {
  if (peer.blocked.includes(me.uid)) throw new Error("Aap is user ko message nahi kar sakte");
  const id = dmId(me.uid, peer.uid);
  const ref = doc(db, "chats", id);
  const s = await getDoc(ref);
  if (s.exists()) {
    if (s.data().declined && s.data().requestFrom === me.uid) throw new Error("Is user ne request decline kar di hai");
    if (s.data().declined) await updateDoc(ref, { declined: false, accepted: true });
    return id;
  }
  await setDoc(ref, chatDefaults(id, {
    kind: "dm", members: [me.uid, peer.uid], createdBy: me.uid, createdAt: Date.now(), lastAt: Date.now(),
    accepted: false, requestFrom: me.uid,
  }));
  return id;
}

export const acceptChat = (id: string) => updateDoc(doc(db, "chats", id), { accepted: true });
export const declineChat = (id: string) => updateDoc(doc(db, "chats", id), { declined: true });
export const setDisappear = (id: string, hours: number) => updateDoc(doc(db, "chats", id), { disappearHours: hours });

export async function createGroup(me: UserDoc, title: string, publicIds: string[]): Promise<string> {
  const maxMembers = me.pro ? 50 : 20;
  const name = title.replace(/\s+/g, " ").trim();
  if (!name || name.length > 32) throw new Error("Squad name 1–32 characters");
  const uids = new Set<string>([me.uid]);
  for (const pid of [...new Set(publicIds)].slice(0, maxMembers)) {
    const p = await getDoc(doc(db, "publicIds", pid));
    if (!p.exists()) throw new Error(`ID ${pid} nahi mili`);
    uids.add(p.data().uid);
  }
  const ref = doc(collection(db, "chats"));
  const invite = code(8);
  await setDoc(ref, chatDefaults(ref.id, {
    kind: "group", title: name, logo: null, members: [...uids], admins: [me.uid], createdBy: me.uid, createdAt: Date.now(),
    lastAt: Date.now(), inviteCode: invite,
  }));
  await setDoc(doc(db, "invites", invite), { chatId: ref.id });
  await systemMessage(ref.id, me, `${me.displayName} ne squad banaya`);
  return ref.id;
}

export async function joinByCode(me: UserDoc, raw: string): Promise<string> {
  const c = raw.trim().toUpperCase();
  const inv = await getDoc(doc(db, "invites", c));
  if (!inv.exists()) throw new Error("Invite code galat hai");
  const chatId = inv.data().chatId as string;
  const chat = await getDoc(doc(db, "chats", chatId)).catch(() => null);
  if (chat?.exists() && (chat.data().members as string[] | undefined)?.includes(me.uid)) return chatId;
  await updateDoc(doc(db, "chats", chatId), { members: arrayUnion(me.uid) });
  await systemMessage(chatId, me, `${me.displayName} squad mein aaya`);
  return chatId;
}

export const renameGroup = (id: string, title: string) => updateDoc(doc(db, "chats", id), { title: title.trim().slice(0, 32) });
export const setGroupLogo = (id: string, logo: string | null) => updateDoc(doc(db, "chats", id), { logo });
export const addMember = (id: string, uid: string) => updateDoc(doc(db, "chats", id), { members: arrayUnion(uid) });
export const removeMember = (id: string, uid: string) => updateDoc(doc(db, "chats", id), { members: arrayRemove(uid), admins: arrayRemove(uid) });
export const setAdmin = (id: string, uid: string, on: boolean) => updateDoc(doc(db, "chats", id), { admins: on ? arrayUnion(uid) : arrayRemove(uid) });

/* ---------- messages ---------- */
function toMsg(id: string, d: Record<string, unknown>, pending: boolean): Msg {
  return {
    id, senderId: String(d.senderId ?? ""), senderName: String(d.senderName ?? "Player"), text: String(d.text ?? ""),
    image: (d.image as string) ?? null, audio: (d.audio as string) ?? null, audioMs: Number(d.audioMs ?? 0), gif: (d.gif as string) ?? null,
    replyTo: (d.replyTo as Msg["replyTo"]) ?? null, reactions: (d.reactions as Record<string, string>) ?? {},
    mediaId: (d.mediaId as string) ?? null, mediaKind: (d.mediaKind as Msg["mediaKind"]) ?? null, thumb: (d.thumb as string) ?? null, edited: Boolean(d.edited),
    deleted: Boolean(d.deleted), system: Boolean(d.system), createdAt: Number(d.createdAt ?? Date.now()), pending, ai: d.ai === true,
  };
}

const scanned = new Set<string>();
export function watchMessages(chatId: string, cb: (m: Msg[]) => void, onError?: (e: Error) => void, max = 40) {
  return onSnapshot(
    query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), limit(max)),
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => toMsg(d.id, d.data({ serverTimestamps: "estimate" }), d.metadata.hasPendingWrites)).reverse();
      const mine = auth.currentUser?.uid ?? "";
      // v2.3: every phone quietly checks messages it receives, so a cheater cannot skip the check on his own phone
      for (const m of list) if (!m.pending && !m.system && !m.deleted && !m.ai && m.senderId !== mine && !scanned.has(`${chatId}_${m.id}`)) { scanned.add(`${chatId}_${m.id}`); scanMessage(chatId, m, mine); }
      cb(list);
    },
    (e) => onError?.(e),
  );
}

export type Outgoing = {
  text?: string; image?: string | null; audio?: string | null; audioMs?: number; gif?: string | null; replyTo?: Msg["replyTo"];
  mediaId?: string | null; mediaKind?: "image" | "video" | "audio" | null; thumb?: string | null;
};

const sentLog: number[] = [];
function rateOk() {
  const now = Date.now();
  while (sentLog.length && now - sentLog[0] > 10_000) sentLog.shift();
  if (sentLog.length >= 10) return false;
  sentLog.push(now);
  return true;
}

export async function sendMessage(chat: ChatDoc, me: UserDoc, out: Outgoing) {
  const text = (out.text ?? "").replace(/\s+$/g, "").slice(0, 2000);
  const type: LastMsg["type"] = out.mediaKind ?? (out.image ? "image" : out.audio ? "audio" : out.gif ? "gif" : "text");
  if (!text && type === "text") return;
  if (checkSpam(text)) throw new Error("Don't spam! Thoda dhire likho.");
  if (!rateOk()) throw new Error("Bahut tez! Thoda ruko.");
  const now = Date.now();
  const mRef = doc(collection(db, "chats", chat.id, "messages"));
  const preview = text || (type === "image" ? "📷 Photo" : type === "video" ? "🎬 Video" : type === "audio" ? "🎤 Voice message" : "GIF");
  const batch = writeBatch(db);
  batch.set(mRef, {
    senderId: me.uid, senderName: me.displayName, text, image: out.image ?? null, audio: out.audio ?? null, audioMs: out.audioMs ?? 0,
    gif: out.gif ?? null, replyTo: out.replyTo ?? null, reactions: {}, deleted: false, system: false, createdAt: now,
    mediaId: out.mediaId ?? null, mediaKind: out.mediaKind ?? null, thumb: out.thumb ?? null, edited: false,
  });
  const patch: Record<string, unknown> = {
    lastMessage: { text: plainEmoji(preview).slice(0, 120), senderId: me.uid, senderName: me.displayName, at: now, type },
    lastAt: now, [`typing.${me.uid}`]: 0,
  };
  for (const uid of chat.members) if (uid !== me.uid) patch[`unread.${uid}`] = increment(1);
  batch.update(doc(db, "chats", chat.id), patch);
  await batch.commit();
  scanMessage(chat.id, { id: mRef.id, senderId: me.uid, senderName: me.displayName, text, createdAt: now }, me.uid);
  // Group /ai: show AI typing immediately, then hit Vercel API (server writes the reply msg).
  if (/^\s*\/ai(?:\s+|$)/i.test(text) && chat.kind === "group" && auth.currentUser) {
    void updateDoc(doc(db, "chats", chat.id), { [`typing.${AI_UID}`]: Date.now() }).catch(() => undefined);
    void auth.currentUser.getIdToken().then((token) => fetch(AI_API_URL, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "group", chatId: chat.id, msgId: mRef.id }),
    }).then(async (r) => {
      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        console.warn("Group AI request failed", r.status, errText);
        // clear typing + leave a soft system note so user is not left hanging
        void updateDoc(doc(db, "chats", chat.id), { [`typing.${AI_UID}`]: 0 }).catch(() => undefined);
      }
    }).catch((e) => {
      console.warn("Group AI request failed", e);
      void updateDoc(doc(db, "chats", chat.id), { [`typing.${AI_UID}`]: 0 }).catch(() => undefined);
    }));
  }
}

async function systemMessage(chatId: string, me: UserDoc, text: string) {
  const now = Date.now();
  await setDoc(doc(collection(db, "chats", chatId, "messages")), {
    senderId: me.uid, senderName: me.displayName, text, image: null, audio: null, audioMs: 0, gif: null, replyTo: null,
    reactions: {}, deleted: false, system: true, createdAt: now,
  });
  await updateDoc(doc(db, "chats", chatId), { lastMessage: { text, senderId: me.uid, senderName: me.displayName, at: now, type: "system" }, lastAt: now });
}

export const markRead = (chatId: string, uid: string) =>
  updateDoc(doc(db, "chats", chatId), { [`unread.${uid}`]: 0, [`reads.${uid}`]: Date.now() }).catch(() => undefined);
export const sendTyping = (chatId: string, uid: string) =>
  updateDoc(doc(db, "chats", chatId), { [`typing.${uid}`]: Date.now() }).catch(() => undefined);

export const react = (chatId: string, msgId: string, uid: string, emoji: string | null) =>
  setDoc(doc(db, "chats", chatId, "messages", msgId), { reactions: { [uid]: emoji ?? deleteField() } }, { merge: true });

// edit / delete keep the original in `audit` first, so the owner can still read what was said
async function keepOriginal(chatId: string, msgId: string, kind: "edited" | "deleted") {
  const ref = doc(db, "chats", chatId, "messages", msgId);
  const s = await getDoc(ref).catch(() => null);
  if (s?.exists() && auth.currentUser) await auditOriginal(chatId, msgId, auth.currentUser.uid, s.data(), kind);
}

export const editMessage = async (chatId: string, msgId: string, text: string) => {
  await keepOriginal(chatId, msgId, "edited");
  await updateDoc(doc(db, "chats", chatId, "messages", msgId), { text: text.trim().slice(0, 2000), edited: true });
};

export const deleteMessage = async (chatId: string, msgId: string) => {
  await keepOriginal(chatId, msgId, "deleted");
  await updateDoc(doc(db, "chats", chatId, "messages", msgId), { deleted: true, text: "", image: null, audio: null, gif: null });
};

export const purgeMessage = (chatId: string, msgId: string) => deleteDoc(doc(db, "chats", chatId, "messages", msgId)).catch(() => undefined);
