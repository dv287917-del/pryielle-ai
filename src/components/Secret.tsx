import { useEffect, useRef, useState } from "react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Delete, Lock, Play, X } from "lucide-react";
import { pushBack } from "../lib/util";
import { sfx } from "../lib/sfx";
import { PackHost } from "./PackHost";
import type { Pack } from "../lib/packs";
import type { UserDoc } from "../lib/types";

type Phase = "pin" | "locked" | "count" | "boom";

/* PIN (2303) ka SHA-256 hash, plain text app mein nahi */
const PIN_HASH = "8c548efea2d3fe541e9ce87fdd55192bb95b98ea8975125affe3e9344faf51a9";
async function pinOk(pin: string): Promise<boolean> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pry-secret-v1:${pin}`));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("") === PIN_HASH;
  } catch {
    return false;
  }
}

function Chains({ wild }: { wild: boolean }) {
  const links = (x1: number, y1: number, x2: number, y2: number) => {
    const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    return Array.from({ length: 11 }, (_, i) => {
      const t = i / 10;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      const flat = i % 2 === 0;
      return (
        <rect key={i} x={x - (flat ? 11 : 6)} y={y - (flat ? 6 : 10)} width={flat ? 22 : 12} height={flat ? 12 : 20} rx="6" transform={`rotate(${ang} ${x} ${y})`} fill="none" stroke="#8c8f96" strokeWidth="3.4" />
      );
    });
  };
  return (
    <svg viewBox="0 0 300 300" className={`chains mx-auto w-[78vw] max-w-sm ${wild ? "chains-wild" : ""}`} aria-hidden="true">
      <g>{links(14, 56, 286, 244)}</g>
      <g>{links(286, 56, 14, 244)}</g>
      <path d="M118 140 V112 a32 32 0 0 1 64 0 V140" fill="none" stroke="#9a9ca3" strokeWidth="11" strokeLinecap="round" />
      <rect x="104" y="136" width="92" height="82" rx="12" fill="#1c1b20" stroke="#8c8f96" strokeWidth="3.4" />
      <circle cx="150" cy="170" r="10" fill="#d4122f" className="lock-eye" />
      <rect x="146" y="176" width="8" height="22" rx="3" fill="#d4122f" className="lock-eye" />
    </svg>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export function Secret({ onClose, pack, me }: { onClose: () => void; pack?: Pack | null; me: UserDoc }) {
  const [phase, setPhase] = useState<Phase>("pin");
  const [n, setN] = useState(5);
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(0);
  const [checking, setChecking] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => pushBack(() => closeRef.current()), []);
  useEffect(() => () => sfx.stopFiles(), []);

  const press = (k: string) => {
    if (checking || phase !== "pin") return;
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    if (k === "del") { setPin((p) => p.slice(0, -1)); return; }
    if (!k || pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length < 4) return;
    setChecking(true);
    void pinOk(next).then((ok) => {
      if (ok) {
        void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
        window.setTimeout(() => { setPhase("locked"); setChecking(false); }, 350);
      } else {
        void Haptics.vibrate({ duration: 300 }).catch(() => undefined);
        setWrong((w) => w + 1);
        window.setTimeout(() => { setPin(""); setChecking(false); }, 450);
      }
    });
  };

  useEffect(() => {
    if (phase !== "count") return;
    let left = 5;
    setN(5);
    sfx.heartbeat();
    const t = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        window.clearInterval(t);
        setPhase("boom");
        return;
      }
      setN(left);
      sfx.heartbeat();
      void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "boom") void Haptics.vibrate({ duration: 300 }).catch(() => undefined);
  }, [phase]);

  return (
    <div className={`secret-root fixed inset-0 z-[80] overflow-hidden bg-black text-paper`}>
      <button type="button" aria-label="Close" onClick={onClose} className="tap safe-top absolute top-3 right-3 z-20 grid size-10 place-items-center rounded-full bg-black/60 text-paper/80">
        <X className="size-5" />
      </button>


      {phase === "pin" ? (
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <Lock className="lock-pulse size-12 text-rose" />
          <p className="blood-text fade-up mt-4 font-display text-3xl font-bold tracking-[0.3em]">PASSWORD</p>
          <p className="fade-up mt-1 text-sm text-paper/55" style={{ "--d": 100 } as React.CSSProperties}>Start karne se pehle 4 digit code dalo</p>
          <div key={wrong} className={`pin-dots mt-6 flex gap-4 ${wrong ? "pin-wrong" : ""}`}>
            {[0, 1, 2, 3].map((i) => <span key={i} className={`pin-dot ${i < pin.length ? "pin-dot-on" : ""}`} />)}
          </div>
          <p className="mt-3 h-5 text-sm font-semibold text-rose">{wrong && pin.length === 0 ? "Galat code. Dobara try karo." : ""}</p>
          <div className="mt-3 grid w-72 grid-cols-3 gap-3">
            {KEYS.map((k, i) => (
              <button key={i} type="button" disabled={!k} aria-label={k === "del" ? "Delete" : k || undefined} onClick={() => press(k)} className={`pin-key tap fade-up h-16 rounded-full font-display text-2xl font-bold ${k ? "" : "invisible"}`} style={{ "--d": 140 + i * 30 } as React.CSSProperties}>
                {k === "del" ? <Delete className="mx-auto size-6" /> : k}
              </button>
            ))}
          </div>
        </div>
      ) : phase !== "boom" ? (
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <Chains wild={phase === "count"} />
          {phase === "locked" ? (
            <>
              <p className="blood-text fade-up mt-6 flex items-center gap-2 font-display text-4xl font-bold tracking-[0.3em]"><Lock className="size-7" /> UNLOCKED</p>
              <p className="fade-up mt-2 max-w-xs text-paper/55" style={{ "--d": 120 } as React.CSSProperties}>Code sahi hai. Zanjeeren tod di… ab START dabao.</p>
              <div className="start-wrap fade-up mt-9" style={{ "--d": 240 } as React.CSSProperties}>
                <button type="button" onClick={() => { void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined); setPhase("count"); }} className="start-btn start-btn-pro relative h-16 w-60 rounded-full font-display text-2xl font-bold tracking-[0.35em]">
                  <Play className="mr-2 inline size-6 -translate-y-0.5 fill-current" />START
                </button>
              </div>
            </>
          ) : (
            <div className="count-wrap mt-4">
              <svg viewBox="0 0 200 200" className="count-ring" aria-hidden="true">
                <circle cx="100" cy="100" r="88" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="6" />
                <circle key={n} cx="100" cy="100" r="88" fill="none" stroke="#ff2a4d" strokeWidth="6" strokeLinecap="round" className="count-arc" />
              </svg>
              <p key={n} className="count-pop count-num font-display font-bold text-rose">{n}</p>
            </div>
          )}
        </div>
      ) : pack ? (
        <PackHost pack={pack} me={me} bare onClose={onClose} />
      ) : (
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <Lock className="size-12 text-rose" />
          <p className="fade-up mt-5 font-display text-2xl font-bold">Not available</p>
          <p className="fade-up mt-1 text-paper/60" style={{ "--d": 100 } as React.CSSProperties}>Coming soon</p>
          <button type="button" onClick={onClose} className="tap glass fade-up mt-8 h-12 w-48 rounded-full font-semibold" style={{ "--d": 200 } as React.CSSProperties}>Band karo</button>
        </div>
      )}
    </div>
  );
}
