import { useEffect, useState } from "react";
import clsx from "clsx";
import { BadgeCheck, Ban, ChevronDown, ChevronUp, Crown, Megaphone, Pencil, Trash2, Wrench, Zap } from "lucide-react";
import { adminRecentUsers, adminSetUser, adminStats, deleteReport, setConfig, watchReports, type Report } from "../lib/extra";
import { searchUsers } from "../lib/data";
import { useUser } from "../lib/hooks";
import { BUILTIN_GIFS, addGif, deleteGif, loadGifs } from "../lib/gifs";
import { readDataUrl } from "../lib/media";
import { ROLE_LABEL, type AppConfig, type GifItem, type Role, type UserDoc } from "../lib/types";
import { errorText, relTime } from "../lib/util";
import {
  DEFAULT_SHORTCUTS, MAX_SHORTCUTS, SHORTCUT_EMOJIS, addShortcut, clearShortcuts, deleteShortcut, editShortcut, importDefaults, swapShortcuts, toggleShortcut, watchShortcuts,
} from "../lib/shortcuts";
import type { Shortcut } from "../lib/types";
import { Avatar, Badges, Toggle } from "./ui";
import { Frame } from "./Panels";
import { AlertsTab, BanPanel, ChatsTab, RequestsTab, SecurityTab, UnbanButton, UpdateManager, useAlerts, useRequests } from "./AdminExtra";
import { releaseDevice } from "../lib/security";
import { FollowEditor } from "./FollowUI";
import { EmergencyTab } from "./Emergency";
import { AiAdminTab } from "./AiAdmin";
import { auth } from "../firebase";

type Tab = "stats" | "ai" | "emergency" | "requests" | "alerts" | "chats" | "security" | "update" | "maint" | "banner" | "shortcuts" | "gifs" | "users" | "reports";

function UserRow({ u, onChanged }: { u: UserDoc; onChanged: (n: UserDoc) => void }) {
  const [busy, setBusy] = useState(false);
  const [banning, setBanning] = useState(false);
  const patch = (p: { banned?: boolean; pro?: boolean; verified?: boolean; role?: Role }) => {
    setBusy(true);
    void adminSetUser(u.uid, p).then(() => onChanged({ ...u, ...p })).catch(() => undefined).finally(() => setBusy(false));
  };
  return (
    <li className="glass rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <Avatar src={u.avatar} name={u.displayName} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold"><span className="inline-flex items-center">{u.displayName}<Badges u={u} />{u.banned ? " 🚫" : ""}</span></span>
          <span className="block truncate text-xs text-paper/50">@{u.username} · ID {u.publicId} · {Date.now() - u.lastSeen < 90_000 ? "online" : relTime(u.lastSeen)}</span>
          {u.ffUid ? <span className="block truncate text-xs text-paper/50">FF {u.ffUid} {u.ffRank}</span> : null}
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        {u.banned ? <UnbanButton u={u} onDone={onChanged} /> : <button type="button" disabled={busy} className="tap flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-rose/50 text-xs font-bold text-rose" onClick={() => setBanning(true)}><Ban className="size-3.5" /> Ban</button>}
        <button type="button" disabled={busy} className="tap flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-paper/20 text-xs font-bold" onClick={() => patch({ pro: !u.pro })}><Crown className="size-3.5" /> {u.pro ? "Remove Pro" : "Give Pro"}</button>
        <button type="button" disabled={busy} className="tap flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-sky-400/40 text-xs font-bold text-sky-300" onClick={() => patch({ verified: !u.verified })}><BadgeCheck className="size-3.5" /> {u.verified ? "Un-verify" : "Verify"}</button>
      </div>
      {banning ? <BanPanel u={u} onCancel={() => setBanning(false)} onDone={(n) => { setBanning(false); onChanged(n); }} /> : null}
      {u.banned && u.banReason ? <p className="mt-2 text-xs text-rose">Ban reason: {u.banReason}</p> : null}
      <p className="mt-2 truncate text-[0.65rem] text-paper/35">device {u.deviceId ? u.deviceId.slice(0, 12) : "?"} · ip {u.lastIp ? u.lastIp.replace(/_/g, ".") : "?"}{u.deviceId ? " · " : ""}{u.deviceId ? <button type="button" className="underline" onClick={() => { if (window.confirm("Is device ka lock hata dein? Phir is phone par nayi ID ban sakti hai.")) void releaseDevice(u.deviceId).catch(() => undefined); }}>Device lock hatao</button> : null}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[0.65rem] font-semibold tracking-widest text-paper/45">ROLE</span>
        {u.role === "owner" ? <span className="text-xs font-semibold text-hot">Owner (tum)</span> : (["member", "officer", "admin"] as Role[]).map((r) => (
          <button key={r} type="button" disabled={busy} className={clsx("tap h-8 flex-1 rounded-lg text-xs font-bold", (u.role ?? "member") === r ? "grad text-white" : "border border-paper/20 text-paper/70")} onClick={() => patch({ role: r })}>{ROLE_LABEL[r]}</button>
        ))}
      </div>
      <FollowEditor key={u.uid} u={u} onChanged={onChanged} />
    </li>
  );
}

function ReportRow({ r }: { r: Report }) {
  const by = useUser(r.by);
  const target = useUser(r.target);
  return (
    <li className="glass rounded-2xl p-3 text-sm">
      <p><span className="font-semibold">{by?.displayName ?? r.by.slice(0, 6)}</span> ne report kiya <span className="font-semibold text-rose">{target?.displayName ?? r.target.slice(0, 6)}</span> (ID {target?.publicId ?? "?"})</p>
      <p className="mt-1 text-paper/70">Reason: {r.reason}</p>
      <div className="mt-2 flex items-center justify-between"><span className="text-xs text-paper/40">{relTime(r.at)}</span>
        <div className="flex gap-2">
          {target ? <button type="button" className="tap h-8 rounded-lg border border-rose/50 px-3 text-xs font-bold text-rose" onClick={() => void adminSetUser(target.uid, { banned: true })}>Ban</button> : null}
          <button type="button" className="tap grid size-8 place-items-center rounded-lg border border-paper/20" aria-label="Dismiss report" onClick={() => void deleteReport(r.id)}><Trash2 className="size-4" /></button>
        </div>
      </div>
    </li>
  );
}

function GifManager({ by }: { by: string }) {
  const [list, setList] = useState<GifItem[]>([]);
  const [label, setLabel] = useState("");
  const [tag, setTag] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const refresh = () => loadGifs().then((l) => setList(l.filter((g) => !BUILTIN_GIFS.some((b) => b.id === g.id)))).catch((e) => setError(errorText(e)));
  useEffect(() => { void refresh(); }, []);

  const done = () => { setLabel(""); setTag(""); setUrl(""); setMsg("GIF add ho gaya ✓ Sabko dikhega"); window.setTimeout(() => setMsg(""), 2500); void refresh(); };
  const fail = (e: unknown) => { setMsg(""); setError(errorText(e)); };
  const addLink = () => {
    setBusy(true); setError("");
    addGif(by, { label, tag, url }).then(done).catch(fail).finally(() => setBusy(false));
  };
  const addFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Sirf GIF/image file chuno"); return; }
    if (file.size > 520_000) { setError("File 500KB se badi hai. Link se add karo."); return; }
    setBusy(true); setError("");
    readDataUrl(file).then((data) => addGif(by, { label: label || file.name.replace(/\.[^.]+$/, ""), tag, data })).then(done).catch(fail).finally(() => setBusy(false));
  };
  const remove = (g: GifItem) => {
    if (!window.confirm(`"${g.label}" delete karna hai?`)) return;
    void deleteGif(g.id).then(() => setList((l) => l.filter((x) => x.id !== g.id))).catch(fail);
  };

  return (
    <div className="space-y-4">
      <div className="glass space-y-3 rounded-3xl p-4">
        <p className="font-display text-xl font-bold">➕ Naya GIF</p>
        <input className="h-12 w-full rounded-2xl border border-paper/12 bg-paper/5 px-4 outline-none focus:border-rose/70" maxLength={40} placeholder="Naam (jaise: Kya hua bhai)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="h-12 w-full rounded-2xl border border-paper/12 bg-paper/5 px-4 outline-none focus:border-rose/70" maxLength={60} placeholder="Search tags (jaise: funny, bhai, gg)" value={tag} onChange={(e) => setTag(e.target.value)} />
        <input className="h-12 w-full rounded-2xl border border-paper/12 bg-paper/5 px-4 outline-none focus:border-rose/70" inputMode="url" placeholder="GIF link (https://...gif)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="button" disabled={busy || !url.trim()} className="btn-hot tap h-12 w-full rounded-2xl font-display text-lg font-bold" onClick={addLink}>{busy ? "ADDING…" : "LINK SE ADD KARO"}</button>
        <label className={clsx("glass tap flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl font-display text-lg font-bold", busy && "pointer-events-none opacity-50")}>
          PHONE SE UPLOAD (500KB tak)
          <input type="file" accept="image/gif,image/webp,image/png,image/jpeg" className="sr-only" onChange={(e) => { addFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <p className="text-xs text-paper/45">Bada GIF ho to uska link paste karo (Giphy / Tenor / koi bhi https link). Link wale GIF sabse fast chalte hain.</p>
        {msg ? <p className="text-sm font-semibold text-emerald-400">{msg}</p> : null}
        {error ? <p className="text-sm text-rose">{error}</p> : null}
      </div>
      <p className="text-xs font-semibold tracking-[0.2em] text-paper/55">ADDED GIFS ({list.length})</p>
      {list.length === 0 ? <p className="text-sm text-paper/50">Abhi koi GIF add nahi kiya.</p> : (
        <div className="grid grid-cols-2 gap-3">
          {list.map((g) => (
            <div key={g.id} className="glass overflow-hidden rounded-2xl">
              <img src={g.src} alt={g.label} loading="lazy" referrerPolicy="no-referrer" className="h-28 w-full object-cover" />
              <div className="flex items-center justify-between gap-1 p-2"><span className="min-w-0 truncate text-xs font-semibold">{g.label}</span><button type="button" className="tap p-1 text-rose" aria-label="Delete GIF" onClick={() => remove(g)}><Trash2 className="size-4" /></button></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShortcutManager() {
  const [list, setList] = useState<Shortcut[]>([]);
  const [fromDb, setFromDb] = useState(false);
  const [text, setText] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  useEffect(() => watchShortcuts((l, db) => { setList(l); setFromDb(db); }), []);

  const run = (job: () => Promise<unknown>, ok?: string) => {
    setBusy(true); setError("");
    job().then(() => { if (ok) { setMsg(ok); window.setTimeout(() => setMsg(""), 2200); } }).catch((e) => setError(errorText(e))).finally(() => setBusy(false));
  };
  const add = () => run(async () => { await addShortcut(text, list.length ? Math.max(...list.map((x) => x.order)) + 1 : 0); setText(""); }, "Shortcut add ho gaya ✓ Sabke chat mein dikhega");
  const move = (i: number, d: -1 | 1) => { const a = list[i]; const b = list[i + d]; if (a && b) run(() => swapShortcuts(a, b)); };
  const save = (s: Shortcut) => run(async () => { await editShortcut(s.id, editText); setEditId(null); }, "Update ho gaya ✓");
  const remove = (s: Shortcut) => { if (window.confirm(`"${s.text}" delete karna hai?`)) run(() => deleteShortcut(s.id)); };
  const resetAll = () => { if (window.confirm("Saare shortcuts hata ke default wapas laane hain?")) run(() => clearShortcuts(list), "Default wapas aa gaye ✓"); };
  const chips = list.filter((x) => x.on);

  return (
    <div className="space-y-4">
      <div className="glass space-y-3 rounded-3xl p-4">
        <p className="flex items-center gap-2 font-display text-xl font-bold"><Zap className="size-5 text-hot" /> Naya Shortcut</p>
        <input className="h-12 w-full rounded-2xl border border-paper/12 bg-paper/5 px-4 outline-none focus:border-rose/70" maxLength={40} placeholder="Jaise: Drop kaha? 🪂" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim() && !busy && fromDb) add(); }} />
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1">{SHORTCUT_EMOJIS.map((e) => <button key={e} type="button" className="tap grid size-9 shrink-0 place-items-center rounded-xl bg-paper/6 text-lg" onClick={() => setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${e}`.slice(0, 40))}>{e}</button>)}</div>
        <button type="button" disabled={busy || !text.trim() || list.length >= MAX_SHORTCUTS} className="btn-hot tap h-12 w-full rounded-2xl font-display text-lg font-bold" onClick={() => (fromDb ? add() : run(async () => { await importDefaults(); await addShortcut(text, DEFAULT_SHORTCUTS.length); setText(""); }, "Shortcut add ho gaya ✓"))}>{busy ? "SAVING…" : "SHORTCUT ADD KARO"}</button>
        {msg ? <p className="text-sm font-semibold text-emerald-400">{msg}</p> : null}
        {error ? <p className="text-sm text-rose">{error}</p> : null}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-paper/55">PREVIEW (chat mein aise dikhega)</p>
        <div className="flex gap-2 overflow-x-auto rounded-2xl bg-deep px-3 py-2">{chips.length ? chips.map((s) => <span key={s.id} className="shrink-0 rounded-full border border-rose/40 bg-rose/10 px-4 py-2 text-sm font-semibold">{s.text}</span>) : <span className="text-sm text-paper/45">Sab OFF hain, chat mein shortcut nahi dikhenge</span>}</div>
      </div>

      {!fromDb ? (
        <div className="glass space-y-2 rounded-2xl p-3 text-sm">
          <p className="text-paper/70">Abhi app ke <b>default</b> shortcuts dikh rahe hain. Inhe edit/delete/reorder karne ke liye pehle database mein import karo.</p>
          <button type="button" disabled={busy} className="btn-hot tap h-11 w-full rounded-xl text-sm font-bold" onClick={() => run(importDefaults, "Import ho gaye ✓")}>DEFAULTS IMPORT KARO</button>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold tracking-[0.2em] text-paper/55">SHORTCUTS ({list.length}/{MAX_SHORTCUTS})</p>
          <ul className="space-y-2">
            {list.map((s, i) => (
              <li key={s.id} className={clsx("glass rounded-2xl p-3", !s.on && "opacity-60")}>
                {editId === s.id ? (
                  <div className="flex gap-2">
                    <input autoFocus className="h-10 min-w-0 flex-1 rounded-xl border border-paper/12 bg-paper/5 px-3 outline-none focus:border-rose/70" maxLength={40} value={editText} onChange={(e) => setEditText(e.target.value)} />
                    <button type="button" disabled={busy} className="btn-hot tap h-10 rounded-xl px-4 text-sm font-bold" onClick={() => save(s)}>Save</button>
                    <button type="button" className="tap h-10 rounded-xl border border-paper/20 px-3 text-sm" onClick={() => setEditId(null)}>✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold">{s.text}</span>
                    <button type="button" className="tap grid size-8 place-items-center rounded-lg border border-paper/20 disabled:opacity-30" aria-label="Upar" disabled={busy || i === 0} onClick={() => move(i, -1)}><ChevronUp className="size-4" /></button>
                    <button type="button" className="tap grid size-8 place-items-center rounded-lg border border-paper/20 disabled:opacity-30" aria-label="Neeche" disabled={busy || i === list.length - 1} onClick={() => move(i, 1)}><ChevronDown className="size-4" /></button>
                    <button type="button" className="tap grid size-8 place-items-center rounded-lg border border-paper/20" aria-label="Edit" onClick={() => { setEditId(s.id); setEditText(s.text); }}><Pencil className="size-4" /></button>
                    <button type="button" className="tap" aria-label={s.on ? "OFF karo" : "ON karo"} onClick={() => run(() => toggleShortcut(s.id, !s.on))}><Toggle on={s.on} /></button>
                    <button type="button" className="tap grid size-8 place-items-center rounded-lg border border-rose/40 text-rose" aria-label="Delete" onClick={() => remove(s)}><Trash2 className="size-4" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <button type="button" disabled={busy} className="glass tap h-11 w-full rounded-xl text-sm font-semibold" onClick={resetAll}>↺ Default par wapas jao</button>
        </>
      )}
    </div>
  );
}

export function AdminPanel({ config, onClose }: { config: AppConfig; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<{ total: number; banned: number; online: number; pro: number; verified: number } | null>(null);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [term, setTerm] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [msg, setMsg] = useState(config.message);
  const [banner, setBanner] = useState(config.banner);
  const [ytKey, setYtKey] = useState(config.youtubeApiKey || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const requests = useRequests();
  const alerts = useAlerts();
  const [openChat, setOpenChat] = useState<string | null>(null);
  const pendingCount = requests.filter((r) => r.approval === "pending" || r.appeal).length;
  const unseen = alerts.filter((a) => !a.seen).length;

  useEffect(() => {
    void adminStats().then(setStats).catch((e) => setError(errorText(e)));
    void adminRecentUsers().then(setUsers).catch((e) => setError(errorText(e)));
    return watchReports(setReports);
  }, []);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) return;
    const t = window.setTimeout(() => void searchUsers(q, "").then(setUsers).catch(() => undefined), 300);
    return () => window.clearTimeout(t);
  }, [term]);

  const save = (next: AppConfig) => setConfig(next).then(() => { setSaved(true); window.setTimeout(() => setSaved(false), 1500); }).catch((e) => setError(errorText(e)));
  const TABS: [Tab, string][] = [["stats", "Dashboard"], ["ai", "🤖 AI"], ["emergency", "🚨 Emergency"], ["requests", `Requests${pendingCount ? ` (${pendingCount})` : ""}`], ["alerts", `Alerts${unseen ? ` (${unseen})` : ""}`], ["chats", "Chats"], ["security", "Security"], ["update", "Update"], ["maint", "Maintenance"], ["banner", "Banner"], ["shortcuts", "Shortcuts"], ["gifs", "GIFs"], ["users", "Users"], ["reports", `Reports${reports.length ? ` (${reports.length})` : ""}`]];

  return (
    <Frame title="Admin Panel" onClose={onClose} z={60}>
      <div className="flex max-h-36 flex-col gap-1.5 overflow-y-auto pr-1">{TABS.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={clsx("tap h-10 w-full shrink-0 rounded-xl px-4 text-left text-sm font-semibold", tab === id ? "grad text-white" : "glass")}>{label}</button>)}</div>
      {error ? <p className="text-sm text-rose">{error}</p> : null}

      {tab === "stats" ? (
        <div className="grid grid-cols-2 gap-3">
          {[["Total users", stats?.total], ["Online now", stats?.online], ["Pro users", stats?.pro], ["Verified", stats?.verified], ["Banned", stats?.banned]].map(([l, v]) => (
            <div key={String(l)} className="glass rounded-2xl p-4"><p className="grad-text font-display text-4xl leading-none font-bold tabular-nums">{v ?? "…"}</p><p className="mt-1 text-xs font-semibold tracking-wider text-paper/55">{String(l).toUpperCase()}</p></div>
          ))}
          <button type="button" className="glass tap col-span-2 h-11 rounded-xl text-sm font-semibold" onClick={() => void adminStats().then(setStats)}>↻ Refresh</button>
        </div>
      ) : null}

      {tab === "maint" ? (
        <div className="space-y-4">
          <button type="button" className="glass tap flex h-16 w-full items-center justify-between rounded-2xl px-4" onClick={() => void save({ ...config, maintenance: !config.maintenance, message: msg })}>
            <span className="flex items-center gap-3 text-left"><Wrench className="size-5 text-hot" /><span><span className="block font-semibold">Maintenance mode</span><span className="block text-xs text-paper/55">ON karte hi sabko "App Under Maintenance" dikhega</span></span></span>
            <Toggle on={config.maintenance} />
          </button>
          <label className="block"><span className="mb-2 block text-xs font-semibold tracking-[0.2em] text-paper/55">EXTRA MESSAGE (optional)</span>
            <textarea className="min-h-20 w-full rounded-2xl border border-paper/12 bg-paper/5 p-4 outline-none focus:border-rose/70" maxLength={200} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Jaise: 2 ghante mein wapas aayenge" /></label>
          <button type="button" className="btn-hot tap h-12 w-full rounded-2xl font-display text-lg font-bold" onClick={() => void save({ ...config, message: msg })}>{saved ? "SAVED ✓" : "SAVE MESSAGE"}</button>
          <p className="text-xs text-paper/45">Tum (admin) maintenance mein bhi app use kar sakte ho.</p>
        </div>
      ) : null}

      {tab === "banner" ? (
        <div className="space-y-4">
          <button type="button" className="glass tap flex h-16 w-full items-center justify-between rounded-2xl px-4" onClick={() => void save({ ...config, banner, bannerOn: !config.bannerOn })}>
            <span className="flex items-center gap-3 text-left"><Megaphone className="size-5 text-hot" /><span><span className="block font-semibold">Home banner</span><span className="block text-xs text-paper/55">ON karte hi sabke Home par ye message dikhega</span></span></span>
            <Toggle on={config.bannerOn} />
          </button>
          <label className="block"><span className="mb-2 block text-xs font-semibold tracking-[0.2em] text-paper/55">BANNER TEXT</span>
            <textarea className="min-h-24 w-full rounded-2xl border border-paper/12 bg-paper/5 p-4 outline-none focus:border-rose/70" maxLength={160} value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="Jaise: Naya update aa gaya! 🔥" /></label>
          <button type="button" className="btn-hot tap h-12 w-full rounded-2xl font-display text-lg font-bold" onClick={() => void save({ ...config, banner })}>{saved ? "SAVED ✓" : "SAVE BANNER"}</button>
          <label className="block space-y-1 pt-2">
            <span className="text-xs font-semibold tracking-wider text-paper/50">YOUTUBE DATA API KEY</span>
            <input className="h-12 w-full rounded-2xl border border-paper/12 bg-paper/5 px-4 outline-none focus:border-rose/70" value={ytKey} onChange={(e) => setYtKey(e.target.value)} placeholder="AIza… (search ke liye)" />
          </label>
          <button type="button" className="glass tap h-11 w-full rounded-2xl font-semibold" onClick={() => void save({ ...config, youtubeApiKey: ytKey.trim() })}>SAVE YT KEY</button>
        </div>
      ) : null}

      {tab === "ai" ? <AiAdminTab /> : null}

      {tab === "emergency" ? <EmergencyTab adminName={auth.currentUser?.displayName ?? "Admin"} /> : null}

      {tab === "requests" ? <RequestsTab list={requests} /> : null}

      {tab === "alerts" ? <AlertsTab list={alerts} onView={(id) => { setOpenChat(id); setTab("chats"); }} /> : null}

      {tab === "chats" ? <ChatsTab openChat={openChat} setOpenChat={setOpenChat} /> : null}

      {tab === "security" ? <SecurityTab config={config} /> : null}

      {tab === "update" ? <UpdateManager config={config} /> : null}

      {tab === "shortcuts" ? <ShortcutManager /> : null}

      {tab === "gifs" ? <GifManager by="admin" /> : null}

      {tab === "users" ? (
        <div className="space-y-3">
          <input className="h-12 w-full rounded-2xl border border-paper/12 bg-paper/5 px-4 outline-none focus:border-rose/70" placeholder="ID ya username search" value={term} onChange={(e) => setTerm(e.target.value)} />
          <ul className="space-y-2">{users.map((u) => <UserRow key={u.uid} u={u} onChanged={(n) => setUsers((l) => l.map((x) => (x.uid === n.uid ? n : x)))} />)}</ul>
        </div>
      ) : null}

      {tab === "reports" ? (reports.length === 0 ? <p className="pt-8 text-center text-paper/55">Koi report nahi 🎉</p> : <ul className="space-y-2">{reports.map((r) => <ReportRow key={r.id} r={r} />)}</ul>) : null}
    </Frame>
  );
}
