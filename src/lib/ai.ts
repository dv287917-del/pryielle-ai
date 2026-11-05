import { auth } from "../firebase";
import { AI_API_URL } from "./aiUrl";

export type AiAttachment =
  | { kind: "image"; mime: string; data: string; name: string }
  | { kind: "pdf"; data: string; name: string }
  | { kind: "text"; text: string; name: string };
export type AiTurn = { role: "user" | "assistant"; text: string };



/** AI se poochho. Error aaye to samajhne layak Hinglish message ke saath throw hota hai. */
export type AiReply = { text: string; /** server ne secret code pehchana — ye turn chat history me chhupana hai */ secret: boolean };
export async function askAi(messages: AiTurn[], attachments: AiAttachment[]): Promise<AiReply> {
  const user = auth.currentUser;
  if (!user) throw new Error("Dobara login karo.");
  try {
    const token = await user.getIdToken();
    const r = await fetch(AI_API_URL, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "ask", messages, attachments }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 413) throw new Error("Files bahut badi hain. Chhoti photo/PDF bhejo.");
    if (r.status === 404) throw new Error("AI server nahi mila. Admin: Vercel deploy aur app ka AI URL check karo.");
    if (!r.ok) throw new Error(String(data.error || `AI request failed (${r.status})`));
    return { text: String(data.text ?? "").trim() || "Hmm, kuch samajh nahi aaya. Ek baar phir bolo? 😅", secret: data.secret === true };
  } catch (e) {
    if (e instanceof TypeError) throw new Error("AI server tak nahi pahunch paaye. Internet check karo ya thodi der baad try karo.");
    if (e instanceof Error) throw e;
    throw new Error("AI abhi jawab nahi de pa raha. Thodi der baad try karo.");
  }
}

/* ---------- attachments ---------- */
const TEXT_EXT = /\.(txt|md|json|csv|tsv|xml|html?|css|js|jsx|ts|tsx|py|java|kt|c|cpp|h|cs|go|rs|php|rb|sh|yml|yaml|toml|ini|log|sql|env)$/i;
const MAX_PDF = 3 * 1024 * 1024;

const readB64 = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(new Error("File padh nahi paaye."));
    r.readAsDataURL(blob);
  });

async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Photo khul nahi paayi."));
      i.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Photo process nahi ho paayi.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82).split(",")[1] ?? "";
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function fileToAttachment(file: File): Promise<AiAttachment> {
  const name = file.name || "file";
  if (file.type.startsWith("image/")) return { kind: "image", mime: "image/jpeg", data: await shrinkImage(file), name };
  if (file.type === "application/pdf" || /\.pdf$/i.test(name)) {
    if (file.size > MAX_PDF) throw new Error("PDF 3MB se chhoti honi chahiye (Vercel request limit).");
    return { kind: "pdf", data: await readB64(file), name };
  }
  if (file.type.startsWith("text/") || file.type === "application/json" || TEXT_EXT.test(name)) {
    const text = (await file.text()).slice(0, 60_000);
    return { kind: "text", text, name };
  }
  throw new Error("Ye file type abhi nahi chalta. Photo, PDF ya text/code file bhejo.");
}

/* ---------- chats (sirf is phone par, text) ---------- */
export type Chat = { id: string; title: string; at: number; turns: AiTurn[] };
const ckey = (uid: string) => `pryai-chats-${uid}`;
export function loadChats(uid: string): Chat[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ckey(uid)) ?? "[]") as Chat[];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((c) => c && typeof c.id === "string" && Array.isArray(c.turns))
      .map((c) => ({ id: c.id, title: String(c.title ?? "New chat"), at: Number(c.at) || 0, turns: c.turns.filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string") }))
      .sort((a, b) => b.at - a.at)
      .slice(0, 60);
  } catch {
    return [];
  }
}
export function saveChats(uid: string, chats: Chat[]) {
  try { localStorage.setItem(ckey(uid), JSON.stringify(chats.slice(0, 60))); } catch { /* ignore */ }
}
export const newChatId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---------- voice (bolke likhna) ---------- */
type SR = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null; start(): void; stop(): void };
type SRCtor = new () => SR;
const srCtor = (): SRCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
export const speechSupported = () => srCtor() !== null;

/** Bolke likhna. Stop karne ke liye return hui function call karo. */
export function listen(lang: string, onText: (t: string, final: boolean) => void, onEnd: (err?: string) => void): () => void {
  const C = srCtor();
  if (!C) { onEnd("unsupported"); return () => undefined; }
  const r = new C();
  r.lang = lang;
  r.interimResults = true;
  r.continuous = false;
  r.onresult = (e) => {
    let t = "";
    for (let i = 0; i < e.results.length; i += 1) t += e.results[i][0].transcript;
    const last = e.results[e.results.length - 1] as unknown as { isFinal?: boolean };
    onText(t, Boolean(last?.isFinal));
  };
  r.onerror = (e) => onEnd(e.error || "error");
  r.onend = () => onEnd();
  try { r.start(); } catch { onEnd("error"); }
  return () => { try { r.stop(); } catch { /* ignore */ } };
}

/* ---------- LIVE voice (Gemini Live jaisa): mic -> WAV -> AI -> bolke jawab ---------- */
export type VoiceReply = { heard: string; reply: string };

/** Voice turn bhejo: aawaz (WAV base64) + optional camera/screenshot frames. */
export async function askVoice(history: AiTurn[], wavB64: string, images: string[], lang: "auto" | "hi" | "en"): Promise<VoiceReply> {
  const user = auth.currentUser;
  if (!user) throw new Error("Dobara login karo.");
  try {
    const token = await user.getIdToken();
    const r = await fetch(AI_API_URL, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "voice", messages: history.slice(-10), audio: { mime: "audio/wav", data: wavB64 }, images: images.map((data) => ({ mime: "image/jpeg", data })), lang }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 413) throw new Error("Aawaz/photo bahut badi hai. Chhota bolo.");
    if (r.status === 404 || r.status === 400 && String(data.error || "").includes("Unknown action")) throw new Error("AI server purana hai. Admin: Vercel par naya api/ai.js deploy karo.");
    if (!r.ok) throw new Error(String(data.error || `AI request failed (${r.status})`));
    return { heard: String(data.heard ?? "").trim(), reply: String(data.reply ?? "").trim() };
  } catch (e) {
    if (e instanceof TypeError) throw new Error("AI server tak nahi pahunch paaye. Internet check karo.");
    if (e instanceof Error) throw e;
    throw new Error("AI abhi jawab nahi de pa raha.");
  }
}

/** Mic se sunne wala engine: awaaz shuru/khatam khud pakadta hai (VAD) aur WAV deta hai. */
export type Ears = { stop(): void; setPaused(p: boolean): void; level(): number };
export type EarsHandlers = { onSpeech: () => void; onClip: (wavB64: string) => void; onError: (msg: string) => void };

function floatTo16k(buf: Float32Array, inRate: number): Int16Array {
  const ratio = inRate / 16000;
  const n = Math.floor(buf.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i += 1) {
    const a = Math.floor(i * ratio);
    const b = Math.min(buf.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < b; j += 1) sum += buf[j];
    const v = Math.max(-1, Math.min(1, sum / Math.max(1, b - a)));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}
function wavB64(pcm: Int16Array): string {
  const head = new ArrayBuffer(44);
  const dv = new DataView(head);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i += 1) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, "data"); dv.setUint32(40, pcm.length * 2, true);
  const bytes = new Uint8Array(44 + pcm.length * 2);
  bytes.set(new Uint8Array(head), 0);
  bytes.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), 44);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function startEars(h: EarsHandlers): Promise<Ears> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Is phone mein mic access nahi mil raha.");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    throw new Error("Mic ki permission do (Settings -> App -> Permissions -> Microphone).");
  }
  const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new AC();
  void ctx.resume().catch(() => undefined);
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(2048, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);

  let paused = false;
  let lvl = 0;
  let floor = 0.008;
  let calib = 0;
  let talking = false;
  let talkMs = 0;
  let quietMs = 0;
  let loudMs = 0;
  let chunks: Float32Array[] = [];
  let pre: Float32Array[] = [];

  const reset = () => { talking = false; talkMs = 0; quietMs = 0; loudMs = 0; chunks = []; pre = []; };
  proc.onaudioprocess = (e) => {
    const x = e.inputBuffer.getChannelData(0);
    let s = 0;
    for (let i = 0; i < x.length; i += 1) s += x[i] * x[i];
    const rms = Math.sqrt(s / x.length);
    lvl = lvl * 0.6 + rms * 0.4;
    if (paused) { reset(); return; }
    const ms = (x.length / ctx.sampleRate) * 1000;
    const copy = new Float32Array(x);
    if (calib < 600) { calib += ms; floor = Math.max(0.006, Math.min(0.05, floor * 0.7 + rms * 0.3)); }
    const thr = Math.max(0.022, floor * 3.2);
    const loud = rms > thr;
    if (!talking) {
      pre.push(copy);
      if (pre.length > 8) pre.shift();
      loudMs = loud ? loudMs + ms : 0;
      if (loudMs >= 140) { talking = true; chunks = [...pre]; talkMs = loudMs; quietMs = 0; h.onSpeech(); }
      return;
    }
    chunks.push(copy);
    talkMs += ms;
    quietMs = loud ? 0 : quietMs + ms;
    if (quietMs >= 1100 || talkMs >= 25000) {
      const all = chunks;
      const voiced = talkMs - quietMs;
      reset();
      if (voiced < 350) return;
      let total = 0;
      for (const c of all) total += c.length;
      const flat = new Float32Array(total);
      let o = 0;
      for (const c of all) { flat.set(c, o); o += c.length; }
      try { h.onClip(wavB64(floatTo16k(flat, ctx.sampleRate))); } catch { h.onError("Aawaz process nahi ho paayi."); }
    }
  };
  return {
    stop: () => {
      try { proc.disconnect(); src.disconnect(); mute.disconnect(); } catch { /* ignore */ }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => undefined);
    },
    setPaused: (p) => { paused = p; if (p) reset(); },
    level: () => Math.min(1, lvl * 9),
  };
}

/* ---------- bolke jawab dena (phone ka TTS) ---------- */
export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;
const DEVA = /[\u0900-\u097F]/;
export function stopSpeak() { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }

/** Jawab bolta hai. Hindi (Devanagari) ho to hi-IN, warna en-IN. done hamesha ek baar bulta hai. */
export function speak(text: string, rate: number, onStart: () => void, done: () => void): void {
  const clean = text.replace(/[*_`#>~]/g, "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  if (!clean || !ttsSupported()) { done(); return; }
  const synth = window.speechSynthesis;
  synth.cancel();
  const lang = DEVA.test(clean) ? "hi-IN" : "en-IN";
  const voices = synth.getVoices();
  const voice = voices.find((v) => v.lang.replace("_", "-") === lang) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  const parts = clean.match(/[^.!?।]+[.!?।]*/g)?.map((p) => p.trim()).filter(Boolean) ?? [clean];
  let i = 0;
  let finished = false;
  const end = () => { if (!finished) { finished = true; done(); } };
  const next = () => {
    if (finished) return;
    if (i >= parts.length) { end(); return; }
    const u = new SpeechSynthesisUtterance(parts[i]);
    u.lang = lang; u.rate = rate; u.pitch = 1;
    if (voice) u.voice = voice;
    if (i === 0) u.onstart = () => onStart();
    u.onend = () => { i += 1; next(); };
    u.onerror = () => end();
    synth.speak(u);
  };
  next();
}
