import { useState, type CSSProperties } from "react";
import { Avatar } from "./ui";
import { BlueBg, IronRose, Sparkle } from "./Brand";
import type { UserDoc } from "../lib/types";
import { buzz } from "../lib/util";

export function Start({ me, onStart }: { me: UserDoc; onStart: () => void }) {
  const [going, setGoing] = useState(false);
  function start() {
    if (going) return;
    setGoing(true);
    buzz();
    window.requestAnimationFrame(() => window.setTimeout(onStart, 420));
  }
  return (
    <main className={`safe-top relative flex h-dvh flex-col overflow-hidden text-white ${going ? "start-out" : ""}`}>
      <BlueBg />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-between px-6 pt-[8dvh] pb-10 text-center">
        <div className="relative">
          <IronRose className="rose-float size-40 drop-shadow-[0_20px_44px_rgba(120,170,255,0.9)]" />
          <Sparkle className="sparkle-a absolute -right-3 top-2 size-8" />
          <Sparkle className="sparkle-b absolute -left-4 bottom-4 size-5" />
        </div>
        <div className="fade-up flex w-full flex-col items-center" style={{ "--d": 120 } as CSSProperties}>
          <Avatar src={me.avatar} name={me.displayName} size="lg" live />
          <p className="mt-4 text-xs tracking-[0.3em] text-slate-500">WELCOME BACK</p>
          <p className="font-display text-4xl leading-tight font-bold text-slate-900">{me.displayName}</p>
          <p className="mt-2 text-sm text-slate-500">Your ID <span className="font-display text-lg font-bold text-blue-600 tabular-nums">{me.publicId}</span> is ready.</p>
          <button type="button" onClick={start} className="premium-btn tap mt-7 h-14 w-full max-w-xs rounded-2xl font-display text-xl font-bold tracking-[0.2em]">START</button>
        </div>
      </div>
    </main>
  );
}
