import { collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { AlertDoc, AlertKind, ChatDoc, Msg } from "./types";
import { chatDefaults } from "./data";

/* ============ automatic bad-behaviour detection ============ */
let enabled = true;
export const setAutoDetect = (on: boolean) => { enabled = on; };

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };
/** lower-case, undo l33t-speak and collapse repeated letters: "Ch00tiyaaa" -> "chotiya" style comparable form */
const norm = (t: string) =>
  t.toLowerCase().replace(/[013457@$]/g, (c) => LEET[c] ?? c).replace(/(.)\1+/g, "$1");

const ABUSE_WORDS = [
  "madarchod", "maderchod", "madrchod", "behenchod", "bhenchod", "benchod", "bhosdike", "bhosdi", "bhosda", "chutiya", "chutiye", "gandu", "gaandu",
  "randi", "harami", "haramkhor", "lund", "lauda", "lawda", "lode", "gaand", "bsdk", "bkl", "mkc", "mc", "bc", "chodu", "kamina", "kutta", "kutte",
  "fuck", "fucker", "fuk", "shit", "bitch", "asshole", "bastard", "dick", "slut", "whore", "cunt", "motherfucker", "nigga", "nigger", "faggot", "retard",
].map(norm);
const ABUSE_SET = new Set(ABUSE_WORDS);
const ABUSE_ROOTS = ["madarchod", "behenchod", "bhenchod", "bhosd", "chutiy", "fuck", "bitch", "asshole", "motherf"].map(norm);
const ABUSE_PHRASES = [/teri (maa|ma|mummy|behen|bhen)/, /(maa|ma|behen|bhen) (ki|ka) /, /tere baap/];
const THREATS = [
  /(maar|mar) (dunga|dalunga|dalonga|denge|dungi)/, /jaan se (maar|mar)/, /kill (you|u)\b/, /i (will|ll) (kill|find|hurt) (you|u)/, /tujhe (utha|maar|dekh)/,
  /ghar (aa|aake|pe aa)/, /(ip|address|location) nikal/, /mar ja\b/, /sui?cide kar/,
];
const SCAM_KEYS = /(free (diamond|dimond)|diamond hack|\botp\b|\bupi\b|paytm|phonepe|send money|bitcoin|crypto|investment|gift ?card|password|telegram\.me|t\.me\/|wa\.me\/|click (here|link)|earn money)/;
const LINK = /(https?:\/\/|www\.)\S+/;

export type Hit = { kind: AlertKind; matched: string[] };

export function detect(text: string): Hit | null {
  if (!text || text.length < 2) return null;
  const n = norm(text);
  const tokens = n.split(/[^a-z]+/).filter(Boolean);
  const matched = new Set<string>();
  for (const t of tokens) {
    if (ABUSE_SET.has(t) || (t.length >= 5 && ABUSE_ROOTS.some((r) => t.includes(r)))) matched.add(t);
  }
  for (const p of ABUSE_PHRASES) { const m = n.match(p); if (m) matched.add(m[0].trim()); }
  const threat = THREATS.map((p) => n.match(p)?.[0]).filter(Boolean) as string[];
  if (threat.length) return { kind: "threat", matched: threat.slice(0, 4) };
  if (matched.size) return { kind: "abuse", matched: [...matched].slice(0, 6) };
  const raw = text.toLowerCase();
  const scam = raw.match(SCAM_KEYS);
  if (scam && (LINK.test(raw) || /\b(otp|password|upi)\b/.test(raw))) return { kind: "scam", matched: [scam[0]] };
  return null;
}

const flagged = new Set<string>();
const floodLog = new Map<string, { at: number; text: string }[]>();

async function raise(id: string, a: Omit<AlertDoc, "id" | "seen">) {
  if (flagged.has(id)) return;
  flagged.add(id);
  await setDoc(doc(db, "alerts", id), { ...a, text: a.text.slice(0, 280), seen: false }).catch(() => undefined);
}

/** Looks at one chat message (called for messages I send and messages I receive) */
export function scanMessage(chatId: string, m: { id: string; senderId: string; senderName: string; text: string; createdAt: number }, myUid: string) {
  if (!enabled || !myUid || !m.text) return;
  if (Date.now() - m.createdAt > 120_000) return; // only fresh messages, not old history
  const hit = detect(m.text);
  if (hit) {
    void raise(`${chatId}_${m.id}`, { kind: hit.kind, chatId, msgId: m.id, senderId: m.senderId, senderName: m.senderName, text: m.text, matched: hit.matched, by: myUid, at: Date.now() });
    return;
  }
  // flood / copy-paste spam: 8+ messages in 10s or the same text 4+ times in 30s
  const log = (floodLog.get(m.senderId) ?? []).filter((x) => m.createdAt - x.at < 30_000);
  log.push({ at: m.createdAt, text: m.text });
  floodLog.set(m.senderId, log);
  const burst = log.filter((x) => m.createdAt - x.at < 10_000).length >= 8;
  const same = log.filter((x) => x.text === m.text).length >= 4;
  if (burst || same) {
    void raise(`spam_${m.senderId}_${Math.floor(m.createdAt / 60_000)}`, {
      kind: "spam", chatId, msgId: m.id, senderId: m.senderId, senderName: m.senderName, text: m.text, matched: [burst ? "flood" : "repeat"], by: myUid, at: Date.now(),
    });
  }
}

/* ============ alerts (admin) ============ */
const toAlert = (id: string, d: Record<string, unknown>): AlertDoc => ({
  id, kind: (d.kind as AlertKind) ?? "other", chatId: String(d.chatId ?? ""), msgId: String(d.msgId ?? ""), senderId: String(d.senderId ?? ""),
  senderName: String(d.senderName ?? ""), text: String(d.text ?? ""), matched: (d.matched as string[]) ?? [], by: String(d.by ?? ""), at: Number(d.at ?? 0), seen: Boolean(d.seen),
});
export function watchAlerts(cb: (a: AlertDoc[]) => void) {
  return onSnapshot(query(collection(db, "alerts"), orderBy("at", "desc"), limit(80)), (s) => cb(s.docs.map((d) => toAlert(d.id, d.data()))), () => cb([]));
}
export const dismissAlert = (id: string) => deleteDoc(doc(db, "alerts", id));
export const markAlertSeen = (id: string) => updateDoc(doc(db, "alerts", id), { seen: true });

/* ============ audit trail: original text of edited / deleted messages ============ */
export type AuditDoc = { id: string; chatId: string; msgId: string; senderId: string; senderName: string; text: string; image: string | null; gif: string | null; thumb: string | null; kind: "edited" | "deleted"; at: number };

export async function auditOriginal(chatId: string, msgId: string, by: string, d: Record<string, unknown>, kind: "edited" | "deleted") {
  const image = typeof d.image === "string" && d.image.length < 600_000 ? d.image : null;
  const thumb = typeof d.thumb === "string" && d.thumb.length < 200_000 ? d.thumb : null;
  await setDoc(doc(db, "audit", `${msgId}_${Date.now()}`), {
    chatId, msgId, by, senderId: String(d.senderId ?? by), senderName: String(d.senderName ?? ""), text: String(d.text ?? ""), image, thumb,
    gif: typeof d.gif === "string" ? d.gif : null, mediaId: (d.mediaId as string) ?? null, kind, at: Date.now(),
  }).catch(() => undefined);
}

export async function adminAudit(chatId: string): Promise<AuditDoc[]> {
  const s = await getDocs(query(collection(db, "audit"), where("chatId", "==", chatId), limit(300)));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditDoc, "id">) })).sort((a, b) => a.at - b.at);
}

/* ============ admin: read a user's chats ============ */
export async function adminUserChats(uid: string): Promise<ChatDoc[]> {
  const s = await getDocs(query(collection(db, "chats"), where("members", "array-contains", uid), limit(60)));
  return s.docs.map((d) => chatDefaults(d.id, d.data() as Partial<ChatDoc>)).sort((a, b) => b.lastAt - a.lastAt);
}

export type RawMsg = Msg & { rawText: string };
export function watchAdminMessages(chatId: string, cb: (m: Msg[]) => void, max = 200) {
  return onSnapshot(
    query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), limit(max)),
    (snap) => cb(snap.docs.map((d) => {
      const x = d.data() as Record<string, unknown>;
      return {
        id: d.id, senderId: String(x.senderId ?? ""), senderName: String(x.senderName ?? ""), text: String(x.text ?? ""), image: (x.image as string) ?? null,
        audio: (x.audio as string) ?? null, audioMs: Number(x.audioMs ?? 0), gif: (x.gif as string) ?? null, replyTo: null, reactions: {}, mediaId: (x.mediaId as string) ?? null,
        mediaKind: (x.mediaKind as Msg["mediaKind"]) ?? null, thumb: (x.thumb as string) ?? null, edited: Boolean(x.edited), deleted: Boolean(x.deleted),
        system: Boolean(x.system), createdAt: Number(x.createdAt ?? 0), pending: false,
      } satisfies Msg;
    }).reverse()),
    () => cb([]),
  );
}
