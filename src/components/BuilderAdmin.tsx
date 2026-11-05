// Owner ke liye: Builder access requests approve / reject, aur approved builders revoke.
// Firestore rules (firestore.rules) me ye sab sirf isAdmin (owner) likh sakta hai — server ki zaroorat nahi.
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where, writeBatch } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebase";

type Req = { uid: string; email: string; displayName: string; status: string; count: number; updatedAt: number };
type Adm = { uid: string; email: string; name: string; approved: boolean; approvedAt: number };

const str = (v: unknown, n = 80) => (typeof v === "string" ? v.slice(0, n) : "");
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** drawer ke badge ke liye: pending requests ki ginti (sirf enabled=true yaani owner ke liye sunta hai) */
export function usePendingBuilderRequests(enabled: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) { setN(0); return undefined; }
    return onSnapshot(
      query(collection(db, "builderRequests"), where("status", "==", "pending")),
      (s) => setN(s.size),
      () => setN(0),
    );
  }, [enabled]);
  return n;
}

const when = (t: number) => (t ? new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

export function BuilderAdmin({ owner, onClose }: { owner: User; onClose: () => void }) {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [adms, setAdms] = useState<Adm[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, "builderRequests"),
      (s) => {
        setReqs(s.docs.map((d) => {
          const x = d.data();
          return { uid: d.id, email: str(x.email, 120), displayName: str(x.displayName, 60), status: str(x.status, 12), count: num(x.count), updatedAt: num(x.updatedAt) };
        }));
        setReady(true);
      },
      (e) => { setErr(e.message); setReady(true); },
    );
    const u2 = onSnapshot(
      collection(db, "builderAdmins"),
      (s) => setAdms(s.docs.map((d) => {
        const x = d.data();
        return { uid: d.id, email: str(x.email, 120), name: str(x.name, 60), approved: x.approved === true, approvedAt: num(x.approvedAt) };
      })),
      (e) => setErr(e.message),
    );
    return () => { u1(); u2(); };
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setErr("");
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "Nahi ho paya."); } finally { setBusy(""); }
  };

  const approve = (r: Req) => run(r.uid, async () => {
    const now = Date.now();
    const b = writeBatch(db);
    b.set(doc(db, "builderAdmins", r.uid), { approved: true, email: r.email, name: r.displayName, approvedAt: now, approvedBy: owner.uid });
    b.set(doc(db, "builderRequests", r.uid), { status: "approved", updatedAt: now, decidedBy: owner.uid }, { merge: true });
    await b.commit();
  });
  const reject = (r: Req) => run(r.uid, async () => {
    const b = writeBatch(db);
    b.set(doc(db, "builderRequests", r.uid), { status: "rejected", updatedAt: Date.now(), decidedBy: owner.uid }, { merge: true });
    await b.commit();
  });
  const revoke = (a: Adm) => run(a.uid, async () => {
    const now = Date.now();
    const b = writeBatch(db);
    b.set(doc(db, "builderAdmins", a.uid), { approved: false, revokedAt: now, revokedBy: owner.uid }, { merge: true });
    // request doc sirf tab update (create nahi — rules me client create band hai)
    if (reqs.some((r) => r.uid === a.uid)) b.set(doc(db, "builderRequests", a.uid), { status: "revoked", updatedAt: now, decidedBy: owner.uid }, { merge: true });
    await b.commit();
  });

  const pending = reqs.filter((r) => r.status === "pending").sort((a, b) => b.updatedAt - a.updatedAt);
  const past = reqs.filter((r) => r.status !== "pending" && r.status !== "approved").sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const live = adms.filter((a) => a.approved);

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet ba" onClick={(e) => e.stopPropagation()}>
        <div className="ba-head">
          <p className="sheet-name">Builder access</p>
          <button type="button" className="ba-x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        {err ? <p className="err bar" onClick={() => setErr("")}>{err}</p> : null}
        {!ready ? <p className="sheet-sub">Load ho raha hai…</p> : null}

        <p className="dh">Pending ({pending.length})</p>
        {ready && pending.length === 0 ? <p className="sheet-sub">Koi pending request nahi.</p> : null}
        {pending.map((r) => (
          <div key={r.uid} className="ba-row">
            <div className="ba-who">
              <b>{r.displayName || r.email.split("@")[0] || "User"}</b>
              <span>{r.email} · {when(r.updatedAt)}{r.count > 1 ? ` · ${r.count}th request` : ""}</span>
            </div>
            <button type="button" className="ba-ok" disabled={busy === r.uid} onClick={() => void approve(r)}>Approve</button>
            <button type="button" className="ba-no" disabled={busy === r.uid} onClick={() => void reject(r)}>Reject</button>
          </div>
        ))}

        <p className="dh">Builders ({live.length})</p>
        {live.length === 0 ? <p className="sheet-sub">Abhi koi approved builder nahi. (Tum owner ho, tumhe access hai.)</p> : null}
        {live.map((a) => (
          <div key={a.uid} className="ba-row">
            <div className="ba-who">
              <b>{a.name || a.email.split("@")[0] || a.uid.slice(0, 6)}</b>
              <span>{a.email}{a.approvedAt ? ` · ${when(a.approvedAt)}` : ""}</span>
            </div>
            <button type="button" className="ba-no" disabled={busy === a.uid} onClick={() => void revoke(a)}>Revoke</button>
          </div>
        ))}

        {past.length ? <p className="dh">Pichli requests</p> : null}
        {past.map((r) => (
          <div key={r.uid} className="ba-row dim">
            <div className="ba-who"><b>{r.displayName || r.email.split("@")[0]}</b><span>{r.email} · {r.status}</span></div>
            {r.status !== "approved" ? <button type="button" className="ba-ok" disabled={busy === r.uid} onClick={() => void approve(r)}>Approve</button> : null}
          </div>
        ))}
        <p className="sheet-sub ba-note">Approved builder: draft banana aur preview. Publish / rollback sirf tum (owner) kar sakte ho.</p>
      </div>
    </div>
  );
}
