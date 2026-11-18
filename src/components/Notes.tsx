import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import clsx from "clsx";
import { ChevronRight, MapPin, Music, Palette, Pause, Play, Send, Trash2, Users, X } from "lucide-react";
import { db } from "../firebase";
import { chatDefaults, openDm, sendMessage } from "../lib/data";
import { deleteNote, getNote, publishNote } from "../lib/extra";
import { fetchMedia, readDataUrl, storyMedia, uploadMedia } from "../lib/media";
import type { ChatDoc, NoteDoc, UserDoc } from "../lib/types";
import { buzz, errorText, pushBack, relTime } from "../lib/util";
import { useGif, loadGifs } from "../lib/gifs";
import type { GifItem } from "../lib/types";
import { Avatar } from "./ui";
import { Rich } from "./Rich";

/** Contacts + apne notes, 60s mein refresh. */
export function useNotes(uids: string[], tick: number) {
  const [notes, setNotes] = useState<Record<string, NoteDoc>>({});
  const key = [...uids].sort().join(",");
  useEffect(() => {
    let stop = false;
    const load = () => {
      void Promise.all(uids.map((u) => getNote(u).then((n) => [u, n] as const).catch(() => [u, null] as const))).then((rows) => {
        if (stop) return;
        const next: Record<string, NoteDoc> = {};
        for (const [u, n] of rows) if (n) next[u] = n;
        setNotes(next);
      });
    };
    load();
    const t = window.setInterval(load, 60_000);
    return () => { stop = true; window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
  return notes;
}

export function Eq({ on = true }: { on?: boolean }) {
  return <span className={clsx("eq", !on && "eq-off")} aria-hidden="true"><i /><i /><i /></span>;
}

export const NOTE_TONES: Array<{ bg: string; fg: string }> = [
  { bg: "", fg: "" },
  { bg: "#ff2e7e", fg: "#ffffff" },
  { bg: "#7c3aed", fg: "#ffffff" },
  { bg: "#2563eb", fg: "#ffffff" },
  { bg: "#16a34a", fg: "#ffffff" },
  { bg: "#facc15", fg: "#111111" },
];

type BubbleNote = Pick<NoteDoc, "text" | "songTitle"> & Partial<Pick<NoteDoc, "place" | "gif" | "tone">>;

function NoteGif({ id, size }: { id: string; size: number }) {
  const { src } = useGif(id);
  return src ? <img decoding="async" src={src} alt="GIF" className="mx-auto rounded-lg object-cover" style={{ width: size, height: size }} /> : null;
}

/** Instagram jaisa note bubble (text + song + jagah + GIF). */
export function NoteBubble({ note, placeholder, className }: { note: BubbleNote | null; placeholder?: string; className?: string }) {
  if (!note && !placeholder) return null;
  const tone = NOTE_TONES[note?.tone ?? 0] ?? NOTE_TONES[0];
  return (
    <span className={clsx("note-bubble block", !note && "opacity-80", className)} style={tone.bg ? { background: tone.bg, color: tone.fg } : undefined}>
      {note?.gif ? <NoteGif id={note.gif} size={44} /> : null}
      {note?.songTitle ? <span className="flex items-center justify-center gap-1 font-semibold"><Eq /><span className="line-clamp-1 break-all">{note.songTitle}</span></span> : null}
      {note?.place ? <span className="flex items-center justify-center gap-1 font-semibold"><MapPin className="size-3 shrink-0" /><span className="line-clamp-1 break-all">{note.place}</span></span> : null}
      {note?.text ? <span className="line-clamp-2 break-words"><Rich text={note.text} size={16} /></span> : null}
      {!note ? <span className="text-paper/60">{placeholder}</span> : null}
    </span>
  );
}

export type NoteTile = { uid: string; user: UserDoc | null; note: NoteDoc | null };

export function NotesRow({ me, tiles, onOpen }: { me: UserDoc; tiles: NoteTile[]; onOpen: (uid: string) => void }) {
  return (
    <div className="-mx-0 flex gap-2 overflow-x-auto px-3 pt-1 pb-3">
      {tiles.map((t) => {
        const mine = t.uid === me.uid;
        const name = mine ? "Your note" : t.user?.displayName ?? "…";
        return (
          <button key={t.uid} type="button" onClick={() => onOpen(t.uid)} className="tap flex w-[5.6rem] shrink-0 flex-col items-center pt-11 active:scale-95">
            <span className="relative">
              <span className="absolute bottom-[calc(100%-0.75rem)] left-1/2 z-10 -translate-x-1/2">
                <NoteBubble note={t.note} placeholder={mine ? "Note…" : undefined} />
              </span>
              <Avatar src={mine ? me.avatar : t.user?.avatar ?? null} name={name} size="note" />
            </span>
            <span className="mt-1.5 w-full truncate text-center text-xs text-paper/65">{name}</span>
            {t.note?.songTitle ? <span className="mt-0 w-full truncate text-center text-[0.65rem] font-semibold text-paper/50">♪ {t.note.songTitle}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

async function sendDm(me: UserDoc, owner: UserDoc, text: string) {
  const id = await openDm(me, owner);
  const snap = await getDoc(doc(db, "chats", id));
  const chat: ChatDoc = chatDefaults(id, snap.data() as Partial<ChatDoc>);
  await sendMessage(chat, me, { text });
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => pushBack(onClose), [onClose]);
  return (
    <div className="fixed inset-0 z-[66] flex items-end bg-black/65" onClick={onClose}>
      <div className="sheet-up w-full rounded-t-3xl bg-deep p-4 pb-8 text-paper" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><p className="font-display text-2xl font-bold">{title}</p><button type="button" className="tap p-2" aria-label="Close" onClick={onClose}><X className="size-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

/** Apna note: Instagram jaisa full-screen editor. */
export function NoteEditor({ me, current, onClose, onChanged }: { me: UserDoc; current: NoteDoc | null; onClose: () => void; onChanged: () => void }) {
  const [text, setText] = useState(current?.text ?? "");
  const [songTitle, setSongTitle] = useState(current?.songTitle ?? "");
  const [song, setSong] = useState<File | null>(null);
  const [keepOld, setKeepOld] = useState(Boolean(current?.musicId));
  const [place, setPlace] = useState(current?.place ?? "");
  const [gif, setGif] = useState<string | null>(current?.gif ?? null);
  const [tone, setTone] = useState(current?.tone ?? 0);
  const [audience, setAudience] = useState<"all" | "close">(current?.audience ?? "all");
  const [panel, setPanel] = useState<"none" | "music" | "place" | "gif" | "who">("none");
  const [gifs, setGifs] = useState<GifItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const songRef = useRef<HTMLInputElement>(null);
  const hasSong = Boolean(song) || keepOld;
  const preview = useMemo(() => ({ text, songTitle: hasSong && songTitle.trim() ? songTitle.trim() : null, place: place.trim() || null, gif, tone }), [text, songTitle, hasSong, place, gif, tone]);
  const empty = !text.trim() && !preview.songTitle && !preview.place && !gif;

  useEffect(() => pushBack(() => { if (panel !== "none") setPanel("none"); else onClose(); }), [onClose, panel]);
  useEffect(() => { if (panel === "gif" && !gifs) void loadGifs().then(setGifs).catch(() => setGifs([])); }, [panel, gifs]);

  async function share() {
    setBusy(true); setError("");
    try {
      let musicId: string | null = keepOld ? current?.musicId ?? null : null;
      if (song) {
        if (song.size > 2_000_000) throw new Error("Song 2MB se chhota hona chahiye");
        musicId = await uploadMedia(storyMedia(me.uid), await readDataUrl(song), "audio");
      }
      await publishNote(me.uid, { text, songTitle: musicId ? (songTitle.trim() || "Song").slice(0, 40) : null, musicId, place: place.trim().slice(0, 30) || null, gif, tone, audience }, me.pro ? 48 : 24);
      onChanged(); onClose();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  const pill = "tap grid h-[3.4rem] w-[4.4rem] place-items-center rounded-full border border-white/15 bg-white/[0.04]";
  return (
    <div className="fixed inset-0 z-[66] flex flex-col bg-[#0b0f14] text-white" style={{ animation: "fade-up 260ms cubic-bezier(0.2,0.8,0.2,1) both" }}>
      <header className="flex h-16 shrink-0 items-center px-4 pt-[env(safe-area-inset-top)]">
        <button type="button" className="tap grid size-11 place-items-center rounded-full" aria-label="Close" onClick={onClose}><X className="size-8" strokeWidth={1.6} /></button>
        {current ? <button type="button" disabled={busy} className="tap ml-auto grid size-11 place-items-center rounded-full text-rose" aria-label="Delete note" onClick={() => { setBusy(true); void deleteNote(me.uid).then(() => { onChanged(); onClose(); }).catch((e) => setError(errorText(e))).finally(() => setBusy(false)); }}><Trash2 className="size-6" /></button> : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 pb-16">
        <div className="relative flex w-full max-w-xs flex-col items-center">
          <div className="note-bubble relative !max-w-[17rem] !rounded-[1.6rem] !px-5 !py-3" style={{ background: NOTE_TONES[tone]?.bg || "#1b2027", color: NOTE_TONES[tone]?.fg || "#e8eaed", fontSize: "1.5rem", marginBottom: "0.35rem" }}>
            {gif ? <NoteGif id={gif} size={72} /> : null}
            {preview.songTitle ? <span className="mb-1 flex items-center justify-center gap-1.5 text-sm font-semibold"><Eq /><span className="line-clamp-1 break-all">{preview.songTitle}</span></span> : null}
            {preview.place ? <span className="mb-1 flex items-center justify-center gap-1.5 text-sm font-semibold"><MapPin className="size-3.5" />{preview.place}</span> : null}
            <input autoFocus className="w-full min-w-[9rem] bg-transparent text-center outline-none placeholder:text-white/45" style={{ caretColor: "#6f9bff" }} maxLength={60} placeholder="Note…" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="relative">
            <Avatar src={me.avatar} name={me.displayName} size="note" />
            <button type="button" aria-label="Note colour" onClick={() => setTone((t) => (t + 1) % NOTE_TONES.length)} className="tap absolute -right-1 -bottom-1 grid size-10 place-items-center rounded-full border border-white/15 bg-[#1b2027]"><Palette className="size-5 text-[#ff4f8b]" /></button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" aria-label="Music" className={pill} onClick={() => setPanel(panel === "music" ? "none" : "music")}><Music className="size-6 text-[#ff2e7e]" /></button>
          <button type="button" aria-label="Location" className={pill} onClick={() => setPanel(panel === "place" ? "none" : "place")}><MapPin className="size-6 text-[#8b5cf6]" /></button>
          <button type="button" aria-label="GIF" className={pill} onClick={() => setPanel(panel === "gif" ? "none" : "gif")}><span className="rounded-md border-2 border-[#22c55e] px-1 text-[0.7rem] leading-4 font-extrabold text-[#22c55e]">GIF</span></button>
        </div>

        {panel === "music" ? (
          <div className="sheet-up w-full max-w-xs space-y-2">
            <button type="button" className="tap flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 text-sm font-semibold" onClick={() => songRef.current?.click()}><Music className="size-4" /> {hasSong ? "Song badlo" : "Song file chuno (2MB tak)"}</button>
            {hasSong ? <div className="flex gap-2"><input className="h-11 min-w-0 flex-1 rounded-2xl border border-white/15 bg-transparent px-4 text-sm outline-none" maxLength={40} placeholder="Song / artist ka naam" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} /><button type="button" className="tap h-11 rounded-2xl border border-rose/40 px-4 text-sm text-rose" onClick={() => { setSong(null); setKeepOld(false); setSongTitle(""); }}>Hatao</button></div> : null}
            <input ref={songRef} type="file" accept="audio/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSong(f); setKeepOld(false); setSongTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 40)); } e.target.value = ""; }} />
          </div>
        ) : null}
        {panel === "place" ? (
          <div className="sheet-up flex w-full max-w-xs gap-2">
            <input autoFocus className="h-11 min-w-0 flex-1 rounded-2xl border border-white/15 bg-transparent px-4 text-sm outline-none" maxLength={30} placeholder="Kahan ho? (jagah ka naam)" value={place} onChange={(e) => setPlace(e.target.value)} />
            {place ? <button type="button" className="tap h-11 rounded-2xl border border-rose/40 px-4 text-sm text-rose" onClick={() => setPlace("")}>Hatao</button> : null}
          </div>
        ) : null}
        {panel === "gif" ? (
          <div className="sheet-up w-full max-w-xs">
            {!gifs ? <div className="shimmer h-24 rounded-2xl" /> : gifs.length === 0 ? <p className="text-center text-sm text-white/50">Abhi koi GIF nahi.</p> : (
              <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto">
                {gifs.map((g) => <button key={g.id} type="button" className={clsx("tap overflow-hidden rounded-xl ring-2", gif === g.id ? "ring-[#22c55e]" : "ring-transparent")} onClick={() => setGif(gif === g.id ? null : g.id)}><img decoding="async" src={g.src} alt={g.label} loading="lazy" className="aspect-square w-full object-cover" /></button>)}
              </div>
            )}
          </div>
        ) : null}
        {error ? <p className="text-sm text-rose">{error}</p> : null}
      </div>

      <footer className="flex shrink-0 items-center justify-between px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button type="button" className="tap flex items-center gap-2 text-[1.05rem] font-semibold" onClick={() => setPanel(panel === "who" ? "none" : "who")}><Users className="size-5" /> {audience === "close" ? "Close friends" : "Share with friends"} <ChevronRight className="size-5" /></button>
        <button type="button" disabled={busy || empty} onClick={() => void share()} className="tap h-14 rounded-full bg-[#1f2766] px-9 text-xl font-semibold disabled:opacity-40">{busy ? "…" : "Share"}</button>
      </footer>
      {panel === "who" ? (
        <div className="absolute inset-0 z-10 flex items-end bg-black/60" onClick={() => setPanel("none")}>
          <div className="sheet-up w-full rounded-t-3xl bg-[#141a22] p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-lg font-bold">Note kisko dikhe?</p>
            {([["all", "Friends / contacts", "Jinse tumhari chat hai wo sab"], ["close", "Close friends", `Sirf ${me.closeFriends.length} close friends`]] as const).map(([k, t, d]) => (
              <button key={k} type="button" className="tap flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left" onClick={() => { setAudience(k); setPanel("none"); }}>
                <span><span className="block font-semibold">{t}</span><span className="block text-sm text-white/50">{d}</span></span>
                <span className={clsx("grid size-6 place-items-center rounded-full border-2", audience === k ? "border-[#6f9bff] bg-[#6f9bff]" : "border-white/30")}>{audience === k ? <span className="size-2 rounded-full bg-white" /> : null}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Dusre ka note dekhna, song sunna, reply bhejna. */
export function NoteViewer({ me, owner, note, onClose }: { me: UserDoc; owner: UserDoc; note: NoteDoc; onClose: () => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [reply, setReply] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!note.musicId) return;
    let stop = false;
    void fetchMedia(storyMedia(owner.uid), note.musicId).then((u) => { if (!stop) setUrl(u); }).catch(() => undefined);
    return () => { stop = true; };
  }, [note.musicId, owner.uid]);
  useEffect(() => { if (url && audio.current) void audio.current.play().catch(() => undefined); }, [url]);

  const send = (text: string) => {
    buzz(); setToast("Bhej diya ✓"); setReply("");
    void sendDm(me, owner, text).catch((e) => setToast(errorText(e)));
  };
  const quote = `📝 ${note.songTitle ? `♪ ${note.songTitle} ` : ""}${note.text}`.trim().slice(0, 80);

  return (
    <Sheet title={`${owner.displayName} ka note`} onClose={onClose}>
      <div className="flex flex-col items-center gap-3 py-2">
        <Avatar src={owner.avatar} name={owner.displayName} size="xl" />
        <NoteBubble note={note} className="max-w-[16rem] text-base" />
        <p className="text-xs text-paper/45">{relTime(note.createdAt)} pehle</p>
        {note.musicId ? (
          <button type="button" disabled={!url} className="glass tap flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-50" onClick={() => { const a = audio.current; if (!a) return; if (a.paused) void a.play(); else a.pause(); }}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />} {url ? (playing ? "Pause" : "Play song") : "Song load ho raha hai…"}
          </button>
        ) : null}
        {url ? <audio ref={audio} src={url} loop onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : null}
      </div>
      <div className="mb-3 flex items-center justify-center gap-3">{["❤️", "🔥", "😂", "😮", "👏"].map((e) => <button key={e} type="button" className="tap grid size-11 place-items-center rounded-full bg-paper/8 text-2xl" onClick={() => send(`${e} ${quote}`)}>{e}</button>)}</div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) send(`${quote}\n↳ ${reply.trim()}`); }}>
        <input className="h-12 min-w-0 flex-1 rounded-full border border-paper/12 bg-paper/5 px-5 outline-none focus:border-rose/70" placeholder="Reply to note…" maxLength={200} value={reply} onChange={(e) => setReply(e.target.value)} />
        <button type="submit" disabled={!reply.trim()} className="btn-hot tap grid size-12 shrink-0 place-items-center rounded-full" aria-label="Send reply"><Send className="size-5" /></button>
      </form>
      {toast ? <p className="mt-2 text-center text-sm text-paper/70">{toast}</p> : null}
    </Sheet>
  );
}
