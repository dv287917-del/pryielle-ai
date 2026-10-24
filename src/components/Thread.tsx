import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, Ban, BellOff, Check, CheckCheck, ChevronLeft, Clapperboard, Clock, Copy, Flag, ImagePlus, Mic, MoreVertical,
  Pause, Palette, Pencil, Pin, Play, Plus, Reply, RotateCw, Search, Send, Shield, Smile, Trash2, X, Zap,
} from "lucide-react";
import clsx from "clsx";
import {
  acceptChat, deleteMessage, editMessage, markRead, react, reportUser, sendMessage, sendTyping, togglePref, watchChat, watchMessages,
} from "../lib/data";
import { loadGifs, useGif } from "../lib/gifs";
import { useUser } from "../lib/hooks";
import { useShortcuts } from "../lib/shortcuts";
import { cachedMedia, chatMedia, fetchMedia, primeMedia, readDataUrl, uploadMedia, videoThumb } from "../lib/media";
import { STATUS_META, type ChatDoc, type GifItem, type Msg, type UserDoc } from "../lib/types";
import { buzz, clock, compressImage, dayLabel, declineAndLeave, errorText, lastSeenText, pushBack } from "../lib/util";
import { Avatar, Badges } from "./ui";
import { AI_NAME, AI_UID } from "../lib/types";
import { EMOJI_IDS, emojiSrc, emojiToken, plainEmoji } from "../lib/emoji";
import { Rich, StickerOnly, stickerIds } from "./Rich";

const REACTIONS = ["🔥", "😂", "👍", "❤️", "😮", "💀"];

export const CHAT_THEMES = [
  { id: "default", label: "Default", me: "", wall: "", pro: false },
  { id: "night", label: "Night", me: "linear-gradient(135deg,#4f46e5,#7c3aed)", wall: "linear-gradient(180deg,#0b1020,#111a36)", pro: false },
  { id: "blood", label: "Blood", me: "linear-gradient(135deg,#dc2626,#7f1d1d)", wall: "radial-gradient(ellipse at 50% 0%,#2a0608,#080203 70%)", pro: false },
  { id: "toxic", label: "Toxic", me: "linear-gradient(135deg,#22c55e,#047857)", wall: "linear-gradient(180deg,#04120a,#0a1f14)", pro: false },
  { id: "ocean", label: "Ocean", me: "linear-gradient(135deg,#0ea5e9,#2563eb)", wall: "linear-gradient(180deg,#041428,#0a2240)", pro: false },
  { id: "amoled", label: "AMOLED", me: "linear-gradient(135deg,#334155,#1e293b)", wall: "#000", pro: false },
  { id: "sunset", label: "Sunset ⭐", me: "linear-gradient(135deg,#f97316,#ec4899)", wall: "linear-gradient(180deg,#1a0a14,#2b0f1d)", pro: true },
  { id: "gold", label: "Gold ⭐", me: "linear-gradient(135deg,#f59e0b,#b45309)", wall: "radial-gradient(ellipse at 50% 0%,#2a1c04,#050300 70%)", pro: true },
  { id: "sakura", label: "Sakura ⭐", me: "linear-gradient(135deg,#f472b6,#a855f7)", wall: "linear-gradient(180deg,#1b0a1d,#2a1033)", pro: true },
];

function VoiceBubble({ load, ms, mine, cached }: { load: () => Promise<string>; ms: number; mine: boolean; cached: string | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(cached);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const toggle = async () => {
    let url = src;
    if (!url) {
      setBusy(true);
      try {
        url = await load();
        setSrc(url);
      } catch {
        setBusy(false);
        return;
      }
      setBusy(false);
      window.setTimeout(() => void ref.current?.play().catch(() => undefined), 30);
      return;
    }
    const a = ref.current;
    if (!a) return;
    if (playing) a.pause();
    else void a.play().catch(() => setPlaying(false));
  };
  return (
    <div className="flex w-44 items-center gap-2">
      {src ? (
        <audio
          ref={ref}
          src={src}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setPct(e.currentTarget.duration ? (e.currentTarget.currentTime / e.currentTarget.duration) * 100 : 0)}
          onEnded={() => { setPlaying(false); setPct(0); }}
        />
      ) : null}
      <button type="button" className={clsx("tap grid size-9 shrink-0 place-items-center rounded-full", mine ? "bg-white/25" : "grad text-white")} onClick={() => void toggle()} aria-label="Play voice message">
        {busy ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full bg-white/80" style={{ width: `${pct}%` }} /></div>
      <span className="text-[0.65rem] tabular-nums opacity-70">{Math.max(1, Math.round(ms / 1000))}s</span>
    </div>
  );
}

function MediaBlock({ chatId, m, mine, onOpen }: { chatId: string; m: Msg; mine: boolean; onOpen: (url: string) => void }) {
  const base = useMemo(() => chatMedia(chatId), [chatId]);
  const id = m.mediaId as string;
  const [url, setUrl] = useState<string | null>(() => cachedMedia(base, id));
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (url || busy) return;
    setBusy(true);
    fetchMedia(base, id).then(setUrl).catch(() => undefined).finally(() => setBusy(false));
  }, [base, id, url, busy]);
  useEffect(() => {
    if (m.mediaKind === "image") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (m.mediaKind === "audio") return <VoiceBubble load={() => fetchMedia(base, id)} ms={m.audioMs} mine={mine} cached={url} />;
  if (m.mediaKind === "video") {
    return url ? (
      <video src={url} poster={m.thumb ?? undefined} controls playsInline className="mb-1 max-h-72 w-full rounded-xl bg-black" />
    ) : (
      <button type="button" className="relative mb-1 block h-44 w-full overflow-hidden rounded-xl bg-black/40" onClick={load}>
        {m.thumb ? <img decoding="async" src={m.thumb} alt="" className="h-full w-full object-cover" /> : null}
        <span className="absolute inset-0 grid place-items-center bg-black/30">
          {busy ? <span className="size-10 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <span className="grid size-14 place-items-center rounded-full bg-black/60"><Play className="size-7 text-white" /></span>}
        </span>
      </button>
    );
  }
  return (
    <button type="button" className="mb-1 block w-full overflow-hidden rounded-xl" onClick={() => (url ? onOpen(url) : load())}>
      <img decoding="async" src={url ?? m.thumb ?? undefined} alt="" className={clsx("max-h-64 min-h-24 w-full object-cover transition-[filter] duration-300", !url && "blur-md")} />
    </button>
  );
}

function GifView({ id }: { id: string }) {
  const { src, failed } = useGif(id);
  if (src) return <img decoding="async" src={src} alt="GIF" referrerPolicy="no-referrer" className="mb-1 max-h-56 w-full rounded-xl object-cover" />;
  return failed ? <p className="mb-1 rounded-xl bg-black/20 px-3 py-4 text-center text-xs opacity-70">GIF available nahi hai</p> : <div className="shimmer mb-1 h-32 w-full rounded-xl" />;
}

function SenderName({ uid, name, onOpen }: { uid: string; name: string; onOpen: (uid: string) => void }) {
  const u = useUser(uid);
  return <button type="button" className="mb-0.5 flex items-center font-display text-sm font-bold text-aqua" onClick={() => onOpen(uid)}>{name}<Badges u={u} /></button>;
}

function SenderAvatar({ uid, name, onOpen }: { uid: string; name: string; onOpen: (uid: string) => void }) {
  const u = useUser(uid);
  return <button type="button" className="tap mb-0.5 shrink-0" aria-label={`${name} ka profile`} onClick={() => onOpen(uid)}><Avatar src={u?.avatar ?? null} name={u?.displayName ?? name} size="xs" /></button>;
}

type Staged = { file: File; url: string; kind: "image" | "video" };
type Outbox = { tempId: string; kind: "image" | "video" | "audio"; preview: string | null; text: string; failed: boolean };

export function Thread({ chatId, me, onBack, onGroup, onProfile }: { chatId: string; me: UserDoc; onBack: () => void; onGroup: (id: string) => void; onProfile: (uid: string) => void }) {
  const quick = useShortcuts();
  const [chat, setChat] = useState<ChatDoc | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [max, setMax] = useState(40);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [outbox, setOutbox] = useState<Outbox[]>([]);
  const [panel, setPanel] = useState<"none" | "emoji" | "quick">("none");
  const [gifOpen, setGifOpen] = useState(false);
  const [gifList, setGifList] = useState<GifItem[]>([]);
  const [gifQ, setGifQ] = useState("");
  const [gifBusy, setGifBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [find, setFind] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [picked, setPicked] = useState<Msg | null>(null);
  const [customEmoji, setCustomEmoji] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Msg["replyTo"]>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [away, setAway] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [rec, setRec] = useState<{ start: number } | null>(null);
  const [recSecs, setRecSecs] = useState(0);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [themeId, setThemeId] = useState(() => localStorage.getItem(`pry-ct-${chatId}`) ?? "default");
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stick = useRef(true);
  const known = useRef<Set<string> | null>(null);
  const lastTyping = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelRec = useRef(false);
  const markedFor = useRef("");
  const chatRef = useRef<ChatDoc | null>(null);
  chatRef.current = chat;

  const peerUid = chat?.kind === "dm" ? chat.members.find((u) => u !== me.uid) ?? null : null;
  const peer = useUser(peerUid, true);
  const isGroup = chat?.kind === "group";
  const iAmAdmin = Boolean(chat?.admins.includes(me.uid));
  const title = isGroup ? chat?.title ?? "" : peer?.displayName ?? "";
  const theme = CHAT_THEMES.find((t) => t.id === themeId) ?? CHAT_THEMES[0];
  const maxVideo = 8_000_000;
  const maxVoice = me.pro ? 120 : 30;

  useEffect(() => {
    setReady(false);
    known.current = null;
    markedFor.current = "";
    setMax(40);
    setMsgs([]);
    return watchChat(chatId, setChat);
  }, [chatId]);

  useEffect(() => {
    return watchMessages(
      chatId,
      (list) => {
        const first = known.current === null;
        const prev = known.current ?? new Set<string>();
        const arrived = list.filter((m) => !prev.has(m.id));
        known.current = new Set(list.map((m) => m.id));
        if (!first && arrived.length) {
          setFresh(new Set(arrived.filter((m) => m.senderId !== me.uid).map((m) => m.id)));
          if (!stick.current) setAway((n) => n + arrived.filter((m) => m.senderId !== me.uid).length);
        }
        setMsgs(list);
        setReady(true);
      },
      (e) => setError(errorText(e)),
      max,
    );
  }, [chatId, me.uid, max]);

  useEffect(() => {
    if (!gifOpen) return;
    let stop = false;
    setGifBusy(true);
    setGifQ("");
    loadGifs()
      .then((l) => { if (!stop) setGifList(l); })
      .catch(() => undefined)
      .finally(() => { if (!stop) setGifBusy(false); });
    return () => { stop = true; };
  }, [gifOpen]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const anyOpen = picked || gifOpen || menuOpen || reportOpen || themeOpen || lightbox;
    if (anyOpen) {
      return pushBack(() => {
        setPicked(null); setGifOpen(false); setMenuOpen(false); setReportOpen(false); setThemeOpen(false); setLightbox(null); setCustomEmoji(null);
      });
    }
    return pushBack(onBack);
  }, [picked, gifOpen, menuOpen, reportOpen, themeOpen, lightbox, onBack]);

  const unreadMe = chat?.unread?.[me.uid] ?? 0;
  const lastAt = chat?.lastAt ?? 0;
  useEffect(() => {
    if (!chat) return;
    const key = `${lastAt}:${unreadMe}`;
    if (markedFor.current === key) return;
    if (unreadMe > 0 || (chat.reads[me.uid] ?? 0) < lastAt) {
      markedFor.current = key;
      void markRead(chatId, me.uid);
    }
  }, [chat, chatId, me.uid, unreadMe, lastAt]);

  useEffect(() => {
    if (!stick.current) return;
    const node = scroller.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: ready ? "smooth" : "auto" });
  }, [msgs, outbox, ready, rec]);

  const visible = useMemo(() => {
    const q = find.trim().toLowerCase();
    return searching && q ? msgs.filter((m) => m.text.toLowerCase().includes(q)) : msgs;
  }, [msgs, searching, find]);

  const typers = chat ? Object.entries(chat.typing).filter(([uid, t]) => uid !== me.uid && now - t < 4000).map(([uid]) => uid) : [];
  const typer = useUser(typers[0] && typers[0] !== AI_UID ? typers[0] : null);
  const typeLine = typers.length === 0 ? "" : typers.length === 1 ? (typers[0] === AI_UID ? `🤖 ${AI_NAME} soch raha hai...` : `${typer?.displayName ?? "Someone"} typing...`) : `${typers.length} people typing...`;

  const iBlocked = peerUid ? me.blocked.includes(peerUid) : false;
  const blockedMe = peer ? peer.blocked.includes(me.uid) : false;
  const pendingReq = chat?.kind === "dm" && !chat.accepted;
  const incomingReq = Boolean(pendingReq && chat?.requestFrom !== me.uid);
  const myCount = msgs.filter((m) => m.senderId === me.uid && !m.system).length;
  const waiting = Boolean(pendingReq && !incomingReq && myCount >= 1);
  const lockedReason = iBlocked ? "Tumne is user ko block kiya hai" : blockedMe ? "Aap is user ko message nahi kar sakte" : waiting ? "Request accept hone ka wait karo" : "";
  const muted = chat ? me.muted.includes(chat.id) : false;
  const pinned = chat ? me.pinned.includes(chat.id) : false;

  const send = useCallback(
    (out: Parameters<typeof sendMessage>[2]) => {
      const c = chatRef.current;
      if (!c) return Promise.resolve();
      stick.current = true;
      return sendMessage(c, me, out).catch((e) => setError(errorText(e)));
    },
    [me],
  );

  async function sendMedia(file: Blob, kind: "image" | "video" | "audio", caption: string, reply: Msg["replyTo"], audioMs = 0) {
    const tempId = crypto.randomUUID();
    const preview = kind === "audio" ? null : URL.createObjectURL(file);
    setOutbox((l) => [...l, { tempId, kind, preview, text: caption, failed: false }]);
    stick.current = true;
    try {
      let dataUrl = "";
      let thumb = "";
      if (kind === "image") {
        [dataUrl, thumb] = await Promise.all([compressImage(file as File, 1280, 0.72, 380_000), compressImage(file as File, 28, 0.5, 4000)]);
      } else if (kind === "video") {
        if (file.size > maxVideo) throw new Error("Video 8MB se chhota chuno (lagbhag 10-15 sec)");
        [dataUrl, thumb] = await Promise.all([readDataUrl(file), videoThumb(file)]);
      } else dataUrl = await readDataUrl(file);
      const base = chatMedia(chatId);
      const mediaId = await uploadMedia(base, dataUrl, kind);
      primeMedia(base, mediaId, preview ?? URL.createObjectURL(file));
      void send({ text: caption, mediaId, mediaKind: kind, thumb: thumb || null, audioMs, replyTo: reply });
      setOutbox((l) => l.filter((x) => x.tempId !== tempId));
    } catch (e) {
      setOutbox((l) => l.map((x) => (x.tempId === tempId ? { ...x, failed: true } : x)));
      setError(errorText(e));
    }
  }

  function submit(text?: string) {
    if (lockedReason) return;
    const body = (text ?? draft).trim();
    if (editing) {
      if (body) void editMessage(chatId, editing.id, body).catch((e) => setError(errorText(e)));
      setEditing(null);
      setDraft("");
      if (area.current) area.current.style.height = "";
      return;
    }
    if (!body && staged.length === 0) return;
    buzz();
    if (text) {
      void send({ text: body });
      if (!/^:e\d{2}:$/.test(body)) setPanel("none"); // sticker panel khula rahe, ek ke baad ek bhej sako
      return;
    }
    const reply = replyTo;
    if (staged.length) staged.forEach((s, i) => void sendMedia(s.file, s.kind, i === 0 ? body : "", i === 0 ? reply : null));
    else void send({ text: body, replyTo: reply });
    setDraft("");
    setStaged([]);
    setReplyTo(null);
    setPanel("none");
    if (area.current) area.current.style.height = "";
  }

  function pickFiles(files: FileList | null) {
    if (!files?.length) return;
    const next: Staged[] = [];
    for (const f of Array.from(files).slice(0, 6)) {
      const kind = f.type.startsWith("video/") ? "video" : f.type.startsWith("image/") ? "image" : null;
      if (!kind) continue;
      if (kind === "video" && f.size > maxVideo) {
        setError("Video 8MB se chhota chuno (lagbhag 10-15 sec ka clip)");
        continue;
      }
      next.push({ file: f, url: URL.createObjectURL(f), kind });
    }
    setStaged((s) => [...s, ...next].slice(0, 6));
  }

  async function startRec() {
    if (lockedReason || rec) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 });
      chunks.current = [];
      cancelRec.current = false;
      const startedAt = Date.now();
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const ms = Date.now() - startedAt;
        setRec(null);
        if (cancelRec.current || ms < 500) return;
        const blob = new Blob(chunks.current, { type: r.mimeType });
        if (blob.size > 520_000) return setError("Voice message bahut lamba hai");
        void sendMedia(blob, "audio", "", null, ms);
      };
      recorder.current = r;
      r.start();
      setRec({ start: startedAt });
      setRecSecs(0);
      buzz();
    } catch {
      setError("Mic permission do (Settings → App → Permissions)");
    }
  }

  useEffect(() => {
    if (!rec) return;
    const t = window.setInterval(() => {
      const s = Math.floor((Date.now() - rec.start) / 1000);
      setRecSecs(s);
      if (s >= maxVoice) recorder.current?.stop();
    }, 250);
    return () => window.clearInterval(t);
  }, [rec, maxVoice]);

  useEffect(() => () => {
    cancelRec.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const holdTimer = useRef<number | null>(null);
  const hold = (m: Msg) => ({
    onPointerDown: () => {
      holdTimer.current = window.setTimeout(() => { buzz(); setPicked(m); }, 380);
    },
    onPointerUp: () => holdTimer.current && window.clearTimeout(holdTimer.current),
    onPointerLeave: () => holdTimer.current && window.clearTimeout(holdTimer.current),
    onPointerMove: () => holdTimer.current && window.clearTimeout(holdTimer.current),
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setPicked(m); },
  });

  const seen = (m: Msg) => {
    if (!chat) return false;
    const others = chat.members.filter((u) => u !== me.uid);
    return others.length > 0 && others.every((u) => (chat.reads[u] ?? 0) >= m.createdAt);
  };
  const lastMineId = (() => {
    for (let i = visible.length - 1; i >= 0; i -= 1) if (visible[i].senderId === me.uid && !visible[i].system && !visible[i].deleted) return visible[i].id;
    return "";
  })();
  const seenLabel = (m: Msg) => {
    if (!chat || m.pending) return "";
    const others = chat.members.filter((u) => u !== me.uid);
    if (isGroup) {
      const n = others.filter((u) => (chat.reads[u] ?? 0) >= m.createdAt).length;
      return n > 0 ? `Seen by ${n}` : "";
    }
    if (!seen(m)) return "";
    const at = chat.reads[others[0]] ?? 0;
    const diff = Math.max(0, now - at);
    return diff < 60_000 ? "Seen · Just now" : diff < 3_600_000 ? `Seen · ${Math.floor(diff / 60_000)}m ago` : `Seen · ${clock(at)}`;
  };
  const canDelete = (m: Msg) => m.senderId === me.uid || iAmAdmin;
  const doReact = (m: Msg, emoji: string) => {
    void react(chatId, m.id, me.uid, m.reactions[me.uid] === emoji ? null : emoji).catch((e) => setError(errorText(e)));
    setPicked(null);
    setCustomEmoji(null);
  };
  const firstEmoji = (t: string): string | null => {
    const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? Array.from(new (Intl as unknown as { Segmenter: new (l?: string, o?: object) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter(undefined, { granularity: "grapheme" }).segment(t.trim())).map((x) => x.segment) : Array.from(t.trim());
    const g = seg[0];
    return g && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g) ? g : null;
  };

  return (
    <section
      className="slide-in safe-top fixed inset-0 z-40 flex flex-col bg-ink lg:static lg:z-auto lg:h-full lg:flex-1 lg:animate-none"
      style={{ background: theme.wall || undefined, ["--cm-me" as string]: theme.me || undefined }}
    >
      <header className="flex h-16 shrink-0 items-center gap-1 border-b border-paper/8 bg-deep/85 px-2">
        <button type="button" onClick={onBack} className="tap grid size-11 place-items-center rounded-full lg:hidden" aria-label="Back"><ChevronLeft className="size-6" /></button>
        {searching ? (
          <input autoFocus className="h-10 min-w-0 flex-1 rounded-full border border-paper/12 bg-paper/6 px-4 text-sm outline-none" placeholder="Chat mein search" value={find} onChange={(e) => setFind(e.target.value)} />
        ) : (
          <>
            {isGroup ? (
              <span className="grad ml-1 grid size-10 shrink-0 place-items-center rounded-full font-display font-bold text-white">{(title[0] || "S").toUpperCase()}</span>
            ) : (
              <button type="button" className="ml-1 tap" onClick={() => peerUid && onProfile(peerUid)} aria-label="Profile"><Avatar src={peer?.avatar ?? null} name={title || "?"} size="sm" live={Boolean(typeLine)} /></button>
            )}
            <button type="button" className="ml-2 min-w-0 flex-1 text-left" onClick={() => (isGroup ? onGroup(chatId) : peerUid && onProfile(peerUid))}>
              <p className="truncate font-display text-xl leading-tight font-bold">{title || "…"}<Badges u={peer} /></p>
              <p className="truncate text-xs">
                {typeLine ? (
                  <span className="flex items-center gap-1.5 font-semibold text-aqua">
                    <span className="flex gap-0.5"><span className="typing-dot size-1 rounded-full bg-aqua" /><span className="typing-dot size-1 rounded-full bg-aqua" /><span className="typing-dot size-1 rounded-full bg-aqua" /></span>
                    {typeLine}
                  </span>
                ) : isGroup ? (
                  <span className="inline-flex items-center gap-1 text-paper/55">{iAmAdmin ? <Shield className="size-3 text-hot" /> : null}{chat?.members.length} players{iAmAdmin ? " · admin" : ""}</span>
                ) : peer ? (
                  <span className={clsx(Date.now() - peer.lastSeen < 90_000 ? "text-aqua" : "text-paper/55")}>{lastSeenText(peer.lastSeen)} · {STATUS_META[peer.status].emoji} {STATUS_META[peer.status].label}</span>
                ) : null}
              </p>
            </button>
          </>
        )}
        <button type="button" className="tap grid size-11 place-items-center rounded-full" aria-label="Search in chat" onClick={() => { setSearching((s) => !s); setFind(""); }}>{searching ? <X className="size-5" /> : <Search className="size-5" />}</button>
        <button type="button" className="tap grid size-11 place-items-center rounded-full" aria-label="Menu" onClick={() => setMenuOpen(true)}><MoreVertical className="size-5" /></button>
      </header>

      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        onScroll={(e) => {
          const n = e.currentTarget;
          stick.current = n.scrollHeight - n.scrollTop - n.clientHeight < 90;
          if (stick.current) setAway(0);
        }}
      >
        {!ready ? (
          <div className="space-y-3"><div className="shimmer h-12 w-2/3 rounded-2xl" /><div className="shimmer ml-auto h-12 w-1/2 rounded-2xl" /><div className="shimmer h-16 w-3/4 rounded-2xl" /></div>
        ) : null}
        {ready && msgs.length >= max ? (
          <p className="mb-3 text-center"><button type="button" className="tap rounded-full bg-paper/8 px-4 py-2 text-xs font-semibold text-paper/70" onClick={() => setMax((v) => v + 40)}>↑ Purane messages dikhao</button></p>
        ) : null}
        {ready && visible.length === 0 && outbox.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center"><div className="pop-in"><p className="float text-5xl">{searching ? "🔎" : "👋"}</p><p className="mt-3 font-display text-2xl font-bold">{searching ? "Kuch nahi mila" : "Say hi!"}</p></div></div>
        ) : null}

        <div className="flex flex-col">
          {visible.map((m, i) => {
            const prev = visible[i - 1];
            const mine = m.senderId === me.uid;
            const showDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            const same = prev && !prev.system && !m.system && prev.senderId === m.senderId && !showDay;
            const counts = Object.values(m.reactions).reduce<Record<string, number>>((acc, e) => ({ ...acc, [e]: (acc[e] ?? 0) + 1 }), {});
            const next = visible[i + 1];
            const sticker = m.text && !m.image && !m.mediaId && !m.audio && !m.gif ? stickerIds(m.text) : null;
            const lastOfRun = !next || next.system || next.senderId !== m.senderId || new Date(next.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            return (
              <div key={m.id} className={clsx(same ? "mt-1" : "mt-3", "msg-row")}>
                {showDay ? <p className="mb-3 text-center"><span className="rounded-full bg-paper/8 px-3 py-1 text-xs font-semibold text-paper/55">{dayLabel(m.createdAt)}</span></p> : null}
                {m.system ? (
                  <p className="text-center text-xs text-paper/45">{m.text}</p>
                ) : m.deleted ? (
                  <p className={clsx("max-w-[80%] rounded-2xl border border-paper/10 px-3 py-2 text-sm text-paper/40 italic", mine ? "ml-auto" : "mr-auto ml-10")}>🚫 Message deleted</p>
                ) : (
                  <div className={clsx("flex items-end gap-2", mine && "justify-end")}>
                    {!mine ? (lastOfRun ? (m.ai ? <span className="ai-orb mb-0.5 grid size-8 shrink-0 place-items-center rounded-full text-base" aria-label={AI_NAME}>🤖</span> : <SenderAvatar uid={m.senderId} name={m.senderName} onOpen={onProfile} />) : <span className="size-8 shrink-0" />) : null}
                    <div className={clsx("flex min-w-0 flex-col", mine ? "max-w-[82%] items-end" : "max-w-[78%] items-start")}>
                    <article {...hold(m)} className={clsx("max-w-full select-none", sticker ? "px-1 py-0.5" : clsx("rounded-2xl px-3 py-2", mine ? "bubble-me rounded-br-md" : m.ai ? "bubble-ai rounded-bl-md" : "bubble-them rounded-bl-md", fresh.has(m.id) && "msg-them", m.pending && "opacity-80"))}>
                      {m.ai ? <p className="ai-name mb-0.5 font-display text-sm font-bold">🤖 {AI_NAME}</p> : !mine && isGroup && !same ? <SenderName uid={m.senderId} name={m.senderName} onOpen={onProfile} /> : null}
                      {m.replyTo ? (
                        <div className="mb-1 rounded-lg border-l-4 border-white/60 bg-black/20 px-2 py-1 text-xs"><p className="font-semibold">{m.replyTo.name}</p><p className="truncate opacity-80">{plainEmoji(m.replyTo.text)}</p></div>
                      ) : null}
                      {m.mediaId ? <MediaBlock chatId={chatId} m={m} mine={mine} onOpen={setLightbox} /> : null}
                      {m.image ? <button type="button" className="mb-1 block w-full" onClick={() => setLightbox(m.image)}><img decoding="async" src={m.image} alt="" loading="lazy" className="max-h-64 w-full rounded-xl object-cover" /></button> : null}
                      {m.gif ? <GifView id={m.gif} /> : null}
                      {m.audio ? <VoiceBubble load={() => Promise.resolve(m.audio as string)} ms={m.audioMs} mine={mine} cached={m.audio} /> : null}
                      {sticker ? <StickerOnly ids={sticker} mine={mine} animate={fresh.has(m.id) || (mine && Date.now() - m.createdAt < 2500)} /> : m.text ? <p className="text-[0.92rem] leading-relaxed break-words whitespace-pre-wrap"><Rich text={m.text} /></p> : null}
                      <p className={clsx("mt-0.5 flex items-center justify-end gap-1 text-[0.65rem] tabular-nums", mine ? "text-white/75" : "text-paper/40")}>
                        {m.edited ? <span className="italic">edited</span> : null}
                        {clock(m.createdAt)}
                        {mine ? m.pending ? <Clock className="size-3" /> : seen(m) ? <CheckCheck className="size-3.5 text-aqua" /> : <Check className="size-3.5" /> : null}
                      </p>
                    </article>
                    {Object.keys(counts).length ? (
                      <div className="pop-in -mt-1.5 flex gap-1 px-2">
                        {Object.entries(counts).map(([emoji, n]) => (
                          <button key={emoji} type="button" className="tap rounded-full border border-paper/15 bg-card px-2 py-0.5 text-sm" onClick={() => doReact(m, emoji)}><Rich text={emoji} size={18} />{n > 1 ? <span className="ml-1 text-xs">{n}</span> : null}</button>
                        ))}
                      </div>
                    ) : null}
                    {mine && m.id === lastMineId && seenLabel(m) ? <p key={seenLabel(m)} className="seen-pop mt-0.5 px-1 text-[0.68rem] font-semibold tracking-wide text-aqua">{seenLabel(m)}</p> : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {outbox.map((o) => (
            <article key={o.tempId} className={clsx("bubble-me msg-me mt-1 ml-auto max-w-[82%] rounded-2xl rounded-br-md px-3 py-2", !o.failed && "opacity-75")}>
              {o.preview ? <div className="relative mb-1 overflow-hidden rounded-xl">{o.kind === "video" ? <video src={o.preview} className="max-h-48 w-full object-cover" muted /> : <img decoding="async" src={o.preview} alt="" className="max-h-48 w-full object-cover" />}{!o.failed ? <span className="absolute inset-0 grid place-items-center bg-black/35"><span className="size-7 animate-spin rounded-full border-2 border-white/40 border-t-white" /></span> : null}</div> : <p className="flex items-center gap-2 text-sm"><Mic className="size-4" /> Voice bhej rahe hain…</p>}
              {o.text ? (stickerIds(o.text) ? <StickerOnly ids={stickerIds(o.text) as string[]} mine animate /> : <p className="text-[0.92rem] break-words whitespace-pre-wrap"><Rich text={o.text} /></p>) : null}
              {o.failed ? <button type="button" className="mt-1 flex items-center gap-1 text-xs font-semibold underline" onClick={() => setOutbox((l) => l.filter((x) => x.tempId !== o.tempId))}><RotateCw className="size-3" /> Failed · hatao</button> : <p className="mt-0.5 text-right text-[0.65rem] text-white/70">Sending…</p>}
            </article>
          ))}
          {typeLine ? <div className="bubble-them pop-in mt-3 mr-auto flex w-16 items-center justify-center gap-1.5 rounded-2xl rounded-bl-md py-3.5"><span className="typing-dot size-2 rounded-full bg-paper/80" /><span className="typing-dot size-2 rounded-full bg-paper/80" /><span className="typing-dot size-2 rounded-full bg-paper/80" /></div> : null}
        </div>
      </div>

      {away > 0 ? <button type="button" className="grad pop-in tap absolute right-4 bottom-28 z-10 flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold text-white shadow-lg" onClick={() => { stick.current = true; setAway(0); scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }}><ArrowDown className="size-4" /> {away} new</button> : null}
      {error ? <p className="px-4 pb-1 text-xs text-rose" onClick={() => setError("")}>{error}</p> : null}

      {incomingReq ? (
        <div className="dock flex items-center gap-3 border-t border-paper/8 bg-deep p-3">
          <p className="flex-1 text-sm text-paper/75">{title} tumhe message karna chahta hai.</p>
          <button type="button" className="btn-hot tap h-10 rounded-xl px-5 font-display font-bold" onClick={() => void acceptChat(chatId)}>ACCEPT</button>
          <button type="button" className="tap h-10 rounded-xl border border-rose/50 px-4 font-display font-bold text-rose" onClick={() => { declineAndLeave(chatId); onBack(); }}>DECLINE</button>
        </div>
      ) : lockedReason ? (
        <div className="dock border-t border-paper/8 bg-deep p-4 text-center text-sm text-paper/60">{lockedReason}{iBlocked && peerUid ? <button type="button" className="ml-2 font-semibold text-rose" onClick={() => void togglePref(me.uid, "blocked", peerUid, false)}>Unblock</button> : null}</div>
      ) : (
        <>
          {panel === "emoji" ? (
            <div className="sheet-up border-t border-paper/8 bg-deep">
              <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto px-4 py-3">
                {EMOJI_IDS.map((id) => (
                  <button key={id} type="button" aria-label={`Emoji ${id}`} className="tap grid aspect-square place-items-center rounded-2xl active:bg-paper/10" onClick={() => submit(emojiToken(id))}>
                    <img loading="lazy" decoding="async" src={emojiSrc(id)} alt="" draggable={false} className="sticker-img size-14" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {panel === "quick" ? <div className="sheet-up flex gap-2 overflow-x-auto border-t border-paper/8 bg-deep px-3 py-2">{quick.map((q) => q.text).map((t, i) => <button key={`${i}-${t}`} type="button" onClick={() => submit(t)} className="tap shrink-0 rounded-full border border-rose/40 bg-rose/10 px-4 py-2 text-sm font-semibold">{t}</button>)}</div> : null}
          {replyTo ? <div className="pop-in flex items-center gap-2 border-t border-paper/8 bg-deep px-3 py-2"><Reply className="size-4 text-rose" /><div className="min-w-0 flex-1 border-l-2 border-rose pl-2 text-xs"><p className="font-semibold text-rose">{replyTo.name}</p><p className="truncate text-paper/65">{replyTo.text}</p></div><button type="button" className="tap p-2" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X className="size-4" /></button></div> : null}
          {editing ? <div className="pop-in flex items-center gap-2 border-t border-paper/8 bg-deep px-3 py-2"><Pencil className="size-4 text-hot" /><p className="min-w-0 flex-1 truncate text-xs text-paper/70">Message edit ho raha hai</p><button type="button" className="tap p-2" aria-label="Cancel edit" onClick={() => { setEditing(null); setDraft(""); }}><X className="size-4" /></button></div> : null}
          {staged.length ? (
            <div className="pop-in flex gap-2 overflow-x-auto border-t border-paper/8 bg-deep px-3 py-2">
              {staged.map((s, i) => (
                <div key={s.url} className="relative shrink-0">
                  {s.kind === "video" ? <video src={s.url} className="size-16 rounded-xl object-cover" muted /> : <img decoding="async" src={s.url} alt="" className="size-16 rounded-xl object-cover" />}
                  <button type="button" className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-rose text-white" aria-label="Remove" onClick={() => setStaged((l) => l.filter((_, j) => j !== i))}><X className="size-3" /></button>
                </div>
              ))}
            </div>
          ) : null}

          {rec ? (
            <div className="dock flex items-center gap-3 border-t border-paper/8 bg-deep p-2 pl-4">
              <span className="size-3 animate-pulse rounded-full bg-rose" />
              <span className="flex-1 font-display text-xl tabular-nums">{Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, "0")} <span className="text-sm text-paper/50">/ {maxVoice}s</span></span>
              <button type="button" className="tap grid size-11 place-items-center rounded-full border border-paper/15" aria-label="Cancel recording" onClick={() => { cancelRec.current = true; recorder.current?.stop(); }}><Trash2 className="size-5" /></button>
              <button type="button" className="btn-hot tap grid size-11 place-items-center rounded-full" aria-label="Send voice message" onClick={() => recorder.current?.stop()}><Send className="size-4" /></button>
            </div>
          ) : (
            <form className="dock flex items-end gap-0.5 border-t border-paper/8 bg-deep/95 p-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <button type="button" className={clsx("tap grid size-10 shrink-0 place-items-center rounded-full", panel === "emoji" ? "text-rose" : "text-paper/75")} aria-label="Emoji" onClick={() => setPanel((p) => (p === "emoji" ? "none" : "emoji"))}><Smile className="size-5" /></button>
              <button type="button" className={clsx("tap grid size-10 shrink-0 place-items-center rounded-full", panel === "quick" ? "text-hot" : "text-paper/75")} aria-label="Quick replies" onClick={() => setPanel((p) => (p === "quick" ? "none" : "quick"))}><Zap className="size-5" /></button>
              <button type="button" className="tap grid size-10 shrink-0 place-items-center rounded-full text-paper/75" aria-label="Photos and videos" onClick={() => fileRef.current?.click()}><ImagePlus className="size-5" /></button>
              <button type="button" className="tap grid size-10 shrink-0 place-items-center rounded-full text-paper/75" aria-label="GIF" onClick={() => { setGifOpen(true); setPanel("none"); }}><Clapperboard className="size-5" /></button>
              <textarea
                ref={area}
                value={draft}
                rows={1}
                placeholder="Message"
                className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-paper/12 bg-paper/6 px-4 py-3 text-base outline-none placeholder:text-paper/30 focus:border-rose/60"
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 112)}px`;
                  if (Date.now() - lastTyping.current > 2500) { lastTyping.current = Date.now(); void sendTyping(chatId, me.uid); }
                }}
                onFocus={() => setPanel("none")}
              />
              {draft.trim() || staged.length ? (
                <button type="submit" className="btn-hot tap ml-1 grid size-11 shrink-0 place-items-center rounded-full" aria-label="Send"><Send className="size-4" /></button>
              ) : (
                <button type="button" className="btn-hot tap ml-1 grid size-11 shrink-0 place-items-center rounded-full" aria-label="Record voice message" onClick={() => void startRec()}><Mic className="size-5" /></button>
              )}
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} />
            </form>
          )}
        </>
      )}

      {picked ? (
        <div className="absolute inset-0 z-30 flex items-end bg-black/60" onClick={() => { setPicked(null); setCustomEmoji(null); }}>
          <div className="sheet-up w-full rounded-t-3xl bg-deep p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-1">
              {REACTIONS.map((e) => <button key={e} type="button" className="tap grid size-11 place-items-center rounded-full bg-paper/8 text-2xl" onClick={() => doReact(picked, e)}>{e}</button>)}
              <button type="button" className="tap grid size-11 place-items-center rounded-full bg-paper/8" aria-label="Custom emoji" onClick={() => setCustomEmoji(customEmoji === null ? "" : null)}><Plus className="size-5" /></button>
            </div>
            {customEmoji !== null ? (
              <div className="mb-3 flex gap-2">
                <input autoFocus className="h-11 min-w-0 flex-1 rounded-2xl border border-paper/15 bg-paper/6 px-4 text-xl outline-none" placeholder="Koi bhi emoji likho 😎" value={customEmoji} onChange={(e) => setCustomEmoji(e.target.value)} />
                <button type="button" className="btn-hot tap h-11 rounded-2xl px-5 font-display font-bold" onClick={() => { const g = firstEmoji(customEmoji); if (g) doReact(picked, g); else setError("Sirf emoji daalo"); }}>OK</button>
              </div>
            ) : null}
            {customEmoji !== null ? (
              <div className="mb-3 grid max-h-40 grid-cols-6 gap-1 overflow-y-auto rounded-2xl bg-paper/5 p-2">
                {EMOJI_IDS.map((id) => <button key={id} type="button" className="tap grid aspect-square place-items-center rounded-xl" onClick={() => doReact(picked, emojiToken(id))}><img loading="lazy" decoding="async" src={emojiSrc(id)} alt="" className="sticker-img size-10" /></button>)}
              </div>
            ) : null}
            <button type="button" className="tap flex h-12 w-full items-center gap-3 px-2" onClick={() => { setReplyTo({ id: picked.id, name: picked.senderName, text: plainEmoji(picked.text) || (picked.mediaKind === "video" ? "🎬 Video" : picked.mediaId || picked.image ? "📷 Photo" : picked.audio ? "🎤 Voice message" : "GIF") }); setPicked(null); area.current?.focus(); }}><Reply className="size-5" /> Reply</button>
            {picked.senderId === me.uid && picked.text ? <button type="button" className="tap flex h-12 w-full items-center gap-3 px-2" onClick={() => { setEditing(picked); setDraft(picked.text); setPicked(null); window.setTimeout(() => area.current?.focus(), 50); }}><Pencil className="size-5" /> Edit</button> : null}
            {picked.text ? <button type="button" className="tap flex h-12 w-full items-center gap-3 px-2" onClick={() => { void navigator.clipboard?.writeText(picked.text); setPicked(null); }}><Copy className="size-5" /> Copy</button> : null}
            {canDelete(picked) ? <button type="button" className="tap flex h-12 w-full items-center gap-3 px-2 text-rose" onClick={() => { void deleteMessage(chatId, picked.id).catch((e) => setError(errorText(e))); setPicked(null); }}><Trash2 className="size-5" /> Delete</button> : null}
          </div>
        </div>
      ) : null}

      {menuOpen && chat ? (
        <div className="absolute inset-0 z-30 flex items-end bg-black/60" onClick={() => setMenuOpen(false)}>
          <div className="sheet-up w-full rounded-t-3xl bg-deep p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="tap flex h-12 w-full items-center gap-3 px-2" onClick={() => { setMenuOpen(false); setThemeOpen(true); }}><Palette className="size-5" /> Chat theme</button>
            <button type="button" className="tap flex h-12 w-full items-center gap-3 px-2" onClick={() => { if (!pinned && !me.pro && me.pinned.length >= 3) { setError("Free mein 3 chats pin ho sakti hain. Unlimited pin Pro mein."); } else void togglePref(me.uid, "pinned", chat.id, !pinned); setMenuOpen(false); }}><Pin className="size-5" /> {pinned ? "Unpin chat" : "Pin chat"}</button>
            <button type="button" className="tap flex h-12 w-full items-center gap-3 px-2" onClick={() => { void togglePref(me.uid, "muted", chat.id, !muted); setMenuOpen(false); }}><BellOff className="size-5" /> {muted ? "Unmute" : "Mute notifications"}</button>
            {isGroup ? <button type="button" className="tap flex h-12 w-full items-center gap-3 px-2" onClick={() => { setMenuOpen(false); onGroup(chat.id); }}><Shield className="size-5" /> Squad settings</button> : null}
            {!isGroup && peerUid ? (
              <>
                <button type="button" className="tap flex h-12 w-full items-center gap-3 px-2" onClick={() => { setMenuOpen(false); onProfile(peerUid); }}><Shield className="size-5" /> View profile</button>
                <button type="button" className="tap flex h-12 w-full items-center gap-3 px-2" onClick={() => { setMenuOpen(false); setReportOpen(true); }}><Flag className="size-5" /> Report user</button>
                <button type="button" className="tap flex h-12 w-full items-center gap-3 px-2 text-rose" onClick={() => { void togglePref(me.uid, "blocked", peerUid, !iBlocked); setMenuOpen(false); }}><Ban className="size-5" /> {iBlocked ? "Unblock user" : "Block user"}</button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {themeOpen ? (
        <div className="absolute inset-0 z-30 flex items-end bg-black/60" onClick={() => setThemeOpen(false)}>
          <div className="sheet-up w-full rounded-t-3xl bg-deep p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 font-display text-2xl font-bold">Chat theme</p>
            <div className="grid grid-cols-3 gap-3">
              {CHAT_THEMES.map((t) => (
                <button key={t.id} type="button" className={clsx("tap h-20 rounded-2xl border p-2 text-left text-xs font-semibold", themeId === t.id ? "border-paper" : "border-paper/10")} style={{ background: t.wall || "var(--bg2)" }}
                  onClick={() => { if (t.pro && !me.pro) { setError("⭐ Ye theme Pro plan mein milti hai"); return; } setThemeId(t.id); localStorage.setItem(`pry-ct-${chatId}`, t.id); setThemeOpen(false); }}>
                  <span className="block h-5 w-12 rounded-lg" style={{ background: t.me || "linear-gradient(135deg,var(--c1),var(--c2))" }} />
                  <span className="mt-2 block">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {reportOpen && peerUid ? (
        <div className="absolute inset-0 z-30 flex items-end bg-black/60" onClick={() => setReportOpen(false)}>
          <div className="sheet-up w-full rounded-t-3xl bg-deep p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 font-display text-2xl font-bold">Report {title}</p>
            {["Spam", "Gaali / abuse", "Fake account", "Cheating / hack", "Kuch aur"].map((r) => <button key={r} type="button" className="tap flex h-12 w-full items-center px-2 text-left" onClick={() => { void reportUser(me.uid, peerUid, chatId, r); setReportOpen(false); setError("Report bhej di gayi. Thanks!"); }}>{r}</button>)}
          </div>
        </div>
      ) : null}

      {gifOpen ? (
        <div className="absolute inset-0 z-30 flex items-end bg-black/60" onClick={() => setGifOpen(false)}>
          <div className="sheet-up flex max-h-[80dvh] w-full flex-col rounded-t-3xl bg-deep p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 font-display text-2xl font-bold">GIFs</p>
            <input className="mb-3 h-11 w-full rounded-2xl border border-paper/12 bg-paper/6 px-4 text-base outline-none placeholder:text-paper/30 focus:border-rose/60" placeholder="GIF search" value={gifQ} onChange={(e) => setGifQ(e.target.value)} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {gifBusy && gifList.length === 0 ? <div className="grid grid-cols-2 gap-3"><div className="shimmer h-32 rounded-2xl" /><div className="shimmer h-32 rounded-2xl" /></div> : null}
              {(() => {
                const q = gifQ.trim().toLowerCase();
                const list = q ? gifList.filter((g) => `${g.label} ${g.tag}`.toLowerCase().includes(q)) : gifList;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">{list.map((g) => <button key={g.id} type="button" className="tap overflow-hidden rounded-2xl border border-paper/10" onClick={() => { void send({ gif: g.id }); setGifOpen(false); }}><img decoding="async" src={g.src} alt={g.label} loading="lazy" referrerPolicy="no-referrer" className="h-32 w-full object-cover" /></button>)}</div>
                    {q && list.length === 0 ? <p className="py-6 text-center text-sm text-paper/55">Is naam ka GIF nahi mila</p> : null}
                  </>
                );
              })()}
              {gifList.length < 6 && !gifQ.trim() ? <p className="grad-text mt-5 text-center font-display text-xl font-bold tracking-wide">More GIFs Coming Soon</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {lightbox ? <div className="pop-in absolute inset-0 z-40 grid place-items-center bg-black/90 p-3" onClick={() => setLightbox(null)}><img decoding="async" src={lightbox} alt="" className="max-h-full max-w-full rounded-xl object-contain" /><button type="button" className="tap absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-paper/15" aria-label="Close photo"><X className="size-5" /></button></div> : null}
    </section>
  );
}
