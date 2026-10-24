import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Play, Search, X } from "lucide-react";

type VideoKind = "video" | "short";
type Hit = { id: string; title: string; thumb: string; channel: string; kind: VideoKind; duration?: string };

const INTEREST_KEY = "yt-interests";
const HISTORY_KEY = "yt-history";
const MAX_HISTORY = 40;

function getInterests(): string[] {
  try { return JSON.parse(localStorage.getItem(INTEREST_KEY) || "[]"); } catch { return []; }
}
function addInterest(terms: string[]) {
  try {
    const existing = getInterests();
    const merged = [...new Set([...terms, ...existing])].slice(0, 30);
    localStorage.setItem(INTEREST_KEY, JSON.stringify(merged));
  } catch { /* ignore */ }
}
function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function addHistory(id: string) {
  try {
    const h = [id, ...getHistory().filter((x) => x !== id)].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch { /* ignore */ }
}

function isShort(item: { snippet?: { title?: string; description?: string }; contentDetails?: { duration?: string } }): boolean {
  const dur = item.contentDetails?.duration ?? "";
  if (dur) {
    const m = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (m) {
      const h = parseInt(m[1] ?? "0");
      const min = parseInt(m[2] ?? "0");
      const s = parseInt(m[3] ?? "0");
      const total = h * 3600 + min * 60 + s;
      if (total <= 60) return true;
    }
  }
  const title = (item.snippet?.title ?? "").toLowerCase();
  return title.includes("#shorts") || title.includes("#short");
}

function formatDur(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "";
  const h = parseInt(m[1] ?? "0");
  const min = parseInt(m[2] ?? "0");
  const s = parseInt(m[3] ?? "0");
  if (h) return `${h}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${min}:${String(s).padStart(2, "0")}`;
}

type RawItem = {
  id?: { videoId?: string };
  snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } }; description?: string };
  contentDetails?: { duration?: string };
};

async function ytSearch(q: string, key: string, maxResults = 20): Promise<Hit[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(q)}&key=${key}`;
  const r = await fetch(url);
  const j = await r.json() as { items?: RawItem[]; error?: { message?: string } };
  if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
  const ids = (j.items || []).map((it) => it.id?.videoId).filter(Boolean).join(",");
  if (!ids) return [];
  const det = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${ids}&key=${key}`);
  const dj = await det.json() as { items?: RawItem[] };
  return ((dj.items || []) as RawItem[]).map((it) => {
    const short = isShort(it);
    return {
      id: (it.id as unknown as string) || "",
      title: it.snippet?.title || "Video",
      channel: it.snippet?.channelTitle || "",
      thumb: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || "",
      kind: short ? "short" : "video",
      duration: it.contentDetails?.duration ? formatDur(it.contentDetails.duration) : undefined,
    };
  }).filter((h) => h.id);
}

async function ytRecommended(key: string, interests: string[]): Promise<Hit[]> {
  const q = interests.length ? interests.slice(0, 3).join(" ") : "trending music India";
  return ytSearch(q, key, 20);
}

/* ───── Shorts player ───── */
function ShortsPlayer({ ids, startIndex, onClose }: { ids: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const touchStart = useRef(0);

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => setIdx((i) => Math.min(ids.length - 1, i + 1));

  useEffect(() => {
    addHistory(ids[idx]);
    addInterest(["shorts", "reels"]);
  }, [idx, ids]);

  const src = `https://www.youtube.com/embed/${ids[idx]}?autoplay=1&loop=1&rel=0&modestbranding=1&playsinline=1`;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black"
      onTouchStart={(e) => { touchStart.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => {
        const dy = touchStart.current - e.changedTouches[0].clientY;
        if (dy > 60) next();
        else if (dy < -60) prev();
      }}
    >
      <button type="button" className="absolute left-3 top-4 z-10 tap grid size-10 place-items-center rounded-full bg-black/50" aria-label="Close" onClick={onClose}>
        <X className="size-5 text-white" />
      </button>
      <div className="flex flex-1 items-center justify-center">
        <iframe
          key={ids[idx]}
          title="Short"
          className="h-full w-full max-h-[100dvh]"
          style={{ aspectRatio: "9/16", maxWidth: "min(100vw, 420px)", margin: "auto" }}
          src={src}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="absolute bottom-8 right-3 flex flex-col gap-3 text-white text-xs font-bold text-center">
        <button type="button" disabled={idx === 0} className="tap disabled:opacity-30 flex flex-col items-center" onClick={prev}>▲<span>Prev</span></button>
        <span>{idx + 1}/{ids.length}</span>
        <button type="button" disabled={idx === ids.length - 1} className="tap disabled:opacity-30 flex flex-col items-center" onClick={next}>▼<span>Next</span></button>
      </div>
    </div>
  );
}

/* ───── Main component ───── */
export function YoutubeView({ apiKey, onClose }: { apiKey?: string; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [recommended, setRecommended] = useState<Hit[]>([]);
  const [loadingRec, setLoadingRec] = useState(false);
  const [playId, setPlayId] = useState<string | null>(null);
  const [shortsIds, setShortsIds] = useState<string[] | null>(null);
  const [shortsStart, setShortsStart] = useState(0);
  const [tab, setTab] = useState<"search" | "recommended">("recommended");

  const embed = useMemo(() => {
    if (!playId) return null;
    return `https://www.youtube.com/embed/${playId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  }, [playId]);

  // Load recommended on mount
  useEffect(() => {
    if (!apiKey) return;
    setLoadingRec(true);
    const interests = getInterests();
    ytRecommended(apiKey, interests)
      .then(setRecommended)
      .catch(() => setRecommended([]))
      .finally(() => setLoadingRec(false));
  }, [apiKey]);

  function extractId(raw: string): string | null {
    const s = raw.trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    try {
      const u = new URL(s);
      if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).slice(0, 11);
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/");
      const i = parts.indexOf("shorts");
      if (i >= 0 && parts[i + 1]) return parts[i + 1].slice(0, 11);
      const e = parts.indexOf("embed");
      if (e >= 0 && parts[e + 1]) return parts[e + 1].slice(0, 11);
    } catch { /* not url */ }
    return null;
  }

  async function search() {
    setErr("");
    const id = extractId(q);
    if (id) { play({ id, title: "", thumb: "", channel: "", kind: "video" }); return; }
    if (!apiKey) { setErr("Search ke liye Admin API key set kare, ya seedha YouTube link / video ID paste karo."); return; }
    if (q.trim().length < 2) { setErr("Search likho"); return; }
    setBusy(true);
    setTab("search");
    try {
      const list = await ytSearch(q.trim(), apiKey);
      setHits(list);
      addInterest(q.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 2));
      if (!list.length) setErr("Kuch nahi mila");
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  function play(h: Hit) {
    if (h.kind === "short") {
      const pool = (tab === "search" ? hits : recommended).filter((x) => x.kind === "short");
      const idx = pool.findIndex((x) => x.id === h.id);
      setShortsIds(pool.map((x) => x.id));
      setShortsStart(Math.max(0, idx));
    } else {
      addHistory(h.id);
      if (h.title) addInterest(h.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 5));
      setPlayId(h.id);
    }
  }

  const displayList = tab === "search" ? hits : recommended;
  const shorts = displayList.filter((h) => h.kind === "short");
  const videos = displayList.filter((h) => h.kind === "video");

  return (
    <>
      {shortsIds ? (
        <ShortsPlayer ids={shortsIds} startIndex={shortsStart} onClose={() => setShortsIds(null)} />
      ) : null}

      <div className="sheet-up safe-top fixed inset-0 z-[60] flex flex-col bg-ink text-paper">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 px-3">
          {playId ? (
            <button type="button" className="tap grid size-10 place-items-center rounded-full" aria-label="Back" onClick={() => setPlayId(null)}>
              <ChevronLeft className="size-5" />
            </button>
          ) : (
            <button type="button" className="tap grid size-10 place-items-center rounded-full" aria-label="Close" onClick={onClose}>
              <X className="size-5" />
            </button>
          )}
          {!playId ? (
            <>
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-paper/10 px-3 py-2">
                <Search className="size-4 shrink-0 text-paper/50" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-paper/40"
                  placeholder="Search ya YouTube link paste…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void search(); }}
                />
              </div>
              <button type="button" disabled={busy} className="tap rounded-full bg-paper/12 px-3 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => void search()}>
                {busy ? "…" : "Go"}
              </button>
            </>
          ) : null}
        </header>

        {/* Video player */}
        {playId ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="aspect-video w-full bg-black">
              <iframe title="YouTube" className="h-full w-full" src={embed!} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <p className="text-xs text-paper/40 mt-2">Related videos loading…</p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Tabs */}
            {apiKey ? (
              <div className="flex shrink-0 gap-1 px-3 pb-2">
                {(["recommended", "search"] as const).map((t) => (
                  <button key={t} type="button"
                    className={`tap rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-paper text-ink" : "bg-paper/10"}`}
                    onClick={() => setTab(t)}
                  >
                    {t === "recommended" ? "For You" : "Search"}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
              {err ? <p className="mb-3 rounded-2xl bg-rose/15 px-3 py-2 text-sm text-rose">{err}</p> : null}

              {!apiKey ? (
                <p className="mb-3 rounded-2xl border border-paper/10 bg-paper/5 px-3 py-2 text-xs text-paper/55">
                  Admin ne abhi YouTube API key set nahi ki. Link / video ID se play ho jayega.
                </p>
              ) : null}

              {/* Shorts row */}
              {shorts.length > 0 ? (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-bold tracking-widest text-paper/50">SHORTS</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {shorts.map((h, i) => (
                      <button key={h.id} type="button" className="tap shrink-0 relative rounded-2xl overflow-hidden bg-paper/5" style={{ width: 100, height: 170 }}
                        onClick={() => { setShortsIds(shorts.map((x) => x.id)); setShortsStart(i); }}>
                        {h.thumb ? <img src={h.thumb} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
                        <span className="absolute bottom-2 left-1 right-1 text-[0.65rem] font-semibold text-white line-clamp-2 leading-tight">{h.title}</span>
                        <span className="absolute top-2 right-2 rounded-md bg-black/60 px-1 py-0.5 text-[0.6rem] font-bold text-white">SHORT</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Regular videos */}
              {loadingRec && tab === "recommended" ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="h-20 w-32 shrink-0 rounded-xl bg-paper/10" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 rounded bg-paper/10 w-3/4" />
                        <div className="h-3 rounded bg-paper/10 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="space-y-3">
                  {videos.map((h) => (
                    <li key={h.id}>
                      <button type="button" className="tap flex w-full gap-3 rounded-2xl bg-paper/5 p-2 text-left" onClick={() => play(h)}>
                        <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-paper/10">
                          {h.thumb ? <img src={h.thumb} alt="" className="h-full w-full object-cover" /> : null}
                          <span className="absolute inset-0 grid place-items-center bg-black/20"><Play className="size-7 text-white drop-shadow" /></span>
                          {h.duration ? <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[0.6rem] font-bold text-white">{h.duration}</span> : null}
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm font-semibold">{h.title}</span>
                          <span className="mt-1 block text-xs text-paper/50">{h.channel}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
