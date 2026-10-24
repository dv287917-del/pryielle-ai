import { useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Ban, Check, ChevronLeft, Copy, Crown, ImagePlus, Lock, MessageCircle, Plus, Trash2, X } from "lucide-react";
import { deleteNews, postNews } from "../lib/extra";
import { setCloseFriends, togglePref } from "../lib/data";
import { useUser } from "../lib/hooks";
import { STATUS_META, type NewsItem, type UserDoc } from "../lib/types";
import { compressImage, errorText, relTime } from "../lib/util";
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
  const [composing, setComposing] = useState(false);
  const [idx, setIdx] = useState(0);
  const [title, setTitle] = useState("");
  const [lead, setLead] = useState("");
  const [text, setText] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    try { setCover(await compressImage(f, 900, 0.7, 160_000)); setError(""); } catch (e) { setError(errorText(e)); }
  }
  function publish() {
    setBusy(true);
    setError("");
    postNews(me.displayName, title, text, { lead, cover, byAvatar: me.avatar })
      .then(() => { setTitle(""); setLead(""); setText(""); setCover(null); setComposing(false); })
      .catch((e) => setError(errorText(e)))
      .finally(() => setBusy(false));
  }

  return (
    <div className="sheet-up fixed inset-0 z-[45] overflow-hidden bg-[#1d3a0c] text-white">
      {news.length === 0 ? (
        <div className="news-green absolute inset-0 grid place-items-center px-8 text-center">
          <div><p className="float text-6xl">📰</p><p className="mt-4 font-display text-4xl font-bold">No news yet</p><p className="mt-2 text-white/75">Jab owner kuch post karega, yahan dikhega.</p></div>
        </div>
      ) : (
        <div className="news-snap yt-scroll flex h-full overflow-x-auto" onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          {news.map((n) => (
            <article key={n.id} className="news-green relative h-full w-full shrink-0 overflow-hidden">
              {n.cover ? <img src={n.cover} alt="" className="absolute inset-x-0 top-0 h-[62%] w-full object-cover" /> : null}
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-[#2c4d10]/80" />
              <div className="safe-top absolute inset-x-0 top-0 px-6 pt-20">
                <h2 className="font-display text-[2.7rem] leading-[1.02] font-bold tracking-tight drop-shadow-[0_3px_18px_rgba(0,0,0,0.35)]">{n.title}</h2>
                <div className="mt-4 flex items-center gap-2.5">
                  <Avatar src={n.byAvatar ?? null} name={n.by} size="sm" />
                  <p className="text-[0.95rem] font-semibold drop-shadow">{n.by}<span className="font-normal text-white/75"> · {relTime(n.at)}</span></p>
                </div>
              </div>
              <div className="news-arch absolute inset-x-3 bottom-24 top-[40%] flex flex-col px-7 pt-14 pb-4">
                <div className="min-h-0 flex-1 overflow-y-auto pr-1 yt-scroll">
                  {n.lead ? <p className="font-display text-[1.45rem] leading-tight font-bold">{n.lead}</p> : null}
                  <p className={clsx("text-[1.02rem] leading-relaxed whitespace-pre-wrap text-white/90", n.lead && "mt-3")}>{n.text}</p>
                </div>
              </div>
              {isAdmin ? <button type="button" className="tap absolute right-4 bottom-8 grid size-12 place-items-center rounded-full bg-black/35 backdrop-blur" aria-label="Delete news" onClick={() => void deleteNews(n.id)}><Trash2 className="size-5" /></button> : null}
            </article>
          ))}
        </div>
      )}

      <div className="safe-top pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3">
        <button type="button" className="tap pointer-events-auto grid size-11 place-items-center rounded-full border border-white/40 bg-white/15 backdrop-blur-md" aria-label="Close" onClick={onClose}><ChevronLeft className="size-6" /></button>
        {isAdmin ? <button type="button" className="tap pointer-events-auto grid size-11 place-items-center rounded-full border border-white/40 bg-white/15 backdrop-blur-md" aria-label="New news" onClick={() => setComposing(true)}><Plus className="size-6" /></button> : null}
      </div>
      {news.length > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-9 flex justify-center gap-1.5">
          {news.slice(0, 12).map((n, i) => <span key={n.id} className={clsx("h-1.5 rounded-full bg-white transition-all", i === idx ? "w-6 opacity-100" : "w-1.5 opacity-45")} />)}
        </div>
      ) : null}

      {composing ? (
        <div className="sheet-up absolute inset-0 z-10 flex flex-col bg-[#14270a]/95 backdrop-blur-xl">
          <header className="safe-top flex h-16 shrink-0 items-center justify-between px-4">
            <h3 className="font-display text-3xl font-bold">New news</h3>
            <button type="button" className="tap grid size-11 place-items-center rounded-full" aria-label="Close" onClick={() => setComposing(false)}><X className="size-5" /></button>
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-10">
            <Field label="TITLE"><input className={fieldClass} maxLength={70} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bada heading" /></Field>
            <Field label="HEADLINE (bold line, optional)"><input className={fieldClass} maxLength={110} value={lead} onChange={(e) => setLead(e.target.value)} placeholder="Ek line ka summary" /></Field>
            <Field label="NEWS TEXT"><textarea className="min-h-40 w-full rounded-2xl border border-paper/12 bg-paper/5 p-4 outline-none focus:border-lime-400/70" maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Neeche jo likhna hai" /></Field>
            <button type="button" className="tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-paper/25 text-paper/80" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-5" /> {cover ? "Cover photo badlo" : "Cover photo (optional)"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
            {cover ? <img src={cover} alt="" className="h-40 w-full rounded-2xl object-cover" /> : null}
            <p className="text-xs text-paper/50">Posted by: <span className="font-semibold text-paper/80">{me.displayName}</span> (naam card par dikhega)</p>
            {error ? <p className="text-sm text-rose">{error}</p> : null}
            <button type="button" disabled={busy || !title.trim() || !text.trim()} className="premium-btn tap h-14 w-full rounded-2xl font-display text-xl font-bold tracking-wide" onClick={publish}>{busy ? "POSTING…" : "POST NEWS"}</button>
          </div>
        </div>
      ) : null}
    </div>
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
