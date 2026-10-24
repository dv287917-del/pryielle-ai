import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronUp, Clock, MoreVertical, Search, X } from "lucide-react";
import { pushBack } from "../lib/util";
import { TubeIcon } from "./Brand";

/* ───────── types ───────── */
type Hit = {
  id: string; title: string; thumb: string; channel: string; channelId: string; avatar: string;
  kind: "video" | "short"; duration: string; views: number; at: string;
};
type Chan = { id: string; title: string; thumb: string; subs: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const INTEREST_KEY = "yt-interests";
const HISTORY_KEY = "yt-recent-search";
const FEED_KEY = "yt-feed-cache";
const CHIPS = ["All", "Music", "Gaming", "Live", "Comedy", "News", "Tech", "Movies", "Cricket", "Cooking", "Podcasts"];

/* ───────── small helpers ───────── */
const read = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const addInterest = (terms: string[]) => write(INTEREST_KEY, [...new Set([...terms, ...read<string[]>(INTEREST_KEY, [])])].slice(0, 24));
const addRecent = (q: string) => write(HISTORY_KEY, [q, ...read<string[]>(HISTORY_KEY, []).filter((x) => x !== q)].slice(0, 12));

function fmtCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}
function ago(iso: string): string {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  const t: [number, string][] = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hr"], [60, "min"]];
  for (const [sec, name] of t) if (s >= sec) { const v = Math.floor(s / sec); return name === "hr" || name === "min" ? `${v} ${name} ago` : `${v} ${name}${v > 1 ? "s" : ""} ago`; }
  return "just now";
}
function parseDur(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return +(m[1] ?? 0) * 3600 + +(m[2] ?? 0) * 60 + +(m[3] ?? 0);
}
function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function extractId(raw: string): string | null {
  const s = raw.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1, 12);
    const v = u.searchParams.get("v");
    if (v) return v.slice(0, 11);
    const parts = u.pathname.split("/");
    for (const key of ["shorts", "embed", "live"]) { const i = parts.indexOf(key); if (i >= 0 && parts[i + 1]) return parts[i + 1].slice(0, 11); }
  } catch { /* not a url */ }
  return null;
}

/* ───────── API ───────── */
async function api(path: string, params: Record<string, string | number>, key: string): Promise<Json> {
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), key });
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${qs}`);
  const j = (await r.json()) as Json;
  if (!r.ok) {
    const reason = j?.error?.errors?.[0]?.reason as string | undefined;
    if (reason === "quotaExceeded") throw new Error("YouTube ki aaj ki search limit khatam. Kal phir chalega (ya Admin naya API key lagaye).");
    if (reason === "keyInvalid" || reason === "forbidden") throw new Error("YouTube API key galat / band hai. Admin panel mein key check karo.");
    throw new Error(j?.error?.message || `HTTP ${r.status}`);
  }
  return j;
}

/** ids → full Hit objects (views, duration, channel avatar). Non-embeddable videos are dropped. */
async function enrich(ids: string[], key: string): Promise<Hit[]> {
  const clean = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (!clean.length) return [];
  const v = await api("videos", { part: "snippet,contentDetails,statistics,status", id: clean.join(","), maxResults: 50 }, key);
  return mapVideos(v.items ?? [], key);
}
async function mapVideos(items: Json[], key: string): Promise<Hit[]> {
  const chIds = [...new Set(items.map((i) => i.snippet?.channelId as string).filter(Boolean))].slice(0, 50);
  const av: Record<string, string> = {};
  if (chIds.length) {
    try {
      const c = await api("channels", { part: "snippet", id: chIds.join(","), maxResults: 50 }, key);
      for (const ch of c.items ?? []) av[ch.id] = ch.snippet?.thumbnails?.default?.url ?? "";
    } catch { /* avatars are optional */ }
  }
  return items
    .filter((i) => i.status?.embeddable !== false && i.snippet?.liveBroadcastContent !== "upcoming")
    .map((i): Hit => {
      const sec = parseDur(i.contentDetails?.duration ?? "");
      const th = i.snippet?.thumbnails ?? {};
      const tags = `${i.snippet?.title ?? ""}`.toLowerCase();
      return {
        id: String(i.id), title: decode(i.snippet?.title ?? "Video"), channel: decode(i.snippet?.channelTitle ?? ""),
        channelId: i.snippet?.channelId ?? "", avatar: av[i.snippet?.channelId] ?? "",
        thumb: (th.maxres ?? th.standard ?? th.high ?? th.medium ?? th.default)?.url ?? "",
        kind: (sec > 0 && sec <= 60) || tags.includes("#shorts") ? "short" : "video",
        duration: i.snippet?.liveBroadcastContent === "live" ? "LIVE" : sec ? fmtDur(sec) : "",
        views: Number(i.statistics?.viewCount ?? 0), at: i.snippet?.publishedAt ?? "",
      };
    });
}

async function searchAll(q: string, key: string): Promise<{ chans: Chan[]; hits: Hit[] }> {
  const [vs, cs] = await Promise.all([
    api("search", { part: "snippet", type: "video", videoEmbeddable: "true", maxResults: 30, regionCode: "IN", safeSearch: "none", q }, key),
    api("search", { part: "snippet", type: "channel", maxResults: 3, regionCode: "IN", q }, key).catch(() => ({ items: [] })),
  ]);
  const hits = await enrich((vs.items ?? []).map((i: Json) => i.id?.videoId as string), key);
  let chans: Chan[] = [];
  const cids = (cs.items ?? []).map((i: Json) => i.id?.channelId as string).filter(Boolean);
  if (cids.length) {
    try {
      const c = await api("channels", { part: "snippet,statistics", id: cids.join(",") }, key);
      chans = (c.items ?? []).map((ch: Json): Chan => ({
        id: ch.id, title: decode(ch.snippet?.title ?? ""), thumb: ch.snippet?.thumbnails?.medium?.url ?? ch.snippet?.thumbnails?.default?.url ?? "",
        subs: ch.statistics?.hiddenSubscriberCount ? "" : `${fmtCount(Number(ch.statistics?.subscriberCount ?? 0))} subscribers`,
      }));
      // best match first: a channel whose name equals the query
      chans.sort((a, b) => Number(b.title.toLowerCase() === q.toLowerCase()) - Number(a.title.toLowerCase() === q.toLowerCase()));
    } catch { /* ignore */ }
  }
  return { chans, hits };
}

async function channelVideos(chId: string, key: string): Promise<Hit[]> {
  const uploads = `UU${chId.slice(2)}`;
  const p = await api("playlistItems", { part: "contentDetails", playlistId: uploads, maxResults: 40 }, key);
  return enrich((p.items ?? []).map((i: Json) => i.contentDetails?.videoId as string), key);
}

async function loadFeed(key: string): Promise<Hit[]> {
  const cached = read<{ t: number; hits: Hit[] } | null>(FEED_KEY, null);
  if (cached && Date.now() - cached.t < 20 * 60_000 && cached.hits.length) return cached.hits;
  const interests = read<string[]>(INTEREST_KEY, []);
  const jobs: Promise<Hit[]>[] = [
    api("videos", { part: "snippet,contentDetails,statistics,status", chart: "mostPopular", regionCode: "IN", maxResults: 30 }, key).then((v) => mapVideos(v.items ?? [], key)),
  ];
  if (interests.length) {
    jobs.push(
      api("search", { part: "snippet", type: "video", videoEmbeddable: "true", maxResults: 25, regionCode: "IN", q: interests.slice(0, 3).join(" ") }, key)
        .then((r) => enrich((r.items ?? []).map((i: Json) => i.id?.videoId as string), key)),
    );
  }
  const res = await Promise.allSettled(jobs);
  const lists = res.map((r) => (r.status === "fulfilled" ? r.value : []));
  if (!lists.some((l) => l.length) && res[0].status === "rejected") throw (res[0] as PromiseRejectedResult).reason;
  const seen = new Set<string>();
  const merged: Hit[] = [];
  const pop = lists[0] ?? [];
  const mine = lists[1] ?? [];
  const order: Hit[] = [];
  for (let i = 0; i < Math.max(pop.length, mine.length); i++) { if (mine[i]) order.push(mine[i]); if (pop[i]) order.push(pop[i]); }
  for (const h of order) if (!seen.has(h.id)) { seen.add(h.id); merged.push(h); }
  write(FEED_KEY, { t: Date.now(), hits: merged });
  return merged;
}

async function suggest(q: string): Promise<string[]> {
  try {
    const r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=en&q=${encodeURIComponent(q)}`);
    const j = (await r.json()) as [string, string[]];
    return (j[1] ?? []).slice(0, 7);
  } catch { return []; }
}

/* ───────── pieces ───────── */
function Avatar({ src, name, size = 40 }: { src: string; name: string; size?: number }) {
  return src
    ? <img src={src} alt="" className="shrink-0 rounded-full bg-white/10 object-cover" style={{ width: size, height: size }} />
    : <span className="grid shrink-0 place-items-center rounded-full bg-white/15 font-bold" style={{ width: size, height: size }}>{(name[0] ?? "?").toUpperCase()}</span>;
}

function VideoCard({ h, onPlay, onChannel }: { h: Hit; onPlay: () => void; onChannel: () => void }) {
  return (
    <li className="mb-5">
      <button type="button" className="tap relative block aspect-video w-full overflow-hidden bg-white/10 text-left" onClick={onPlay}>
        {h.thumb ? <img src={h.thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
        {h.duration ? <span className={`absolute right-2 bottom-2 rounded-md px-1.5 py-0.5 text-xs font-bold ${h.duration === "LIVE" ? "bg-red-600" : "bg-black/75"}`}>{h.duration}</span> : null}
      </button>
      <div className="flex gap-3 px-3 pt-3">
        <button type="button" className="tap self-start" aria-label={h.channel} onClick={onChannel}><Avatar src={h.avatar} name={h.channel} /></button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onPlay}>
          <span className="line-clamp-2 text-[1.02rem] leading-snug font-medium">{h.title}</span>
          <span className="mt-1 block truncate text-[0.82rem] text-white/55">{h.channel}{h.views ? ` · ${fmtCount(h.views)} views` : ""}{h.at ? ` · ${ago(h.at)}` : ""}</span>
        </button>
        <MoreVertical className="mt-1 size-5 shrink-0 text-white/70" />
      </div>
    </li>
  );
}

function ShortsShelf({ shorts, onOpen }: { shorts: Hit[]; onOpen: (i: number) => void }) {
  if (!shorts.length) return null;
  return (
    <li className="mb-6 border-y border-white/10 py-4">
      <p className="mb-3 flex items-center gap-2 px-3 text-xl font-bold"><span className="grid size-7 place-items-center rounded-lg bg-red-600 text-sm">▶</span> Shorts</p>
      <div className="yt-scroll flex gap-2.5 overflow-x-auto px-3">
        {shorts.slice(0, 12).map((h, i) => (
          <button key={h.id} type="button" className="tap relative aspect-[9/16] w-[43%] shrink-0 overflow-hidden rounded-2xl bg-white/10 text-left" onClick={() => onOpen(i)}>
            {h.thumb ? <img src={h.thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <span className="absolute inset-x-2.5 bottom-2.5">
              <span className="line-clamp-2 text-[0.95rem] leading-tight font-semibold">{h.title}</span>
              <span className="mt-1 block text-xs text-white/75">{h.views ? `${fmtCount(h.views)} views` : ""}</span>
            </span>
          </button>
        ))}
      </div>
    </li>
  );
}

function ShortsPlayer({ list, start, onClose }: { list: Hit[]; start: number; onClose: () => void }) {
  const [idx, setIdx] = useState(start);
  const y0 = useRef(0);
  const cur = list[idx];
  const next = () => setIdx((i) => Math.min(list.length - 1, i + 1));
  const prev = () => setIdx((i) => Math.max(0, i - 1));
  useEffect(() => { addInterest(["shorts"]); }, [idx]);
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { y0.current = e.touches[0].clientY; },
    onTouchEnd: (e: React.TouchEvent) => { const d = y0.current - e.changedTouches[0].clientY; if (d > 50) next(); else if (d < -50) prev(); },
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black text-white">
      <div className="relative mx-auto h-full w-full max-w-[480px]">
        <iframe key={cur.id} title="Short" className="absolute inset-0 h-full w-full" src={`https://www.youtube.com/embed/${cur.id}?autoplay=1&loop=1&playlist=${cur.id}&rel=0&modestbranding=1&playsinline=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        {/* the iframe swallows touches, so the edges catch the swipe */}
        <div className="absolute inset-y-16 left-0 w-[14%]" {...swipe} />
        <div className="absolute inset-y-16 right-0 w-[20%]" {...swipe} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pr-[22%] pb-6">
          <p className="line-clamp-2 text-sm font-semibold">{cur.title}</p>
          <p className="mt-0.5 text-xs text-white/70">{cur.channel}</p>
        </div>
        <button type="button" className="tap absolute top-[max(1rem,env(safe-area-inset-top))] left-3 grid size-10 place-items-center rounded-full bg-black/55" aria-label="Close" onClick={onClose}><X className="size-5" /></button>
        <div className="absolute right-2 bottom-24 flex flex-col items-center gap-3">
          <button type="button" disabled={idx === 0} className="tap grid size-11 place-items-center rounded-full bg-black/55 disabled:opacity-30" aria-label="Previous" onClick={prev}><ChevronUp className="size-6" /></button>
          <button type="button" disabled={idx === list.length - 1} className="tap grid size-11 place-items-center rounded-full bg-black/55 disabled:opacity-30" aria-label="Next" onClick={next}><ChevronDown className="size-6" /></button>
        </div>
      </div>
    </div>
  );
}

/* ───────── main ───────── */
export function YoutubeView({ apiKey, onClose }: { apiKey?: string; onClose: () => void }) {
  const key = apiKey || "";
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [sugg, setSugg] = useState<string[]>([]);
  const [chip, setChip] = useState("All");
  const [mode, setMode] = useState<"feed" | "search" | "channel">("feed");
  const [feed, setFeed] = useState<Hit[]>([]);
  const [results, setResults] = useState<Hit[]>([]);
  const [chans, setChans] = useState<Chan[]>([]);
  const [channel, setChannel] = useState<{ c: Chan; hits: Hit[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [playing, setPlaying] = useState<Hit | null>(null);
  const [shorts, setShorts] = useState<{ list: Hit[]; start: number } | null>(null);
  const reqId = useRef(0);

  const loadFeedNow = useCallback(() => {
    if (!key) return;
    setBusy(true); setErr("");
    loadFeed(key).then(setFeed).catch((e) => setErr(String((e as Error).message ?? e))).finally(() => setBusy(false));
  }, [key]);
  useEffect(() => { loadFeedNow(); }, [loadFeedNow]);

  // autocomplete (debounced, silently skipped if the network blocks it)
  useEffect(() => {
    if (!focus || q.trim().length < 2) { setSugg([]); return; }
    const t = window.setTimeout(() => void suggest(q.trim()).then(setSugg), 220);
    return () => window.clearTimeout(t);
  }, [q, focus]);

  const run = useCallback(async (term: string) => {
    const text = term.trim();
    setErr(""); setFocus(false); setSugg([]);
    const id = extractId(text);
    if (id) {
      if (key) { try { const [h] = await enrich([id], key); if (h) { setPlaying(h); return; } } catch { /* fall through */ } }
      setPlaying({ id, title: "", thumb: "", channel: "", channelId: "", avatar: "", kind: "video", duration: "", views: 0, at: "" });
      return;
    }
    if (text.length < 2) return;
    if (!key) { setErr("Search ke liye Admin ko YouTube API key set karni hogi. Tab tak link / video ID paste karo."); return; }
    const my = ++reqId.current;
    setBusy(true); setMode("search"); addRecent(text);
    try {
      const r = await searchAll(text, key);
      if (my !== reqId.current) return;
      setResults(r.hits); setChans(r.chans);
      addInterest(text.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 3));
      if (!r.hits.length && !r.chans.length) setErr("Kuch nahi mila. Spelling check karo ya doosra word try karo.");
    } catch (e) { if (my === reqId.current) setErr(String((e as Error).message ?? e)); }
    finally { if (my === reqId.current) setBusy(false); }
  }, [key]);

  const openChannel = useCallback(async (c: Chan) => {
    if (!key) return;
    setMode("channel"); setChannel({ c, hits: [] }); setBusy(true); setErr(""); setPlaying(null);
    try { setChannel({ c, hits: await channelVideos(c.id, key) }); }
    catch (e) { setErr(String((e as Error).message ?? e)); }
    finally { setBusy(false); }
  }, [key]);

  const list = mode === "search" ? results : mode === "channel" ? channel?.hits ?? [] : feed;
  const longs = useMemo(() => list.filter((h) => h.kind === "video"), [list]);
  const shortList = useMemo(() => list.filter((h) => h.kind === "short"), [list]);
  const recents = read<string[]>(HISTORY_KEY, []);

  function play(h: Hit) {
    addInterest(h.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 4));
    setPlaying(h);
  }
  function openChannelOf(h: Hit) { if (h.channelId) void openChannel({ id: h.channelId, title: h.channel, thumb: h.avatar, subs: "" }); }
  function pickChip(c: string) {
    setChip(c);
    if (c === "All") { setQ(""); setMode("feed"); setErr(""); return; }
    setQ(c); void run(c);
  }
  function goFeed() { setMode("feed"); setChip("All"); setQ(""); setErr(""); }

  // Android back: short → player → channel/search → close
  const st = useRef({ shorts, playing, mode });
  st.current = { shorts, playing, mode };
  useEffect(() => pushBack(() => {
    const s = st.current;
    if (s.shorts) setShorts(null);
    else if (s.playing) setPlaying(null);
    else if (s.mode !== "feed") goFeed();
    else onClose();
  }), [shorts, playing, mode, onClose]);

  const upNext = longs.filter((h) => h.id !== playing?.id).slice(0, 25);
  const showSuggest = focus && !playing;

  return (
    <>
      {shorts ? <ShortsPlayer list={shorts.list} start={shorts.start} onClose={() => setShorts(null)} /> : null}

      <div className="sheet-up safe-top fixed inset-0 z-[60] flex flex-col bg-[#0f0f0f] text-white">
        <header className="flex shrink-0 items-center gap-2 px-2 py-2">
          <button type="button" className="tap grid size-10 shrink-0 place-items-center rounded-full" aria-label="Back" onClick={() => (playing ? setPlaying(null) : mode !== "feed" ? goFeed() : onClose())}>
            {playing || mode !== "feed" ? <ChevronLeft className="size-6" /> : <X className="size-5" />}
          </button>
          {playing ? (
            <p className="flex items-center gap-1.5 font-display text-xl font-bold"><TubeIcon className="size-7 text-red-500" strokeWidth={2} /> YouTube</p>
          ) : (
            <form className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/10 px-4" onSubmit={(e) => { e.preventDefault(); void run(q); }}>
              <Search className="size-4 shrink-0 text-white/60" />
              <input className="h-10 min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-white/45" placeholder="Search YouTube / paste link" value={q} enterKeyHint="search"
                onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => window.setTimeout(() => setFocus(false), 150)} />
              {q ? <button type="button" aria-label="Clear" onClick={() => setQ("")}><X className="size-4 text-white/60" /></button> : null}
            </form>
          )}
        </header>

        {!playing && mode !== "channel" ? (
          <div className="yt-scroll flex shrink-0 gap-2 overflow-x-auto px-3 pb-2">
            {CHIPS.map((c) => <button key={c} type="button" className={`yt-chip tap ${chip === c ? "yt-chip-on" : ""}`} onClick={() => pickChip(c)}>{c}</button>)}
          </div>
        ) : null}

        {showSuggest && (q ? sugg : recents).length ? (
          <ul className="absolute inset-x-0 top-[3.4rem] z-10 max-h-[60dvh] overflow-y-auto bg-[#0f0f0f] pb-2 shadow-2xl" style={{ marginTop: "env(safe-area-inset-top)" }}>
            {(q ? sugg : recents).map((s) => (
              <li key={s}>
                <button type="button" className="tap flex w-full items-center gap-4 px-4 py-3 text-left" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(s); void run(s); }}>
                  {q ? <Search className="size-5 text-white/60" /> : <Clock className="size-5 text-white/60" />}<span className="truncate">{s}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {playing ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="aspect-video w-full shrink-0 bg-black">
              <iframe key={playing.id} title="YouTube" className="h-full w-full" src={`https://www.youtube.com/embed/${playing.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-10">
              {playing.title ? (
                <div className="px-3 pt-3 pb-4">
                  <p className="text-[1.1rem] leading-snug font-semibold">{playing.title}</p>
                  <p className="mt-1 text-[0.82rem] text-white/55">{playing.views ? `${fmtCount(playing.views)} views` : ""}{playing.at ? ` · ${ago(playing.at)}` : ""}</p>
                  <button type="button" className="tap mt-3 flex items-center gap-3" onClick={() => openChannelOf(playing)}>
                    <Avatar src={playing.avatar} name={playing.channel} size={36} /><span className="font-semibold">{playing.channel}</span>
                  </button>
                </div>
              ) : null}
              {upNext.length ? <p className="px-3 pb-3 text-sm font-bold tracking-wider text-white/50">UP NEXT</p> : null}
              <ul>{upNext.map((h) => <VideoCard key={h.id} h={h} onPlay={() => play(h)} onChannel={() => openChannelOf(h)} />)}</ul>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pb-10" onScroll={() => setFocus(false)}>
            {!key ? <p className="mx-3 mb-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">YouTube API key set nahi hai. Admin mein key daalo, tab search + feed chalega. Abhi sirf link / video ID paste karke chala sakte ho.</p> : null}
            {err ? (
              <div className="mx-3 mb-3 rounded-2xl bg-red-500/15 px-3 py-2.5 text-sm text-red-200">
                {err}
                {mode === "feed" && key ? <button type="button" className="tap mt-2 block font-semibold text-white underline" onClick={loadFeedNow}>Retry</button> : null}
              </div>
            ) : null}

            {mode === "channel" && channel ? (
              <div className="flex flex-col items-center px-4 pt-2 pb-5 text-center">
                <Avatar src={channel.c.thumb} name={channel.c.title} size={84} />
                <p className="mt-3 text-2xl font-bold">{channel.c.title}</p>
                {channel.c.subs ? <p className="text-sm text-white/55">{channel.c.subs}</p> : null}
              </div>
            ) : null}

            {mode === "search" && chans.length ? (
              <ul className="mb-3">
                {chans.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="tap flex w-full items-center gap-4 px-4 py-3 text-left" onClick={() => void openChannel(c)}>
                      <Avatar src={c.thumb} name={c.title} size={64} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-lg font-semibold">{c.title}</span><span className="block text-sm text-white/55">{c.subs || "Channel"}</span></span>
                      <span className="rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-black">Open</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {busy && !list.length ? (
              <ul>{[0, 1, 2].map((i) => (
                <li key={i} className="mb-5 animate-pulse">
                  <div className="aspect-video bg-white/10" />
                  <div className="flex gap-3 px-3 pt-3"><div className="size-10 rounded-full bg-white/10" /><div className="flex-1 space-y-2 pt-1"><div className="h-3.5 w-11/12 rounded bg-white/10" /><div className="h-3 w-1/2 rounded bg-white/10" /></div></div>
                </li>
              ))}</ul>
            ) : (
              <ul>
                {longs.slice(0, 3).map((h) => <VideoCard key={h.id} h={h} onPlay={() => play(h)} onChannel={() => openChannelOf(h)} />)}
                <ShortsShelf shorts={shortList} onOpen={(i) => setShorts({ list: shortList, start: i })} />
                {longs.slice(3).map((h) => <VideoCard key={h.id} h={h} onPlay={() => play(h)} onChannel={() => openChannelOf(h)} />)}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}
