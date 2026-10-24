import { useEffect, useRef, useState } from "react";
import { Loader2, Rocket, X } from "lucide-react";
import { packSrcDoc, type Pack } from "../lib/packs";
import type { UserDoc } from "../lib/types";

const storeKey = (packId: string, uid: string) => `pack:${packId}:${uid}`;
const readStore = (k: string): Record<string, unknown> => {
  try { return JSON.parse(localStorage.getItem(k) || "{}") as Record<string, unknown>; } catch { return {}; }
};

/** Full-screen sandbox: pack ka code alag (opaque origin) iframe mein chalta hai — app ka data/Firebase touch nahi kar sakta, internet bhi band. */
export function PackHost({ pack, me, preview, onClose, onPublish }: {
  pack: Pack; me: UserDoc; preview?: boolean; onClose: () => void; onPublish?: () => Promise<void> | void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const key = storeKey(pack.id, me.uid);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => { setReady(false); }, [pack.id, pack.rev]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { pry?: number; type?: string; key?: string; value?: unknown; text?: string } | null;
      if (!d || d.pry !== 1) return;
      if (d.type === "ready") {
        setReady(true);
        frame.current?.contentWindow?.postMessage({
          pry: 1, type: "init", store: readStore(key),
          user: { uid: meRef.current.uid, name: meRef.current.displayName, username: meRef.current.username, avatar: meRef.current.avatar ?? "", publicId: meRef.current.publicId },
        }, "*");
      } else if (d.type === "set" && typeof d.key === "string") {
        const s = readStore(key);
        s[d.key.slice(0, 60)] = d.value;
        try { const j = JSON.stringify(s); if (j.length < 400_000) localStorage.setItem(key, j); } catch { /* storage full */ }
      } else if (d.type === "close") closeRef.current();
      else if (d.type === "toast" && typeof d.text === "string") { setToast(d.text.slice(0, 120)); window.setTimeout(() => setToast(""), 2200); }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [key]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0b1630] text-white pop-in">
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <span className="text-xl">{pack.icon}</span>
        <p className="min-w-0 flex-1 truncate text-sm font-bold">{pack.title}</p>
        {preview ? <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[0.65rem] font-bold text-amber-300">PREVIEW</span> : null}
        <button type="button" onClick={onClose} aria-label="Close" className="tap grid size-9 place-items-center rounded-full bg-white/10"><X className="size-4" /></button>
      </header>
      <div className="relative min-h-0 flex-1">
        {!ready ? <div className="absolute inset-0 grid place-items-center"><Loader2 className="size-6 animate-spin text-white/60" /></div> : null}
        <iframe ref={frame} title={pack.title} key={`${pack.id}-${pack.rev}`} sandbox="allow-scripts allow-modals" srcDoc={packSrcDoc(pack.html)} className="absolute inset-0 h-full w-full border-0 bg-[#0b1630]" />
        {toast ? <div className="fade-up pointer-events-none absolute inset-x-6 bottom-6 rounded-xl bg-black/70 px-4 py-2 text-center text-sm">{toast}</div> : null}
      </div>
      {preview && onPublish ? (
        <footer className="flex gap-2 border-t border-white/10 bg-black/30 p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <button type="button" onClick={onClose} className="glass tap h-12 flex-1 rounded-xl text-sm font-bold">Aur badlo</button>
          <button type="button" disabled={busy} onClick={() => { setBusy(true); void Promise.resolve(onPublish()).finally(() => setBusy(false)); }} className="grad tap flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl text-sm font-bold text-white">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} Publish now
          </button>
        </footer>
      ) : null}
    </div>
  );
}
