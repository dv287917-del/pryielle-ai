import { useEffect, useState } from "react";
import { Download, Loader2, ShieldAlert, WifiOff } from "lucide-react";
import { HauntedBg } from "./Horror";
import { downloadUpdate, installDownloaded } from "../lib/update";
import { submitAppeal } from "../lib/security";
import { APP_VERSION } from "../lib/version";
import type { AppConfig, UserDoc } from "../lib/types";
import { errorText } from "../lib/util";

const shell = "safe-top fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-ink px-8 text-center text-paper";

export function PendingScreen({ me, onLogout }: { me: UserDoc; onLogout: () => void }) {
  return (
    <main className={shell}>
      <HauntedBg />
      <div className="relative w-full max-w-sm">
        <p className="float text-6xl">⏳</p>
        <h1 className="grad-text mt-4 font-display text-5xl leading-tight font-bold">Request Bhej Di</h1>
        <p className="mt-3 text-pretty text-paper/75">
          <span className="font-semibold text-paper">{me.displayName}</span>, tumhari request owner ke paas pahunch gayi hai. Approve hote hi app apne aap khul jayega.
        </p>
        <div className="glass mt-6 flex items-center justify-center gap-3 rounded-2xl p-4 text-sm text-paper/70">
          <Loader2 className="size-5 animate-spin text-hot" /> Owner ke jawab ka intezaar…
        </div>
        <p className="mt-3 text-xs text-paper/40">Tumhari ID: {me.publicId} · @{me.username}</p>
        <button type="button" className="tap mt-8 h-11 rounded-xl border border-paper/20 px-6 font-display font-bold" onClick={onLogout}>LOGOUT</button>
      </div>
    </main>
  );
}

export function RejectedScreen({ me, onLogout }: { me: UserDoc; onLogout: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sent = me.appealAt > 0;
  const send = () => {
    setBusy(true);
    setError("");
    submitAppeal(me.uid, text).catch((e) => setError(errorText(e))).finally(() => setBusy(false));
  };
  return (
    <main className={shell}>
      <HauntedBg />
      <div className="relative w-full max-w-sm">
        <p className="text-6xl">🚫</p>
        <h1 className="blood-text mt-4 font-display text-5xl leading-tight font-bold">Rejected</h1>
        <p className="mt-3 text-paper/70">Tumhari request owner ne reject kar di hai.</p>
        <div className="glass mt-4 rounded-2xl p-4 text-left text-sm">
          <p className="text-xs font-semibold tracking-[0.2em] text-paper/50">REASON</p>
          <p className="mt-1 break-words whitespace-pre-wrap text-paper/90">{me.rejectReason || "Koi reason nahi diya gaya."}</p>
        </div>
        {sent ? (
          <div className="glass mt-4 rounded-2xl p-4 text-sm">
            <p className="font-semibold text-emerald-400">Appeal bhej di gayi ✓</p>
            <p className="mt-1 break-words text-paper/60">“{me.appeal}”</p>
            <p className="mt-2 text-xs text-paper/45">Owner dekhega, jawab aane tak ruko.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-left">
            <textarea className="min-h-24 w-full rounded-2xl border border-paper/12 bg-paper/5 p-4 text-sm outline-none focus:border-rose/70" maxLength={300} placeholder="Appeal likho: tumhe kyun andar aane dena chahiye?" value={text} onChange={(e) => setText(e.target.value)} />
            {error ? <p className="text-sm text-rose">{error}</p> : null}
            <button type="button" disabled={busy || text.trim().length < 5} className="btn-hot tap h-12 w-full rounded-2xl font-display text-lg font-bold" onClick={send}>{busy ? "SENDING…" : "APPEAL KARO"}</button>
          </div>
        )}
        <button type="button" className="tap mt-6 h-11 rounded-xl border border-paper/20 px-6 font-display font-bold" onClick={onLogout}>LOGOUT</button>
      </div>
    </main>
  );
}

export function VpnBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <main className={shell}>
      <HauntedBg />
      <div className="relative w-full max-w-sm">
        <span className="float mx-auto grid size-20 place-items-center rounded-3xl bg-rose/15 text-rose"><WifiOff className="size-10" /></span>
        <h1 className="blood-text mt-5 font-display text-4xl leading-tight font-bold">VPN Not Available</h1>
        <p className="mt-3 text-pretty text-paper/75">Is app mein VPN / proxy chalta nahi hai. Please VPN OFF karo aur phir se try karo.</p>
        <button type="button" className="btn-hot tap mt-8 h-13 w-full rounded-2xl font-display text-xl font-bold" onClick={onRetry}>VPN OFF KAR DIYA, RETRY</button>
        <p className="mt-3 text-xs text-paper/40">Ye check apne aap bhi hota rehta hai.</p>
      </div>
    </main>
  );
}

export function BanScreen({ reason, device, onLogout }: { reason: string; device: boolean; onLogout: () => void }) {
  return (
    <main className={shell}>
      <HauntedBg />
      <div className="relative w-full max-w-sm">
        <span className="float mx-auto grid size-20 place-items-center rounded-3xl bg-rose/15 text-rose"><ShieldAlert className="size-10" /></span>
        <h1 className="blood-text mt-5 font-display text-5xl leading-tight font-bold">Account Suspended</h1>
        <p className="mt-3 text-pretty text-paper/70">{device ? "Is device / network par ye app ban hai." : "Tumhara account rules todne ki wajah se band kiya gaya hai."}</p>
        {reason ? (
          <div className="glass mt-4 rounded-2xl p-4 text-left text-sm">
            <p className="text-xs font-semibold tracking-[0.2em] text-paper/50">REASON</p>
            <p className="mt-1 break-words whitespace-pre-wrap text-paper/90">{reason}</p>
          </div>
        ) : null}
        <p className="grad-text mt-6 font-display text-2xl font-bold">Contact Pryielle :)</p>
        <button type="button" className="tap mt-8 h-11 rounded-xl border border-paper/20 px-6 font-display font-bold" onClick={onLogout}>LOGOUT</button>
      </div>
    </main>
  );
}

/** "Mega Update Here" popup: downloads inside the app and opens the installer, no browser / GitHub */
export function UpdateModal({ config, onLater }: { config: AppConfig; onLater: () => void }) {
  const [phase, setPhase] = useState<"idle" | "downloading" | "ready" | "error">("idle");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState("");
  const [needPerm, setNeedPerm] = useState(false);

  const install = () => {
    setError("");
    setNeedPerm(false);
    installDownloaded(config.updateVersion).catch((e) => {
      const m = errorText(e);
      if (/permission/i.test(m) || (e as Error)?.message === "permission") setNeedPerm(true);
      else setError(m);
    });
  };
  const start = () => {
    setPhase("downloading");
    setPct(0);
    setError("");
    downloadUpdate(config, setPct)
      .then(() => {
        setPhase("ready");
        install();
      })
      .catch((e) => {
        setPhase("error");
        setError(errorText(e));
      });
  };
  useEffect(() => { setPhase("idle"); }, [config.updateVersion]);

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/85 px-6 backdrop-blur-sm">
      <div className="pop-in w-full max-w-sm overflow-hidden rounded-3xl border border-paper/15 bg-deep text-center text-paper shadow-[0_30px_80px_-20px_rgba(43,140,255,0.5)]">
        <div className="grad px-6 pt-8 pb-6">
          <span className="float mx-auto grid size-16 place-items-center rounded-2xl bg-white/20 text-white"><Download className="size-8" /></span>
          <p className="mt-3 font-display text-3xl leading-tight font-bold text-white">{config.updateTitle || "Mega Update Here"}</p>
          <p className="text-sm text-white/85">Naya version v{config.updateVersion} (tumhara v{APP_VERSION})</p>
        </div>
        <div className="space-y-4 p-5">
          {config.updateNotes ? <p className="text-sm break-words whitespace-pre-wrap text-paper/80">{config.updateNotes}</p> : <p className="text-sm text-paper/60">Naye features aur fixes ke liye app update karo.</p>}
          {phase === "downloading" ? (
            <div>
              <div className="h-3 overflow-hidden rounded-full bg-paper/10"><div className="grad h-full rounded-full transition-[width] duration-200" style={{ width: `${pct}%` }} /></div>
              <p className="mt-2 text-sm font-semibold text-paper/80">Download ho raha hai… {pct}%</p>
            </div>
          ) : phase === "ready" ? (
            <button type="button" className="btn-hot tap h-13 w-full rounded-2xl font-display text-xl font-bold tracking-wide" onClick={install}>INSTALL KARO</button>
          ) : (
            <button type="button" className="btn-hot tap h-13 w-full rounded-2xl font-display text-xl font-bold tracking-wide" onClick={start}>{phase === "error" ? "DOBARA TRY KARO" : "UPDATE NOW"}</button>
          )}
          {needPerm ? <p className="text-xs text-hot">Settings mein “Is source se install allow” ON karo, phir wapas aake INSTALL KARO dabao.</p> : null}
          {error ? <p className="text-sm break-words text-rose">{error}</p> : null}
          {config.updateForce ? <p className="text-xs font-semibold text-rose">Ye update zaroori hai.</p> : phase === "downloading" ? null : <button type="button" className="tap h-10 w-full text-sm text-paper/60" onClick={onLater}>Baad mein</button>}
        </div>
      </div>
    </div>
  );
}
