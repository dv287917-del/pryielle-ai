import { useCallback, useEffect, useState } from "react";
import { collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, limit, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { UserDoc } from "./types";

/* Followers system: ek follow = ek doc `follows/{follower}_{target}`. Counts server se gine jaate hain. */
const fid = (follower: string, target: string) => `${follower}_${target}`;

export async function followUser(me: string, target: string) {
  if (me === target) return;
  await setDoc(doc(db, "follows", fid(me, target)), { follower: me, target, at: Date.now() });
}
export const unfollowUser = (me: string, target: string) => deleteDoc(doc(db, "follows", fid(me, target)));

export async function listFollows(uid: string, mode: "followers" | "following"): Promise<string[]> {
  const q = query(collection(db, "follows"), where(mode === "followers" ? "target" : "follower", "==", uid), limit(200));
  const s = await getDocs(q);
  const key = mode === "followers" ? "follower" : "target";
  return s.docs.map((d) => String((d.data() as Record<string, unknown>)[key] ?? "")).filter(Boolean);
}

/** Asli counts + kya main isko follow karta hoon. */
export function useFollowStats(uid: string, meUid: string) {
  const [state, setState] = useState({ followers: 0, following: 0, mine: false, ready: false });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const col = collection(db, "follows");
    void Promise.all([
      getCountFromServer(query(col, where("target", "==", uid))),
      getCountFromServer(query(col, where("follower", "==", uid))),
      uid === meUid ? Promise.resolve(null) : getDoc(doc(db, "follows", fid(meUid, uid))),
    ])
      .then(([a, b, m]) => { if (alive) setState({ followers: a.data().count, following: b.data().count, mine: Boolean(m && m.exists()), ready: true }); })
      .catch(() => { if (alive) setState((s) => ({ ...s, ready: true })); });
    return () => { alive = false; };
  }, [uid, meUid, tick]);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const toggle = useCallback(async () => {
    if (uid === meUid) return;
    const was = state.mine;
    setState((s) => ({ ...s, mine: !was, followers: Math.max(0, s.followers + (was ? -1 : 1)) }));
    try {
      if (was) await unfollowUser(meUid, uid); else await followUser(meUid, uid);
    } catch {
      setState((s) => ({ ...s, mine: was, followers: Math.max(0, s.followers + (was ? 1 : -1)) }));
    }
  }, [uid, meUid, state.mine]);
  return { ...state, refresh, toggle };
}

/** Admin ka custom number ho to wahi dikhta hai, warna asli. */
export const shownCount = (custom: number | null | undefined, real: number) => (typeof custom === "number" && custom >= 0 ? custom : real);
export const postsOf = (u: Pick<UserDoc, "postsCustom" | "postsCount">) => shownCount(u.postsCustom, Number(u.postsCount) || 0);

/** 1234 -> 1,234 | 12300 -> 12.3K | 2500000 -> 2.5M */
export function fmtCount(n: number) {
  const v = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  if (v < 10_000) return v.toLocaleString("en-US");
  if (v < 1_000_000) return `${Math.floor(v / 100) / 10}K`;
  if (v < 1_000_000_000) return `${Math.floor(v / 100_000) / 10}M`;
  return `${Math.floor(v / 100_000_000) / 10}B`;
}

/** "1M", "2.5m", "500k", "1,200,000" -> number. Khali = null (asli count wapas). Galat = undefined. */
export function parseCount(raw: string): number | null | undefined {
  const t = raw.trim().toLowerCase().replace(/[,\s_]/g, "");
  if (!t) return null;
  const m = /^(\d+(?:\.\d+)?)([kmb]?)$/.exec(t);
  if (!m) return undefined;
  const mult = m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : m[2] === "b" ? 1e9 : 1;
  const n = Math.round(Number(m[1]) * mult);
  return n >= 0 && n <= 9_999_999_999 ? n : undefined;
}

export type CountPatch = { followersCustom?: number | null; followingCustom?: number | null; postsCustom?: number | null };
export const adminSetCounts = (uid: string, patch: CountPatch) => updateDoc(doc(db, "users", uid), patch);
