import { useMemo, useState } from "react";
import { Search, X, Play } from "lucide-react";

type Hit = { id: string; title: string; thumb: string; channel: string };

/**
 * In-app YouTube shell.
 * Admin pastes Data API key in Admin → Update/Banner area (config.youtubeApiKey).
 * Without key: paste a video URL / ID and play via embed (no search).
 */
export function YoutubeView({ apiKey, onClose }: { apiKey?: string; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [playId, setPlayId] = useState<string | null>(null);

  const embed = useMemo(() => {
    if (!playId) return null;
    return `https://www.youtube.com/embed/${playId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  }, [playId]);

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
    if (id) {
      setPlayId(id);
      return;
    }
    if (!apiKey) {
      setErr("Search ke liye Admin API key set kare, ya seedha YouTube link / video ID paste karo.");
      return;
    }
    if (q.trim().length < 2) {
      setErr("Search likho");
      return;
    }
    setBusy(true);
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(q.trim())}&key=${apiKey}`;
      const r = await fetch(url);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
      const list: Hit[] = (j.items || []).map((it: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } } }) => ({
        id: it.id?.videoId || "",
        title: it.snippet?.title || "Video",
        channel: it.snippet?.channelTitle || "",
        thumb: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || "",
      })).filter((h: Hit) => h.id);
      setHits(list);
      if (!list.length) setErr("Kuch nahi mila");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-up safe-top fixed inset-0 z-[60] flex flex-col bg-ink text-paper">
      <header className="flex h-14 shrink-0 items-center gap-2 px-3">
        <button type="button" className="tap grid size-10 place-items-center rounded-full" aria-label="Close" onClick={onClose}><X className="size-5" /></button>
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
      </header>

      {playId ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="aspect-video w-full bg-black">
            <iframe title="YouTube" className="h-full w-full" src={embed!} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          </div>
          <button type="button" className="tap m-3 h-11 rounded-2xl border border-paper/15 text-sm font-semibold" onClick={() => setPlayId(null)}>Back to results</button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
          {err ? <p className="mb-3 rounded-2xl bg-rose/15 px-3 py-2 text-sm text-rose">{err}</p> : null}
          {!apiKey ? (
            <p className="mb-3 rounded-2xl border border-paper/10 bg-paper/5 px-3 py-2 text-xs text-paper/55">
              Admin ne abhi YouTube API key set nahi ki. Link / video ID se play ho jayega. Search key ke baad chalega.
            </p>
          ) : null}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" className="tap flex w-full gap-3 rounded-2xl bg-paper/5 p-2 text-left" onClick={() => setPlayId(h.id)}>
                  <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-paper/10">
                    {h.thumb ? <img src={h.thumb} alt="" className="h-full w-full object-cover" /> : null}
                    <span className="absolute inset-0 grid place-items-center bg-black/25"><Play className="size-8 text-white" /></span>
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-semibold">{h.title}</span>
                    <span className="mt-1 block text-xs text-paper/50">{h.channel}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
