import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BlueBg, IronRose, Sparkle } from "./Brand";
import { APP_VERSION } from "../lib/version";

const LINES = ["Starting up…", "Securing your space…", "Syncing chats…", "Polishing roses…", "Almost there…"];
const NAME = "IronRoses".split("");
const DOTS = [0, 1, 2, 3, 4, 5];

export function Boot({ children }: { children?: ReactNode }) {
  const [i, setI] = useState(0);
  const [pct, setPct] = useState(3);
  const t0 = useRef(performance.now());

  useEffect(() => {
    const t = window.setInterval(() => setI((n) => Math.min(n + 1, LINES.length - 1)), 1700);
    return () => window.clearInterval(t);
  }, []);

  // Fake-but-honest progress: tezi se 70% tak, phir dheere-dheere 96% par ruk kar asli load ka intezaar.
  useEffect(() => {
    const t = window.setInterval(() => {
      const s = (performance.now() - t0.current) / 1000;
      setPct(Math.min(96, Math.round(96 * (1 - Math.exp(-s / 2.4)))));
    }, 140);
    return () => window.clearInterval(t);
  }, []);

  return (
    <main className="boot relative flex h-dvh flex-col items-center justify-center overflow-hidden text-white">
      <BlueBg />
      <i className="boot-orb boot-orb-a" />
      <i className="boot-orb boot-orb-b" />

      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="boot-stage relative grid size-56 place-items-center">
          <span className="boot-halo absolute inset-3 rounded-full" />
          <span className="boot-conic absolute inset-0 rounded-full" />
          <span className="boot-dash absolute inset-5 rounded-full" />
          <span className="boot-orbit absolute inset-0">
            {DOTS.map((d) => <i key={d} style={{ "--a": `${d * 60}deg`, "--o": 1 - d * 0.14 } as CSSProperties} />)}
          </span>
          <IronRose className="boot-rose relative size-32 drop-shadow-[0_18px_40px_rgba(120,170,255,0.85)]" />
          <Sparkle className="sparkle-a absolute right-1 top-5 size-7" />
          <Sparkle className="sparkle-b absolute left-0 bottom-8 size-4" />
          <Sparkle className="sparkle-a absolute left-6 top-2 size-3" />
        </div>

        <h1 className="boot-title mt-5 font-display text-5xl leading-none font-bold" aria-label="IronRoses">
          {NAME.map((ch, k) => <span key={k} style={{ "--k": k } as CSSProperties}>{ch}</span>)}
        </h1>
        <p className="boot-msg mt-2 text-xs font-semibold text-white/75">MSG</p>

        <div className="boot-track mt-9 w-60">
          <div className="boot-fill" style={{ transform: `scaleX(${pct / 100})` }} />
          <i className="boot-gloss" />
        </div>
        <div className="mt-3 flex w-60 items-center justify-between text-[0.7rem] tracking-[0.2em] text-white/75">
          <p key={i} className="fade-up">{LINES[i]}</p>
          <span className="tabular-nums font-semibold text-white">{pct}%</span>
        </div>
        {children}
      </div>

      <p className="absolute bottom-6 text-[0.65rem] tracking-[0.3em] text-white/45" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>v{APP_VERSION}</p>
    </main>
  );
}
