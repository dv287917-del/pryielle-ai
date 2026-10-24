import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import clsx from "clsx";
import { Check, ChevronRight, Copy, KeyRound, Lock, Megaphone, Search, ShieldCheck, Sparkles, SquarePlay, Users } from "lucide-react";
import { STATUS_META, type Presence, type UserDoc } from "../lib/types";
import { Avatar, Badges } from "./ui";

type Go = "chats" | "find" | "squads" | "me";

const STATUS_DOT: Record<Presence, string> = { free: "#34d399", playing: "#a78bfa", busy: "#f87171", squad: "#fbbf24" };
const delay = (ms: number) => ({ "--d": ms }) as CSSProperties;

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

/** Number smoothly upar chadhta hai (sirf yeh chhota component re-render hota hai). */
function useCountUp(to: number, ms = 750) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const root = document.documentElement;
    const calm = root.dataset.perf === "low" || root.dataset.motion === "reduced";
    if (calm) { from.current = to; setV(to); return; }
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(a + (to - a) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step); else from.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

function Stat({ label, value, hot, onClick }: { label: string; value: number; hot?: boolean; onClick: () => void }) {
  const n = useCountUp(value);
  return (
    <button type="button" onClick={onClick} className="tap flex flex-col items-start gap-1.5 px-4 py-3.5 text-left">
      <span className={clsx("font-display text-[1.9rem] leading-none font-bold tabular-nums", hot ? "text-hot" : "text-paper")}>{n}</span>
      <span className="flex items-center gap-1.5 text-xs font-medium text-paper/50">
        {hot ? <i className="live-dot" /> : null}{label}
      </span>
    </button>
  );
}

function ListRow({ icon, label, hint, onClick, tone }: { icon: ReactNode; label: string; hint?: string; onClick: () => void; tone?: string }) {
  return (
    <button type="button" onClick={onClick} className="tap flex h-14 w-full items-center gap-3 px-4 text-left">
      <span className={clsx("grid size-8 shrink-0 place-items-center rounded-lg bg-paper/8", tone)}>{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold">{label}{hint ? <span className="ml-2 text-xs font-medium text-hot">{hint}</span> : null}</span>
      <ChevronRight className="size-4 shrink-0 text-paper/35" />
    </button>
  );
}

export function HomeView(p: {
  me: UserDoc; isAdmin: boolean; banner: string | null; maintenance: boolean;
  chatCount: number; unread: number; squadCount: number;
  stories: ReactNode; requestCount: number; requests: ReactNode; floatBtn: ReactNode;
  onTab: (t: Go) => void; onNewSquad: () => void; onJoin: () => void; onSecret: () => void; onAi: () => void; onAdmin: () => void; onYoutube: () => void; onStatus: (s: Presence) => void;
}) {
  const { me } = p;
  const keys = Object.keys(STATUS_META) as Presence[];
  const [opt, setOpt] = useState<Presence | null>(null);
  useEffect(() => setOpt(null), [me.status]);
  const cur = opt ?? me.status;
  const idx = keys.indexOf(cur);

  const [copied, setCopied] = useState(false);
  const copyId = () => {
    void navigator.clipboard?.writeText(String(me.publicId)).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1400); }).catch(() => undefined);
  };

  const actions = [
    { label: "Find people", icon: Search, run: () => p.onTab("find"), primary: true },
    { label: "New squad", icon: Users, run: p.onNewSquad, primary: false },
    { label: "Join code", icon: KeyRound, run: p.onJoin, primary: false },
  ];

  return (
    <div className="hv">
      <header className="rise flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-paper/50">{greeting()}</p>
          <h1 className="truncate font-display text-[2.1rem] leading-[1.05] font-bold">{me.displayName}</h1>
        </div>
        <button type="button" className="tap shrink-0" aria-label="Profile" onClick={() => p.onTab("me")}>
          <Avatar src={me.avatar} name={me.displayName} size="md" live />
        </button>
      </header>

      {p.stories}

      <section className="rise card grid grid-cols-3 divide-x divide-paper/8 overflow-hidden" style={delay(70)}>
        <Stat label="Chats" value={p.chatCount} onClick={() => p.onTab("chats")} />
        <Stat label="Unread" value={p.unread} hot={p.unread > 0} onClick={() => p.onTab("chats")} />
        <Stat label="Squads" value={p.squadCount} onClick={() => p.onTab("squads")} />
      </section>

      {p.banner ? (
        <div className="rise flex items-start gap-3 rounded-2xl border border-hot/25 bg-hot/8 p-3.5" style={delay(110)}>
          <Megaphone className="mt-0.5 size-[1.1rem] shrink-0 text-hot" />
          <p className="min-w-0 flex-1 text-sm leading-snug font-medium break-words whitespace-pre-wrap">{p.banner}</p>
        </div>
      ) : null}

      <section className="rise grid grid-cols-3 gap-2.5" style={delay(150)}>
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.label} type="button" onClick={a.run} className={clsx("tap flex flex-col items-center gap-2 rounded-2xl px-2 py-3.5 text-[0.8rem] font-semibold", a.primary ? "grad text-white shadow-[0_8px_24px_-10px_var(--c2)]" : "card text-paper/85")}>
              <Icon className="size-5" strokeWidth={2} />
              {a.label}
            </button>
          );
        })}
      </section>

      <section className="rise" style={delay(190)}>
        <p className="mb-2 text-xs font-semibold text-paper/45">Status</p>
        <div className="seg card" style={{ "--n": keys.length, "--i": Math.max(0, idx) } as CSSProperties}>
          <i className="seg-thumb" style={{ opacity: idx < 0 ? 0 : 1 }} />
          {keys.map((s) => (
            <button key={s} type="button" onClick={() => { setOpt(s); p.onStatus(s); }} className={clsx("tap relative z-[1] flex h-10 items-center justify-center gap-1.5 rounded-xl text-[0.76rem] font-semibold transition-colors duration-200", cur === s ? "text-paper" : "text-paper/55")}>
              <i className="size-1.5 rounded-full" style={{ background: STATUS_DOT[s] }} />
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </section>

      {p.requestCount > 0 ? (
        <section className="rise" style={delay(220)}>
          <p className="mb-2 text-xs font-semibold text-paper/45">Message requests · {p.requestCount}</p>
          {p.requests}
        </section>
      ) : null}

      <section className="rise card divide-y divide-paper/8 overflow-hidden" style={delay(250)}>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">@{me.username}<Badges u={me} /></p>
            <p className="mt-0.5 truncate text-xs text-paper/45">{me.ffRank ? `${me.ffRank}` : "Your account"}{me.ffUid ? ` · FF ${me.ffUid}` : ""}</p>
          </div>
          <button type="button" onClick={copyId} aria-label="Copy ID" className="tap flex h-9 items-center gap-1.5 rounded-full bg-paper/8 px-3 text-sm font-semibold tabular-nums">
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5 text-paper/50" />}
            {copied ? "Copied" : `ID ${me.publicId}`}
          </button>
        </div>
        <ListRow icon={<Sparkles className="size-4" />} label="Pryielle AI" hint="Photo, file, voice" tone="text-aqua" onClick={p.onAi} />
        <ListRow icon={<Lock className="size-4" />} label="Secret" tone="text-rose" onClick={p.onSecret} />
      <ListRow icon={<SquarePlay className="size-4" />} label="YouTube" hint="Long + Shorts" onClick={p.onYoutube} />
        {p.isAdmin ? <ListRow icon={<ShieldCheck className="size-4" />} label="Admin panel" hint={p.maintenance ? "Maintenance ON" : undefined} tone="text-hot" onClick={p.onAdmin} /> : null}
        {p.floatBtn}
      </section>
    </div>
  );
}
