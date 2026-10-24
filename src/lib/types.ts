export type Role = "member" | "officer" | "admin" | "owner";
export const ROLE_LABEL: Record<Role, string> = { member: "Member", officer: "Officer", admin: "Admin", owner: "Owner" };

export type Presence = "free" | "playing" | "busy" | "squad";

export type UserDoc = {
  uid: string;
  publicId: string;
  username: string;
  usernameLower: string;
  displayName: string;
  avatar: string | null;
  ffUid: string;
  ffRank: string;
  status: Presence;
  lastSeen: number;
  pinned: string[];
  muted: string[];
  blocked: string[];
  pro: boolean;
  banned: boolean;
  verified: boolean;
  private: boolean;
  closeFriends: string[];
  role: Role;
  bio: string;
  /** signup approval: new users start "pending", owner approves / rejects */
  approval: Approval;
  rejectReason: string;
  appeal: string;
  appealAt: number;
  banReason: string;
  deviceId: string;
  lastIp: string;
  /** posts = kitni stories daali (lifetime) */
  postsCount: number;
  /** admin ke set kiye fake / custom numbers (null = asli count dikhao) */
  followersCustom: number | null;
  followingCustom: number | null;
  postsCustom: number | null;
  /** app foreground/background (Emergency tab ke liye) */
  appState: "active" | "background" | "";
};
export type Approval = "pending" | "approved" | "rejected";

export type LastMsg = { text: string; senderId: string; senderName: string; at: number; type: "text" | "image" | "video" | "audio" | "gif" | "system" };

export type ChatDoc = {
  id: string;
  kind: "dm" | "group";
  members: string[];
  admins: string[];
  title: string;
  logo: string | null;
  createdBy: string;
  createdAt: number;
  lastMessage: LastMsg | null;
  lastAt: number;
  reads: Record<string, number>;
  unread: Record<string, number>;
  typing: Record<string, number>;
  accepted: boolean;
  requestFrom: string | null;
  declined: boolean;
  inviteCode: string | null;
  disappearHours: number;
};

export type Msg = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  image: string | null;
  audio: string | null;
  audioMs: number;
  gif: string | null;
  replyTo: { id: string; text: string; name: string } | null;
  reactions: Record<string, string>;
  mediaId: string | null;
  mediaKind: "image" | "video" | "audio" | null;
  thumb: string | null;
  edited: boolean;
  deleted: boolean;
  system: boolean;
  createdAt: number;
  pending: boolean;
  /** Pryielle AI ka jawab (Cloud Function likhta hai) */
  ai?: boolean;
};

export const STATUS_META: Record<Presence, { label: string; emoji: string }> = {
  free: { label: "Free", emoji: "🟢" },
  playing: { label: "Playing", emoji: "🎮" },
  busy: { label: "Busy", emoji: "⛔" },
  squad: { label: "Need squad", emoji: "📣" },
};

export type NewsItem = { id: string; title: string; text: string; at: number; by: string; lead?: string; cover?: string | null; byAvatar?: string | null };
export type AppConfig = {
  maintenance: boolean; message: string; banner: string; bannerOn: boolean; youtubeApiKey: string;
  updateVersion: string; updateUrl: string; updateNotes: string; updateForce: boolean;
  /** "Mega Update Here" style heading shown on the update popup */
  updateTitle: string;
  /** number of APK chunks stored in Firestore (0 = use updateUrl link instead) */
  updateParts: number;
  updateSize: number;
  blockVpn: boolean;
  autoDetect: boolean;
  oneAccountPerDevice: boolean;
};
export const EMPTY_CONFIG: AppConfig = {
  maintenance: false, message: "", banner: "", bannerOn: false, youtubeApiKey: "", updateVersion: "", updateUrl: "", updateNotes: "", updateForce: false,
  updateTitle: "", updateParts: 0, updateSize: 0, blockVpn: true, autoDetect: true, oneAccountPerDevice: true,
};

export type AlertKind = "abuse" | "threat" | "scam" | "spam" | "other";
export type AlertDoc = {
  id: string; kind: AlertKind; chatId: string; msgId: string; senderId: string; senderName: string;
  text: string; matched: string[]; by: string; at: number; seen: boolean;
};
export type BanDoc = { id: string; kind: "device" | "ip"; uid: string; name: string; reason: string; at: number };
export type NoteDoc = { uid: string; text: string; songTitle: string | null; musicId: string | null; place?: string | null; gif?: string | null; tone?: number; audience?: "all" | "close"; createdAt: number; expiresAt: number };
export type GifItem = { id: string; label: string; tag: string; src: string };
export type StoryItem = {
  id: string; kind: "image" | "text"; mediaId: string | null; thumb: string | null; text: string; bg: number; caption: string;
  mentions: string[]; mentionNames: string[]; audience: "all" | "close"; allowed: string[]; musicId: string | null; musicTitle: string | null;
  createdAt: number; expiresAt: number;
};
export const AI_UID = "ai_pryielle";
export const AI_NAME = "Pryielle AI";
export const ADMIN_EMAIL = "workwithpryielle@gmail.com";
export type Shortcut = { id: string; text: string; order: number; on: boolean };
