import { auth } from "../firebase";
import { AI_API_URL } from "./aiUrl";

export type AiAttachment =
  | { kind: "image"; mime: string; data: string; name: string }
  | { kind: "pdf"; data: string; name: string }
  | { kind: "text"; text: string; name: string };
export type AiTurn = { role: "user" | "assistant"; text: string };



/** AI se poochho. Error aaye to samajhne layak Hinglish message ke saath throw hota hai. */
export async function askAi(messages: AiTurn[], attachments: AiAttachment[]): Promise<string> {
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
    return String(data.text ?? "").trim() || "Hmm, kuch samajh nahi aaya. Ek baar phir bolo? 😅";
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

/* ---------- history (sirf is phone par, text) ---------- */
const hkey = (uid: string) => `pry-ai-hist-${uid}`;
export function loadHistory(uid: string): AiTurn[] {
  try {
    const raw = JSON.parse(localStorage.getItem(hkey(uid)) ?? "[]") as AiTurn[];
    return Array.isArray(raw) ? raw.filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string").slice(-40) : [];
  } catch {
    return [];
  }
}
export function saveHistory(uid: string, turns: AiTurn[]) {
  try { localStorage.setItem(hkey(uid), JSON.stringify(turns.slice(-40))); } catch { /* ignore */ }
}

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
