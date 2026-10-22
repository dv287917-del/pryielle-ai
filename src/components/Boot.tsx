import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { sfx } from "../lib/sfx";
import { HauntedBg, Witch } from "./Horror";

const LINES = ["SUMMONING…", "WAKING THE DEAD…", "SOMEONE IS WATCHING…", "DON'T LOOK BEHIND…"];

export function Boot({ children }: { children?: ReactNode }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => {
      setI((n) => (n + 1) % LINES.length);
      void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
      sfx.heartbeat();
    }, 1800);
    return () => window.clearInterval(t);
  }, []);
  return (
    <main className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-ink text-paper">
      <HauntedBg />
      <div className="relative flex flex-col items-center px-6 text-center">
        <Witch className="witch-float logo-pop h-48 w-auto" />
        <p className="blood-text mt-5 flex font-display text-4xl font-bold tracking-[0.18em]">
          {"IRONROSES".split("").map((ch, i) => (
            <span key={i} className="letter" style={{ "--i": i } as CSSProperties}>
              {ch}
            </span>
          ))}
        </p>
        <h1 className="glitch grad-text font-display text-7xl leading-none font-bold" data-text="MSG">
          MSG
        </h1>
        <div className="mt-7 h-1 w-48 overflow-hidden rounded-full bg-paper/10">
          <div className="boot-bar grad h-full w-full" />
        </div>
        <p key={i} className="fade-up mt-3 text-xs tracking-[0.3em] text-paper/45">{LINES[i]}</p>
        {children}
      </div>
    </main>
  );
}
