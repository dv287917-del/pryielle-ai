import { Capacitor, CapacitorHttp } from "@capacitor/core";

/* =====================================================================
   YouTube data layer (v2.13.0)
   1) Phone app (native): YouTube ke apne "youtubei" endpoints direct native HTTP se (CORS nahi, quota nahi).
      Isse search me videos + CHANNELS + Shorts sab aate hain.
   2) Agar wo fail ho ya web par ho: Admin ki Data API key (official) use hoti hai.
   3) Channel ke videos ke liye RSS feed ka bhi fallback.
   ===================================================================== */

export type Vid = {
  id: string; title: string; channel: string; channelId?: string; avatar?: string;
  views?: string; ago?: string; dur?: string; short: boolean;
};
export type Chan = { id: string; title: string; avatar: string; subs?: string; handle?: string; desc?: string };
export type Feed = { videos: Vid[]; shorts: Vid[]; channels: Chan[] };

export const EMPTY_FEED: Feed = { videos: [], shorts: [], channels: [] };
export const thumbOf = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/* ---------- small helpers ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function txt(x: Any): string {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x.simpleText === "string") return x.simpleText;
  if (Array.isArray(x.runs)) return x.runs.map((r: Any) => r?.text ?? "").join("");
  if (typeof x.content === "string") return x.content;
  return "";
}
const fixUrl = (u: string | undefined) => (u ? (u.startsWith("//") ? `https:${u}` : u) : "");

function durSeconds(d: string): number {
  const p = d.split(":").map((n) => parseInt(n, 10));
  if (p.some((n) => Number.isNaN(n))) return 0;
  return p.reduce((a, n) => a * 60 + n, 0);
}

export function fmtCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, "")}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}
export function fmtAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!t) return "";
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  const u: Array<[number, string]> = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hr"], [60, "min"]];
  for (const [sec, name] of u) {
    if (s >= sec) {
      const n = Math.floor(s / sec);
      return name === "hr" || name === "min" ? `${n} ${name} ago` : `${n} ${name}${n > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
}
export function fmtIsoDur(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "";
  const h = parseInt(m[1] ?? "0", 10), min = parseInt(m[2] ?? "0", 10), s = parseInt(m[3] ?? "0", 10);
  return h ? `${h}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${min}:${String(s).padStart(2, "0")}`;
}

/* ---------- unofficial "youtubei" (InnerTube) ---------- */
const IT = "https://www.youtube.com/youtubei/v1";
const CLIENT = { clientName: "WEB", clientVersion: "2.20250620.01.00", hl: "en", gl: "IN" };

async function itPost(path: string, body: Record<string, unknown>): Promise<Any> {
  const url = `${IT}/${path}?prettyPrint=false`;
  const data = { context: { client: CLIENT }, ...body };
  if (!Capacitor.isNativePlatform()) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error(`YouTube ${r.status}`);
    return r.json();
  }
  const r = await CapacitorHttp.post({
    url,
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "en-IN,en;q=0.9",
      Origin: "https://www.youtube.com",
      Referer: "https://www.youtube.com/",
      "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    },
    data,
    connectTimeout: 12000,
    readTimeout: 15000,
  });
  if (r.status >= 400) throw new Error(`YouTube ${r.status}`);
  return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
}

function parseVideoRenderer(v: Any): Vid | null {
  const id: string | undefined = v?.videoId;
  if (!id || id.length !== 11) return null;
  const run = (v.ownerText ?? v.longBylineText ?? v.shortBylineText)?.runs?.[0];
  const dur = txt(v.lengthText);
  const isReel = Boolean(v.navigationEndpoint?.reelWatchEndpoint);
  return {
    id,
    title: txt(v.title) || "Video",
    channel: run?.text ?? "",
    channelId: run?.navigationEndpoint?.browseEndpoint?.browseId,
    avatar: fixUrl(v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url),
    views: txt(v.shortViewCountText) || txt(v.viewCountText) || undefined,
    ago: txt(v.publishedTimeText) || undefined,
    dur: dur || undefined,
    short: isReel || (dur ? durSeconds(dur) > 0 && durSeconds(dur) <= 60 : false),
  };
}
function parseCompact(v: Any): Vid | null {
  const base = parseVideoRenderer(v);
  return base;
}
function parseReel(v: Any): Vid | null {
  const id: string | undefined = v?.videoId;
  if (!id) return null;
  return { id, title: txt(v.headline) || "Short", channel: "", views: txt(v.viewCountText) || undefined, short: true };
}
function parseShortsLockup(v: Any): Vid | null {
  const id: string | undefined = v?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ?? (typeof v?.entityId === "string" ? v.entityId.replace(/^shorts-shelf-item-/, "") : undefined);
  if (!id || id.length !== 11) return null;
  return { id, title: txt(v.overlayMetadata?.primaryText) || "Short", channel: "", views: txt(v.overlayMetadata?.secondaryText) || undefined, short: true };
}
function parseLockup(l: Any): Vid | null {
  const id: string | undefined = l?.contentId;
  if (!id || id.length !== 11) return null;
  if (l.contentType && !/VIDEO/.test(String(l.contentType))) return null;
  const meta = l.metadata?.lockupMetadataViewModel;
  const rows: Any[] = meta?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
  const parts = (i: number): string[] => (rows[i]?.metadataParts ?? []).map((p: Any) => txt(p?.text));
  const r0 = parts(0), r1 = parts(1);
  const overlays: Any[] = l.contentImage?.thumbnailViewModel?.overlays ?? [];
  let dur = "";
  for (const o of overlays) {
    const t = o?.thumbnailOverlayBadgeViewModel?.thumbnailBadges?.[0]?.thumbnailBadgeViewModel?.text;
    if (t) { dur = String(t); break; }
  }
  return {
    id,
    title: txt(meta?.title) || "Video",
    channel: r0[0] ?? "",
    avatar: fixUrl(meta?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.[0]?.url),
    views: r1[0] || undefined,
    ago: r1[1] || undefined,
    dur: dur || undefined,
    short: dur ? durSeconds(dur) > 0 && durSeconds(dur) <= 60 : false,
  };
}
function parseChannelRenderer(c: Any): Chan | null {
  const id: string | undefined = c?.channelId;
  if (!id) return null;
  const a = txt(c.subscriberCountText), b = txt(c.videoCountText);
  const all = [a, b];
  return {
    id,
    title: txt(c.title) || "Channel",
    avatar: fixUrl(c.thumbnail?.thumbnails?.slice(-1)?.[0]?.url),
    subs: all.find((s) => /subscriber/i.test(s)) || undefined,
    handle: all.find((s) => s.startsWith("@")) || undefined,
    desc: txt(c.descriptionSnippet) || undefined,
  };
}

/** Poore JSON me se video / short / channel dhundh nikalta hai (YouTube ka layout badalta rehta hai, isliye deep scan). */
export function parseFeed(root: Any): Feed {
  const videos: Vid[] = [], shorts: Vid[] = [], channels: Chan[] = [];
  const seen = new Set<string>();
  const seenC = new Set<string>();
  const stack: Any[] = [root];
  let guard = 0;
  while (stack.length && guard++ < 400_000) {
    const o = stack.pop();
    if (!o || typeof o !== "object") continue;
    if (Array.isArray(o)) { for (let i = o.length - 1; i >= 0; i--) stack.push(o[i]); continue; }
    const keys = Object.keys(o);
    for (const k of keys) {
      const val = o[k];
      let v: Vid | null = null;
      if (k === "videoRenderer") v = parseVideoRenderer(val);
      else if (k === "compactVideoRenderer" || k === "gridVideoRenderer") v = parseCompact(val);
      else if (k === "reelItemRenderer") v = parseReel(val);
      else if (k === "shortsLockupViewModel") v = parseShortsLockup(val);
      else if (k === "lockupViewModel") v = parseLockup(val);
      else if (k === "channelRenderer") {
        const c = parseChannelRenderer(val);
        if (c && !seenC.has(c.id)) { seenC.add(c.id); channels.push(c); }
      }
      if (v && !seen.has(v.id)) { seen.add(v.id); (v.short ? shorts : videos).push(v); }
    }
    // bachon ko ulte order me daalte hain taaki pop hone par document ka original order bana rahe
    for (let i = keys.length - 1; i >= 0; i--) {
      const val = o[keys[i]];
      if (val && typeof val === "object") stack.push(val);
    }
  }
  return { videos, shorts, channels };
}

/* ---------- official Data API (fallback) ---------- */
const API = "https://www.googleapis.com/youtube/v3";

async function api(path: string, params: Record<string, string | number>, key: string): Promise<Any> {
  const u = new URL(`${API}/${path}`);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  u.searchParams.set("key", key);
  const r = await fetch(u.toString());
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `YouTube API ${r.status}`);
  return j;
}

async function enrich(ids: string[], channelIds: string[], key: string): Promise<{ vids: Any[]; chans: Record<string, Any> }> {
  const uniq = [...new Set(ids)].slice(0, 50);
  const vids = uniq.length ? (await api("videos", { part: "snippet,contentDetails,statistics", id: uniq.join(",") }, key)).items ?? [] : [];
  const cids = [...new Set([...channelIds, ...vids.map((v: Any) => v.snippet?.channelId)].filter(Boolean))].slice(0, 50);
  const chans: Record<string, Any> = {};
  if (cids.length) {
    const cj = await api("channels", { part: "snippet,statistics", id: cids.join(",") }, key);
    for (const c of cj.items ?? []) chans[c.id] = c;
  }
  return { vids, chans };
}

function officialVid(v: Any, chans: Record<string, Any>): Vid {
  const dur = v.contentDetails?.duration ? fmtIsoDur(v.contentDetails.duration) : "";
  const secs = dur ? durSeconds(dur) : 0;
  const title: string = v.snippet?.title ?? "Video";
  const cid: string | undefined = v.snippet?.channelId;
  const vc = Number(v.statistics?.viewCount ?? NaN);
  return {
    id: v.id, title, channel: v.snippet?.channelTitle ?? "", channelId: cid,
    avatar: cid ? chans[cid]?.snippet?.thumbnails?.default?.url : undefined,
    views: Number.isNaN(vc) ? undefined : `${fmtCount(vc)} views`,
    ago: v.snippet?.publishedAt ? fmtAgo(v.snippet.publishedAt) : undefined,
    dur: dur || undefined,
    short: (secs > 0 && secs <= 60) || /#shorts?\b/i.test(title),
  };
}
function officialChan(c: Any): Chan {
  const sc = Number(c.statistics?.subscriberCount ?? NaN);
  return {
    id: c.id, title: c.snippet?.title ?? "Channel", avatar: c.snippet?.thumbnails?.medium?.url ?? c.snippet?.thumbnails?.default?.url ?? "",
    subs: c.statistics?.hiddenSubscriberCount || Number.isNaN(sc) ? undefined : `${fmtCount(sc)} subscribers`,
    handle: c.snippet?.customUrl, desc: c.snippet?.description,
  };
}

async function officialSearch(q: string, key: string): Promise<Feed> {
  const j = await api("search", { part: "snippet", type: "video,channel", maxResults: 25, q, regionCode: "IN" }, key);
  const items: Any[] = j.items ?? [];
  const vids = items.filter((i) => i.id?.videoId).map((i) => i.id.videoId as string);
  const chIds = items.filter((i) => i.id?.channelId).map((i) => i.id.channelId as string);
  const { vids: det, chans } = await enrich(vids, chIds, key);
  const order = new Map(vids.map((id, i) => [id, i]));
  det.sort((a: Any, b: Any) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  const all = det.map((v: Any) => officialVid(v, chans));
  return { videos: all.filter((v: Vid) => !v.short), shorts: all.filter((v: Vid) => v.short), channels: chIds.map((id) => chans[id]).filter(Boolean).map(officialChan) };
}
async function officialPopular(key: string): Promise<Feed> {
  const j = await api("videos", { part: "snippet,contentDetails,statistics", chart: "mostPopular", regionCode: "IN", maxResults: 30 }, key);
  const cids = (j.items ?? []).map((v: Any) => v.snippet?.channelId);
  const { chans } = await enrich([], cids, key);
  const all = (j.items ?? []).map((v: Any) => officialVid(v, chans));
  return { videos: all.filter((v: Vid) => !v.short), shorts: all.filter((v: Vid) => v.short), channels: [] };
}

/* ---------- public API ---------- */
const memo = new Map<string, { at: number; feed: Feed }>();
const TTL = 10 * 60_000;
const native = () => Capacitor.isNativePlatform();

async function best(unofficial: () => Promise<Feed>, official: ((key: string) => Promise<Feed>) | null, apiKey: string): Promise<Feed> {
  let firstErr: unknown = null;
  const order: Array<() => Promise<Feed>> = [];
  const off = official && apiKey ? () => official(apiKey) : null;
  if (native()) { order.push(unofficial); if (off) order.push(off); }
  else { if (off) order.push(off); order.push(unofficial); }
  for (const run of order) {
    try {
      const f = await run();
      if (f.videos.length || f.shorts.length || f.channels.length) return f;
    } catch (e) { firstErr ??= e; }
  }
  if (firstErr) throw firstErr instanceof Error ? firstErr : new Error(String(firstErr));
  return EMPTY_FEED;
}

export async function searchYt(q: string, apiKey: string): Promise<Feed> {
  const key = `s:${q.toLowerCase()}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.feed;
  const feed = await best(
    async () => {
      const [main, extra] = await Promise.all([itPost("search", { query: q }), itPost("search", { query: `${q} shorts` }).catch(() => null)]);
      const f = parseFeed(main);
      if (extra) {
        const e = parseFeed(extra);
        const seen = new Set(f.shorts.map((s) => s.id));
        for (const s of e.shorts) if (!seen.has(s.id)) f.shorts.push(s);
      }
      return f;
    },
    (k) => officialSearch(q, k),
    apiKey,
  );
  memo.set(key, { at: Date.now(), feed });
  return feed;
}

const HOME_FALLBACK = ["trending India today", "new songs", "gaming highlights", "latest comedy", "cricket highlights", "tech review"];

export async function homeFeed(interests: string[], apiKey: string): Promise<Feed> {
  const key = `h:${interests.slice(0, 2).join("|")}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.feed;
  const feed = await best(
    async () => {
      let f: Feed = EMPTY_FEED;
      try { f = parseFeed(await itPost("browse", { browseId: "FEwhat_to_watch" })); } catch { /* search se bharenge */ }
      if (f.videos.length < 6) {
        const q = interests.length ? interests.slice(0, 2).join(" ") : HOME_FALLBACK[new Date().getHours() % HOME_FALLBACK.length];
        const s = parseFeed(await itPost("search", { query: q }));
        const seen = new Set(f.videos.map((v) => v.id));
        f = { videos: [...f.videos, ...s.videos.filter((v) => !seen.has(v.id))], shorts: [...f.shorts, ...s.shorts], channels: [] };
      }
      if (f.shorts.length < 6) {
        try {
          const sh = parseFeed(await itPost("search", { query: "shorts viral india" }));
          const seen = new Set(f.shorts.map((v) => v.id));
          f.shorts.push(...sh.shorts.filter((v) => !seen.has(v.id)));
        } catch { /* optional */ }
      }
      return f;
    },
    officialPopular,
    apiKey,
  );
  memo.set(key, { at: Date.now(), feed });
  return feed;
}

/** Watch page ke "related" videos + (agar pata na ho) title/channel. */
export async function relatedYt(id: string): Promise<{ related: Vid[]; title?: string; channel?: string; channelId?: string }> {
  const j = await itPost("next", { videoId: id });
  const f = parseFeed(j);
  let title: string | undefined, channel: string | undefined, channelId: string | undefined;
  const stack: Any[] = [j];
  let guard = 0;
  while (stack.length && guard++ < 200_000 && (!title || !channel)) {
    const o = stack.pop();
    if (!o || typeof o !== "object") continue;
    if (!Array.isArray(o)) {
      if (!title && o.videoPrimaryInfoRenderer) title = txt(o.videoPrimaryInfoRenderer.title);
      if (!channel && o.videoOwnerRenderer) {
        channel = txt(o.videoOwnerRenderer.title);
        channelId = o.videoOwnerRenderer.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
      }
    }
    for (const k of Object.keys(o)) { const v = o[k]; if (v && typeof v === "object") stack.push(v); }
  }
  return { related: f.videos.filter((v) => v.id !== id).slice(0, 25), title, channel, channelId };
}

/* ---------- channel page ---------- */
async function rssChannel(channelId: string): Promise<Vid[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  let xml = "";
  if (native()) {
    const r = await CapacitorHttp.get({ url, responseType: "text" });
    if (r.status >= 400) throw new Error(`YouTube ${r.status}`);
    xml = typeof r.data === "string" ? r.data : String(r.data);
  } else {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`YouTube ${r.status}`);
    xml = await r.text();
  }
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const author = doc.querySelector("feed > author > name")?.textContent ?? "";
  return [...doc.querySelectorAll("entry")].map((e) => {
    const id = e.getElementsByTagName("yt:videoId")[0]?.textContent ?? "";
    const views = e.getElementsByTagName("media:statistics")[0]?.getAttribute("views");
    const pub = e.getElementsByTagName("published")[0]?.textContent ?? "";
    return {
      id, title: e.getElementsByTagName("title")[0]?.textContent ?? "Video", channel: author, channelId,
      views: views ? `${fmtCount(Number(views))} views` : undefined, ago: pub ? fmtAgo(pub) : undefined, short: false,
    } as Vid;
  }).filter((v) => v.id);
}

export async function channelVideos(channelId: string, apiKey: string): Promise<Vid[]> {
  if (apiKey) {
    try {
      const cj = await api("channels", { part: "contentDetails,snippet", id: channelId }, apiKey);
      const up: string | undefined = cj.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (up) {
        const pj = await api("playlistItems", { part: "contentDetails", playlistId: up, maxResults: 30 }, apiKey);
        const ids: string[] = (pj.items ?? []).map((i: Any) => i.contentDetails?.videoId).filter(Boolean);
        const { vids, chans } = await enrich(ids, [channelId], apiKey);
        const list = vids.map((v: Any) => officialVid(v, chans));
        if (list.length) return list;
      }
    } catch { /* RSS par jayenge */ }
  }
  return rssChannel(channelId);
}

export async function channelInfo(channelId: string, apiKey: string): Promise<Chan | null> {
  if (!apiKey) return null;
  try {
    const cj = await api("channels", { part: "snippet,statistics", id: channelId }, apiKey);
    return cj.items?.[0] ? officialChan(cj.items[0]) : null;
  } catch { return null; }
}

/* ---------- pasted link / ID ---------- */
export function extractId(raw: string): string | null {
  const s = raw.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).slice(0, 11);
    const v = u.searchParams.get("v");
    if (v) return v.slice(0, 11);
    const parts = u.pathname.split("/");
    for (const key of ["shorts", "embed", "live"]) {
      const i = parts.indexOf(key);
      if (i >= 0 && parts[i + 1]) return parts[i + 1].slice(0, 11);
    }
  } catch { /* not a url */ }
  return null;
}

/* ---------- local taste memory ---------- */
const INTEREST_KEY = "yt-interests";
const RECENT_KEY = "yt-recent";
function readList(k: string): string[] { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } }
export const getInterests = () => readList(INTEREST_KEY);
export function addInterest(terms: string[]) {
  try { localStorage.setItem(INTEREST_KEY, JSON.stringify([...new Set([...terms, ...getInterests()])].slice(0, 30))); } catch { /* ignore */ }
}
export const getRecent = () => readList(RECENT_KEY);
export function addRecent(q: string) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...getRecent().filter((x) => x !== q)].slice(0, 10))); } catch { /* ignore */ }
}
export function clearRecent() { try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ } }
