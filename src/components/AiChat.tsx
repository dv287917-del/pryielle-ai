import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import clsx from "clsx";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Share } from "@capacitor/share";
import { ArrowUp, Camera, Copy, FileText, Globe, Mic, Paperclip, Share2, Sparkles, Square, Trash2, X } from "lucide-react";
import { askAi, fileToAttachment, listen, loadHistory, saveHistory, speechSupported, type AiAttachment, type AiTurn } from "../lib/ai";
import { pushBack } from "../lib/util";

type View = { role: "user" | "assistant"; text: string; imgs?: string[]; files?: string[] };
type Pick = { id: number; att: AiAttachment; preview: string | null };

const MAX_FILES = 4;
const ACCEPT = "image/*,application/pdf,text/*,.json,.csv,.md,.js,.jsx,.ts,.tsx,.py,.java,.kt,.html,.css,.sql,.yml,.yaml,.xml,.txt,.log";
const LANGS: [string, string][] = [["hi-IN", "हिं"], ["en-IN", "EN"]];
const IDEAS = ["Ek funny joke suna 😄", "Free Fire ke liye pro tips do", "Python mein calculator code bana do", "Mujhe ek mast roast likh do (halka)"];

/* ---------- chhota markdown (bold, `code`, ``` blocks) ---------- */
function inline(s: string, k: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) return <strong key={`${k}${i}`}>{p.slice(2, -2)}</strong>;
    if (p.length > 2 && p.startsWith("`") && p.endsWith("`")) return <code key={`${k}${i}`} className="ai-icode">{p.slice(1, -1)}</code>;
    return <Fragment key={`${k}${i}`}>{p}</Fragment>;
  });
}
function Plain({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        if (line.trim() === "") return <div key={i} className="h-2" />;
        const head = /^#{1,4}\s+(.*)$/.exec(line);
        if (head) return <p key={i} className="mt-1 font-display text-base font-bold">{inline(head[1], `h${i}`)}</p>;
        return <p key={i} className="break-words whitespace-pre-wrap">{inline(line, `l${i}`)}</p>;
      })}
    </>
  );
}
function Md({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /```[\w+#-]*\n?([\s\S]*?)```/g;
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    if (m.index > last) out.push(<Plain key={n++} text={text.slice(last, m.index)} />);
    out.push(<pre key={n++} className="ai-code"><code>{m[1].replace(/\n$/, "")}</code></pre>);
    last = m.index + m[0].length;
    m = re.exec(text);
  }
  if (last < text.length) out.push(<Plain key={n++} text={text.slice(last)} />);
  return <>{out}</>;
}

export function AiChat({ uid, name, onClose }: { uid: string; name: string; onClose: () => void }) {
  const [view, setView] = useState<View[]>(() => loadHistory(uid).map((t) => ({ role: t.role, text: t.text })));
  const [input, setInput] = useState("");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tip, setTip] = useState("");
  const [listening, setListening] = useState(false);
  const [langIdx, setLangIdx] = useState(0);
  const [copied, setCopied] = useState(-1);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const stopMic = useRef<(() => void) | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const fileIn = useRef<HTMLInputElement | null>(null);
  const camIn = useRef<HTMLInputElement | null>(null);
  const pickId = useRef(0);

  useEffect(() => pushBack(() => closeRef.current()), []);
  useEffect(() => () => { stopMic.current?.(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [view, busy]);
  useEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = "auto";
    a.style.height = `${Math.min(a.scrollHeight, 140)}px`;
  }, [input]);

  const turnsOf = (v: View[]): AiTurn[] => v.map((x) => ({ role: x.role, text: x.text }));

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (busy || (!text && picks.length === 0)) return;
    stopMic.current?.();
    setErr("");
    setTip("");
    const sent = picks;
    const shown: View = {
      role: "user",
      text: text || "Is file/photo ko dekho aur batao",
      imgs: sent.filter((p) => p.preview).map((p) => p.preview as string),
      files: sent.filter((p) => !p.preview).map((p) => p.att.name),
    };
    const next = [...view, shown];
    setView(next);
    setInput("");
    setPicks([]);
    setBusy(true);
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    try {
      const reply = await askAi(turnsOf(next), sent.map((p) => p.att));
      const done = [...next, { role: "assistant" as const, text: reply }];
      setView(done);
      saveHistory(uid, turnsOf(done));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI abhi jawab nahi de pa raha.");
      saveHistory(uid, turnsOf(next));
    } finally {
      setBusy(false);
    }
  };

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setErr("");
    const room = MAX_FILES - picks.length;
    if (room <= 0) { setErr(`Ek baar mein sirf ${MAX_FILES} files.`); return; }
    const files = Array.from(list).slice(0, room);
    const added: Pick[] = [];
    for (const f of files) {
      try {
        const att = await fileToAttachment(f);
        pickId.current += 1;
        added.push({ id: pickId.current, att, preview: att.kind === "image" ? `data:image/jpeg;base64,${att.data}` : null });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "File add nahi ho paayi.");
      }
    }
    if (added.length) setPicks((p) => [...p, ...added]);
  };

  const lastAi = () => [...view].reverse().find((v) => v.role === "assistant")?.text ?? "";

  const chip = (kind: "explain" | "summary" | "translate" | "code") => {
    const t = input.trim();
    if (kind === "explain") void send(t ? `${t}\n\n(Isko detail mein, step by step explain karo.)` : lastAi() ? "Pichle jawab ko detail mein, step by step explain karo." : "");
    else if (kind === "summary") void send(t ? `Is ka chhota summary do:\n\n${t}` : picks.length ? "Is file/photo ka chhota summary do." : "Ab tak ki baatcheet ka chhota summary do.");
    else if (kind === "translate") {
      const src = t || lastAi();
      if (!src) { setErr("Pehle kuch likho ya bolo, phir Hindi translate dabao."); return; }
      void send(`Neeche ka text Hindi (Devanagari) mein translate karo. Sirf translation do, aur kuch nahi:\n\n${src}`);
    } else if (t) void send(`Iske liye poora kaam karne wala code bana do (explanation chhota rakho):\n\n${t}`);
    else { setTip("Likho ya bolo ki kya banana hai, phir 💻 Code dabao."); area.current?.focus(); }
  };

  const toggleMic = () => {
    if (listening) { stopMic.current?.(); return; }
    if (!speechSupported()) {
      setTip("Keyboard ke 🎤 mic se bolo (Hindi/English dono chalta hai), wo seedha yahan likh dega.");
      area.current?.focus();
      return;
    }
    setErr("");
    const base = input.trim();
    setListening(true);
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    stopMic.current = listen(LANGS[langIdx][0], (t) => setInput(base ? `${base} ${t}` : t), (e) => {
      setListening(false);
      if (e && e !== "no-speech" && e !== "aborted") {
        setTip("Mic nahi chal paaya. Keyboard ke 🎤 mic se bolo, ya mic ki permission do.");
      }
    });
  };

  const copy = async (i: number, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(i); window.setTimeout(() => setCopied(-1), 1500); } catch { setTip("Copy nahi ho paaya."); }
  };
  const share = async (text: string) => { try { await Share.share({ text }); } catch { /* user ne cancel kiya */ } };
  const clear = () => { setView([]); saveHistory(uid, []); setErr(""); setTip(""); };

  const canSend = !busy && (input.trim().length > 0 || picks.length > 0);

  return (
    <div className="ai-root fixed inset-0 z-[75] flex flex-col bg-ink text-paper">
      <header className="safe-top flex items-center gap-3 border-b border-paper/10 px-3 pt-3 pb-3">
        <button type="button" aria-label="Back" onClick={onClose} className="tap grid size-10 shrink-0 place-items-center rounded-full bg-paper/8"><X className="size-5" /></button>
        <span className="ai-orb grid size-10 shrink-0 place-items-center rounded-full text-xl">🤖</span>
        <div className="min-w-0 flex-1">
          <p className="ai-name truncate font-display text-lg leading-tight font-bold">Pryielle AI</p>
          <p className="truncate text-xs text-paper/50">Photo, PDF, file, voice — kuch bhi bhejo</p>
        </div>
        {view.length ? <button type="button" aria-label="Nayi chat" onClick={clear} className="tap grid size-10 shrink-0 place-items-center rounded-full bg-paper/8 text-paper/70"><Trash2 className="size-5" /></button> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {view.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center pt-8 text-center">
            <span className="ai-orb ai-orb-big grid size-24 place-items-center rounded-full text-5xl">🤖</span>
            <p className="ai-name mt-4 font-display text-2xl font-bold">Namaste {name.split(" ")[0]}! 😎</p>
            <p className="mt-1 text-sm text-paper/60">Main Pryielle AI. Photo, PDF ya code bhejo, ya bas gappe maaro.</p>
            <p className="mt-1 text-xs text-paper/40">Group chat mein bhi likh sakte ho: <span className="ai-icode">/ai kuch bhi</span></p>
            <div className="mt-5 flex w-full flex-col gap-2">
              {IDEAS.map((s, i) => (
                <button key={s} type="button" onClick={() => { setInput(s); area.current?.focus(); }} className="ai-idea tap fade-up rounded-2xl px-4 py-3 text-left text-sm" style={{ "--d": 100 + i * 70 } as CSSProperties}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {view.map((v, i) =>
              v.role === "user" ? (
                <div key={i} className="ml-auto flex max-w-[85%] flex-col items-end gap-1">
                  {v.imgs?.length ? <div className="flex flex-wrap justify-end gap-1">{v.imgs.map((src, j) => <img key={j} src={src} alt="" className="size-28 rounded-xl object-cover" />)}</div> : null}
                  {v.files?.length ? <div className="flex flex-wrap justify-end gap-1">{v.files.map((f, j) => <span key={j} className="flex items-center gap-1 rounded-full bg-paper/10 px-2.5 py-1 text-xs"><FileText className="size-3.5" />{f}</span>)}</div> : null}
                  <div className="bubble-me msg-me rounded-2xl rounded-br-md px-3 py-2"><p className="break-words whitespace-pre-wrap">{v.text}</p></div>
                </div>
              ) : (
                <div key={i} className="mr-auto flex max-w-[92%] items-end gap-2">
                  <span className="ai-orb mb-1 grid size-8 shrink-0 place-items-center rounded-full text-base">🤖</span>
                  <div className="min-w-0">
                    <div className="bubble-ai msg-them rounded-2xl rounded-bl-md px-3 py-2"><Md text={v.text} /></div>
                    <div className="mt-1 flex gap-1 pl-1 text-paper/45">
                      <button type="button" onClick={() => void copy(i, v.text)} className="tap flex h-7 items-center gap-1 rounded-full px-2 text-xs"><Copy className="size-3.5" />{copied === i ? "Copied" : "Copy"}</button>
                      <button type="button" onClick={() => void share(v.text)} className="tap flex h-7 items-center gap-1 rounded-full px-2 text-xs"><Share2 className="size-3.5" />Share</button>
                    </div>
                  </div>
                </div>
              ),
            )}
            {busy ? (
              <div className="mr-auto flex items-end gap-2">
                <span className="ai-orb mb-1 grid size-8 shrink-0 place-items-center rounded-full text-base">🤖</span>
                <div className="bubble-ai pop-in flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3">
                  <span className="typing-dot size-2 rounded-full bg-paper/80" /><span className="typing-dot size-2 rounded-full bg-paper/80" /><span className="typing-dot size-2 rounded-full bg-paper/80" />
                  <span className="ml-1 text-xs text-paper/60">soch raha hai...</span>
                </div>
              </div>
            ) : null}
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="border-t border-paper/10 bg-ink/95 px-3 pt-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}>
        {err ? <p className="mb-1 rounded-xl bg-rose/15 px-3 py-1.5 text-xs text-rose">{err}</p> : null}
        {tip && !err ? <p className="mb-1 rounded-xl bg-aqua/10 px-3 py-1.5 text-xs text-aqua">{tip}</p> : null}
        {picks.length ? (
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {picks.map((p) => (
              <div key={p.id} className="relative shrink-0">
                {p.preview ? <img src={p.preview} alt="" className="size-16 rounded-xl object-cover" /> : <div className="flex h-16 w-24 flex-col items-center justify-center gap-1 rounded-xl bg-paper/10 px-1 text-[10px]"><FileText className="size-5" /><span className="w-full truncate text-center">{p.att.name}</span></div>}
                <button type="button" aria-label="Hatao" onClick={() => setPicks((x) => x.filter((y) => y.id !== p.id))} className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-black text-white"><X className="size-3" /></button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
          <button type="button" disabled={busy} onClick={() => chip("explain")} className="ai-chip tap shrink-0"><Sparkles className="size-3.5" />Explain kar</button>
          <button type="button" disabled={busy} onClick={() => chip("summary")} className="ai-chip tap shrink-0">📝 Summary</button>
          <button type="button" disabled={busy} onClick={() => chip("translate")} className="ai-chip tap shrink-0"><Globe className="size-3.5" />Hindi mein translate</button>
          <button type="button" disabled={busy} onClick={() => chip("code")} className="ai-chip tap shrink-0">💻 Code bana</button>
        </div>
        <div className="flex items-end gap-1.5">
          <button type="button" aria-label="File bhejo" onClick={() => fileIn.current?.click()} className="tap grid size-11 shrink-0 place-items-center rounded-full bg-paper/8"><Paperclip className="size-5" /></button>
          <button type="button" aria-label="Camera" onClick={() => camIn.current?.click()} className="tap grid size-11 shrink-0 place-items-center rounded-full bg-paper/8"><Camera className="size-5" /></button>
          <textarea
            ref={area} rows={1} value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Bol raha hu... sun raha hu 👂" : "Kuch bhi pucho ya bolo..."}
            className="max-h-36 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-paper/12 bg-paper/5 px-3.5 py-2.5 outline-none focus:border-aqua/70"
          />
          <button type="button" aria-label={listening ? "Mic band" : "Bol ke likho"} onClick={toggleMic} onContextMenu={(e) => { e.preventDefault(); setLangIdx((i) => (i + 1) % LANGS.length); }} className={clsx("tap relative grid size-11 shrink-0 place-items-center rounded-full", listening ? "ai-mic-on text-white" : "bg-paper/8")}>
            {listening ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
          </button>
          <button type="button" aria-label="Bhejo" disabled={!canSend} onClick={() => void send()} className={clsx("tap grid size-11 shrink-0 place-items-center rounded-full", canSend ? "grad text-white" : "bg-paper/8 text-paper/30")}><ArrowUp className="size-5" /></button>
        </div>
        <button type="button" onClick={() => setLangIdx((i) => (i + 1) % LANGS.length)} className="mt-1 text-[11px] text-paper/40">🎤 bolne ki bhasha: <b className="text-paper/70">{LANGS[langIdx][1]}</b> (badalne ke liye tap)</button>
        <input ref={fileIn} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={camIn} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
      </div>
    </div>
  );
}
