import { useEffect, useState, type ReactNode } from "react";
import { RoseEmblem, Sparkle, useStatusBar } from "./Brand";

const LINES = ["Warming up…", "Securing your chats…", "Polishing the roses…", "Almost there…"];

export function Boot({ children }: { children?: ReactNode }) {
  const [i, setI] = useState(0);
  useStatusBar("#051a96");
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % LINES.length), 1500);
    return () => window.clearInterval(t);
  }, []);
  return (
    <main className="ir-sky relative flex h-dvh flex-col items-center overflow-hidden text-white">
      <span className="ir-glow" style={{ width: 340, height: 340, left: "50%", top: "30%", marginLeft: -170, marginTop: -170 }} />
      <div className="relative flex h-full w-full flex-col items-center px-6 pt-[22dvh] text-center">
        <div className="relative">
          <span className="ir-glow" style={{ width: 230, height: 230, left: -25, top: -25 }} />
          <div className="ir-bloom ir-float relative">
            <RoseEmblem className="h-[180px] w-[180px]" spin />
          </div>
          <Sparkle className="top-0 -right-4 size-5" d={300} />
          <Sparkle className="bottom-3 -left-6 size-4" d={1100} />
          <Sparkle className="-top-3 left-4 size-3" d={1800} />
        </div>
        <h1 className="ir-rise mt-9 font-display text-[2.7rem] leading-none font-bold tracking-[0.04em]" style={{ "--d": 250 } as never}>
          <span className="ir-shine">IronRoses</span>
        </h1>
        <p className="ir-rise mt-2 text-[0.7rem] font-semibold tracking-[0.55em] text-white/80" style={{ "--d": 380 } as never}>MSG</p>
        <div className="ir-rise mt-10 flex flex-col items-center gap-3" style={{ "--d": 520 } as never}>
          <div className="ir-bar"><i /></div>
          <p key={i} className="fade-up text-xs tracking-[0.18em] text-white/85">{LINES[i]}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
