import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { Ban, Check, Copy, Crown, Lock, MessageCircle, Trash2, X } from "lucide-react";
import { deleteNews, postNews } from "../lib/extra";
import { setCloseFriends, togglePref } from "../lib/data";
import { useUser } from "../lib/hooks";
import { STATUS_META, type NewsItem, type UserDoc } from "../lib/types";
import { errorText, relTime } from "../lib/util";
import { Avatar, Badges, Field, fieldClass } from "./ui";
import { HauntedBg } from "./Horror";

export function Frame({ title, onClose, children, z = 45 }: { title: string; onClose: () => void; children: ReactNode; z?: number }) {
  return (
    <div className="sheet-up safe-top fixed inset-0 flex flex-col bg-ink text-paper" style={{ zIndex: z }}>
      <header className="flex h-16 shrink-0 items-center justify-between px-4">
        <h2 className="font-display text-3xl font-bold">{title}</h2>
        <button type="button" className="tap grid size-11 place-items-center rounded-full" aria-label="Close" onClick={onClose}><X className="size-5" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-10">{children}</div>
    </div>
  );
}

export function NewsSheet({ me, isAdmin, news, onClose }: { me: UserDoc; isAdmin: boolean; news: NewsItem[]; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Frame title="News" onClose={onClose}>
      {isAdmin ? (
        <div className="glass space-y-3 rounded-3xl p-4">
          <p className="font-display text-xl font-bold">📣 Nayi news post karo</p>
          <Field label="TITLE"><input className={fieldClass} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Heading" /></Field>
          <Field label="MESSAGE"><textarea className="min-h-24 w-full rounded-2xl border border-paper/12 bg-paper/5 p-4 outline-none focus:border-rose/70" maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Sabko ye dikhega" /></Field>
          {error ? <p className="text-sm text-rose">{error}</p> : null}
          <button type="button" disabled={busy || !title.trim() || !text.trim()} className="btn-hot tap h-12 w-full rounded-2xl font-display text-lg font-bold" onClick={() => { setBusy(true); setError(""); postNews(me.displayName, title, text).then(() => { setTitle(""); setText(""); }).catch((e) => setError(errorText(e))).finally(() => setBusy(false)); }}>{busy ? "POSTING…" : "POST NEWS"}</button>
        </div>
      ) : null}
      {news.length === 0 ? <div className="pop-in mt-10 text-center"><p className="float text-5xl">📰</p><p className="mt-3 text-sm text-paper/55">Abhi koi news nahi.</p></div> : (
        <ul className="space-y-3">
          {news.map((n, i) => (
            <li key={n.id} className="glass fade-up rounded-2xl p-4" style={{ ["--d" as string]: Math.min(i, 8) * 50 }}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-xl leading-tight font-bold">{n.title}</p>
                {isAdmin ? <button type="button" className="tap p-1 text-rose" aria-label="Delete news" onClick={() => void deleteNews(n.id)}><Trash2 className="size-4" /></button> : null}
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap text-paper/80">{n.text}</p>
              <p className="mt-2 text-xs text-paper/40">{n.by} · {relTime(n.at)}</p>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

const PRO_FEATURES = [
  ["⭐", "Pro badge", "Naam ke saath ⭐ sabko dikhega"],
  ["🎨", "Premium chat themes", "3 extra themes: Sunset, Gold, Sakura"],
  ["⏳", "48 ghante ki story", "Free mein 24 ghante"],
  ["📌", "Unlimited pinned chats", "Free mein sirf 3"],
  ["🛡️", "Bade squads", "50 players tak (free mein 20)"],
  ["🎤", "Lambe voice messages", "2 minute tak (free mein 30 sec)"],
];

export function ProSheet({ me, onClose }: { me: UserDoc; onClose: () => void }) {
  const [buy, setBuy] = useState(false);
  return (
    <Frame title="Pro Plan" onClose={onClose}>
      <div className="relative overflow-hidden rounded-3xl p-6 text-center" style={{ background: "linear-gradient(135deg,#f59e0b,#e11d48 60%,#7c3aed)" }}>
        <Crown className="mx-auto size-10 text-white" />
        <p className="mt-2 font-display text-4xl font-bold text-white">IronRoses Pro</p>
        <p className="mt-1 font-display text-5xl font-bold text-white">₹129<span className="text-xl font-semibold text-white/80"> / month</span></p>
        {me.pro ? <p className="mt-2 inline-block rounded-full bg-black/40 px-3 py-1 text-sm font-bold text-white">✅ Tumhara Pro active hai</p> : null}
      </div>
      <ul className="space-y-2">
        {PRO_FEATURES.map(([icon, t, d]) => (
          <li key={t} className="glass flex items-center gap-3 rounded-2xl p-3"><span className="text-2xl">{icon}</span><span><span className="block font-semibold">{t}</span><span className="block text-xs text-paper/55">{d}</span></span></li>
        ))}
      </ul>
      <p className="text-center text-xs text-paper/45">Pro se koi unfair advantage nahi milta. Sirf looks aur convenience.</p>
      {!me.pro ? <button type="button" className="btn-hot tap h-14 w-full rounded-2xl font-display text-xl font-bold tracking-wide" onClick={() => setBuy(true)}>BUY PRO ₹129</button> : null}
      {buy ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-6" onClick={() => setBuy(false)}>
          <div className="pop-in glass w-full max-w-sm rounded-3xl p-7 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-5xl">🚫</p>
            <p className="blood-text mt-3 font-display text-3xl font-bold">Not Available Here</p>
            <p className="mt-2 text-paper/70">Contact Pryielle :)</p>
            <button type="button" className="btn-hot tap mt-6 h-12 w-full rounded-2xl font-display text-lg font-bold" onClick={() => setBuy(false)}>OK</button>
          </div>
        </div>
      ) : null}
    </Frame>
  );
}

export function Maintenance({ message, onLogout }: { message: string; onLogout: () => void }) {
  return (
    <main className="safe-top fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-ink px-8 text-center text-paper">
      <HauntedBg />
      <div className="relative">
        <p className="float text-6xl">🛠️</p>
        <h1 className="blood-text mt-4 font-display text-5xl leading-tight font-bold">App Under Maintenance</h1>
        {message ? <p className="mx-auto mt-4 max-w-xs text-pretty text-paper/75">{message}</p> : null}
        <p className="grad-text mt-6 font-display text-2xl font-bold">Contact Pryielle :)</p>
        <button type="button" className="tap mt-10 text-xs text-paper/40 underline" onClick={onLogout}>Logout</button>
      </div>
    </main>
  );
}

export function BannedScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <main className="safe-top fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink px-8 text-center text-paper">
      <p className="text-6xl">⛔</p>
      <h1 className="blood-text mt-4 font-display text-5xl font-bold">Account Suspended</h1>
      <p className="mt-3 max-w-xs text-paper/70">Tumhara account rules todne ki wajah se band kiya gaya hai.</p>
      <p className="grad-text mt-6 font-display text-2xl font-bold">Contact Pryielle :)</p>
      <button type="button" className="tap mt-10 h-11 rounded-xl border border-paper/20 px-6 font-display font-bold" onClick={onLogout}>LOGOUT</button>
    </main>
  );
}

function CloseRow({ u, on, onToggle }: { u: UserDoc; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="glass tap flex w-full items-center gap-3 rounded-2xl p-2.5 text-left" onClick={onToggle}>
      <Avatar src={u.avatar} name={u.displayName} size="sm" />
      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{u.displayName}</span><span className="text-xs text-paper/50">@{u.username}</span></span>
      <span className={clsx("grid size-7 place-items-center rounded-full", on ? "bg-emerald-500 text-white" : "border border-paper/25")}>{on ? <Check className="size-4" /> : null}</span>
    </button>
  );
}

export function CloseFriendsSheet({ me, contacts, onClose }: { me: UserDoc; contacts: UserDoc[]; onClose: () => void }) {
  const [list, setList] = useState<string[]>(me.closeFriends);
  const toggle = (uid: string) => {
    const next = list.includes(uid) ? list.filter((x) => x !== uid) : [...list, uid];
    setList(next);
    void setCloseFriends(me.uid, next);
  };
  return (
    <Frame title="Close friends" onClose={onClose}>
      <p className="text-sm text-paper/60">Close friends wali stories sirf inko dikhti hain.</p>
      {contacts.length === 0 ? <p className="text-sm text-paper/50">Abhi koi contact nahi.</p> : <div className="space-y-2">{contacts.map((c) => <CloseRow key={c.uid} u={c} on={list.includes(c.uid)} onToggle={() => toggle(c.uid)} />)}</div>}
    </Frame>
  );
}
