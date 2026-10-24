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

const NEWS_TONES: Record<string, { label: string; bg: string; dot: string }> = {
  green: { label: "Green", dot: "#4fae3a", bg: "radial-gradient(70% 38% at 22% 14%, #c4ee74 0%, transparent 62%), radial-gradient(80% 46% at 88% 38%, #4ba43f 0%, transparent 66%), linear-gradient(172deg, #79c43f 0%, #2f7d2d 46%, #123f1c 100%)" },
  ocean: { label: "Ocean", dot: "#2f7bff", bg: "radial-gradient(70% 38% at 22% 14%, #8fd0ff 0%, transparent 62%), radial-gradient(80% 46% at 88% 38%, #1d5fe0 0%, transparent 66%), linear-gradient(172deg, #3d8cff 0%, #1740b8 46%, #0a1a5c 100%)" },
  sunset: { label: "Sunset", dot: "#ff7a45", bg: "radial-gradient(70% 38% at 22% 14%, #ffd08a 0%, transparent 62%), radial-gradient(80% 46% at 88% 38%, #e0457a 0%, transparent 66%), linear-gradient(172deg, #ff9a4d 0%, #d23e6a 46%, #4a1a5e 100%)" },
  violet: { label: "Violet", dot: "#8b5cf6", bg: "radial-gradient(70% 38% at 22% 14%, #d3b8ff 0%, transparent 62%), radial-gradient(80% 46% at 88% 38%, #6a3fe0 0%, transparent 66%), linear-gradient(172deg, #9b6bff 0%, #4b2bb8 46%, #1a0f4a 100%)" },
};

export function NewsSheet({ me, isAdmin, news, onClose }: { me: UserDoc; isAdmin: boolean; news: NewsItem[]; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [lead, setLead] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [tone, setTone] = useState("green");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const area = "w-full rounded-2xl border border-paper/12 bg-paper/5 p-4 outline-none focus:border-rose/70";
  return (
    <Frame title="News" onClose={onClose}>
      {isAdmin ? (
        <div className="glass space-y-3 rounded-3xl p-4">
          <p className="font-display text-xl font-bold">📣 Nayi news post karo</p>
          <Field label="TITLE"><input className={fieldClass} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bada heading" /></Field>
          <Field label="SUB HEADING (optional)"><input className={fieldClass} maxLength={140} value={lead} onChange={(e) => setLead(e.target.value)} placeholder="Bold line, body ke upar" /></Field>
          <Field label="MESSAGE"><textarea className={`${area} min-h-28`} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Neeche jo likhna hai" /></Field>
          <Field label="COVER IMAGE LINK (optional, https)"><input className={fieldClass} inputMode="url" autoCapitalize="none" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…jpg" /></Field>
          <div className="flex items-center gap-2">
            {Object.entries(NEWS_TONES).map(([id, t]) => (
              <button key={id} type="button" aria-label={t.label} onClick={() => setTone(id)} className={clsx("tap size-9 rounded-full", tone === id ? "ring-2 ring-paper ring-offset-2 ring-offset-black/40" : "opacity-80")} style={{ background: t.dot }} />
            ))}
            <span className="ml-1 text-xs text-paper/50">Posted by <b className="text-paper/80">{me.displayName}</b></span>
          </div>
          {error ? <p className="text-sm text-rose">{error}</p> : null}
          <button type="button" disabled={busy || !title.trim() || !text.trim()} className="btn-hot tap h-12 w-full rounded-2xl font-display text-lg font-bold" onClick={() => { setBusy(true); setError(""); postNews(me.displayName, title, text, { lead, byAvatar: me.avatar, tone, image }).then(() => { setTitle(""); setLead(""); setText(""); setImage(""); }).catch((e) => setError(errorText(e))).finally(() => setBusy(false)); }}>{busy ? "POSTING…" : "POST NEWS"}</button>
        </div>
      ) : null}
      {news.length === 0 ? <div className="pop-in mt-10 text-center"><p className="float text-5xl">📰</p><p className="mt-3 text-sm text-paper/55">Abhi koi news nahi.</p></div> : (
        <ul className="space-y-5">
          {news.map((n, i) => {
            const t = NEWS_TONES[n.tone ?? "green"] ?? NEWS_TONES.green;
            return (
              <li key={n.id} className="fade-up relative overflow-hidden rounded-[32px] text-white shadow-[0_24px_50px_-26px_rgba(0,0,0,0.7)]" style={{ ["--d" as string]: Math.min(i, 6) * 60, background: t.bg }}>
                {n.image ? <img src={n.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
                {n.image ? <span className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/55" /> : null}
                <div className="relative px-6 pt-8">
                  <h3 className="pr-9 text-[2.05rem] leading-[1.06] font-semibold tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">{n.title}</h3>
                  <div className="mt-4 flex items-center gap-2.5">
                    <Avatar src={n.byAvatar ?? null} name={n.by} size="xs" />
                    <p className="min-w-0 truncate text-[0.95rem] font-semibold">{n.by}<span className="font-normal text-white/70"> · {relTime(n.at)}</span></p>
                  </div>
                </div>
                <div className="ir-arch relative mt-6 min-h-[200px] px-6 pt-16 pb-8" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.10))", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)" }}>
                  {n.lead ? <p className="text-[1.2rem] leading-snug font-semibold">{n.lead}</p> : null}
                  <p className={clsx("text-[1rem] leading-relaxed whitespace-pre-wrap text-white/90", n.lead && "mt-3")}>{n.text}</p>
                </div>
                {isAdmin ? <button type="button" className="tap absolute top-4 right-4 rounded-full bg-black/35 p-2 text-white" aria-label="Delete news" onClick={() => void deleteNews(n.id)}><Trash2 className="size-4" /></button> : null}
              </li>
            );
          })}
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
