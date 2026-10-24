import { useEffect, useState, type ReactNode } from "react";
import { BlueBg, IronRose, Sparkle } from "./Brand";

const LINES = ["Starting up…", "Securing your space…", "Syncing chats…", "Almost there…"];

export function Boot({ children }: { children?: ReactNode }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % LINES.length), 1500);
    return () => window.clearInterval(t);
  }, []);
  return (
    <main className="relative flex h-dvh flex-col items-center justify-center overflow-hidden text-white">
      <BlueBg />
      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="relative grid size-44 place-items-center">
          <span className="boot-halo absolute inset-0 rounded-full" />
          <span className="boot-ring absolute inset-2 rounded-full" />
          <IronRose className="rose-float relative size-32 drop-shadow-[0_18px_40px_rgba(120,170,255,0.85)]" />
          <Sparkle className="sparkle-a absolute -right-1 top-3 size-7" />
          <Sparkle className="sparkle-b absolute -left-2 bottom-6 size-4" />
        </div>
        <h1 className="shine-text mt-6 font-display text-5xl leading-none font-bold tracking-[0.12em]">IronRoses</h1>
        <p className="mt-1 text-xs font-semibold tracking-[0.55em] text-white/70">MSG</p>
        <div className="mt-9 h-1 w-52 overflow-hidden rounded-full bg-white/20">
          <div className="boot-slide h-full w-1/3 rounded-full bg-white shadow-[0_0_16px_4px_rgba(255,255,255,0.7)]" />
        </div>
        <p key={i} className="fade-up mt-4 text-xs tracking-[0.25em] text-white/75">{LINES[i]}</p>
        {children}
      </div>
    </main>
  );
}
