import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useUser } from "../lib/hooks";
import { adminSetCounts, listFollows, parseCount, type CountPatch } from "../lib/follow";
import type { UserDoc } from "../lib/types";
import { errorText, pushBack } from "../lib/util";
import { Avatar, Badges } from "./ui";

function Row({ uid, onOpen }: { uid: string; onOpen: (uid: string) => void }) {
  const u = useUser(uid);
  return (
    <li>
      <button type="button" className="tap flex w-full items-center gap-3 px-4 py-2.5 text-left" onClick={() => onOpen(uid)}>
        <Avatar src={u?.avatar ?? null} name={u?.displayName ?? "?"} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center truncate font-semibold">{u?.displayName ?? "…"}{u ? <Badges u={u} /> : null}</span>
          <span className="block truncate text-sm text-paper/55">@{u?.username ?? "…"}</span>
        </span>
      </button>
    </li>
  );
}

/** Followers / Following ki list (Instagram jaisa). Asli follows dikhte hain. */
export function FollowList({ uid, mode, onClose, onOpenProfile }: { uid: string; mode: "followers" | "following"; onClose: () => void; onOpenProfile: (uid: string) => void }) {
  const [ids, setIds] = useState<string[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => pushBack(onClose), [onClose]);
  useEffect(() => {
    let alive = true;
    setIds(null);
    setErr("");
    void listFollows(uid, mode).then((l) => { if (alive) setIds(l); }).catch((e) => { if (alive) { setIds([]); setErr(errorText(e)); } });
    return () => { alive = false; };
  }, [uid, mode]);
  return (
    <div className="sheet-up safe-top fixed inset-0 z-[60] flex flex-col bg-ink text-paper">
      <header className="flex h-14 shrink-0 items-center gap-1 px-2">
        <button type="button" className="tap grid size-11 place-items-center" aria-label="Back" onClick={onClose}><ChevronLeft className="size-7" /></button>
        <p className="text-xl font-bold">{mode === "followers" ? "Followers" : "Following"}</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        {ids === null ? <p className="pt-16 text-center text-paper/55">Loading…</p> : err ? <p className="px-6 pt-16 text-center text-sm text-rose">{err}</p> : ids.length === 0 ? (
          <p className="px-6 pt-16 text-center text-paper/55">{mode === "followers" ? "Abhi koi follower nahi." : "Abhi kisi ko follow nahi kiya."}</p>
        ) : <ul>{ids.map((id) => <Row key={id} uid={id} onOpen={onOpenProfile} />)}</ul>}
      </div>
    </div>
  );
}

/** Admin: kisi ke bhi followers / following / posts custom set karo (1M, 2.5M, 500k…). Khali chhodke Set = asli count wapas. */
export function FollowEditor({ u, onChanged }: { u: UserDoc; onChanged: (n: UserDoc) => void }) {
  const init = (v: number | null | undefined) => (typeof v === "number" ? String(v) : "");
  const [f, setF] = useState(init(u.followersCustom));
  const [g, setG] = useState(init(u.followingCustom));
  const [p, setP] = useState(init(u.postsCustom));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const field = "h-9 w-full min-w-0 rounded-lg border border-paper/15 bg-paper/5 px-2 text-sm outline-none focus:border-rose/70";

  async function save() {
    const a = parseCount(f), b = parseCount(g), c = parseCount(p);
    if (a === undefined || b === undefined || c === undefined) { setMsg("Number galat hai. Aise likho: 1M, 2.5M, 500k, 1200000"); return; }
    const patch: CountPatch = { followersCustom: a, followingCustom: b, postsCustom: c };
    setBusy(true);
    setMsg("");
    try {
      await adminSetCounts(u.uid, patch);
      onChanged({ ...u, ...patch });
      setMsg("Save ho gaya ✓");
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-paper/12 p-2.5">
      <p className="text-[0.65rem] font-semibold tracking-widest text-paper/45">CUSTOM COUNTS (khali = asli)</p>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        <label className="min-w-0 text-[0.65rem] text-paper/50">Followers<input className={field} value={f} inputMode="text" placeholder="asli" onChange={(e) => setF(e.target.value)} /></label>
        <label className="min-w-0 text-[0.65rem] text-paper/50">Following<input className={field} value={g} inputMode="text" placeholder="asli" onChange={(e) => setG(e.target.value)} /></label>
        <label className="min-w-0 text-[0.65rem] text-paper/50">Posts<input className={field} value={p} inputMode="text" placeholder="asli" onChange={(e) => setP(e.target.value)} /></label>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" disabled={busy} className="tap h-9 flex-1 rounded-lg grad text-xs font-bold text-white" onClick={() => void save()}>{busy ? "SAVING…" : "SET"}</button>
        <button type="button" disabled={busy} className="tap h-9 rounded-lg border border-paper/20 px-3 text-xs font-bold" onClick={() => { setF(""); setG(""); setP(""); setMsg("Ab SET dabao, asli count wapas aa jayega"); }}>RESET</button>
      </div>
      {msg ? <p className="mt-1.5 text-xs text-paper/70">{msg}</p> : null}
    </div>
  );
}
