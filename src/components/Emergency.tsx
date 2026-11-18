import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { BellRing, Siren, X, Upload, Volume2 } from "lucide-react";
import { Avatar } from "./ui";
import { sfx } from "../lib/sfx";
import hoshUrl from "../assets/sfx/hosh.mp3";
import {
  ALARM_PRESETS, AlarmNative, MAX_ALARM_SECONDS, ackAlarm, isNative, liveState, sendAlarm, stopAlarm,
  watchAlarm, watchAllAlarms, watchEmergencyUsers, importCustomAlarmSound, clearCustomAlarmSound, hasCustomAlarmSound,
  type AlarmDoc, type LiveState,
} from "../lib/alarm";
import type { UserDoc } from "../lib/types";
import { errorText, relTime } from "../lib/util";

const CHIP: Record<LiveState, string> = {
  online: "bg-emerald-500/20 text-emerald-300",
  closed: "bg-amber-500/20 text-amber-300",
  off: "bg-rose/20 text-rose",
  never: "bg-paper/10 text-paper/50",
};
const DOT: Record<LiveState, string> = { online: "bg-emerald-400", closed: "bg-amber-400", off: "bg-rose", never: "bg-paper/30" };

/* ================= admin: Emergency tab ================= */
export function EmergencyTab({ adminName }: { adminName: string }) {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [alarms, setAlarms] = useState<Record<string, AlarmDoc>>({});
  const [filter, setFilter] = useState<"all" | LiveState>("all");
  const [target, setTarget] = useState<UserDoc | null>(null);
  const [now, setNow] = useState(Date.now());
  const [soundMsg, setSoundMsg] = useState("");
  const [hasSound, setHasSound] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => watchEmergencyUsers(setUsers), []);
  useEffect(() => watchAllAlarms(setAlarms), []);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 15_000); return () => window.clearInterval(t); }, []);
  useEffect(() => { void hasCustomAlarmSound().then((r) => setHasSound(r.has)); }, []);

  const rows = useMemo(() => {
    const order: Record<LiveState, number> = { off: 0, closed: 1, online: 2, never: 3 };
    return users
      .filter((u) => (u.approval ?? "approved") === "approved" && !u.banned)
      .map((u) => ({ u, live: liveState(u, now) }))
      .filter((r) => filter === "all" || r.live.state === filter)
      .sort((a, b) => order[a.live.state] - order[b.live.state] || b.u.lastSeen - a.u.lastSeen);
  }, [users, filter, now]);

  const count = (s: LiveState) => users.filter((u) => (u.approval ?? "approved") === "approved" && !u.banned && liveState(u, now).state === s).length;
  const chips: ["all" | LiveState, string][] = [["all", "Sab"], ["off", `Switch Off (${count("off")})`], ["closed", `App band (${count("closed")})`], ["online", `Online (${count("online")})`]];

  const onSoundPick = async (f: File | null) => {
    if (!f) return;
    setSoundMsg("Importing...");
    const r = await importCustomAlarmSound(f);
    if (r.ok) {
      setHasSound(true);
      setSoundMsg(`✓ Sound set (${Math.round((r.bytes || 0) / 1024)} KB). Target devices pe bhi same file lagani hogi ya Storage se push (next).`);
    } else setSoundMsg(r.error || "fail");
  };

  return (
    <div className="space-y-3">
      <p className="rounded-2xl border border-paper/10 bg-paper/5 p-3 text-xs leading-relaxed text-paper/70">
        HARD Emergency: alarm bajte hi volume max lock, service sticky, casual stop ignore. Band sirf yahan se STOP se hota hai. Sound import is device-local (admin phone). Target pe custom sound ke liye Storage push baad mein.
      </p>

      {/* custom sound */}
      <div className="rounded-2xl border border-paper/10 bg-paper/5 p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><Volume2 className="size-4" /> Alarm sound {hasSound ? <span className="text-emerald-400 text-xs font-normal">· custom set</span> : <span className="text-paper/40 text-xs font-normal">· default hosh</span>}</div>
        <div className="flex gap-2">
          <button type="button" className="tap flex-1 h-11 rounded-xl border border-paper/15 bg-paper/5 text-sm flex items-center justify-center gap-2" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Import mp3
          </button>
          <button type="button" className="tap h-11 px-4 rounded-xl border border-paper/15 text-sm text-paper/60" onClick={() => { void clearCustomAlarmSound().then(() => { setHasSound(false); setSoundMsg("Default restore"); }); }}>Reset</button>
        </div>
        <input ref={fileRef} type="file" accept="audio/*,.mp3,.ogg,.wav" className="hidden" onChange={(e) => void onSoundPick(e.target.files?.[0] ?? null)} />
        {soundMsg ? <p className="text-xs text-paper/60">{soundMsg}</p> : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {chips.map(([k, lab]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={clsx("tap rounded-full px-3 py-1.5 text-xs font-medium", filter === k ? "bg-rose/25 text-rose" : "bg-paper/8 text-paper/60")}>{lab}</button>
        ))}
      </div>

      {rows.length ? (
        <ul className="space-y-1.5">
          {rows.map(({ u, live }) => {
            const a = alarms[u.uid];
            const active = a && !a.ack && Date.now() - a.at < a.seconds * 1000 + 30_000;
            return (
              <li key={u.uid} className="flex items-center gap-2 rounded-2xl border border-paper/8 bg-paper/4 px-2.5 py-2">
                <Avatar src={u.avatar} name={u.displayName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.displayName}</p>
                  <p className={clsx("text-[11px]", CHIP[live.state])}>{live.label}{active ? " · 🚨 ACTIVE" : ""}</p>
                </div>
                {active ? (
                  <button type="button" aria-label={`Stop ${u.displayName}`} onClick={() => void stopAlarm(u.uid)} className="tap h-11 shrink-0 rounded-full bg-emerald-500/25 px-3 text-xs font-bold text-emerald-300">STOP</button>
                ) : null}
                <button type="button" aria-label={`Alarm ${u.displayName}`} onClick={() => setTarget(u)} className="tap grid size-11 shrink-0 place-items-center rounded-full bg-rose/20 text-rose"><Siren className="size-5" /></button>
              </li>
            );
          })}
        </ul>
      ) : <p className="pt-10 text-center text-paper/45">Koi nahi mila.</p>}
      {target ? <AlarmSheet u={target} adminName={adminName} onClose={() => setTarget(null)} /> : null}
    </div>
  );
}

function AlarmSheet({ u, adminName, onClose }: { u: UserDoc; adminName: string; onClose: () => void }) {
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const go = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 1) { setMsg("Seconds likho (1 se 3600)"); return; }
    setBusy(true); setMsg("");
    void sendAlarm(u.uid, sec, adminName)
      .then(() => setMsg(`✓ ${Math.min(sec, MAX_ALARM_SECONDS)} sec ka HARD alarm bhej diya`))
      .catch((e) => setMsg(errorText(e)))
      .finally(() => setBusy(false));
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/60" onClick={onClose}>
      <div className="sheet-up w-full space-y-3 rounded-t-3xl bg-deep p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3"><Avatar src={u.avatar} name={u.displayName} size="sm" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">🚨 {u.displayName} ko HARD alarm</p><p className="text-xs text-paper/50">{liveState(u).label}</p></div><button type="button" className="tap p-2" aria-label="Close" onClick={onClose}><X className="size-5" /></button></div>
        <div className="grid grid-cols-3 gap-2">
          {ALARM_PRESETS.map((s) => <button key={s} type="button" disabled={busy} onClick={() => go(s)} className="tap grad h-14 rounded-2xl font-display text-xl font-bold text-white disabled:opacity-50">{s}s</button>)}
        </div>
        <div className="flex gap-2">
          <input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={`Custom seconds (max ${MAX_ALARM_SECONDS})`} className="h-12 min-w-0 flex-1 rounded-2xl border border-paper/12 bg-paper/5 px-4 outline-none focus:border-rose/70" />
          <button type="button" disabled={busy || !custom} onClick={() => go(Number(custom))} className="tap grad h-12 rounded-2xl px-5 font-semibold text-white disabled:opacity-50">Bajao</button>
        </div>
        <button type="button" disabled={busy} onClick={() => { setBusy(true); void stopAlarm(u.uid).then(() => setMsg("✓ STOP bhej diya")).catch((e) => setMsg(errorText(e))).finally(() => setBusy(false)); }} className="tap w-full h-12 rounded-2xl bg-emerald-500/20 font-semibold text-emerald-300">Admin STOP</button>
        {msg ? <p className="text-center text-sm text-paper/70">{msg}</p> : null}
      </div>
    </div>
  );
}

/* ================= user phone: alarm bajna ================= */
export function AlarmHost({ uid }: { uid: string }) {
  const [ring, setRing] = useState<{ by: string; total: number } | null>(null);
  const [left, setLeft] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<number | null>(null);
  const handled = useRef(localStorage.getItem("pry-alarm-id") ?? "");

  const finish = (fromAdmin = false) => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    if (audio.current) { audio.current.pause(); audio.current = null; }
    if (isNative) {
      if (fromAdmin) void AlarmNative.adminStop().catch(() => undefined);
      else void AlarmNative.stop().catch(() => undefined);
    } else navigator.vibrate?.(0);
    setRing(null);
    void ackAlarm(uid);
  };

  const begin = (a: AlarmDoc, seconds: number) => {
    setRing({ by: a.by, total: seconds });
    setLeft(seconds);
    const end = Date.now() + seconds * 1000;
    timer.current = window.setInterval(() => {
      const l = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) finish(false);
    }, 500);
    if (!isNative) {
      sfx.setMuted(false);
      const el = new Audio(hoshUrl);
      el.loop = true; el.volume = 1;
      audio.current = el;
      void el.play().catch(() => undefined);
      navigator.vibrate?.(Array.from({ length: Math.min(60, seconds) }, () => 700).flatMap((v) => [v, 300]));
    }
  };

  useEffect(() => watchAlarm(uid, (a) => {
    // admin deleted doc or set ack → hard stop
    if (!a || a.ack) {
      if (ring || handled.current) {
        finish(true);
        handled.current = "";
        localStorage.removeItem("pry-alarm-id");
      }
      return;
    }
    if (!a.id || a.id === handled.current) return;
    if (Date.now() - a.at > 6 * 3600_000) return;
    handled.current = a.id;
    localStorage.setItem("pry-alarm-id", a.id);
    if (isNative) {
      void AlarmNative.ring({ id: a.id, seconds: a.seconds })
        .then((r) => { if (r.already && r.remaining <= 0) { void ackAlarm(uid); return; } begin(a, Math.max(1, r.already ? r.remaining : a.seconds)); })
        .catch(() => begin(a, a.seconds));
    } else begin(a, a.seconds);
  }), [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); audio.current?.pause(); }, []);

  if (!ring) return null;
  const pct = ring.total ? (left / ring.total) * 100 : 0;
  return (
    <div className="alarm-screen fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 px-8 text-center text-white">
      <BellRing className="alarm-bell size-24" />
      <p className="font-display text-5xl font-bold tracking-wide">ALARM</p>
      <p className="text-lg opacity-90">{ring.by ? `${ring.by} ne` : "Admin ne"} emergency alarm bheja hai</p>
      <p className="text-sm opacity-70">Band nahi hoga — sirf admin STOP</p>
      <p className="font-display text-7xl font-bold tabular-nums">{left}s</p>
      <div className="h-2 w-64 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
