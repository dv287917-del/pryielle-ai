// Secret AI Builder screen: AI se baat karke app ka look badlo -> draft -> preview -> (owner) publish / rollback.
import { useEffect, useRef, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { fileToAttachment, type AiAttachment } from "../lib/ai";
import { builderDiscard, builderGenerate, builderPublish, builderRollback, builderUnpublish, type BuilderBase } from "../lib/builder";
import { useFeatures } from "../lib/features";
import { validateFeatureConfig, type FeatureConfig } from "../../shared/featureSchema";
import { draftStale, summarizeConfig } from "../../shared/featureRuntime";

type LiveInfo = { version: number; active: boolean; title: string; notes: string; publishedAt: number };
type DraftInfo = { updatedAt: number; basedOnVersion: number; warnings: string[]; prompt: string; config: FeatureConfig | null };
type Entry = { id: string; version: number; title: string; notes: string; active: boolean; publishedAt: number; rolledBackFrom: number };
type Msg = { id: number; role: "me" | "ai" | "err"; text: string; warnings?: string[] };
type Confirm = null | { kind: "publish" } | { kind: "unpublish" } | { kind: "discard" } | { kind: "rollback"; version: number };
type Pick = { id: number; att: AiAttachment };

const MAX_FILES = 4;
const ACCEPT = "image/*,application/pdf,text/*,.json,.md,.txt";
const IDEAS = ["Orange theme + welcome banner", "Light clean theme", "Home par 3 suggestion chips", "Drawer me Compact mode toggle", "Greeting badlo: Namaste {name}"];

const str = (v: unknown, n = 120) => (typeof v === "string" ? v.slice(0, n) : "");
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const when = (t: number) => (t ? new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

function History({ owner, current, onRollback, onClose }: { owner: boolean; current: number; onRollback: (v: number) => void; onClose: () => void }) {
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "appFeaturesHistory"), orderBy("version", "desc"), limit(20)),
        (s) => setRows(s.docs.map((d) => {
          const x = d.data();
          return { id: d.id, version: num(x.version), title: str(x.title, 60), notes: str(x.notes, 160), active: x.active !== false, publishedAt: num(x.publishedAt), rolledBackFrom: num(x.rolledBackFrom) };
        })),
        (e) => { setErr(e.message); setRows([]); },
      ),
    [],
  );
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet ba" onClick={(e) => e.stopPropagation()}>
        <div className="ba-head"><p className="sheet-name">History</p><button type="button" className="ba-x" aria-label="Close" onClick={onClose}>×</button></div>
        {err ? <p className="err bar">{err}</p> : null}
        {rows === null ? <p className="sheet-sub">Load ho raha hai…</p> : null}
        {rows && rows.length === 0 && !err ? <p className="sheet-sub">Abhi koi publish nahi hua.</p> : null}
        {rows?.map((r) => (
          <div key={r.id} className="ba-row">
            <div className="ba-who">
              <b>v{r.version} · {r.active ? r.title || "(bina naam)" : "Unpublish (default look)"}{r.version === current ? " · LIVE" : ""}</b>
              <span>{when(r.publishedAt)}{r.rolledBackFrom ? ` · rollback of v${r.rolledBackFrom}` : ""}{r.notes ? ` · ${r.notes}` : ""}</span>
            </div>
            {owner && r.version !== current ? <button type="button" className="ba-no" onClick={() => onRollback(r.version)}>Rollback</button> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BuilderScreen({ owner, onClose }: { owner: boolean; onClose: () => void }) {
  const fx = useFeatures();
  const [live, setLive] = useState<LiveInfo>({ version: 0, active: false, title: "", notes: "", publishedAt: 0 });
  const [draft, setDraft] = useState<DraftInfo | null>(null);
  const [log, setLog] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [base, setBase] = useState<BuilderBase>("draft");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [hist, setHist] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);
  const fileIn = useRef<HTMLInputElement | null>(null);
  const ids = useRef(0);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "appFeatures", "live"),
        (s) => {
          const x = s.exists() ? s.data() : {};
          const v = num(x.version);
          setLive({ version: v, active: v > 0 && x.active !== false, title: str(x.title, 60), notes: str(x.notes, 160), publishedAt: num(x.publishedAt) });
        },
        () => undefined,
      ),
    [],
  );
  useEffect(
    () =>
      onSnapshot(
        doc(db, "appFeatures", "draft"),
        (s) => {
          if (!s.exists()) return setDraft(null);
          const x = s.data();
          const v = validateFeatureConfig(x);
          setDraft({ updatedAt: num(x.updatedAt), basedOnVersion: num(x.basedOnVersion), warnings: Array.isArray(x.warnings) ? x.warnings.map((w: unknown) => str(w, 140)).slice(0, 8) : [], prompt: str(x.prompt, 300), config: v.ok ? v.config : null });
        },
        () => setDraft(null),
      ),
    [],
  );
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [log.length, busy]);

  const push = (m: Omit<Msg, "id">) => { ids.current += 1; setLog((l) => [...l, { ...m, id: ids.current }]); };
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key); setErr("");
    try { await fn(); } catch (e) { const m = e instanceof Error ? e.message : "Nahi ho paya."; setErr(m); push({ role: "err", text: m }); } finally { setBusy(""); }
  };

  const generate = async () => {
    const q = text.trim();
    if (!q || busy) return;
    const atts = picks.map((p) => p.att);
    const keepPicks = picks;
    push({ role: "me", text: atts.length ? `${q}\n📎 ${atts.map((a) => a.name).join(", ")}` : q });
    setText(""); setPicks([]); setBusy("gen"); setErr("");
    try {
      const r = await builderGenerate(q, base, atts);
      setBase("draft");
      push({ role: "ai", text: "✅ Draft ban gaya. Neeche card me dekho; “Preview” se app me live-jaisa dekh sakte ho.", warnings: r.warnings });
    } catch (e) {
      const m = e instanceof Error ? e.message : "Draft nahi ban paya.";
      setErr(m); push({ role: "err", text: m }); setText(q); setPicks(keepPicks);
    } finally { setBusy(""); }
  };

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    setErr("");
    for (const f of Array.from(list)) {
      if (picks.length >= MAX_FILES) { setErr(`Max ${MAX_FILES} files.`); break; }
      try {
        const att = await fileToAttachment(f);
        ids.current += 1;
        const id = ids.current;
        setPicks((p) => (p.length >= MAX_FILES ? p : [...p, { id, att }]));
      } catch (e) { setErr(e instanceof Error ? e.message : "File nahi khuli."); }
    }
  };

  const doConfirm = async () => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    if (c.kind === "publish" && draft) await run("pub", async () => { const r = await builderPublish(draft.updatedAt); push({ role: "ai", text: `🚀 Live ho gaya — v${r.version}. Sabko “Update now” popup aayega.` }); });
    else if (c.kind === "unpublish") await run("unpub", async () => { const r = await builderUnpublish(); push({ role: "ai", text: `⏹ Unpublish ho gaya (v${r.version}). Sabka app default look par wapas.` }); });
    else if (c.kind === "rollback") await run("rb", async () => { const r = await builderRollback(c.version); push({ role: "ai", text: `↩️ v${c.version} wapas live hua (naya v${r.version}).` }); });
    else if (c.kind === "discard") await run("disc", async () => { await builderDiscard(); fx.setPreview(false); push({ role: "ai", text: "🗑 Draft hata diya." }); });
  };

  const sum = draft?.config ? summarizeConfig(draft.config) : null;
  const stale = draft ? draftStale(draft.basedOnVersion, live.version) : false;
  const CONFIRM_TEXT: Record<string, [string, string]> = {
    publish: ["Publish karun?", "Ye sab users ke app par live ho jayega aur sabko “Update now” popup aayega."],
    unpublish: ["Unpublish karun?", "Sabka app default look par wapas aa jayega (turant, bina popup)."],
    discard: ["Draft hata dun?", "Ye draft delete ho jayega. Live app par koi asar nahi."],
    rollback: ["Rollback karun?", "Ye version naye version number ke saath live ho jayega."],
  };

  return (
    <div className="bs">
      <header className="bs-top">
        <button type="button" className="icon" aria-label="Back" onClick={onClose}>←</button>
        <p className="bs-title">Builder</p>
        <span className={`bs-pill ${live.active ? "on" : ""}`}>{live.active ? `Live v${live.version}` : "Default look"}</span>
        <button type="button" className="bs-hist" onClick={() => setHist(true)}>🕘</button>
      </header>

      <div className="bs-body">
        {log.length === 0 ? (
          <div className="bs-intro">
            <p>Bolo kya badalna hai — AI sirf safe cheezein badal sakta hai: rang, font, corners, banner/card/chips/toggle jaise blocks. Pehle draft banta hai, tum preview dekhte ho, phir {owner ? "publish karte ho." : "owner publish karta hai."}</p>
            <div className="bs-ideas">{IDEAS.map((i) => <button key={i} type="button" className="fb-chip" onClick={() => setText(i)}>{i}</button>)}</div>
          </div>
        ) : null}

        {log.map((m) => (
          <div key={m.id} className={`bs-msg ${m.role}`}>
            <div className="bs-bub">{m.text}</div>
            {m.warnings?.length ? <ul className="bs-warn">{m.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
          </div>
        ))}
        {busy === "gen" ? <div className="bs-msg ai"><div className="bs-bub dim">Soch raha hoon… (10-30 sec)</div></div> : null}

        <section className="bs-card">
          <p className="dh">Draft</p>
          {!draft ? <p className="sheet-sub">Abhi koi draft nahi. Neeche likho aur bhejo.</p> : !sum ? <p className="sheet-sub">Draft padha nahi ja sakta. Naya banwao ya hata do.</p> : (
            <>
              <p className="bs-name">{sum.title || "(bina naam)"} <span>· {when(draft.updatedAt)}</span></p>
              {sum.notes ? <p className="bs-notes">{sum.notes}</p> : null}
              <div className="bs-facts">
                {sum.accent ? <i className="bs-sw" style={{ background: sum.accent }} title="accent" /> : null}
                {sum.bg ? <i className="bs-sw" style={{ background: sum.bg }} title="bg" /> : null}
                <span>{sum.themeKeys} theme · {sum.flags} flags · {sum.blocks.length} blocks</span>
              </div>
              {sum.blocks.length ? <ul className="bs-blocks">{sum.blocks.map((b, i) => <li key={i}><b>{b.type}</b> · {b.slot}{b.label ? ` — ${b.label}` : ""}</li>)}</ul> : null}
              {draft.warnings.length ? <ul className="bs-warn">{draft.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
              {stale ? <p className="bs-stale">⚠ Ye draft v{draft.basedOnVersion} par bana tha, live ab v{live.version} hai. Publish se pehle preview dekho.</p> : null}
              <div className="bs-actions">
                <button type="button" className="ba-no" onClick={() => { fx.setPreview(true); onClose(); }} disabled={!sum}>👁 Preview</button>
                <button type="button" className="ba-no" onClick={() => setConfirm({ kind: "discard" })} disabled={!!busy}>Hatao</button>
                {owner ? <button type="button" className="ba-ok" onClick={() => setConfirm({ kind: "publish" })} disabled={!!busy || !sum}>🚀 Publish</button> : <span className="sheet-sub">Publish sirf owner karta hai</span>}
              </div>
            </>
          )}
        </section>

        <section className="bs-card">
          <p className="dh">Live</p>
          <p className="bs-name">{live.active ? live.title || "(bina naam)" : "Default look"} <span>{live.version ? `· v${live.version} · ${when(live.publishedAt)}` : ""}</span></p>
          {live.active && live.notes ? <p className="bs-notes">{live.notes}</p> : null}
          {owner && live.active ? <div className="bs-actions"><button type="button" className="ba-no" onClick={() => setConfirm({ kind: "unpublish" })} disabled={!!busy}>⏹ Unpublish</button></div> : null}
        </section>
        <div ref={bottom} />
      </div>

      {err && !log.length ? <p className="err bar" onClick={() => setErr("")}>{err}</p> : null}
      <div className="bs-base" role="group" aria-label="Kahan se shuru">
        {(["draft", "live", "new"] as const).map((b) => (
          <button key={b} type="button" className={`bs-opt ${base === b ? "on" : ""}`} onClick={() => setBase(b)}>{b === "draft" ? "Draft pe badlo" : b === "live" ? "Live se shuru" : "Khali se"}</button>
        ))}
      </div>
      {picks.length ? (
        <div className="chips">{picks.map((p) => (
          <span key={p.id} className="chip">{p.att.kind === "image" ? "🖼️" : p.att.kind === "pdf" ? "📄" : "📝"} {p.att.name.slice(0, 18)}
            <button type="button" aria-label="Remove" onClick={() => setPicks((a) => a.filter((x) => x.id !== p.id))}>×</button></span>
        ))}</div>
      ) : null}
      <footer className="composer">
        <button type="button" className="circle dark" aria-label="Attach" onClick={() => fileIn.current?.click()}>＋</button>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void generate(); }} placeholder="Kya badalna hai?" aria-label="Builder prompt" maxLength={2000} />
        <button type="button" className="circle light" aria-label="Send" disabled={!text.trim() || !!busy} onClick={() => void generate()}>↑</button>
      </footer>
      <input ref={fileIn} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />

      {hist ? <History owner={owner} current={live.active ? live.version : 0} onClose={() => setHist(false)} onRollback={(v) => { setHist(false); setConfirm({ kind: "rollback", version: v }); }} /> : null}
      {confirm ? (
        <div className="scrim bs-confirm" onClick={() => setConfirm(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-name">{CONFIRM_TEXT[confirm.kind][0]}{confirm.kind === "rollback" ? ` (v${confirm.version})` : ""}</p>
            <p className="sheet-sub">{CONFIRM_TEXT[confirm.kind][1]}</p>
            <div className="bs-actions">
              <button type="button" className="ba-no" onClick={() => setConfirm(null)}>Nahi</button>
              <button type="button" className="ba-ok" onClick={() => void doConfirm()}>Haan</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
