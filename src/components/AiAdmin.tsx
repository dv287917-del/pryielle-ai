import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Loader2, Save, Zap } from "lucide-react";
import {
  AI_LANGS, AI_LENGTHS, AI_MODELS, AI_MODES, DEFAULT_AI, loadAiSettings, saveAiSettings, testGemini, type AiSettings,
} from "../lib/aiAdmin";
import { errorText } from "../lib/util";
import { Toggle } from "./ui";

const label = "text-[0.65rem] font-semibold tracking-widest text-paper/45";
const input = "w-full rounded-xl border border-paper/15 bg-paper/5 px-3 py-2.5 text-sm outline-none focus:border-rose/60";

/* ================= Admin -> 🤖 AI tab (Gemini) ================= */
export function AiAdminTab() {
  const [s, setS] = useState<AiSettings | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void loadAiSettings().then(setS).catch((e) => { setS(DEFAULT_AI); setMsg({ ok: false, text: errorText(e) }); });
  }, []);

  if (!s) return <p className="pt-8 text-center text-paper/55">Load ho raha hai…</p>;
  const set = (p: Partial<AiSettings>) => setS({ ...s, ...p });

  const save = async () => {
    setBusy("save");
    setMsg(null);
    try {
      const next = { ...s, apiKey: "" };
      await saveAiSettings(next);
      setS(next);
      setMsg({ ok: true, text: "Save ho gaya ✅ (naya jawab turant isi setting se aayega)" });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy("");
    }
  };

  const test = async () => {
    setBusy("test");
    setMsg(null);
    const err = await testGemini("", s.model);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: "Vercel server-side Gemini key chal rahi hai ✅" });
    setBusy("");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-paper/10 bg-paper/5 p-3 text-xs leading-relaxed text-paper/60">
        <p className="font-semibold text-paper/80">Vercel AI setup (key browser/Firestore mein save nahi hoti):</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
          <li>Vercel Project → Settings → Environment Variables kholo.</li>
          <li><b>GEMINI_API_KEY</b> mein Google AI Studio ki Gemini API key add karo.</li>
          <li><b>FIREBASE_SERVICE_ACCOUNT_JSON</b> mein Firebase service-account JSON ka poora content add karo.</li>
          <li>Dono variables add karne ke baad redeploy karo, phir yahan Test dabao.</li>
        </ol>
        <p className="mt-1">Secret key sirf Vercel server par rahegi. Use GitHub ya app ke code mein mat daalna.</p>
      </div>

      <button type="button" onClick={() => set({ on: !s.on })} className="glass tap flex w-full items-center justify-between rounded-2xl p-3 text-left">
        <span><span className="block text-sm font-semibold">AI chalu hai</span><span className="block text-xs text-paper/50">Band karoge to /ai aur AI chat dono band</span></span>
        <Toggle on={s.on} />
      </button>

      <section className="space-y-2">
        <p className={label}>MODEL</p>
        <input value={s.model} onChange={(e) => set({ model: e.target.value })} autoCapitalize="off" spellCheck={false} className={clsx(input, "font-mono")} />
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {AI_MODELS.map((m) => <button key={m} type="button" onClick={() => set({ model: m })} className={clsx("tap h-8 shrink-0 rounded-full px-3 font-mono text-[0.7rem] font-semibold", s.model === m ? "grad text-white" : "glass")}>{m}</button>)}
        </div>
        <p className="text-[0.7rem] text-paper/45">Model nahi mila to AI khud <span className="font-mono">gemini-flash-latest</span> try karta hai.</p>
      </section>

      <section className="space-y-2">
        <p className={label}>AI KA MODE (kaisa bolega)</p>
        <div className="grid grid-cols-2 gap-2">
          {AI_MODES.map((m) => (
            <button key={m.id} type="button" onClick={() => set({ mode: m.id })} className={clsx("tap rounded-2xl p-3 text-left", s.mode === m.id ? "grad text-white" : "glass")}>
              <span className="block text-sm font-bold">{m.label}</span>
              <span className={clsx("block text-[0.65rem] leading-tight", s.mode === m.id ? "text-white/80" : "text-paper/50")}>{m.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className={label}>BHASHA</p>
        <div className="flex flex-wrap gap-2">
          {AI_LANGS.map((l) => <button key={l.id} type="button" onClick={() => set({ lang: l.id })} className={clsx("tap h-9 rounded-full px-3 text-xs font-semibold", s.lang === l.id ? "grad text-white" : "glass")}>{l.label}</button>)}
        </div>
        <p className={clsx(label, "pt-1")}>JAWAB KITNA LAMBA</p>
        <div className="flex flex-wrap gap-2">
          {AI_LENGTHS.map((l) => <button key={l.id} type="button" onClick={() => set({ length: l.id })} className={clsx("tap h-9 rounded-full px-3 text-xs font-semibold", s.length === l.id ? "grad text-white" : "glass")}>{l.label}</button>)}
        </div>
      </section>

      <section className="space-y-2">
        <p className={label}>CUSTOM INSTRUCTIONS (users se kaise baat karni hai)</p>
        <textarea value={s.instructions} onChange={(e) => set({ instructions: e.target.value.slice(0, 2500) })} rows={6} placeholder={"Jaise: Users ko 'bhai' bol ke bulao. Free Fire ke tips do. Kabhi lamba mat bolo. Mera naam Pryielle hai, mere baare mein poochhe to bolo wo owner hain."} className={clsx(input, "resize-none leading-relaxed")} />
        <p className="text-right text-[0.65rem] text-paper/40">{s.instructions.length}/2500 · safety rules in instructions se upar rehte hain</p>
      </section>

      <section className="space-y-2">
        <p className={label}>LIMITS</p>
        <label className="flex items-center justify-between gap-3 text-sm">Har user ke liye roz ke messages
          <input type="number" inputMode="numeric" min={1} max={5000} value={s.dailyLimit} onChange={(e) => set({ dailyLimit: Number(e.target.value) })} className={clsx(input, "w-24 text-center")} />
        </label>
        <label className="block text-sm">Creativity: <b>{s.temperature.toFixed(1)}</b> <span className="text-xs text-paper/45">(kam = seedha, zyada = rangeen)</span>
          <input type="range" min={0} max={1.5} step={0.1} value={s.temperature} onChange={(e) => set({ temperature: Number(e.target.value) })} className="mt-1 w-full accent-[var(--c1,#ff2e63)]" />
        </label>
      </section>

      {msg ? <p className={clsx("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose/15 text-rose")}>{msg.text}</p> : null}

      <div className="flex gap-2">
        <button type="button" disabled={busy !== ""} onClick={() => void test()} className="glass tap flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold">
          {busy === "test" ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Test
        </button>
        <button type="button" disabled={busy !== ""} onClick={() => void save()} className="grad tap flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl text-sm font-bold text-white">
          {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : msg?.ok && busy === "" ? <Check className="size-4" /> : <Save className="size-4" />} Save
        </button>
      </div>
    </div>
  );
}
