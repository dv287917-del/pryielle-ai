import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { AI_API_URL } from "./aiUrl";

/** AI preferences live in Firestore. Gemini API key is kept server-side in Vercel Environment Variables. */
export type AiMode = "funny" | "friendly" | "serious" | "teacher" | "coder" | "gamer";
export type AiLang = "auto" | "hinglish" | "hindi" | "english";
export type AiLength = "short" | "normal" | "long";
export type AiSettings = {
  apiKey: string;
  model: string;
  on: boolean;
  dailyLimit: number;
  mode: AiMode;
  lang: AiLang;
  length: AiLength;
  temperature: number;
  instructions: string;
};

export const AI_MODES: { id: AiMode; label: string; hint: string }[] = [
  { id: "funny", label: "😂 Funny", hint: "Mazaakiya, chatpata desi dost" },
  { id: "friendly", label: "🤗 Friendly", hint: "Pyaara, caring, supportive" },
  { id: "serious", label: "🧑‍💼 Serious", hint: "Seedha, professional, no emoji" },
  { id: "teacher", label: "🎓 Teacher", hint: "Step-by-step samjhane wala" },
  { id: "coder", label: "💻 Coder", hint: "Developer jaisa, code focus" },
  { id: "gamer", label: "🎮 Gamer", hint: "Free Fire squad hype dost" },
];
export const AI_LANGS: { id: AiLang; label: string }[] = [
  { id: "auto", label: "Auto (user jaisi)" },
  { id: "hinglish", label: "Hinglish" },
  { id: "hindi", label: "हिन्दी" },
  { id: "english", label: "English" },
];
export const AI_LENGTHS: { id: AiLength; label: string }[] = [
  { id: "short", label: "Chhota (2-3 line)" },
  { id: "normal", label: "Normal" },
  { id: "long", label: "Detail" },
];
export const AI_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];

export const DEFAULT_AI: AiSettings = {
  apiKey: "", model: "gemini-3.5-flash", on: true, dailyLimit: 150, mode: "funny", lang: "auto", length: "short", temperature: 0.9, instructions: "",
};

const ref = () => doc(db, "aiAdmin", "main");
const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (typeof v === "string" && (ok as readonly string[]).includes(v) ? (v as T) : d);

export async function loadAiSettings(): Promise<AiSettings> {
  const s = await getDoc(ref());
  const d = (s.exists() ? s.data() : {}) as Partial<Record<keyof AiSettings, unknown>>;
  const t = Number(d.temperature);
  const lim = Number(d.dailyLimit);
  return {
    apiKey: "",
    model: typeof d.model === "string" && d.model.trim() ? d.model.trim() : DEFAULT_AI.model,
    on: d.on !== false,
    dailyLimit: Number.isFinite(lim) && lim > 0 ? Math.round(lim) : DEFAULT_AI.dailyLimit,
    mode: pick(d.mode, AI_MODES.map((m) => m.id), "funny"),
    lang: pick(d.lang, AI_LANGS.map((m) => m.id), "auto"),
    length: pick(d.length, AI_LENGTHS.map((m) => m.id), "short"),
    temperature: Number.isFinite(t) ? Math.min(1.5, Math.max(0, t)) : DEFAULT_AI.temperature,
    instructions: typeof d.instructions === "string" ? d.instructions : "",
  };
}

export async function saveAiSettings(s: AiSettings): Promise<void> {
  await setDoc(ref(), {
    model: s.model.trim() || DEFAULT_AI.model,
    on: s.on,
    dailyLimit: Math.max(1, Math.round(s.dailyLimit) || DEFAULT_AI.dailyLimit),
    mode: s.mode,
    lang: s.lang,
    length: s.length,
    temperature: Math.min(1.5, Math.max(0, s.temperature)),
    instructions: s.instructions.trim().slice(0, 2500),
    at: Date.now(),
  });
}

export const maskKey = (k: string) => (k.length <= 8 ? "••••" : `${k.slice(0, 4)}••••••${k.slice(-4)}`);

/** Key + model ko seedha Gemini se test karo (admin ke phone se). Ok to null, warna Hinglish error. */
export async function testGemini(_key: string, _model: string): Promise<string | null> {
  try {
    const { auth } = await import("../firebase");
    const user = auth.currentUser;
    if (!user) return "Dobara login karo.";
    const token = await user.getIdToken();
    const r = await fetch(AI_API_URL, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "test" }) });
    const data = await r.json().catch(() => ({}));
    if (r.ok) return null;
    return String(data.error || `AI test fail (${r.status})`);
  } catch { return "AI test nahi ho paaya. Login aur internet check karo."; }
}
