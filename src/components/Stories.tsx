import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import clsx from "clsx";
import { AtSign, Eye, Image as ImageIcon, Music, Plus, Send, Trash2, Type, X } from "lucide-react";
import { db } from "../firebase";
import { chatDefaults, openDm, sendMessage } from "../lib/data";
import { deleteStory, getStories, getStoryViews, markStoryView, publishStory } from "../lib/extra";
import { cachedMedia, fetchMedia, readDataUrl, storyMedia, uploadMedia } from "../lib/media";
import type { ChatDoc, StoryItem, UserDoc } from "../lib/types";
import { buzz, compressImage, errorText, pushBack, relTime } from "../lib/util";
import { Avatar } from "./ui";

export const STORY_BG = [
  "linear-gradient(135deg,#ff5a1f,#e11d48)", "linear-gradient(135deg,#7c3aed,#0ea5e9)", "linear-gradient(135deg,#16a34a,#065f46)",
  "linear-gradient(135deg,#f59e0b,#b45309)", "linear-gradient(135deg,#111827,#4b5563)", "linear-gradient(135deg,#ec4899,#8b5cf6)",
];
const SEEN_KEY = "pry-seen-stories";
const seenSet = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]); } catch { return new Set(); }
};
const markSeen = (id: string) => {
  const s = seenSet();
  s.add(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-300)));
};

export type StoryOwner = { uid: string; user: UserDoc | null; items: StoryItem[] };

export function visibleItems(items: StoryItem[], me: string, owner: string) {
  const now = Date.now();
  return items.filter((i) => i.expiresAt > now && (owner === me || i.audience === "all" || i.allowed.includes(me)));
}

export function StoriesStrip({ me, owners, onOpen, onCreate }: { me: UserDoc; owners: StoryOwner[]; onOpen: (i: number) => void; onCreate: () => void }) {
  const seen = seenSet();
  const mine = owners.find((o) => o.uid === me.uid);
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      <button type="button" className="tap flex w-16 shrink-0 flex-col items-center gap-1" onClick={() => (mine && mine.items.length ? onOpen(owners.indexOf(mine)) : onCreate())}>
        <span className={clsx("relative rounded-full p-[3px]", mine?.items.length ? "grad" : "bg-paper/15")}>
          <span className="block rounded-full bg-ink p-[2px]"><Avatar src={me.avatar} name={me.displayName} size="md" /></span>
          <span role="button" aria-label="Add story" onClick={(e) => { e.stopPropagation(); onCreate(); }} className="grad absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full text-white ring-2 ring-ink"><Plus className="size-3" /></span>
        </span>
        <span className="w-full truncate text-center text-[0.68rem] text-paper/70">Your story</span>
      </button>
      {owners.filter((o) => o.uid !== me.uid).map((o) => {
        const unseen = o.items.some((i) => !seen.has(i.id));
        return (
          <button key={o.uid} type="button" className="tap flex w-16 shrink-0 flex-col items-center gap-1" onClick={() => onOpen(owners.indexOf(o))}>
            <span className={clsx("rounded-full p-[3px]", unseen ? "grad" : "bg-paper/20")}>
              <span className="block rounded-full bg-ink p-[2px]"><Avatar src={o.user?.avatar ?? null} name={o.user?.displayName ?? "?"} size="md" /></span>
            </span>
            <span className="w-full truncate text-center text-[0.68rem] text-paper/70">{o.user?.displayName ?? "…"}</span>
          </button>
        );
      })}
    </div>
  );
}

async function reactToStory(me: UserDoc, owner: UserDoc, emoji: string) {
  const id = await openDm(me, owner);
  const snap = await getDoc(doc(db, "chats", id));
  const chat: ChatDoc = chatDefaults(id, snap.data() as Partial<ChatDoc>);
  await sendMessage(chat, me, { text: `${emoji} Story reaction` });
}

export function StoryViewer({ me, owners, start, onClose, onChanged }: { me: UserDoc; owners: StoryOwner[]; start: number; onClose: () => void; onChanged: () => void }) {
  const [oi, setOi] = useState(start);
  const [ii, setIi] = useState(0);
  const [pct, setPct] = useState(0);
  const [paused, setPaused] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [views, setViews] = useState<{ viewer: string; name: string; at: number }[] | null>(null);
  const [toast, setToast] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [songUrl, setSongUrl] = useState<string | null>(null);
  const owner = owners[oi];
  const item = owner?.items[ii];
  const mineStory = owner?.uid === me.uid;

  useEffect(() => pushBack(onClose), [onClose]);

  const next = useCallback(() => {
    if (!owner) return onClose();
    if (ii + 1 < owner.items.length) { setIi(ii + 1); setPct(0); return; }
    if (oi + 1 < owners.length) { setOi(oi + 1); setIi(0); setPct(0); return; }
    onClose();
  }, [ii, oi, owner, owners.length, onClose]);
  const prev = () => {
    if (ii > 0) { setIi(ii - 1); setPct(0); } else if (oi > 0) { setOi(oi - 1); setIi(0); setPct(0); }
  };

  useEffect(() => {
    if (!item || !owner) return;
    setImgUrl(null);
    setSongUrl(null);
    setViews(null);
    markSeen(item.id);
    if (!mineStory) void markStoryView(owner.uid, item.id, me.uid, me.displayName);
    const base = storyMedia(owner.uid);
    if (item.mediaId) {
      const c = cachedMedia(base, item.mediaId);
      if (c) setImgUrl(c);
      else void fetchMedia(base, item.mediaId).then(setImgUrl).catch(() => undefined);
    }
    if (item.musicId) void fetchMedia(base, item.musicId).then(setSongUrl).catch(() => undefined);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (songUrl && audioRef.current) void audioRef.current.play().catch(() => undefined);
  }, [songUrl]);

  const waiting = Boolean(item?.mediaId && !imgUrl);
  useEffect(() => {
    if (!item || paused || waiting || views) return;
    const t = window.setInterval(() => {
      setPct((p) => {
        if (p >= 100) return p;
        return p + 100 / (6000 / 60);
      });
    }, 60);
    return () => window.clearInterval(t);
  }, [item?.id, paused, waiting, views]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pct >= 100) next();
  }, [pct]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!owner || !item) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white select-none" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerCancel={() => setPaused(false)}>
      <div className="absolute inset-0" style={item.kind === "text" ? { background: STORY_BG[item.bg % STORY_BG.length] } : undefined}>
        {item.kind === "image" ? <img src={imgUrl ?? item.thumb ?? undefined} alt="" className={clsx("h-full w-full object-contain transition-[filter] duration-300", !imgUrl && "blur-xl")} /> : (
          <div className="grid h-full place-items-center px-8"><p className="text-center font-display text-4xl leading-tight font-bold break-words whitespace-pre-wrap">{item.text}</p></div>
        )}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />
      </div>
      <div className="absolute inset-y-0 left-0 w-1/3" onClick={prev} />
      <div className="absolute inset-y-0 right-0 w-2/3" onClick={next} />

      <div className="safe-top relative z-10 px-3 pt-2">
        <div className="flex gap-1">{owner.items.map((it, k) => <span key={it.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30"><span className="block h-full bg-white" style={{ width: k < ii ? "100%" : k === ii ? `${Math.min(100, pct)}%` : "0%" }} /></span>)}</div>
        <div className="mt-3 flex items-center gap-3">
          <Avatar src={owner.user?.avatar ?? null} name={owner.user?.displayName ?? "?"} size="xs" />
          <p className="font-semibold">{owner.user?.displayName ?? "…"} <span className="ml-1 text-xs font-normal text-white/60">{relTime(item.createdAt)}</span></p>
          {item.audience === "close" ? <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[0.65rem] font-bold">CLOSE</span> : null}
          <button type="button" className="tap ml-auto grid size-9 place-items-center rounded-full bg-black/40" aria-label="Close" onClick={(e) => { e.stopPropagation(); onClose(); }} onPointerDown={(e) => e.stopPropagation()}><X className="size-5" /></button>
        </div>
        {item.musicTitle ? <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-xs"><Music className="size-3.5" /> {item.musicTitle}</p> : null}
      </div>

      <div className="relative z-10 mt-auto px-4 pb-6" onPointerDown={(e) => e.stopPropagation()}>
        {item.mentionNames.length ? <div className="mb-3 flex flex-wrap gap-2">{item.mentionNames.map((n) => <span key={n} className="rounded-full bg-black/55 px-3 py-1 text-sm font-semibold">@{n}</span>)}</div> : null}
        {item.kind === "image" && item.caption ? <p className="mb-4 text-center text-lg font-semibold drop-shadow break-words">{item.caption}</p> : null}
        {toast ? <p className="mb-2 text-center text-sm text-white/80">{toast}</p> : null}
        {mineStory ? (
          <div className="flex items-center justify-between">
            <button type="button" className="tap flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-semibold" onClick={() => void getStoryViews(me.uid, item.id).then((v) => setViews(v.sort((a, b) => b.at - a.at)))}><Eye className="size-4" /> Views</button>
            <button type="button" className="tap grid size-10 place-items-center rounded-full bg-black/50" aria-label="Delete story" onClick={() => void deleteStory(me.uid, item.id).then(() => { onChanged(); next(); }).catch((e) => setToast(errorText(e)))}><Trash2 className="size-5" /></button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            {["❤️", "🔥", "😂", "😮", "👏"].map((e) => (
              <button key={e} type="button" className="tap grid size-12 place-items-center rounded-full bg-black/45 text-2xl" onClick={() => { if (!owner.user) return; buzz(); setToast("Bhej diya ✓"); void reactToStory(me, owner.user, e).catch((x) => setToast(errorText(x))); }}>{e}</button>
            ))}
          </div>
        )}
      </div>

      {songUrl ? <audio ref={audioRef} src={songUrl} loop /> : null}

      {views ? (
        <div className="sheet-up absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-y-auto rounded-t-3xl bg-deep p-4 pb-8 text-paper" onPointerDown={(e) => e.stopPropagation()}>
          <div className="mb-2 flex items-center justify-between"><p className="font-display text-2xl font-bold">{views.length} views</p><button type="button" className="tap p-2" aria-label="Close views" onClick={() => setViews(null)}><X className="size-5" /></button></div>
          {views.length === 0 ? <p className="text-sm text-paper/55">Abhi tak kisi ne nahi dekha.</p> : views.map((v) => <p key={v.viewer} className="flex justify-between border-b border-paper/8 py-2 text-sm"><span>{v.name}</span><span className="text-paper/45">{relTime(v.at)}</span></p>)}
        </div>
      ) : null}
    </div>
  );
}

export function StoryCreator({ me, contacts, onClose, onPublished }: { me: UserDoc; contacts: UserDoc[]; onClose: () => void; onPublished: () => void }) {
  const [mode, setMode] = useState<"choose" | "photo" | "text">("choose");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [caption, setCaption] = useState("");
  const [bg, setBg] = useState(0);
  const [audience, setAudience] = useState<"all" | "close">("all");
  const [mentions, setMentions] = useState<UserDoc[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [song, setSong] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const songRef = useRef<HTMLInputElement>(null);
  useEffect(() => pushBack(onClose), [onClose]);

  async function publish() {
    setBusy(true);
    setError("");
    try {
      const now = Date.now();
      let mediaId: string | null = null;
      let thumb: string | null = null;
      if (mode === "photo") {
        if (!file) throw new Error("Photo chuno");
        const [full, th] = await Promise.all([compressImage(file, 1080, 0.72, 380_000), compressImage(file, 28, 0.5, 4000)]);
        mediaId = await uploadMedia(storyMedia(me.uid), full, "image");
        thumb = th;
      } else if (!text.trim()) throw new Error("Kuch likho");
      let musicId: string | null = null;
      if (song) {
        if (song.size > 2_000_000) throw new Error("Song 2MB se chhota hona chahiye");
        musicId = await uploadMedia(storyMedia(me.uid), await readDataUrl(song), "audio");
      }
      const item: StoryItem = {
        id: String(now), kind: mode === "photo" ? "image" : "text", mediaId, thumb, text: text.trim().slice(0, 300), bg, caption: caption.trim().slice(0, 200),
        mentions: mentions.map((m) => m.uid), mentionNames: mentions.map((m) => m.username), audience, allowed: audience === "close" ? me.closeFriends : [],
        musicId, musicTitle: song ? song.name.replace(/\.[^.]+$/, "").slice(0, 40) : null, createdAt: now, expiresAt: now + (me.pro ? 48 : 24) * 3_600_000,
      };
      await publishStory(me.uid, item);
      onPublished();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-up safe-top fixed inset-0 z-[65] flex flex-col bg-ink text-paper">
      <header className="flex h-16 shrink-0 items-center justify-between px-4">
        <h2 className="font-display text-3xl font-bold">New story</h2>
        <button type="button" className="tap grid size-11 place-items-center rounded-full" aria-label="Close" onClick={onClose}><X className="size-5" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-8">
        {mode === "choose" ? (
          <div className="grid grid-cols-2 gap-3 pt-6">
            <button type="button" className="glass tap flex h-36 flex-col items-center justify-center gap-2 rounded-3xl" onClick={() => photoRef.current?.click()}><ImageIcon className="size-9 text-hot" /><span className="font-display text-xl font-bold">PHOTO</span></button>
            <button type="button" className="glass tap flex h-36 flex-col items-center justify-center gap-2 rounded-3xl" onClick={() => setMode("text")}><Type className="size-9 text-rose" /><span className="font-display text-xl font-bold">TEXT</span></button>
            <input ref={photoRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setMode("photo"); } e.target.value = ""; }} />
          </div>
        ) : (
          <>
            {mode === "photo" && preview ? (
              <div className="overflow-hidden rounded-3xl bg-black"><img src={preview} alt="" className="max-h-[42dvh] w-full object-contain" /></div>
            ) : (
              <div className="grid min-h-48 place-items-center rounded-3xl p-5" style={{ background: STORY_BG[bg] }}>
                <textarea className="w-full resize-none bg-transparent text-center font-display text-3xl font-bold text-white outline-none placeholder:text-white/50" rows={4} maxLength={300} placeholder="Kuch likho…" value={text} onChange={(e) => setText(e.target.value)} />
              </div>
            )}
            {mode === "text" ? <div className="flex gap-2">{STORY_BG.map((b, i) => <button key={b} type="button" aria-label={`Background ${i + 1}`} className={clsx("tap size-9 rounded-full ring-2", bg === i ? "ring-paper" : "ring-transparent")} style={{ background: b }} onClick={() => setBg(i)} />)}</div> : <input className="h-12 w-full rounded-2xl border border-paper/12 bg-paper/5 px-4 outline-none placeholder:text-paper/30 focus:border-rose/70" placeholder="Caption likho (optional)" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} />}

            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={clsx("tap h-11 rounded-2xl text-sm font-semibold", audience === "all" ? "grad text-white" : "glass")} onClick={() => setAudience("all")}>🌍 Everyone</button>
              <button type="button" className={clsx("tap h-11 rounded-2xl text-sm font-semibold", audience === "close" ? "bg-emerald-600 text-white" : "glass")} onClick={() => setAudience("close")}>💚 Close friends</button>
            </div>
            {audience === "close" && me.closeFriends.length === 0 ? <p className="text-xs text-hot">Close friends list khaali hai. Me tab → Close friends mein add karo.</p> : null}

            <div className="flex gap-2">
              <button type="button" className="glass tap flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold" onClick={() => setMentionOpen((v) => !v)}><AtSign className="size-4" /> Mention</button>
              <button type="button" className="glass tap flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold" onClick={() => songRef.current?.click()}><Music className="size-4" /> {song ? "Song ✓" : "Song"}</button>
              <input ref={songRef} type="file" accept="audio/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSong(f); e.target.value = ""; }} />
            </div>
            {song ? <p className="flex items-center justify-between text-xs text-paper/60"><span className="truncate">🎵 {song.name}</span><button type="button" className="text-rose" onClick={() => setSong(null)}>hatao</button></p> : null}
            {mentions.length ? <div className="flex flex-wrap gap-2">{mentions.map((m) => <button key={m.uid} type="button" className="pop-in rounded-full bg-rose/15 px-3 py-1.5 text-sm font-semibold text-rose" onClick={() => setMentions((l) => l.filter((x) => x.uid !== m.uid))}>@{m.username} ×</button>)}</div> : null}
            {mentionOpen ? (
              <div className="glass max-h-48 space-y-1 overflow-y-auto rounded-2xl p-2">
                {contacts.length === 0 ? <p className="p-2 text-sm text-paper/55">Pehle kisi ko chat mein add karo.</p> : contacts.map((c) => (
                  <button key={c.uid} type="button" className="tap flex w-full items-center gap-3 rounded-xl p-2 text-left" onClick={() => { setMentions((l) => (l.some((x) => x.uid === c.uid) ? l : [...l, c].slice(0, 5))); setMentionOpen(false); }}>
                    <Avatar src={c.avatar} name={c.displayName} size="xs" /><span className="truncate">{c.displayName} <span className="text-xs text-paper/45">@{c.username}</span></span>
                  </button>
                ))}
              </div>
            ) : null}
            {error ? <p className="text-sm text-rose">{error}</p> : null}
            <button type="button" disabled={busy} onClick={() => void publish()} className="btn-hot tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-display text-xl font-bold tracking-wide"><Send className="size-5" /> {busy ? "PUBLISHING…" : "PUBLISH"}</button>
            <p className="text-center text-xs text-paper/40">Story {me.pro ? "48" : "24"} ghante tak rahegi{me.pro ? " ⭐" : ""}.</p>
          </>
        )}
      </div>
    </div>
  );
}
