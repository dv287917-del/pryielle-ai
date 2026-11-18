import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Share } from "@capacitor/share";
import { ArrowLeft, ArrowUpLeft, ChevronDown, ChevronUp, ExternalLink, History, Link2, Search, Share2, X } from "lucide-react";
import {
  EMPTY_FEED, addInterest, addRecent, channelInfo, channelVideos, clearRecent, extractId, getInterests, getRecent,
  homeFeed, relatedYt, searchYt, thumbOf, watchUrl, type Chan, type Feed, type Vid,
} from "../lib/yt";
import { pushBack } from "../lib/util";

/* ================= small pieces ================= */
type Page = { k: "home" } | { k: "search"; q: string } | { k: "channel"; chan: Chan };
const CHIPS = ["All", "Music", "Gaming", "Live", "News", "Movies", "Comedy", "Cricket", "Tech", "Cooking"];

const msg = (e: unknown) => {
  const t = e instanceof Error ? e.message : String(e);
  if (/failed to fetch|network|timeout|load failed/i.test(t)) return "Internet ya YouTube se connect nahi hua. Dobara try karo.";
  if (/quota/i.test(t)) return "YouTube ki daily limit khatam. Thodi der baad try karo.";
  return t;
};

async function openExternal(url: string) {
  try {
    if (Capacitor.isNativePlatform()) { await CapApp.openUrl({ url }); return; }
  } catch { /* neeche browser se */ }
  window.open(url, "_blank");
}

function useLoad<T>(key: string | null, loader: () => Promise<T>) {
  const [st, setSt] = useState<{ key: string | null; data?: T; err?: string; loading: boolean }>({ key: null, loading: false });
  const [n, setN] = useState(0);
  const ref = useRef(loader);
  ref.current = loader;
  useEffect(() => {
    if (key === null) return;
    let stop = false;
    setSt({ key, loading: true });
    ref.current().then((data) => { if (!stop) setSt({ key, data, loading: false }); }).catch((e) => { if (!stop) setSt({ key, err: msg(e), loading: false }); });
    return () => { stop = true; };
  }, [key, n]);
  return { data: st.key === key ? st.data : undefined, err: st.key === key ? st.err : undefined, loading: key !== null && (st.key !== key || st.loading), retry: () => setN((x) => x + 1) };
}

function YtLogo() {
  return (
    <span className="flex items-center gap-1" aria-label="YouTube">
      <svg viewBox="0 0 28 20" className="h-5 w-7"><rect width="28" height="20" rx="5.5" fill="#ff0033" /><path d="M11 5.8v8.4L18.5 10 11 5.8Z" fill="#fff" /></svg>
      <span className="text-[1.28rem] font-bold tracking-[-0.06em] text-white" style={{ fontFamily: "Roboto, Arial, sans-serif" }}>YouTube</span>
    </span>
  );
}
function ShortsGlyph({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M10 14.65v-5.3L15 12l-5 2.65Zm7.77-4.33-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25Z" fill="#ff0033" />
      <path d="M10 14.65v-5.3L15 12l-5 2.65Z" fill="#fff" />
    </svg>
  );
}
function Dots({ className = "size-5" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" /></svg>;
}

function Face({ src, name, size = 36 }: { src?: string; name: string; size?: number }) {
  const [bad, setBad] = useState(false);
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  return src && !bad ? (
    <img src={src} alt="" loading="lazy" onError={() => setBad(true)} className="shrink-0 rounded-full bg-[#272727] object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-[#3a3a3a] font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.42 }}>{letter}</span>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-6">
          <div className="aspect-video w-full bg-[#272727]" />
          <div className="flex gap-3 px-3 pt-3">
            <div className="size-9 shrink-0 rounded-full bg-[#272727]" />
            <div className="flex-1 space-y-2"><div className="h-3.5 w-11/12 rounded bg-[#272727]" /><div className="h-3 w-1/2 rounded bg-[#272727]" /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorBox({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="mx-4 mt-10 rounded-2xl bg-[#1f1f1f] p-5 text-center">
      <p className="text-sm text-[#e5e5e5]">{text}</p>
      <button type="button" onClick={onRetry} className="tap mt-4 h-10 rounded-full bg-white px-6 text-sm font-semibold text-black">Retry</button>
    </div>
  );
}

const meta = (v: Vid) => [v.channel, v.views, v.ago].filter(Boolean).join(" · ");

/* ================= cards ================= */
function VideoCard({ v, onPlay, onChannel, onMore }: { v: Vid; onPlay: (v: Vid) => void; onChannel: (v: Vid) => void; onMore: (v: Vid) => void }) {
  return (
    <article className="mb-6">
      <button type="button" className="relative block w-full active:opacity-90" onClick={() => onPlay(v)} aria-label={v.title}>
        <img src={thumbOf(v.id)} alt="" loading="lazy" className="aspect-video w-full bg-[#1a1a1a] object-cover" />
        {v.dur ? <span className="absolute right-2 bottom-2 rounded-md bg-black/80 px-1.5 py-0.5 text-[0.72rem] font-semibold text-white">{v.dur}</span> : null}
      </button>
      <div className="flex gap-3 px-3 pt-3">
        <button type="button" onClick={() => onChannel(v)} aria-label={v.channel}><Face src={v.avatar} name={v.channel || v.title} size={38} /></button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onPlay(v)}>
          <p className="line-clamp-2 text-[0.98rem] leading-[1.3] font-medium text-white">{v.title}</p>
          <p className="mt-1 line-clamp-1 text-[0.78rem] text-[#aaa]">{meta(v)}</p>
        </button>
        <button type="button" onClick={() => onMore(v)} className="-mt-1 grid size-8 shrink-0 place-items-center text-white" aria-label="More"><Dots /></button>
      </div>
    </article>
  );
}

function ShortsShelf({ shorts, onOpen, onMore }: { shorts: Vid[]; onOpen: (i: number) => void; onMore: (v: Vid) => void }) {
  if (!shorts.length) return null;
  return (
    <section className="mb-6 border-y border-white/10 py-3">
      <div className="flex items-center gap-2 px-3 pb-3">
        <ShortsGlyph className="size-7" />
        <h3 className="text-[1.25rem] font-bold text-white">Shorts</h3>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3">
        {shorts.slice(0, 14).map((s, i) => (
          <div key={s.id} className="relative shrink-0" style={{ width: "calc(50vw - 1rem)", maxWidth: 220 }}>
            <button type="button" onClick={() => onOpen(i)} className="relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-[#1a1a1a] active:opacity-90">
              <img src={thumbOf(s.id)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />
              <span className="absolute inset-x-2 bottom-2 text-left">
                <span className="line-clamp-2 block text-[0.9rem] leading-tight font-semibold text-white">{s.title}</span>
                {s.views ? <span className="mt-0.5 block text-[0.72rem] text-white/85">{s.views}</span> : null}
              </span>
            </button>
            <button type="button" onClick={() => onMore(s)} className="absolute top-1 right-1 grid size-8 place-items-center text-white" aria-label="More"><Dots className="size-5 drop-shadow" /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChannelRow({ c, onOpen }: { c: Chan; onOpen: (c: Chan) => void }) {
  return (
    <button type="button" onClick={() => onOpen(c)} className="mb-5 flex w-full items-center gap-4 px-4 text-left active:opacity-80">
      <Face src={c.avatar} name={c.title} size={72} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[1.02rem] font-semibold text-white">{c.title}</span>
        <span className="mt-0.5 block truncate text-[0.78rem] text-[#aaa]">{[c.handle, c.subs].filter(Boolean).join(" · ")}</span>
        {c.desc ? <span className="mt-0.5 line-clamp-1 block text-[0.78rem] text-[#aaa]">{c.desc}</span> : null}
      </span>
    </button>
  );
}

function FeedList({ feed, onPlay, onChannel, onMore, onShorts, onOpenChan, show = "all" }: {
  feed: Feed; onPlay: (v: Vid) => void; onChannel: (v: Vid) => void; onMore: (v: Vid) => void; onShorts: (i: number) => void; onOpenChan: (c: Chan) => void; show?: "all" | "videos" | "shorts" | "channels";
}) {
  const out: ReactNode[] = [];
  if (show === "all" || show === "channels") feed.channels.slice(0, show === "all" ? 2 : 30).forEach((c) => out.push(<ChannelRow key={`c${c.id}`} c={c} onOpen={onOpenChan} />));
  if (show === "shorts" && feed.shorts.length) {
    out.push(
      <div key="sg" className="grid grid-cols-2 gap-2 px-3">
        {feed.shorts.map((s, i) => (
          <button key={s.id} type="button" onClick={() => onShorts(i)} className="relative aspect-[9/16] overflow-hidden rounded-xl bg-[#1a1a1a] text-left">
            <img src={thumbOf(s.id)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent" />
            <span className="absolute inset-x-2 bottom-2 line-clamp-2 text-[0.85rem] leading-tight font-semibold text-white">{s.title}</span>
          </button>
        ))}
      </div>,
    );
  }
  if (show === "all" || show === "videos") {
    feed.videos.forEach((v, i) => {
      out.push(<VideoCard key={v.id} v={v} onPlay={onPlay} onChannel={onChannel} onMore={onMore} />);
      if (show === "all" && i === 2) out.push(<ShortsShelf key="shelf" shorts={feed.shorts} onOpen={onShorts} onMore={onMore} />);
    });
    if (show === "all" && feed.videos.length < 3) out.push(<ShortsShelf key="shelf" shorts={feed.shorts} onOpen={onShorts} onMore={onMore} />);
  }
  if (!out.length) return <p className="px-6 pt-16 text-center text-sm text-[#aaa]">Kuch nahi mila.</p>;
  return <>{out}</>;
}

/* ================= bottom sheet (⋮) ================= */
function MoreSheet({ v, onClose }: { v: Vid; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = watchUrl(v.id);
  const row = "tap flex h-14 w-full items-center gap-4 px-5 text-left text-[0.98rem] text-white active:bg-white/10";
  return (
    <div className="fixed inset-0 z-[90] flex items-end bg-black/60" onClick={onClose}>
      <div className="sheet-up w-full rounded-t-3xl bg-[#212121] pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 mb-2 h-1 w-10 rounded-full bg-white/25" />
        <p className="line-clamp-1 px-5 pb-2 text-sm text-[#aaa]">{v.title}</p>
        <button type="button" className={row} onClick={() => { void Share.share({ title: v.title, url }).catch(() => undefined); onClose(); }}><Share2 className="size-5" /> Share</button>
        <button type="button" className={row} onClick={() => { void navigator.clipboard?.writeText(url).then(() => { setCopied(true); window.setTimeout(onClose, 700); }).catch(() => undefined); }}><Link2 className="size-5" /> {copied ? "Link copied" : "Copy link"}</button>
        <button type="button" className={row} onClick={() => { void openExternal(url); onClose(); }}><ExternalLink className="size-5" /> Open in YouTube app</button>
      </div>
    </div>
  );
}

/* ================= Shorts player ================= */
function ShortsPlayer({ list, start, onClose, onMore }: { list: Vid[]; start: number; onClose: () => void; onMore: (v: Vid) => void }) {
  const [idx, setIdx] = useState(Math.min(start, list.length - 1));
  const [paused, setPaused] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const t0 = useRef<{ x: number; y: number } | null>(null);
  const cur = list[idx];

  useEffect(() => { setPaused(false); addInterest(["shorts"]); }, [idx]);

  const go = (d: number) => setIdx((i) => Math.max(0, Math.min(list.length - 1, i + d)));
  const cmd = (func: string) => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  const toggle = () => { cmd(paused ? "playVideo" : "pauseVideo"); setPaused((p) => !p); };

  const src = `https://www.youtube.com/embed/${cur.id}?autoplay=1&controls=0&loop=1&playlist=${cur.id}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;

  return (
    <div className="fixed inset-0 z-[80] bg-black">
      <div className="absolute inset-0 grid place-items-center">
        <iframe
          ref={frame} key={cur.id} title="Short" src={src} referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="h-full border-0" style={{ width: "min(100vw, calc(100dvh * 9 / 16))" }}
        />
      </div>
      {/* gesture layer: tap = pause/play, swipe = next/prev (iframe ke touches parent tak nahi aate) */}
      <div
        className="absolute inset-0 z-10"
        onTouchStart={(e) => { t0.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const s = t0.current; t0.current = null;
          if (!s) return;
          const dy = s.y - e.changedTouches[0].clientY, dx = s.x - e.changedTouches[0].clientX;
          if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) go(dy > 0 ? 1 : -1);
          else if (Math.abs(dy) < 12 && Math.abs(dx) < 12) toggle();
        }}
        onClick={() => { if (!("ontouchstart" in window)) toggle(); }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-4 pt-16 pb-[max(1.2rem,env(safe-area-inset-bottom))]">
        <p className="line-clamp-2 pr-16 text-[0.98rem] leading-snug font-semibold text-white">{cur.title}</p>
        {cur.views ? <p className="mt-1 text-xs text-white/75">{cur.views}</p> : null}
      </div>
      {paused ? <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center"><span className="grid size-20 place-items-center rounded-full bg-black/45 text-white"><svg viewBox="0 0 24 24" className="size-9 fill-current"><path d="M8 5v14l11-7z" /></svg></span></div> : null}
      <div className="absolute top-[max(0.8rem,env(safe-area-inset-top))] right-3 left-3 z-30 flex items-center justify-between">
        <button type="button" onClick={onClose} className="tap grid size-10 place-items-center rounded-full bg-black/40 text-white" aria-label="Close"><ArrowLeft className="size-5" /></button>
        <button type="button" onClick={() => onMore(cur)} className="tap grid size-10 place-items-center rounded-full bg-black/40 text-white" aria-label="More"><Dots /></button>
      </div>
      <div className="absolute right-3 bottom-[28%] z-30 flex flex-col gap-3">
        <button type="button" disabled={idx === 0} onClick={() => go(-1)} className="tap grid size-11 place-items-center rounded-full bg-black/40 text-white disabled:opacity-30" aria-label="Previous"><ChevronUp className="size-6" /></button>
        <button type="button" disabled={idx >= list.length - 1} onClick={() => go(1)} className="tap grid size-11 place-items-center rounded-full bg-black/40 text-white disabled:opacity-30" aria-label="Next"><ChevronDown className="size-6" /></button>
      </div>
    </div>
  );
}

/* ================= Watch page ================= */
function WatchPage({ v, fallback, onClose, onPlay, onChannel, onMore }: {
  v: Vid; fallback: Vid[]; onClose: () => void; onPlay: (v: Vid) => void; onChannel: (v: Vid) => void; onMore: (v: Vid) => void;
}) {
  const [info, setInfo] = useState<{ related: Vid[]; title?: string; channel?: string; channelId?: string } | null>(null);
  useEffect(() => {
    setInfo(null);
    let stop = false;
    relatedYt(v.id).then((r) => { if (!stop) setInfo(r); }).catch(() => { if (!stop) setInfo({ related: [] }); });
    return () => { stop = true; };
  }, [v.id]);
  const title = v.title || info?.title || "Video";
  const channel = v.channel || info?.channel || "";
  const channelId = v.channelId || info?.channelId;
  const related = (info?.related.length ? info.related : fallback).filter((x) => x.id !== v.id && !x.short).slice(0, 25);
  const src = `https://www.youtube.com/embed/${v.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
  const url = watchUrl(v.id);
  const pill = "tap flex h-9 shrink-0 items-center gap-2 rounded-full bg-[#272727] px-4 text-[0.82rem] font-semibold text-white";
  return (
    <div className="sheet-up safe-top fixed inset-0 z-[70] flex flex-col bg-[#0f0f0f] text-white">
      <div className="relative aspect-video w-full shrink-0 bg-black">
        <iframe title="YouTube" src={src} referrerPolicy="strict-origin-when-cross-origin" className="h-full w-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        <button type="button" onClick={onClose} className="tap absolute top-2 left-2 grid size-9 place-items-center rounded-full bg-black/55 text-white" aria-label="Back"><ArrowLeft className="size-5" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        <div className="px-3 pt-3">
          <h2 className="text-[1.05rem] leading-snug font-semibold">{title}</h2>
          <p className="mt-1 text-[0.8rem] text-[#aaa]">{[v.views, v.ago].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex items-center gap-3 px-3 pt-4">
          <button type="button" onClick={() => onChannel({ ...v, channel, channelId })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <Face src={v.avatar} name={channel || title} size={40} />
            <span className="min-w-0"><span className="block truncate text-[0.95rem] font-semibold">{channel || "Channel"}</span></span>
          </button>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pt-4 pb-1">
          <button type="button" className={pill} onClick={() => void Share.share({ title, url }).catch(() => undefined)}><Share2 className="size-4" /> Share</button>
          <button type="button" className={pill} onClick={() => void navigator.clipboard?.writeText(url).catch(() => undefined)}><Link2 className="size-4" /> Copy link</button>
          <button type="button" className={pill} onClick={() => void openExternal(url)}><ExternalLink className="size-4" /> Open in YouTube</button>
        </div>
        <p className="px-3 pt-2 text-[0.7rem] text-[#777]">Video play na ho to “Open in YouTube” dabao.</p>
        <div className="mt-4 border-t border-white/10 pt-4">
          {info === null && !fallback.length ? <Skeleton /> : related.map((r) => <VideoCard key={r.id} v={r} onPlay={onPlay} onChannel={onChannel} onMore={onMore} />)}
        </div>
      </div>
    </div>
  );
}

/* ================= Main ================= */
export function YoutubeView({ apiKey, onClose }: { apiKey?: string; onClose: () => void }) {
  const key = (apiKey ?? "").trim();
  const [stack, setStack] = useState<Page[]>([{ k: "home" }]);
  const page = stack[stack.length - 1];
  const [chip, setChip] = useState("All");
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<"all" | "videos" | "shorts" | "channels">("all");
  const [playing, setPlaying] = useState<Vid | null>(null);
  const [shorts, setShorts] = useState<{ list: Vid[]; start: number } | null>(null);
  const [sheet, setSheet] = useState<Vid | null>(null);
  const [recent, setRecent] = useState<string[]>(getRecent);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /* data */
  const home = useLoad<Feed>(page.k === "home" ? `home:${chip}` : null, () => (chip === "All" ? homeFeed(getInterests(), key) : searchYt(chip, key)));
  const search = useLoad<Feed>(page.k === "search" ? `q:${page.q}` : null, () => searchYt((page as { q: string }).q, key));
  const chanKey = page.k === "channel" ? `c:${page.chan.id}` : null;
  const chanVids = useLoad<Vid[]>(chanKey, () => channelVideos((page as { chan: Chan }).chan.id, key));
  const [chanExtra, setChanExtra] = useState<Chan | null>(null);
  useEffect(() => {
    setChanExtra(null);
    if (page.k !== "channel") return;
    let stop = false;
    void channelInfo(page.chan.id, key).then((c) => { if (!stop && c) setChanExtra(c); });
    return () => { stop = true; };
  }, [chanKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const homeData = home.data ?? EMPTY_FEED;

  /* back button */
  const back = useRef<() => void>(() => undefined);
  back.current = () => {
    if (sheet) setSheet(null);
    else if (shorts) setShorts(null);
    else if (playing) setPlaying(null);
    else if (typing) setTyping(false);
    else if (stack.length > 1) setStack((s) => s.slice(0, -1));
    else onClose();
  };
  useEffect(() => pushBack(() => back.current()), []);

  /* actions */
  function openShorts(list: Vid[], start: number) { setShorts({ list, start }); }
  function playVid(v: Vid) {
    if (v.short) { openShorts([v], 0); return; }
    if (v.title) addInterest(v.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 4));
    setPlaying(v);
  }
  function runSearch(raw: string) {
    const q = raw.trim();
    setNotice("");
    if (!q) return;
    const id = extractId(q);
    if (id) { setTyping(false); setPlaying({ id, title: "", channel: "", short: false }); return; }
    if (!Capacitor.isNativePlatform() && !key) { setNotice("Search ke liye phone app use karo ya Admin API key set karo. Link / video ID paste karke play kar sakte ho."); return; }
    addRecent(q);
    setRecent(getRecent());
    addInterest(q.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
    setText(q);
    setTyping(false);
    setFilter("all");
    setStack((s) => (s[s.length - 1].k === "search" ? [...s.slice(0, -1), { k: "search", q }] : [...s, { k: "search", q }]));
  }
  function openChannelFromVid(v: Vid) {
    if (!v.channelId) { if (v.channel) { setPlaying(null); runSearch(v.channel); } return; }
    setPlaying(null);
    setStack((s) => [...s, { k: "channel", chan: { id: v.channelId!, title: v.channel, avatar: v.avatar ?? "" } }]);
  }
  function openChan(c: Chan) { setStack((s) => [...s, { k: "channel", chan: c }]); }

  useEffect(() => { if (typing) window.setTimeout(() => inputRef.current?.focus(), 60); }, [typing]);

  const cbs = { onPlay: playVid, onChannel: openChannelFromVid, onMore: setSheet, onOpenChan: openChan };
  const filters = useMemo(() => [["all", "All"], ["videos", "Videos"], ["shorts", "Shorts"], ["channels", "Channels"]] as const, []);

  /* ---------- header ---------- */
  const isHome = page.k === "home";
  const header = typing ? (
    <header className="flex h-14 shrink-0 items-center gap-2 px-2">
      <button type="button" className="tap grid size-10 place-items-center rounded-full text-white" aria-label="Back" onClick={() => setTyping(false)}><ArrowLeft className="size-5" /></button>
      <form className="flex h-10 min-w-0 flex-1 items-center rounded-full bg-[#272727] pr-1 pl-4" onSubmit={(e) => { e.preventDefault(); runSearch(text); }}>
        <input ref={inputRef} className="min-w-0 flex-1 bg-transparent text-[0.98rem] text-white outline-none placeholder:text-[#999]" placeholder="Search YouTube" enterKeyHint="search" value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="none" autoCorrect="off" />
        {text ? <button type="button" aria-label="Clear" className="grid size-8 place-items-center text-white" onClick={() => { setText(""); inputRef.current?.focus(); }}><X className="size-4" /></button> : null}
      </form>
      <button type="button" aria-label="Search" className="tap grid size-10 place-items-center rounded-full text-white" onClick={() => runSearch(text)}><Search className="size-5" /></button>
    </header>
  ) : (
    <header className="flex h-14 shrink-0 items-center gap-1 px-2 pl-3">
      {isHome ? (
        <YtLogo />
      ) : (
        <button type="button" className="tap grid size-10 place-items-center rounded-full text-white" aria-label="Back" onClick={() => back.current()}><ArrowLeft className="size-5" /></button>
      )}
      {page.k === "search" ? (
        <button type="button" onClick={() => { setText(page.q); setTyping(true); }} className="mx-1 flex h-10 min-w-0 flex-1 items-center rounded-full bg-[#272727] px-4 text-left text-[0.95rem] text-white"><span className="truncate">{page.q}</span></button>
      ) : page.k === "channel" ? (
        <p className="min-w-0 flex-1 truncate px-2 text-[1.02rem] font-semibold text-white">{page.chan.title}</p>
      ) : <span className="flex-1" />}
      {page.k !== "search" ? <button type="button" className="tap grid size-10 place-items-center rounded-full text-white" aria-label="Search" onClick={() => { setText(""); setTyping(true); }}><Search className="size-[1.4rem]" /></button> : null}
      <button type="button" className="tap grid size-10 place-items-center rounded-full text-white" aria-label="Close YouTube" onClick={onClose}><X className="size-[1.4rem]" /></button>
    </header>
  );

  /* ---------- body ---------- */
  let body: ReactNode;
  if (typing) {
    const q = text.trim().toLowerCase();
    const list = q ? recent.filter((r) => r.toLowerCase().includes(q)) : recent;
    body = (
      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        {notice ? <p className="mx-4 mt-2 rounded-xl bg-[#272727] px-3 py-2 text-sm text-[#e5e5e5]">{notice}</p> : null}
        {q ? (
          <button type="button" className="tap flex h-12 w-full items-center gap-4 px-4 text-left text-white active:bg-white/10" onClick={() => runSearch(text)}>
            <Search className="size-5 text-[#aaa]" /><span className="min-w-0 flex-1 truncate">{text}</span><ArrowUpLeft className="size-5 text-[#aaa]" />
          </button>
        ) : null}
        {list.map((r) => (
          <div key={r} className="flex h-12 items-center active:bg-white/10">
            <button type="button" className="tap flex min-w-0 flex-1 items-center gap-4 px-4 text-left text-white" onClick={() => runSearch(r)}><History className="size-5 shrink-0 text-[#aaa]" /><span className="truncate">{r}</span></button>
            <button type="button" aria-label="Edit" className="grid size-12 place-items-center text-[#aaa]" onClick={() => { setText(r); inputRef.current?.focus(); }}><ArrowUpLeft className="size-5" /></button>
          </div>
        ))}
        {recent.length && !q ? <button type="button" className="tap mt-2 px-4 py-2 text-sm text-[#3ea6ff]" onClick={() => { clearRecent(); setRecent([]); }}>Clear search history</button> : null}
        {!recent.length && !q ? <p className="px-6 pt-14 text-center text-sm text-[#aaa]">Video, channel ya Shorts search karo. YouTube link bhi paste kar sakte ho.</p> : null}
      </div>
    );
  } else if (page.k === "home") {
    body = (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="no-scrollbar sticky top-0 z-10 flex gap-2 overflow-x-auto bg-[#0f0f0f] px-3 pt-1 pb-3">
          {CHIPS.map((c) => (
            <button key={c} type="button" onClick={() => setChip(c)} className={`tap h-8 shrink-0 rounded-lg px-3 text-[0.85rem] font-medium ${chip === c ? "bg-white text-black" : "bg-[#272727] text-white"}`}>{c}</button>
          ))}
        </div>
        <div className="pb-24 pt-1">
          {home.loading ? <Skeleton /> : home.err ? <ErrorBox text={home.err} onRetry={home.retry} /> : (
            <FeedList feed={homeData} {...cbs} onShorts={(i) => openShorts(homeData.shorts, i)} show="all" />
          )}
        </div>
      </div>
    );
  } else if (page.k === "search") {
    const f = search.data ?? EMPTY_FEED;
    body = (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="no-scrollbar sticky top-0 z-10 flex gap-2 overflow-x-auto bg-[#0f0f0f] px-3 pt-1 pb-3">
          {filters.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={`tap h-8 shrink-0 rounded-lg px-3 text-[0.85rem] font-medium ${filter === id ? "bg-white text-black" : "bg-[#272727] text-white"}`}>{label}</button>
          ))}
        </div>
        <div className="pb-24 pt-1">
          {search.loading ? <Skeleton /> : search.err ? <ErrorBox text={search.err} onRetry={search.retry} /> : (
            <FeedList feed={f} {...cbs} show={filter} onShorts={(i) => openShorts(f.shorts, i)} />
          )}
        </div>
      </div>
    );
  } else {
    const c = chanExtra ?? page.chan;
    const vids = chanVids.data ?? [];
    body = (
      <div className="min-h-0 flex-1 overflow-y-auto pb-24">
        <div className="flex flex-col items-center px-6 pt-4 pb-5 text-center">
          <Face src={c.avatar} name={c.title} size={84} />
          <h2 className="mt-3 text-[1.3rem] font-bold text-white">{c.title}</h2>
          <p className="mt-1 text-[0.8rem] text-[#aaa]">{[c.handle, c.subs].filter(Boolean).join(" · ")}</p>
          {c.desc ? <p className="mt-2 line-clamp-2 max-w-sm text-[0.8rem] text-[#aaa]">{c.desc}</p> : null}
          <button type="button" onClick={() => void openExternal(`https://www.youtube.com/channel/${page.chan.id}`)} className="tap mt-4 flex h-9 items-center gap-2 rounded-full bg-white px-5 text-[0.85rem] font-semibold text-black"><ExternalLink className="size-4" /> Open channel</button>
        </div>
        <p className="border-b border-white/10 px-4 pb-2 text-[0.9rem] font-semibold text-white">Videos</p>
        <div className="pt-4">
          {chanVids.loading ? <Skeleton /> : chanVids.err ? <ErrorBox text={chanVids.err} onRetry={chanVids.retry} /> : vids.length === 0 ? <p className="px-6 pt-10 text-center text-sm text-[#aaa]">Is channel ke videos nahi mile.</p> : vids.map((v) => (
            <VideoCard key={v.id} v={{ ...v, avatar: v.avatar ?? c.avatar, channel: v.channel || c.title }} onPlay={playVid} onChannel={() => undefined} onMore={setSheet} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sheet-up safe-top fixed inset-0 z-[60] flex flex-col bg-[#0f0f0f] text-white" style={{ colorScheme: "dark" }}>
        {header}
        {body}
      </div>
      {playing ? <WatchPage v={playing} fallback={homeData.videos} onClose={() => setPlaying(null)} onPlay={playVid} onChannel={openChannelFromVid} onMore={setSheet} /> : null}
      {shorts ? <ShortsPlayer list={shorts.list} start={shorts.start} onClose={() => setShorts(null)} onMore={setSheet} /> : null}
      {sheet ? <MoreSheet v={sheet} onClose={() => setSheet(null)} /> : null}
    </>
  );
}
