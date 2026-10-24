import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Download, Eye, ImagePlus, Loader2, Paperclip, Plus, Rocket, Send, Trash2, Undo2, X } from "lucide-react";
import {
  askBuilder, deletePack, makeImage, publishPack, savePackDraft, unpublishPack, watchAdminPacks,
  type AdminPack, type BuilderAttachment, type BuilderFile, type BuilderTurn,
} from "../lib/packs";
import { readDataUrl } from "../lib/media";
import { errorText } from "../lib/util";
import type { UserDoc } from "../lib/types";
import { PackHost } from "./PackHost";

type Msg = {
  id: number; role: "user" | "assistant"; text: string; thumbs?: string[];
  packId?: string; files?: BuilderFile[]; image?: { data: string; mime: string }; pending?: boolean; error?: boolean;
};

const MAX_ATT = 4;
const MAX_TOTAL = 3_000_000; // Vercel body limit ~4.5MB; base64 ~33% bada

async function fileToAttachment(f: File): Promise<{ att: BuilderAttachment; thumb?: string }> {
  if (f.type.startsWith("image/")) {
    const data = await shrinkImage(f);
    return { att: { kind: "image", mime: "image/jpeg", name: f.name, data: data.split(",")[1] ?? "" }, thumb: data };
  }
  if (f.type.startsWith("video/")) {
    const frames = await videoFrames(f, 6);
    return { att: { kind: "image", mime: "image/jpeg", name: `${f.name} (6 frames)`, data: frames.map((x) => x.split(",")[1] ?? "") as unknown as string }, thumb: frames[0] };
  }
  if (f.type === "application/pdf") {
    if (f.size > 2_200_000) throw new Error("PDF 2 MB se chhota rakho.");
    const d = await readDataUrl(f);
    return { att: { kind: "pdf", mime: "application/pdf", name: f.name, data: d.split(",")[1] ?? "" } };
  }
  if (f.size > 400_000) throw new Error("Text/code file 400 KB se chhoti rakho.");
  return { att: { kind: "text", name: f.name, text: await f.text() } };
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Image khul nahi payi")); i.src = src; });
}
async function shrinkImage(f: Blob, max = 1280): Promise<string> {
  const src = URL.createObjectURL(f);
  try {
    const img = await loadImg(src);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(src); }
}
/** Video ko AI "padh" sake isliye us ke barabar-doori wale frames nikalte hain (awaaz nahi sunta). */
async function videoFrames(f: File, n: number): Promise<string[]> {
  const url = URL.createObjectURL(f);
  try {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    await new Promise<void>((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error("Video khul nahi payi")); });
    const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
    const out: string[] = [];
    const k = Math.min(1, 640 / Math.max(v.videoWidth || 640, v.videoHeight || 640));
    const c = document.createElement("canvas");
    c.width = Math.round((v.videoWidth || 640) * k); c.height = Math.round((v.videoHeight || 360) * k);
    for (let i = 0; i < n; i += 1) {
      v.currentTime = Math.min(dur - 0.05, (dur * (i + 0.5)) / n);
      await new Promise<void>((res) => { v.onseeked = () => res(); });
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      out.push(c.toDataURL("image/jpeg", 0.7));
    }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

const save = (name: string, mime: string, content: string, b64 = false) => {
  const bytes = b64 ? Uint8Array.from(atob(content), (c) => c.charCodeAt(0)) : new TextEncoder().encode(content);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes], { type: mime }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

/* ================= Admin -> 🛠 AI Builder ================= */
export function AiBuilderTab({ me }: { me: UserDoc }) {
  const [packs, setPacks] = useState<AdminPack[]>([]);
  const [view, setView] = useState<"chat" | "packs">("chat");
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, role: "assistant", text: "Bolo kya banana hai 😎\n\n• “Home par daily quiz feature banao”\n• “Ek image banao: neon rose logo”\n• Photo/video/file attach karke bolo “is jaisa UI banao”\n\nFeature pehle sirf aapko dikhega (Preview). Aap Publish dabaoge tabhi sabko milega." }]);
  const [text, setText] = useState("");
  const [atts, setAtts] = useState<{ att: BuilderAttachment; thumb?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [curId, setCurId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<AdminPack | null>(null);
  const [err, setErr] = useState("");
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => watchAdminPacks(setPacks, (e) => setErr(errorText(e))), []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, view]);

  const byId = useMemo(() => new Map(packs.map((p) => [p.id, p])), [packs]);
  const cur = curId ? byId.get(curId) ?? null : null;
  const previewPack = preview ? byId.get(preview) ?? null : null;
  const push = (m: Omit<Msg, "id">) => { const id = idRef.current++; setMsgs((l) => [...l, { ...m, id }]); return id; };
  const patch = (id: number, p: Partial<Msg>) => setMsgs((l) => l.map((m) => (m.id === id ? { ...m, ...p } : m)));

  const pickFiles = async (list: FileList | null) => {
    if (!list) return;
    setErr("");
    try {
      const next = [...atts];
      for (const f of Array.from(list)) {
        if (next.length >= MAX_ATT) break;
        next.push(await fileToAttachment(f));
      }
      const size = next.reduce((n, a) => n + JSON.stringify(a.att).length, 0);
      if (size > MAX_TOTAL) throw new Error("Attachments bahut bade hain (~3 MB limit). Chhoti photo/video lo.");
      setAtts(next);
    } catch (e) { setErr(errorText(e)); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = async () => {
    const t = text.trim();
    if ((!t && !atts.length) || busy) return;
    setBusy(true); setErr("");
    const sent = atts;
    // video ke frames ek hi attachment mein array ban kar aate hain -> flatten
    const flat: BuilderAttachment[] = sent.flatMap((a) => (Array.isArray(a.att.data)
      ? (a.att.data as unknown as string[]).map((d, i) => ({ kind: "image" as const, mime: "image/jpeg", name: `${a.att.name ?? "video"} #${i + 1}`, data: d }))
      : [a.att]));
    push({ role: "user", text: t || "(attachment)", thumbs: sent.map((a) => a.thumb).filter(Boolean) as string[] });
    setText(""); setAtts([]);
    const pid = push({ role: "assistant", text: "Soch raha hoon… (feature banane mein 20-40 second lag sakte hain)", pending: true });
    try {
      const history: BuilderTurn[] = msgs.filter((m) => m.id !== 0 && !m.pending && !m.error).slice(-12).map((m) => ({ role: m.role, text: m.text.slice(0, 3000) }));
      history.push({ role: "user", text: t || "Is attachment ko dekho aur batao / banao." });
      const r = await askBuilder(history, flat, cur ? { title: cur.title, html: cur.html } : null);
      let packId: string | undefined;
      if (r.pack) {
        const saved = await savePackDraft(cur ? cur.id : null, r.pack, cur?.rev ?? 0);
        packId = saved.id; setCurId(saved.id);
      }
      patch(pid, { text: r.reply || "Ho gaya ✅", pending: false, packId, files: r.files });
      if (r.imagePrompt) {
        const iid = push({ role: "assistant", text: "Image ban rahi hai…", pending: true });
        try {
          const im = await makeImage(r.imagePrompt, flat.find((a) => a.kind === "image"));
          patch(iid, { text: im.text || "Ye lo image 🎨", pending: false, image: { data: im.image, mime: im.mime } });
        } catch (e) { patch(iid, { text: errorText(e), pending: false, error: true }); }
      }
    } catch (e) { patch(pid, { text: errorText(e), pending: false, error: true }); }
    finally { setBusy(false); }
  };

  const doPublish = async (p: AdminPack) => {
    try { await publishPack(p); setConfirm(null); setPreview(null); push({ role: "assistant", text: `🚀 “${p.title}” publish ho gaya — ab sabhi users ke Home par live dikh raha hai.` }); }
    catch (e) { setErr(errorText(e)); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {([["chat", "💬 Builder"], ["packs", `📦 Features (${packs.length})`]] as const).map(([id, l]) => (
          <button key={id} type="button" onClick={() => setView(id)} className={clsx("tap h-10 rounded-xl text-sm font-bold", view === id ? "grad text-white" : "glass")}>{l}</button>
        ))}
      </div>

      {err ? <p className="rounded-xl bg-rose/15 p-3 text-sm text-rose">{err}</p> : null}

      {view === "chat" ? (
        <>
          <div className="flex items-center justify-between gap-2 text-xs text-paper/55">
            <span className="min-w-0 truncate">{cur ? `Edit ho raha hai: ${cur.icon} ${cur.title}` : "Naya feature"}</span>
            {cur ? <button type="button" onClick={() => setCurId(null)} className="tap flex h-8 shrink-0 items-center gap-1 rounded-full bg-paper/10 px-3 font-semibold"><Plus className="size-3.5" /> Naya feature</button> : null}
          </div>

          <div className="space-y-2.5">
            {msgs.map((m) => {
              const p = m.packId ? byId.get(m.packId) : null;
              return (
                <div key={m.id} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={clsx("max-w-[92%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap", m.role === "user" ? "grad text-white" : m.error ? "bg-rose/15 text-rose" : "glass")}>
                    {m.thumbs?.length ? <div className="flex gap-1.5">{m.thumbs.map((t, i) => <img key={i} src={t} alt="" className="size-14 rounded-lg object-cover" />)}</div> : null}
                    <p className="flex items-start gap-2">{m.pending ? <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" /> : null}<span>{m.text}</span></p>
                    {m.image ? (
                      <div className="space-y-1.5">
                        <img src={`data:${m.image.mime};base64,${m.image.data}`} alt="AI image" className="w-full rounded-xl" />
                        <button type="button" onClick={() => save(`ai-image-${Date.now()}.${m.image!.mime.includes("png") ? "png" : "jpg"}`, m.image!.mime, m.image!.data, true)} className="tap flex h-9 items-center gap-1.5 rounded-lg bg-paper/10 px-3 text-xs font-bold"><Download className="size-3.5" /> Download</button>
                      </div>
                    ) : null}
                    {m.files?.map((f, i) => (
                      <button key={i} type="button" onClick={() => save(f.name, f.mime || "text/plain", f.content)} className="tap flex h-10 w-full items-center gap-2 rounded-xl bg-paper/10 px-3 text-left text-xs font-bold"><Download className="size-4 shrink-0" /><span className="truncate">{f.name}</span></button>
                    ))}
                    {p ? (
                      <div className="rounded-xl border border-paper/15 bg-black/20 p-2.5">
                        <p className="truncate font-bold">{p.icon} {p.title} <span className="text-[0.65rem] font-semibold text-amber-300">DRAFT v{p.rev}</span></p>
                        {p.summary ? <p className="mt-0.5 text-xs text-paper/60">{p.summary}</p> : null}
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => setPreview(p.id)} className="glass tap flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold"><Eye className="size-4" /> Preview</button>
                          <button type="button" onClick={() => setConfirm(p)} className="grad tap flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold text-white"><Rocket className="size-4" /> Publish</button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {atts.length ? (
            <div className="flex flex-wrap gap-2">
              {atts.map((a, i) => (
                <span key={i} className="glass flex h-9 items-center gap-1.5 rounded-full pr-1 pl-3 text-xs font-semibold">
                  <span className="max-w-32 truncate">{a.att.name}</span>
                  <button type="button" aria-label="Remove" onClick={() => setAtts((l) => l.filter((_, j) => j !== i))} className="tap grid size-7 place-items-center rounded-full bg-paper/10"><X className="size-3.5" /></button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="sticky bottom-0 flex items-end gap-2 bg-gradient-to-t from-black/40 to-transparent pt-2">
            <input ref={fileRef} type="file" multiple accept="image/*,video/*,application/pdf,.txt,.md,.json,.js,.ts,.tsx,.html,.css,.csv" className="hidden" onChange={(e) => void pickFiles(e.target.files)} />
            <button type="button" aria-label="Attach" onClick={() => fileRef.current?.click()} className="glass tap grid size-11 shrink-0 place-items-center rounded-full"><Paperclip className="size-5" /></button>
            <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 4000))} rows={1} placeholder="Kya banana hai? (feature / image / file)" className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-paper/15 bg-paper/5 px-3.5 py-2.5 text-sm outline-none focus:border-rose/60" />
            <button type="button" aria-label="Send" disabled={busy || (!text.trim() && !atts.length)} onClick={() => void send()} className="grad tap grid size-11 shrink-0 place-items-center rounded-full text-white disabled:opacity-50">{busy ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}</button>
          </div>
          <p className="flex items-center gap-1.5 text-[0.65rem] text-paper/40"><ImagePlus className="size-3.5" /> Video ke 6 frames AI dekhta hai (awaaz nahi sunta). Attachments ~3 MB tak.</p>
        </>
      ) : (
        <ul className="space-y-2.5">
          {packs.length === 0 ? <p className="pt-8 text-center text-paper/55">Abhi koi feature nahi bana. Builder mein bolo 👆</p> : null}
          {packs.map((p) => (
            <li key={p.id} className="glass space-y-2 rounded-2xl p-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{p.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{p.title}</p>
                  <p className="text-[0.7rem] text-paper/50">v{p.rev} · {p.live ? (p.dirty ? "LIVE (nayi draft pending)" : "🟢 LIVE sabko") : "Draft"}</p>
                </div>
              </div>
              {p.summary ? <p className="text-xs text-paper/60">{p.summary}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPreview(p.id)} className="glass tap flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold"><Eye className="size-3.5" /> Preview</button>
                <button type="button" onClick={() => { setCurId(p.id); setView("chat"); push({ role: "assistant", text: `“${p.title}” edit mode mein hai. Bolo kya badalna hai.` }); }} className="glass tap h-9 rounded-lg px-3 text-xs font-bold">✏️ Edit with AI</button>
                {!p.live || p.dirty ? <button type="button" onClick={() => setConfirm(p)} className="grad tap flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white"><Rocket className="size-3.5" /> {p.live ? "Update live" : "Publish"}</button> : null}
                {p.live ? <button type="button" onClick={() => void unpublishPack(p.id).catch((e) => setErr(errorText(e)))} className="tap flex h-9 items-center gap-1.5 rounded-lg bg-amber-400/20 px-3 text-xs font-bold text-amber-300"><Undo2 className="size-3.5" /> Unpublish</button> : null}
                <button type="button" onClick={() => { if (window.confirm(`“${p.title}” hamesha ke liye delete karein?`)) void deletePack(p.id).then(() => { if (curId === p.id) setCurId(null); }).catch((e) => setErr(errorText(e))); }} className="tap grid size-9 place-items-center rounded-lg bg-rose/15 text-rose" aria-label="Delete"><Trash2 className="size-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {previewPack ? <PackHost pack={previewPack} me={me} preview onClose={() => setPreview(null)} onPublish={() => setConfirm(previewPack)} /> : null}

      {confirm ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-5" onClick={() => setConfirm(null)}>
          <div className="glass w-full max-w-sm space-y-3 rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-bold">{confirm.icon} Publish karna hai?</p>
            <p className="text-sm text-paper/70">“{confirm.title}” (v{confirm.rev}) turant sabhi users ke Home par aa jayega — update karne ki zaroorat nahi. Galti hui to Unpublish se wapas le sakte ho.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="glass tap h-12 flex-1 rounded-xl text-sm font-bold">Abhi nahi</button>
              <button type="button" onClick={() => void doPublish(confirm)} className="grad tap h-12 flex-1 rounded-xl text-sm font-bold text-white">Haan, publish</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
