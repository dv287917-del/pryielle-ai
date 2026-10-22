import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Check, Eye, Gavel, Search, Trash2, Upload, X } from "lucide-react";
import { Avatar, Toggle } from "./ui";
import { useUser } from "../lib/hooks";
import { searchUsers } from "../lib/data";
import { setConfig } from "../lib/extra";
import { adminApprove, adminBan, adminReject, adminUnban, releaseDevice, removeBan, watchBans, watchRequests } from "../lib/security";
import { adminAudit, adminUserChats, dismissAlert, markAlertSeen, watchAdminMessages, watchAlerts, type AuditDoc } from "../lib/moderation";
import { MAX_APK_MB, deleteOldApks, uploadApk } from "../lib/update";
import { APP_VERSION, compareVersions } from "../lib/version";
import type { AlertDoc, AppConfig, BanDoc, ChatDoc, Msg, UserDoc } from "../lib/types";
import { errorText, relTime } from "../lib/util";

const input = "h-12 w-full rounded-2xl border border-paper/12 bg-paper/5 px-4 outline-none focus:border-rose/70";

/* ---------------- ban panel (reason + device + IP) ---------------- */
export function BanPanel({ u, onDone, onCancel }: { u: UserDoc; onDone: (n: UserDoc) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [device, setDevice] = useState(true);
  const [ip, setIp] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = () => {
    setBusy(true);
    setError("");
    adminBan(u, { reason, device, ip }).then(() => onDone({ ...u, banned: true, banReason: reason })).catch((e) => setError(errorText(e))).finally(() => setBusy(false));
  };
  return (
    <div className="mt-2 space-y-2 rounded-2xl border border-rose/40 bg-rose/5 p-3">
      <p className="text-sm font-semibold text-rose">Ban: {u.displayName}</p>
      <input className={input} maxLength={200} placeholder="Reason (user ko dikhega)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button type="button" className="glass tap flex h-11 w-full items-center justify-between rounded-xl px-3 text-sm" onClick={() => setDevice(!device)}>
        <span className="text-left"><span className="block font-semibold">Device ban</span><span className="block text-xs text-paper/50">{u.deviceId ? "Is phone se koi bhi account nahi chalega" : "Is user ka device id abhi saved nahi"}</span></span><Toggle on={device} />
      </button>
      <button type="button" className="glass tap flex h-11 w-full items-center justify-between rounded-xl px-3 text-sm" onClick={() => setIp(!ip)}>
        <span className="text-left"><span className="block font-semibold">IP ban {u.lastIp ? `(${u.lastIp.replace(/_/g, ".")})` : ""}</span><span className="block text-xs text-paper/50">Mobile data IP shared ho sakta hai, dusre log bhi ruk sakte hain</span></span><Toggle on={ip} />
      </button>
      {error ? <p className="text-sm text-rose">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" disabled={busy} className="tap h-11 flex-1 rounded-xl bg-rose font-display font-bold text-white" onClick={go}>{busy ? "BANNING…" : "BAN KARO"}</button>
        <button type="button" className="tap h-11 rounded-xl border border-paper/20 px-4 font-semibold" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function UnbanButton({ u, onDone }: { u: UserDoc; onDone: (n: UserDoc) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} className="tap flex h-9 flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 text-xs font-bold text-white" onClick={() => { setBusy(true); void adminUnban(u).then(() => onDone({ ...u, banned: false, banReason: "" })).catch(() => undefined).finally(() => setBusy(false)); }}>
      <Check className="size-3.5" /> Unban
    </button>
  );
}

/* ---------------- signup requests ---------------- */
function RequestRow({ u }: { u: UserDoc }) {
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = (job: Promise<unknown>) => { setBusy(true); setError(""); job.catch((e) => setError(errorText(e))).finally(() => setBusy(false)); };
  return (
    <li className="glass rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <Avatar src={u.avatar} name={u.displayName} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{u.displayName}</span>
          <span className="block truncate text-xs text-paper/50">@{u.username} · ID {u.publicId} · {relTime(u.lastSeen)}</span>
          <span className="block truncate text-[0.65rem] text-paper/35">dev {u.deviceId ? u.deviceId.slice(0, 10) : "?"} · ip {u.lastIp ? u.lastIp.replace(/_/g, ".") : "?"}</span>
        </span>
        <span className={clsx("rounded-full px-2 py-1 text-[0.65rem] font-bold", u.approval === "pending" ? "bg-hot/20 text-hot" : "bg-rose/20 text-rose")}>{u.approval === "pending" ? "PENDING" : "REJECTED"}</span>
      </div>
      {u.approval === "rejected" ? <p className="mt-2 text-xs text-paper/55">Reason diya tha: {u.rejectReason || "—"}</p> : null}
      {u.appeal ? <div className="mt-2 rounded-xl border border-hot/40 bg-hot/5 p-2 text-sm"><p className="text-xs font-semibold text-hot">APPEAL · {relTime(u.appealAt)}</p><p className="mt-1 break-words text-paper/85">{u.appeal}</p></div> : null}
      {reject ? (
        <div className="mt-2 space-y-2">
          <input autoFocus className={input} maxLength={200} placeholder="Reject karne ka reason (user ko dikhega)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="tap h-10 flex-1 rounded-xl bg-rose text-sm font-bold text-white" onClick={() => run(adminReject(u.uid, reason).then(() => setReject(false)))}>REJECT</button>
            <button type="button" className="tap h-10 rounded-xl border border-paper/20 px-4 text-sm" onClick={() => setReject(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy} className="tap h-10 flex-1 rounded-xl bg-emerald-600 text-sm font-bold text-white" onClick={() => run(adminApprove(u.uid))}>✓ APPROVE</button>
          {u.approval === "pending" || u.appeal ? <button type="button" disabled={busy} className="tap h-10 flex-1 rounded-xl border border-rose/50 text-sm font-bold text-rose" onClick={() => { setReason(""); setReject(true); }}>✕ REJECT</button> : null}
        </div>
      )}
      {error ? <p className="mt-2 text-sm text-rose">{error}</p> : null}
    </li>
  );
}

export function RequestsTab({ list }: { list: UserDoc[] }) {
  const pending = list.filter((u) => u.approval === "pending");
  const appeals = list.filter((u) => u.approval === "rejected" && u.appeal);
  const rejected = list.filter((u) => u.approval === "rejected" && !u.appeal);
  const section = (title: string, items: UserDoc[]) => items.length ? (
    <div className="space-y-2"><p className="text-xs font-semibold tracking-[0.2em] text-paper/55">{title} ({items.length})</p><ul className="space-y-2">{items.map((u) => <RequestRow key={u.uid} u={u} />)}</ul></div>
  ) : null;
  if (!list.length) return <p className="pt-8 text-center text-paper/55">Koi nayi request nahi 🎉</p>;
  return <div className="space-y-5">{section("NAYI REQUESTS", pending)}{section("APPEALS", appeals)}{section("REJECTED", rejected)}</div>;
}
export function useRequests() {
  const [list, setList] = useState<UserDoc[]>([]);
  useEffect(() => watchRequests(setList), []);
  return list;
}

/* ---------------- security (VPN / one account per device / detection / bans) ---------------- */
export function SecurityTab({ config }: { config: AppConfig }) {
  const [bans, setBans] = useState<BanDoc[]>([]);
  const [error, setError] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => watchBans(setBans), []);
  const set = (p: Partial<AppConfig>) => setConfig({ ...config, ...p }).catch((e) => setError(errorText(e)));
  const rows: [keyof Pick<AppConfig, "blockVpn" | "oneAccountPerDevice" | "autoDetect">, string, string][] = [
    ["blockVpn", "VPN block", "VPN chalu ho to \"VPN not available\" dikhe (tum exempt ho)"],
    ["oneAccountPerDevice", "Ek phone = ek account", "Naya account banane par device lock check hota hai"],
    ["autoDetect", "Auto-detect (gaali / threat / scam / spam)", "Galat message milte hi Alerts tab mein aa jata hai"],
  ];
  return (
    <div className="space-y-4">
      {rows.map(([k, t, d]) => (
        <button key={k} type="button" className="glass tap flex min-h-16 w-full items-center justify-between rounded-2xl px-4 py-2" onClick={() => void set({ [k]: !config[k] } as Partial<AppConfig>)}>
          <span className="text-left"><span className="block font-semibold">{t}</span><span className="block text-xs text-paper/55">{d}</span></span><Toggle on={config[k]} />
        </button>
      ))}
      <div className="glass space-y-2 rounded-2xl p-4">
        <p className="font-semibold">Device lock hatao</p>
        <p className="text-xs text-paper/55">Kisi user ko nayi ID banane deni ho to Users tab mein uska "Device lock hatao" dabao, ya yahan device id paste karo.</p>
        <input className={input} placeholder="device id" value={deviceId} onChange={(e) => setDeviceId(e.target.value.trim())} />
        <button type="button" disabled={!deviceId} className="glass tap h-11 w-full rounded-xl text-sm font-semibold" onClick={() => void releaseDevice(deviceId).then(() => { setDeviceId(""); setMsg("Device lock hat gaya ✓"); window.setTimeout(() => setMsg(""), 2500); }).catch((e) => setError(errorText(e)))}>LOCK HATAO</button>
        {msg ? <p className="text-sm font-semibold text-emerald-400">{msg}</p> : null}
      </div>
      {error ? <p className="text-sm text-rose">{error}</p> : null}
      <p className="text-xs font-semibold tracking-[0.2em] text-paper/55">BANNED DEVICES / IPs ({bans.length})</p>
      {bans.length === 0 ? <p className="text-sm text-paper/50">Abhi koi device / IP ban nahi.</p> : (
        <ul className="space-y-2">{bans.map((b) => (
          <li key={b.id} className="glass flex items-center gap-3 rounded-2xl p-3 text-sm">
            <span className="rounded-lg bg-rose/15 px-2 py-1 text-[0.65rem] font-bold text-rose">{b.kind === "ip" ? "IP" : "DEVICE"}</span>
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{b.name || "—"}</span><span className="block truncate text-xs text-paper/50">{b.id.slice(b.kind === "ip" ? 3 : 2).replace(/_/g, ".")} · {b.reason || "no reason"} · {relTime(b.at)}</span></span>
            <button type="button" className="tap p-1 text-rose" aria-label="Ban hatao" onClick={() => void removeBan(b.id)}><Trash2 className="size-4" /></button>
          </li>
        ))}</ul>
      )}
    </div>
  );
}

/* ---------------- alerts + chat viewer ---------------- */
const KIND_LABEL: Record<string, string> = { abuse: "GAALI", threat: "THREAT", scam: "SCAM", spam: "SPAM", other: "OTHER" };

function AlertRow({ a, onView }: { a: AlertDoc; onView: (chatId: string) => void }) {
  const sender = useUser(a.senderId);
  const [panel, setPanel] = useState(false);
  const [u, setU] = useState<UserDoc | null>(null);
  const user = u ?? sender;
  return (
    <li className={clsx("glass rounded-2xl p-3 text-sm", !a.seen && "border border-rose/50")} onClick={() => { if (!a.seen) void markAlertSeen(a.id).catch(() => undefined); }}>
      <div className="flex items-center gap-2">
        <span className={clsx("rounded-lg px-2 py-1 text-[0.65rem] font-bold", a.kind === "threat" ? "bg-rose text-white" : "bg-hot/20 text-hot")}>{KIND_LABEL[a.kind] ?? "ALERT"}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{user?.displayName ?? a.senderName}{user ? ` · ID ${user.publicId}` : ""}</span>
        <span className="text-xs text-paper/40">{relTime(a.at)}</span>
      </div>
      <p className="mt-2 break-words whitespace-pre-wrap text-paper/85">“{a.text}”</p>
      {a.matched.length ? <p className="mt-1 text-xs text-paper/45">Pakda: {a.matched.join(", ")}</p> : null}
      <div className="mt-2 flex gap-2">
        {a.chatId ? <button type="button" className="glass tap flex h-9 flex-1 items-center justify-center gap-1 rounded-xl text-xs font-bold" onClick={(e) => { e.stopPropagation(); onView(a.chatId); }}><Eye className="size-3.5" /> Chat dekho</button> : null}
        {user && !user.banned ? <button type="button" className="tap flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-rose/50 text-xs font-bold text-rose" onClick={(e) => { e.stopPropagation(); setPanel(true); }}><Gavel className="size-3.5" /> Ban</button> : null}
        <button type="button" className="tap grid size-9 place-items-center rounded-xl border border-paper/20" aria-label="Dismiss" onClick={(e) => { e.stopPropagation(); void dismissAlert(a.id); }}><X className="size-4" /></button>
      </div>
      {panel && user ? <BanPanel u={user} onCancel={() => setPanel(false)} onDone={(n) => { setU(n); setPanel(false); void dismissAlert(a.id); }} /> : null}
    </li>
  );
}

export function AlertsTab({ list, onView }: { list: AlertDoc[]; onView: (chatId: string) => void }) {
  if (!list.length) return <p className="pt-8 text-center text-paper/55">Sab shaant hai, koi alert nahi 😌</p>;
  return (
    <div className="space-y-3">
      <button type="button" className="glass tap h-10 w-full rounded-xl text-xs font-semibold text-paper/70" onClick={() => { if (window.confirm("Saare alerts hata dene hain?")) list.forEach((a) => void dismissAlert(a.id)); }}>Sab dismiss karo</button>
      <ul className="space-y-2">{list.map((a) => <AlertRow key={a.id} a={a} onView={onView} />)}</ul>
    </div>
  );
}
export function useAlerts() {
  const [list, setList] = useState<AlertDoc[]>([]);
  useEffect(() => watchAlerts(setList), []);
  return list;
}

function Names({ chat }: { chat: ChatDoc }) {
  const a = useUser(chat.members[0]);
  const b = useUser(chat.members[1]);
  if (chat.kind === "group") return <>{chat.title || "Squad"} · {chat.members.length} members</>;
  return <>{a?.displayName ?? "…"} ↔ {b?.displayName ?? "…"}</>;
}

export function ChatViewer({ chatId, onBack }: { chatId: string; onBack: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [audit, setAudit] = useState<AuditDoc[]>([]);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => watchAdminMessages(chatId, setMsgs), [chatId]);
  useEffect(() => { adminAudit(chatId).then(setAudit).catch((e) => setError(errorText(e))); }, [chatId, msgs.length]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);
  const originals = (id: string) => audit.filter((x) => x.msgId === id);
  return (
    <div className="space-y-3">
      <button type="button" className="tap flex items-center gap-2 text-sm font-semibold text-paper/70" onClick={onBack}><ArrowLeft className="size-4" /> Wapas</button>
      <p className="rounded-xl bg-paper/5 p-2 text-xs text-paper/50">Sirf padhne ke liye. Delete / edit hue messages ka original yahan dikhta hai.</p>
      {error ? <p className="text-sm text-rose">{error}</p> : null}
      {msgs.length === 0 ? <p className="py-6 text-center text-paper/50">Koi message nahi.</p> : (
        <ul className="space-y-2">
          {msgs.map((m) => {
            const orig = originals(m.id);
            const deleted = orig.filter((o) => o.kind === "deleted");
            const delOrig = deleted[deleted.length - 1];
            const editOrig = orig.filter((o) => o.kind === "edited");
            if (m.system) return <li key={m.id} className="text-center text-xs text-paper/40">{m.text}</li>;
            return (
              <li key={m.id} className={clsx("glass rounded-2xl p-3 text-sm", m.deleted && "border border-rose/50")}>
                <p className="flex justify-between gap-2 text-xs text-paper/50"><span className="font-semibold text-paper/80">{m.senderName}</span><span>{new Date(m.createdAt).toLocaleString()}</span></p>
                {m.deleted ? (
                  <div className="mt-1">
                    <p className="text-xs font-bold text-rose">🗑 DELETE KIYA GAYA</p>
                    {delOrig ? (
                      <>
                        {delOrig.text ? <p className="mt-1 break-words whitespace-pre-wrap">{delOrig.text}</p> : null}
                        {delOrig.image || delOrig.thumb ? <img src={delOrig.image ?? delOrig.thumb ?? ""} alt="deleted" className="mt-1 max-h-48 rounded-xl" /> : null}
                        {delOrig.gif ? <img src={delOrig.gif} alt="gif" referrerPolicy="no-referrer" className="mt-1 max-h-40 rounded-xl" /> : null}
                      </>
                    ) : <p className="mt-1 text-xs text-paper/45">Original save nahi hua (purana message ya purana app version).</p>}
                  </div>
                ) : (
                  <>
                    {m.text ? <p className="mt-1 break-words whitespace-pre-wrap">{m.text}</p> : null}
                    {m.image || m.thumb ? <img src={m.image ?? m.thumb ?? ""} alt="media" className="mt-1 max-h-48 rounded-xl" /> : null}
                    {m.gif ? <img src={m.gif} alt="gif" referrerPolicy="no-referrer" className="mt-1 max-h-40 rounded-xl" /> : null}
                    {m.audio ? <p className="mt-1 text-xs text-paper/50">🎤 Voice message</p> : null}
                    {m.edited && editOrig.length ? <p className="mt-1 text-xs text-hot">✏️ Edit hua. Pehle: “{editOrig[0].text}”</p> : null}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div ref={end} />
    </div>
  );
}

export function ChatsTab({ openChat, setOpenChat }: { openChat: string | null; setOpenChat: (id: string | null) => void }) {
  const [term, setTerm] = useState("");
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [target, setTarget] = useState<UserDoc | null>(null);
  const [chats, setChats] = useState<ChatDoc[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) return;
    const t = window.setTimeout(() => void searchUsers(q, "").then(setUsers).catch((e) => setError(errorText(e))), 300);
    return () => window.clearTimeout(t);
  }, [term]);
  useEffect(() => {
    if (!target) return;
    setChats([]);
    adminUserChats(target.uid).then(setChats).catch((e) => setError(errorText(e)));
  }, [target]);
  if (openChat) return <ChatViewer chatId={openChat} onBack={() => setOpenChat(null)} />;
  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-rose">{error}</p> : null}
      {!target ? (
        <>
          <div className="relative"><Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-paper/40" /><input className={clsx(input, "pl-10")} placeholder="User ka ID ya username search karo" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
          <ul className="space-y-2">{users.map((u) => (
            <li key={u.uid}><button type="button" className="glass tap flex w-full items-center gap-3 rounded-2xl p-3 text-left" onClick={() => setTarget(u)}><Avatar src={u.avatar} name={u.displayName} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{u.displayName}</span><span className="block truncate text-xs text-paper/50">@{u.username} · ID {u.publicId}</span></span><Eye className="size-4 text-paper/50" /></button></li>
          ))}</ul>
        </>
      ) : (
        <>
          <button type="button" className="tap flex items-center gap-2 text-sm font-semibold text-paper/70" onClick={() => { setTarget(null); setChats([]); }}><ArrowLeft className="size-4" /> Dusra user</button>
          <p className="font-display text-xl font-bold">{target.displayName}ki chats</p>
          {chats.length === 0 ? <p className="text-sm text-paper/50">Koi chat nahi mili.</p> : (
            <ul className="space-y-2">{chats.map((c) => (
              <li key={c.id}><button type="button" className="glass tap w-full rounded-2xl p-3 text-left" onClick={() => setOpenChat(c.id)}><span className="block truncate font-semibold"><Names chat={c} /></span><span className="block truncate text-xs text-paper/50">{c.lastMessage ? `${c.lastMessage.senderName}: ${c.lastMessage.text}` : "—"} · {relTime(c.lastAt)}</span></button></li>
            ))}</ul>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- update manager: upload APK (no GitHub) or link ---------------- */
export function UpdateManager({ config }: { config: AppConfig }) {
  const [version, setVersion] = useState(config.updateVersion);
  const [title, setTitle] = useState(config.updateTitle || "Mega Update Here");
  const [url, setUrl] = useState(config.updateUrl);
  const [notes, setNotes] = useState(config.updateNotes);
  const [force, setForce] = useState(config.updateForce);
  const [file, setFile] = useState<File | null>(null);
  const [prog, setProg] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const live = Boolean(config.updateVersion && (config.updateUrl || config.updateParts > 0));
  const newer = live && compareVersions(config.updateVersion, APP_VERSION) > 0;

  const publish = async () => {
    const v = version.trim().replace(/^v/i, "");
    if (!/^\d+(\.\d+){1,3}$/.test(v)) { setError("Version aise likho: 2.3.0"); return; }
    if (compareVersions(v, APP_VERSION) <= 0) { setError(`Naya version v${APP_VERSION} se bada likho (jaise ${APP_VERSION.replace(/\d+$/, (n) => String(Number(n) + 1))}) aur naye APK mein package.json ka version bhi yahi rakho, warna popup baar baar aayega.`); return; }
    if (!file && !/^https:\/\//i.test(url.trim())) { setError("APK file chuno ya https:// link do"); return; }
    setBusy(true); setError(""); setMsg("");
    try {
      let parts = 0;
      let size = 0;
      if (file) {
        parts = await uploadApk(file, v, (d, t) => setProg([d, t]));
        size = file.size;
        void deleteOldApks(v);
      }
      await setConfig({ ...config, updateVersion: v, updateTitle: title.trim().slice(0, 40), updateUrl: file ? "" : url.trim(), updateParts: parts, updateSize: size, updateNotes: notes.trim().slice(0, 300), updateForce: force });
      setMsg("Update publish ho gaya ✓ Sabke screen par popup aayega");
      setFile(null); setProg(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const stop = () => setConfig({ ...config, updateVersion: "", updateUrl: "", updateParts: 0, updateSize: 0, updateNotes: "", updateForce: false }).then(() => setMsg("Update hata diya ✓")).catch((e) => setError(errorText(e)));

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4 text-sm">
        <p className="text-paper/60">Is phone ka app version</p>
        <p className="grad-text font-display text-3xl font-bold">v{APP_VERSION}</p>
        <p className="mt-1 text-xs text-paper/50">{live ? `Live update: v${config.updateVersion} (${config.updateParts > 0 ? `APK Firestore mein, ${(config.updateSize / 1_000_000).toFixed(1)} MB` : "link se"})${newer ? "" : " · sabke paas latest hai"}` : "Abhi koi update publish nahi hai."}</p>
      </div>
      <div className="glass space-y-3 rounded-3xl p-4">
        <p className="font-display text-xl font-bold">🚀 Naya update publish karo</p>
        <input className={input} placeholder="Popup ka heading (jaise Mega Update Here)" maxLength={40} value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={input} inputMode="decimal" placeholder="Naya version (jaise 2.4.0)" value={version} onChange={(e) => setVersion(e.target.value)} />
        <label className={clsx("glass tap flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-3 py-2 text-center font-display text-lg font-bold", busy && "pointer-events-none opacity-50")}>
          <Upload className="size-5" /> {file ? `${file.name} (${(file.size / 1_000_000).toFixed(1)} MB)` : `APK FILE CHUNO (${MAX_APK_MB}MB tak)`}
          <input type="file" accept=".apk,application/vnd.android.package-archive" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </label>
        <p className="text-center text-xs text-paper/45">ya</p>
        <input className={input} inputMode="url" autoCapitalize="none" placeholder="APK direct link (https://…) — file na chuni ho tab" value={url} disabled={Boolean(file)} onChange={(e) => setUrl(e.target.value)} />
        <textarea className="min-h-20 w-full rounded-2xl border border-paper/12 bg-paper/5 p-4 outline-none focus:border-rose/70" maxLength={300} placeholder="Kya naya hai? (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button type="button" className="glass tap flex h-14 w-full items-center justify-between rounded-2xl px-4" onClick={() => setForce(!force)}>
          <span className="text-left"><span className="block font-semibold">Force update</span><span className="block text-xs text-paper/55">ON ho to update kiye bina app nahi chalega</span></span><Toggle on={force} />
        </button>
        {prog ? <div><div className="h-3 overflow-hidden rounded-full bg-paper/10"><div className="grad h-full rounded-full transition-[width]" style={{ width: `${(prog[0] / prog[1]) * 100}%` }} /></div><p className="mt-1 text-xs text-paper/60">Upload: {prog[0]}/{prog[1]} pieces. App band mat karna.</p></div> : null}
        <button type="button" disabled={busy} className="btn-hot tap h-12 w-full rounded-2xl font-display text-lg font-bold" onClick={() => void publish()}>{busy ? "UPLOADING…" : "PUBLISH UPDATE"}</button>
        {live ? <button type="button" className="tap h-11 w-full rounded-2xl border border-rose/40 text-sm font-semibold text-rose" onClick={() => void stop()}>Update band karo</button> : null}
        {msg ? <p className="text-sm font-semibold text-emerald-400">{msg}</p> : null}
        {error ? <p className="text-sm text-rose">{error}</p> : null}
      </div>
      <div className="glass space-y-1 rounded-2xl p-4 text-xs text-paper/60">
        <p className="font-semibold text-paper/80">Kaise kaam karta hai</p>
        <p>1. package.json mein version badhao (jaise 2.4.1) → push karo → APK banao. Yahan wahi version likhna hai.</p>
        <p>2. Yahan version likho, APK file chuno, Publish dabao.</p>
        <p>3. Sabke app mein "{title || "Mega Update Here"}" popup aata hai. UPDATE NOW dabate hi app ke andar download hoke install screen khulti hai.</p>
        <p>Bahut badi APK ho to link wala option use karo (Drive / Dropbox links apne aap direct ho jate hain).</p>
      </div>
    </div>
  );
}

