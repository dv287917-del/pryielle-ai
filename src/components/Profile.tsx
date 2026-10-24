import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Ban, Check, ChevronDown, ChevronLeft, Copy, LayoutGrid, Lock, Menu, MessageCircle, Music2, PlayCircle, Plus, Share2, StickyNote, UserCheck, UserPlus } from "lucide-react";
import { getNote, getStories } from "../lib/extra";
import { togglePref } from "../lib/data";
import { fmtCount, postsOf, shownCount, useFollowStats } from "../lib/follow";
import { useUser } from "../lib/hooks";
import { STATUS_META, type NoteDoc, type StoryItem, type UserDoc } from "../lib/types";
import { pushBack } from "../lib/util";
import { STORY_BG, visibleItems } from "./Stories";
import { Avatar, Badges } from "./ui";
import { NoteBubble } from "./Notes";
import { FollowList } from "./FollowUI";

type StatItem = { v: ReactNode; l: string; onClick?: () => void };
function Stat({ v, l, onClick }: StatItem) {
  const inner = <><p className="truncate font-display text-[1.65rem] leading-none font-bold tabular-nums">{v}</p><p className="mt-1 truncate text-[0.95rem] text-paper/85">{l}</p></>;
  return onClick ? <button type="button" className="tap min-w-0 text-center" onClick={onClick}>{inner}</button> : <div className="min-w-0 text-center">{inner}</div>;
}

/** Instagram profile ka upar wala hissa: avatar + note + stats + naam + bio. Sabki profile isi design mein. */
function Top({ u, note, stats, onAvatar, plus, live }: { u: UserDoc; note: NoteDoc | null; stats: StatItem[]; onAvatar?: () => void; plus?: boolean; live?: boolean }) {
  return (
    <>
      <div className={clsx("flex items-center gap-5 px-4", note ? "pt-[5.4rem]" : "pt-[4.25rem]")}>
        <div className="relative shrink-0">
          <div className="absolute bottom-[calc(100%-1.1rem)] left-0 z-10 w-max"><NoteBubble note={note} /></div>
          <div className={u.pro ? "nitro-wrap" : undefined}>
            <button type="button" className="tap block rounded-full" onClick={onAvatar} aria-label="Avatar"><Avatar src={u.avatar} name={u.displayName} size="xl" live={live} /></button>
          </div>
          {plus ? <span className="absolute right-0 bottom-0 grid size-6 place-items-center rounded-full bg-paper text-ink ring-2 ring-ink"><Plus className="size-4" strokeWidth={3} /></span> : null}
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">{stats.map((s) => <Stat key={s.l} {...s} />)}</div>
      </div>
      <div className="mt-3 px-4">
        <p className="flex flex-wrap items-center text-[1.05rem] font-semibold">{u.displayName}<Badges u={u} /></p>
        {u.bio ? <p className="mt-1.5 text-[1.05rem] break-words whitespace-pre-wrap">{u.bio}</p> : null}
      </div>
    </>
  );
}

function Pills({ u }: { u: UserDoc }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto px-4">
      <span className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-paper/20 px-4 text-[0.95rem] font-medium">@{u.username}</span>
      <button type="button" className="tap flex h-10 shrink-0 items-center gap-2 rounded-full border border-paper/20 px-4 text-[0.95rem] font-medium tabular-nums" onClick={() => { void navigator.clipboard?.writeText(u.publicId); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }}>ID {u.publicId} {copied ? <Check className="size-4 text-aqua" /> : <Copy className="size-4 text-paper/60" />}</button>
      {u.ffRank ? <span className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-paper/20 px-4 text-[0.95rem] font-medium">🎮 {u.ffRank}</span> : null}
    </div>
  );
}

function Tabs({ tab, onTab }: { tab: number; onTab: (i: number) => void }) {
  const icons = [LayoutGrid, PlayCircle];
  return (
    <div className="mt-4 grid grid-cols-2 border-b border-paper/10">
      {icons.map((I, i) => (
        <button key={i} type="button" aria-label={i === 0 ? "Info" : "Stories"} onClick={() => onTab(i)} className={clsx("tap relative grid h-12 place-items-center", tab === i ? "text-paper" : "text-paper/45")}>
          <I className="size-6" />
          <span className={clsx("absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-paper transition-opacity", tab === i ? "opacity-100" : "opacity-0")} />
        </button>
      ))}
    </div>
  );
}

function StoryGrid({ items, onOpen, empty }: { items: StoryItem[]; onOpen?: () => void; empty: ReactNode }) {
  if (!items.length) return <div className="px-6 pt-16 pb-10 text-center">{empty}</div>;
  return (
    <div className="grid grid-cols-3 gap-0.5 pt-0.5">
      {items.map((it) => (
        <button key={it.id} type="button" onClick={onOpen} className="tap relative aspect-[3/4] overflow-hidden bg-paper/10" style={it.kind === "text" ? { background: STORY_BG[it.bg % STORY_BG.length] } : undefined}>
          {it.kind === "image" && it.thumb ? <img decoding="async" src={it.thumb} alt="" className="h-full w-full object-cover blur-[2px]" /> : null}
          {it.kind === "text" ? <span className="absolute inset-0 grid place-items-center p-2 text-center font-display text-sm leading-tight font-bold text-white">{it.text.slice(0, 40)}</span> : null}
          {it.musicTitle ? <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[0.6rem] text-white"><Music2 className="size-3" /></span> : null}
        </button>
      ))}
    </div>
  );
}

const btn = "tap flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-paper/12 text-[1rem] font-semibold";

/** Mera apna profile tab. */
export function ProfileView({ me, note, unread, myStories, onCreateStory, onOpenStory, onNote, onEdit, onMenu, onOpenProfile }: {
  me: UserDoc; note: NoteDoc | null; unread: number; myStories: StoryItem[];
  onCreateStory: () => void; onOpenStory: () => void; onNote: () => void; onEdit: () => void; onMenu: () => void; onOpenProfile: (uid: string) => void;
}) {
  const [tab, setTab] = useState(0);
  const [list, setList] = useState<"followers" | "following" | null>(null);
  const fs = useFollowStats(me.uid, me.uid);
  const share = () => {
    const text = `${me.displayName} (@${me.username}) ko IronRoses MSG par dhoondo, ID: ${me.publicId}`;
    if (navigator.share) void navigator.share({ text }).catch(() => undefined);
    else void navigator.clipboard?.writeText(text);
  };
  return (
    <div className="relative min-h-full pb-6">
      <header className="absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between px-3">
        <button type="button" className="tap grid size-11 place-items-center" aria-label="Naya story" onClick={onCreateStory}><Plus className="size-8" strokeWidth={1.75} /></button>
        <p className="flex min-w-0 items-center gap-1.5 text-xl font-bold">{me.private ? <Lock className="size-4 shrink-0" /> : null}<span className="truncate">{me.username}</span><ChevronDown className="size-5 shrink-0" />{unread > 0 ? <span className="size-2.5 shrink-0 rounded-full bg-red-500" /> : null}</p>
        <div className="flex items-center"><button type="button" className="tap grid size-11 place-items-center" aria-label="Note" onClick={onNote}><StickyNote className="size-6" /></button><button type="button" className="tap grid size-11 place-items-center" aria-label="Settings" onClick={onMenu}><Menu className="size-7" /></button></div>
      </header>
      <Top u={me} note={note} onAvatar={onNote} plus live stats={[{ v: fmtCount(postsOf(me)), l: "posts" }, { v: fmtCount(shownCount(me.followersCustom, fs.followers)), l: "followers", onClick: () => setList("followers") }, { v: fmtCount(shownCount(me.followingCustom, fs.following)), l: "following", onClick: () => setList("following") }]} />
      <Pills u={me} />
      <div className="mt-4 flex gap-2 px-4">
        <button type="button" className={btn} onClick={onEdit}>Edit profile</button>
        <button type="button" className={btn} onClick={share}><Share2 className="size-4" /> Share profile</button>
      </div>
      <Tabs tab={tab} onTab={setTab} />
      {tab === 0 ? (
        <div className="space-y-3 p-4">
          <div className="glass space-y-3 rounded-2xl p-4">
            <p className="font-display text-xl font-bold">🎮 Free Fire</p>
            <div className="flex items-center justify-between"><span className="text-sm text-paper/55">Rank</span><span className="font-semibold">{me.ffRank || "—"}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-paper/55">UID</span><span className="font-semibold tabular-nums">{me.ffUid || "—"}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-paper/55">Status</span><span className="font-semibold">{STATUS_META[me.status].emoji} {STATUS_META[me.status].label}</span></div>
          </div>
        </div>
      ) : (
        <StoryGrid items={myStories} onOpen={onOpenStory} empty={<><p className="text-5xl">🫶</p><p className="mt-4 font-display text-3xl font-bold">Create your first story</p><p className="mt-1 text-paper/60">Give this space some love.</p><button type="button" className="btn-hot tap mt-5 h-12 rounded-2xl px-6 font-display text-lg font-bold" onClick={onCreateStory}>NEW STORY</button></>} />
      )}
      {list ? <FollowList uid={me.uid} mode={list} onClose={() => setList(null)} onOpenProfile={(id) => { setList(null); onOpenProfile(id); }} /> : null}
    </div>
  );
}

/** Kisi bhi dusre bande ki profile: wahi design. */
export function ProfileSheet({ uid, me, contactUids, onClose, onMessage, onOpenProfile }: { uid: string; me: UserDoc; contactUids: Set<string>; onClose: () => void; onMessage: (u: UserDoc) => void; onOpenProfile: (uid: string) => void }) {
  const u = useUser(uid, true);
  const fs = useFollowStats(uid, me.uid);
  const [list, setList] = useState<"followers" | "following" | null>(null);
  useEffect(() => setList(null), [uid]);
  const [tab, setTab] = useState(0);
  const [note, setNote] = useState<NoteDoc | null>(null);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [copied, setCopied] = useState("");
  const self = uid === me.uid;
  const restricted = Boolean(u?.private && !contactUids.has(uid) && !self);
  const blocked = me.blocked.includes(uid);
  useEffect(() => pushBack(onClose), [onClose]);
  useEffect(() => {
    if (restricted) { setNote(null); setStories([]); return; }
    void getNote(uid).then(setNote).catch(() => undefined);
    void getStories(uid).then((l) => setStories(visibleItems(l, me.uid, uid))).catch(() => undefined);
  }, [uid, restricted, me.uid]);

  return (
    <div className="sheet-up safe-top fixed inset-0 z-[55] flex flex-col bg-ink text-paper">
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-1 px-2">
        <button type="button" className="tap grid size-11 place-items-center" aria-label="Back" onClick={onClose}><ChevronLeft className="size-7" /></button>
        <p className="flex min-w-0 items-center gap-1.5 text-xl font-bold">{u?.private ? <Lock className="size-4 shrink-0" /> : null}<span className="truncate">{u?.username ?? "…"}</span></p>
      </header>
      <div className="relative -mt-14 min-h-0 flex-1 overflow-y-auto pb-10">
        {!u ? <p className="pt-24 text-center text-paper/55">Loading…</p> : (
          <>
            <Top u={u} note={note} live={!restricted && Date.now() - u.lastSeen < 90_000}
              stats={[{ v: restricted ? "—" : fmtCount(postsOf(u)), l: "posts" }, { v: restricted ? "—" : fmtCount(shownCount(u.followersCustom, fs.followers)), l: "followers", onClick: restricted ? undefined : () => setList("followers") }, { v: restricted ? "—" : fmtCount(shownCount(u.followingCustom, fs.following)), l: "following", onClick: restricted ? undefined : () => setList("following") }]} />
            <Pills u={u} />
            {!self ? (
              <div className="mt-4 flex gap-2 px-4">
                <button type="button" disabled={!fs.ready} className={clsx(btn, !fs.mine && "grad text-white")} onClick={() => void fs.toggle()}>{fs.mine ? <><UserCheck className="size-4" /> Following</> : <><UserPlus className="size-4" /> Follow</>}</button>
                <button type="button" className={btn} onClick={() => onMessage(u)}><MessageCircle className="size-4" /> Message</button>
                <button type="button" className={clsx(btn, "!flex-none w-11", !blocked && "text-rose")} aria-label={blocked ? "Unblock" : "Block"} onClick={() => void togglePref(me.uid, "blocked", uid, !blocked)}><Ban className="size-4" /></button>
              </div>
            ) : null}
            <Tabs tab={tab} onTab={setTab} />
            {restricted ? (
              <div className="glass m-4 flex items-center gap-3 rounded-2xl p-4 text-sm text-paper/70"><Lock className="size-5 text-hot" /> Ye private account hai. Rank, UID, note aur stories sirf contacts ko dikhte hain. Message request bhej sakte ho.</div>
            ) : tab === 0 ? (
              <div className="p-4">
                <div className="glass space-y-3 rounded-2xl p-4">
                  <p className="font-display text-xl font-bold">🎮 Free Fire</p>
                  <div className="flex items-center justify-between"><span className="text-sm text-paper/55">Rank</span><span className="font-semibold">{u.ffRank || "—"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-paper/55">UID</span>
                    {u.ffUid ? <button type="button" className="flex items-center gap-2 font-semibold tabular-nums" onClick={() => { void navigator.clipboard?.writeText(u.ffUid); setCopied("ff"); window.setTimeout(() => setCopied(""), 1200); }}>{u.ffUid}{copied === "ff" ? <Check className="size-4 text-aqua" /> : <Copy className="size-4 text-paper/50" />}</button> : <span className="font-semibold">—</span>}</div>
                  <div className="flex items-center justify-between"><span className="text-sm text-paper/55">Status</span><span className="font-semibold">{STATUS_META[u.status].emoji} {STATUS_META[u.status].label}</span></div>
                </div>
              </div>
            ) : (
              <StoryGrid items={stories} empty={<><p className="text-5xl">🫶</p><p className="mt-3 text-paper/60">Abhi koi story nahi.</p></>} />
            )}
          </>
        )}
      </div>
      {list ? <FollowList uid={uid} mode={list} onClose={() => setList(null)} onOpenProfile={(id) => { setList(null); onOpenProfile(id); }} /> : null}
    </div>
  );
}
