import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { AlarmHost } from "./Emergency";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import clsx from "clsx";
import { BellOff, Bell, Camera, Check, ChevronDown, Home, Lock, Newspaper, Pin, Plus, Search, Send, ShieldCheck, SquarePen, Users, X } from "lucide-react";
import { acceptChat, declineChat, getUser, heartbeat, openDm, saveToken, setStatus, watchChats } from "../lib/data";
import { getStories, watchNews } from "../lib/extra";
import { useNotes, NoteEditor, NoteViewer, NotesRow, type NoteTile } from "./Notes";
import { ProfileSheet, ProfileView } from "./Profile";
import { Frame } from "./Panels";
import { useUser } from "../lib/hooks";
import { STATUS_META, type AppConfig, type ChatDoc, type NewsItem, type Presence, type StoryItem, type UserDoc } from "../lib/types";
import { buzz, chime, errorText, isOnline, pushBack, relTime } from "../lib/util";
import { Aurora, Avatar, Badges, Field, Mark, fieldClass } from "./ui";
import { Me } from "./Me";
import { GroupSheet, JoinSheet, SquadIcon, useSearch } from "./Sheets";
import { Thread } from "./Thread";
import { FloatBtn } from "./FloatBtn";
import { HomeView } from "./HomeView";
import { CloseFriendsSheet, NewsSheet, ProSheet } from "./Panels";
import { SpamGuard } from "./SpamGuard";
import { StoriesStrip, StoryCreator, StoryViewer, visibleItems, type StoryOwner } from "./Stories";

type Tab = "home" | "chats" | "find" | "squads" | "me";
type Notice = { id: string; chatId: string; title: string; body: string; avatar: string | null };

// Bhaari screens sirf kholne par load hote hain => startup fast + RAM kam
const AiChat = lazy(() => import("./AiChat").then((m) => ({ default: m.AiChat })));
const Secret = lazy(() => import("./Secret").then((m) => ({ default: m.Secret })));
const Settings = lazy(() => import("./Settings").then((m) => ({ default: m.Settings })));
const AdminPanel = lazy(() => import("./Admin").then((m) => ({ default: m.AdminPanel })));

const TABS = [
  { id: "home" as const, icon: Home, label: "Home" },
  { id: "squads" as const, icon: Users, label: "Squads" },
  { id: "chats" as const, icon: Send, label: "Chats" },
  { id: "find" as const, icon: Search, label: "Find" },
  { id: "me" as const, icon: Home, label: "Me" },
];

function previewText(chat: ChatDoc, meUid: string): string {
  const l = chat.lastMessage;
  if (!l) return "No messages";
  const fromMe = l.senderId === meUid;
  const kinds: Record<string, string> = { image: "a photo", video: "a video", audio: "a voice message", gif: "a GIF" };
  if (kinds[l.type]) return `${fromMe ? "You sent" : "Sent"} ${kinds[l.type]}`;
  if (l.type === "system") return l.text;
  const who = chat.kind === "group" ? (fromMe ? "You: " : `${l.senderName}: `) : fromMe ? "You: " : "";
  return `${who}${l.text}`;
}

function ChatRow({ chat, me, index, filter, onOpen }: { chat: ChatDoc; me: UserDoc; index: number; filter?: string; onOpen: (id: string) => void }) {
  const peerUid = chat.kind === "dm" ? chat.members.find((u) => u !== me.uid) ?? null : null;
  const peer = useUser(peerUid);
  const title = chat.kind === "group" ? chat.title : peer?.displayName ?? "…";
  const unread = chat.unread?.[me.uid] ?? 0;
  const last = chat.lastMessage;
  const q = (filter ?? "").trim().toLowerCase();
  if (q && !title.toLowerCase().includes(q) && !(peer?.username ?? "").includes(q)) return null;
  return (
    <li className="fade-up" style={{ "--d": Math.min(index, 8) * 40 } as CSSProperties}>
      <button type="button" onClick={() => onOpen(chat.id)} className="tap flex w-full items-center gap-3.5 px-4 py-3 text-left active:bg-paper/5">
        {chat.kind === "group" ? (
          <span className="grad grid size-14 shrink-0 place-items-center rounded-full text-white"><Users className="size-6" /></span>
        ) : (
          <span className="relative">
            <Avatar src={peer?.avatar ?? null} name={title} size="row" />
            {peer && isOnline(peer.lastSeen) ? <span className="absolute right-0 bottom-0 size-3.5 rounded-full bg-emerald-400 ring-2 ring-ink" /> : null}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={clsx("flex items-center text-[1.1rem]", unread ? "font-semibold" : "font-normal")}>
            <span className="truncate">{title}</span>{chat.kind === "dm" ? <Badges u={peer} /> : null}
            {me.pinned.includes(chat.id) ? <Pin className="ml-1.5 size-4 shrink-0 fill-paper/60 text-paper/60" /> : null}
            {me.muted.includes(chat.id) ? <BellOff className="ml-1.5 size-3.5 shrink-0 text-paper/40" /> : null}
          </span>
          <span className={clsx("mt-0.5 block truncate text-[1rem]", unread ? "font-semibold text-paper" : "text-paper/60")}>
            {previewText(chat, me.uid)}{last ? ` · ${relTime(last.at)}` : ""}
          </span>
        </span>
        {unread > 0 ? <span key={unread} className="badge-pop size-3 shrink-0 rounded-full bg-[#2b8cff]" aria-label={`${unread} unread`} /> : null}
        <Camera className="size-7 shrink-0 text-paper/70" strokeWidth={1.6} />
      </button>
    </li>
  );
}

function RequestRow({ chat, me, onOpen }: { chat: ChatDoc; me: UserDoc; onOpen: (id: string) => void }) {
  const from = useUser(chat.requestFrom);
  return (
    <li className="glass pop-in flex items-center gap-3 rounded-2xl p-2.5">
      <Avatar src={from?.avatar ?? null} name={from?.displayName ?? "?"} size="sm" />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(chat.id)}>
        <span className="block truncate font-semibold">{from?.displayName ?? "…"}</span>
        <span className="block truncate text-xs text-paper/55">{chat.lastMessage?.text ?? "Message request"}</span>
      </button>
      <button type="button" className="tap grid size-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-300" aria-label="Accept" onClick={() => void acceptChat(chat.id)}><Check className="size-5" /></button>
      <button type="button" className="tap grid size-10 place-items-center rounded-xl bg-rose/20 text-rose" aria-label="Decline" onClick={() => void declineChat(chat.id)}><X className="size-5" /></button>
    </li>
  );
}

function FindTab({ me, onOpen, onProfile }: { me: UserDoc; onOpen: (id: string) => void; onProfile: (uid: string) => void }) {
  const [term, setTerm] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const { hits, busy } = useSearch(term, me.uid);
  async function message(u: UserDoc) {
    setPending(u.uid);
    setError("");
    try {
      onOpen(await openDm(me, u));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending("");
    }
  }
  return (
    <div className="p-4">
      <Field label="FIND BY ID OR USERNAME">
        <input className={fieldClass} value={term} placeholder="8-digit ID ya username" autoCapitalize="none" autoCorrect="off" onChange={(e) => setTerm(e.target.value)} />
      </Field>
      {error ? <p className="mt-2 text-sm text-rose">{error}</p> : null}
      {term.trim().length < 2 ? (
        <div className="pop-in mt-10 text-center">
          <p className="float text-5xl">🔎</p>
          <p className="mt-3 text-sm text-pretty text-paper/55">Jo bhi sign up karta hai uski ID yahan mil jati hai.</p>
        </div>
      ) : null}
      {busy ? <p className="mt-4 text-sm text-paper/50">Searching…</p> : null}
      {!busy && term.trim().length >= 2 && hits.length === 0 ? <p className="mt-4 text-sm text-paper/55">Koi player nahi mila.</p> : null}
      <ul className="mt-4 space-y-2">
        {hits.map((u, i) => (
          <li key={u.uid} onClick={() => onProfile(u.uid)} className="glass fade-up flex cursor-pointer items-center gap-3 rounded-2xl p-2.5" style={{ "--d": i * 50 } as CSSProperties}>
            <Avatar src={u.avatar} name={u.displayName} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{u.displayName}</span>
              <span className="block truncate text-xs text-paper/50">@{u.username} · {u.publicId}{u.ffRank ? ` · ${u.ffRank}` : ""}</span>
            </span>
            <button type="button" disabled={pending === u.uid} onClick={(e) => { e.stopPropagation(); void message(u); }} className="btn-hot tap h-10 rounded-xl px-4 font-display font-bold tracking-wide">MSG</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Shell({ me, isAdmin, config, float = false }: { me: UserDoc; isAdmin: boolean; config: AppConfig; float?: boolean }) {
  const [tab, setTab] = useState<Tab>(float ? "chats" : "home");
  const [secretOpen, setSecretOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsOpen, setNewsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [contactUsers, setContactUsers] = useState<Record<string, UserDoc>>({});
  const [storyItems, setStoryItems] = useState<Record<string, StoryItem[]>>({});
  const [storyAt, setStoryAt] = useState<number | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [storyTick, setStoryTick] = useState(0);
  const [newsSeen, setNewsSeen] = useState(() => Number(localStorage.getItem("pry-news-seen") ?? 0));
  const [chats, setChats] = useState<ChatDoc[] | null>(null);
  const [chatError, setChatError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [groupFor, setGroupFor] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [pingOpen, setPingOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [noteTick, setNoteTick] = useState(0);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [sound, setSound] = useState(localStorage.getItem("pry-sound") !== "0");
  const [alerts, setAlerts] = useState("granted");
  const seen = useRef<Map<string, number> | null>(null);
  const native = Capacitor.isNativePlatform();

  useEffect(() => watchChats(me.uid, (list) => { setChats(list); setChatError(""); }, (e) => setChatError(errorText(e))), [me.uid]);

  /* presence */
  useEffect(() => {
    void heartbeat(me.uid, "active");
    const t = window.setInterval(() => { if (!document.hidden) void heartbeat(me.uid, "active"); }, 30_000);
    const wake = () => void heartbeat(me.uid, document.hidden ? "background" : "active");
    document.addEventListener("visibilitychange", wake);
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => void heartbeat(me.uid, isActive ? "active" : "background"));
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", wake); void sub.then((h) => h.remove()).catch(() => undefined); };
  }, [me.uid]);

  /* permissions + push */
  useEffect(() => {
    if (!native) {
      setAlerts(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
      return;
    }
    void (async () => {
      try {
        const p = await PushNotifications.checkPermissions();
        const ask = p.receive === "prompt" ? await PushNotifications.requestPermissions() : p;
        setAlerts(ask.receive);
        if (ask.receive === "granted") {
          await PushNotifications.register();
          void LocalNotifications.requestPermissions();
        }
      } catch {
        /* optional */
      }
    })();
    const subs = [
      PushNotifications.addListener("registration", (t) => void saveToken(me.uid, t.value)),
      PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
        const id = (a.notification.data as { chatId?: string } | undefined)?.chatId;
        if (id) setActiveId(id);
      }),
    ];
    return () => subs.forEach((s) => void s.then((h) => h.remove()));
  }, [me.uid, native]);

  async function enableAlerts() {
    if (native) {
      const r = await PushNotifications.requestPermissions();
      setAlerts(r.receive);
      if (r.receive === "granted") void PushNotifications.register();
    } else if (typeof Notification !== "undefined") setAlerts(await Notification.requestPermission());
  }

  /* in-app notifications */
  useEffect(() => {
    if (!chats) return;
    if (!seen.current) {
      seen.current = new Map(chats.map((c) => [c.id, c.lastMessage?.at ?? 0]));
      return;
    }
    const fresh: Notice[] = [];
    for (const c of chats) {
      const at = c.lastMessage?.at ?? 0;
      const prev = seen.current.get(c.id) ?? 0;
      seen.current.set(c.id, at);
      const m = c.lastMessage;
      if (!m || at <= prev || m.senderId === me.uid || m.type === "system" || c.id === activeId || me.muted.includes(c.id)) continue;
      if (c.kind === "dm" && !c.accepted) continue;
      fresh.push({ id: `${c.id}:${at}`, chatId: c.id, title: c.kind === "group" ? `${m.senderName} · ${c.title}` : m.senderName, body: m.text, avatar: null });
    }
    if (!fresh.length) return;
    setNotices((cur) => [...fresh, ...cur].slice(0, 4));
    if (sound) chime();
    buzz();
    if (document.hidden) {
      const top = fresh[0];
      if (native) void LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 2_000_000_000), title: top.title, body: top.body, extra: { chatId: top.chatId } }] }).catch(() => undefined);
      else if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(top.title, { body: top.body });
    }
    fresh.forEach((n) => window.setTimeout(() => setNotices((cur) => cur.filter((x) => x.id !== n.id)), 4600));
  }, [chats, activeId, sound, me.uid, me.muted, native]);

  const visibleChats = useMemo(() => (chats ?? []).filter((c) => !(c.kind === "dm" && !c.accepted && c.requestFrom !== me.uid)), [chats, me.uid]);
  const requests = useMemo(() => (chats ?? []).filter((c) => c.kind === "dm" && !c.accepted && c.requestFrom !== me.uid), [chats, me.uid]);
  const sorted = useMemo(
    () => [...visibleChats].sort((a, b) => Number(me.pinned.includes(b.id)) - Number(me.pinned.includes(a.id)) || b.lastAt - a.lastAt),
    [visibleChats, me.pinned],
  );
  const squads = sorted.filter((c) => c.kind === "group");
  const unread = visibleChats.reduce((n, c) => n + (c.unread?.[me.uid] ?? 0), 0);

  useEffect(() => { document.title = unread > 0 ? `(${unread}) IronRoses MSG` : "IronRoses MSG"; }, [unread]);

  useEffect(() => watchNews(setNews), []);
  useEffect(() => {
    if (float) (window as unknown as { NativeBridge?: { unread?: (n: number) => void } }).NativeBridge?.unread?.(unread);
  }, [float, unread]);
  const newsUnread = news.length > 0 && news[0].at > newsSeen;

  const contactUids = useMemo(() => {
    const set = new Set<string>();
    for (const c of chats ?? []) if (c.kind === "dm" && c.accepted) for (const u of c.members) if (u !== me.uid) set.add(u);
    return set;
  }, [chats, me.uid]);
  const contactKey = [...contactUids].sort().join(",");

  useEffect(() => {
    let stop = false;
    const missing = [...contactUids].filter((u) => !contactUsers[u]);
    if (!missing.length) return;
    void Promise.all(missing.map((u) => getUser(u).catch(() => null))).then((list) => {
      if (stop) return;
      setContactUsers((cur) => {
        const next = { ...cur };
        for (const u of list) if (u) next[u.uid] = u;
        return next;
      });
    });
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactKey]);

  useEffect(() => {
    let stop = false;
    const load = () => {
      const ids = [me.uid, ...contactUids];
      void Promise.all(ids.map((u) => getStories(u).then((items) => [u, visibleItems(items, me.uid, u)] as const).catch(() => [u, []] as const))).then((rows) => {
        if (stop) return;
        const next: Record<string, StoryItem[]> = {};
        for (const [u, items] of rows) if (items.length) next[u] = items;
        setStoryItems(next);
      });
    };
    load();
    const t = window.setInterval(load, 60_000);
    return () => { stop = true; window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactKey, me.uid, storyTick]);

  const storyOwners: StoryOwner[] = useMemo(
    () => Object.entries(storyItems).map(([uid, items]) => ({ uid, items, user: uid === me.uid ? me : contactUsers[uid] ?? null })).sort((a, b) => (a.uid === me.uid ? -1 : b.uid === me.uid ? 1 : b.items[b.items.length - 1].createdAt - a.items[a.items.length - 1].createdAt)),
    [storyItems, contactUsers, me],
  );

  const notes = useNotes([me.uid, ...contactUids], noteTick);
  const noteTiles: NoteTile[] = useMemo(() => {
    const others = Object.values(notes).filter((n) => n.uid !== me.uid && contactUsers[n.uid] && (n.audience !== "close" || (contactUsers[n.uid].closeFriends ?? []).includes(me.uid))).sort((a, b) => b.createdAt - a.createdAt);
    return [{ uid: me.uid, user: me, note: notes[me.uid] ?? null }, ...others.map((n) => ({ uid: n.uid, user: contactUsers[n.uid] ?? null, note: n }))];
  }, [notes, contactUsers, me]);
  const myStories: StoryItem[] = storyItems[me.uid] ?? [];

  const openProfileMessage = async (u: UserDoc) => {
    try {
      const id = await openDm(me, u);
      setProfileFor(null);
      setTab("chats");
      openChat(id);
    } catch (e) {
      setProfileFor(null);
      alert(errorText(e));
    }
  };

  const openChat = useCallback((id: string) => {
    setActiveId(id);
    setGroupFor(null);
    setJoinOpen(false);
    setPingOpen(false);
    setNotices((cur) => cur.filter((n) => n.chatId !== id));
  }, []);

  useEffect(() => {
    if (groupFor || joinOpen || pingOpen || newsOpen || adminOpen || proOpen || closeOpen || profileFor || requestsOpen || settingsOpen) {
      return pushBack(() => { setGroupFor(null); setJoinOpen(false); setPingOpen(false); setNewsOpen(false); setAdminOpen(false); setProOpen(false); setCloseOpen(false); setProfileFor(null); setRequestsOpen(false); setSettingsOpen(false); setMenuOpen(false); });
    }
    if (!activeId && tab !== "home") return pushBack(() => setTab("home"));
  }, [groupFor, joinOpen, pingOpen, newsOpen, adminOpen, proOpen, closeOpen, profileFor, requestsOpen, settingsOpen, activeId, tab]);

  const closeThread = useCallback(() => setActiveId(null), []);
  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const prevTabIdx = useRef(tabIndex);
  const tabDir = tabIndex >= prevTabIdx.current ? 1 : -1;
  useEffect(() => { prevTabIdx.current = tabIndex; }, [tabIndex]);

  return (
    <div className="safe-top relative flex h-dvh overflow-hidden bg-ink text-paper">
      <div className="relative flex min-h-0 w-full flex-col lg:w-[400px] lg:shrink-0 lg:border-r lg:border-paper/10">
      <Aurora />
      <AlarmHost uid={me.uid} />
      {tab === "chats" ? (
        <header className="relative flex h-14 shrink-0 items-center justify-center px-4">
          <button type="button" className="tap flex items-center gap-1.5 text-[1.5rem] font-bold" onClick={() => setTab("me")}>
            <span className="max-w-[14rem] truncate">{me.username}</span><ChevronDown className="size-6" />{unread > 0 ? <span className="size-2.5 rounded-full bg-red-500" /> : null}
          </button>
          <button type="button" className="tap absolute right-3 grid size-11 place-items-center" aria-label="New chat" onClick={() => setTab("find")}><SquarePen className="size-7" strokeWidth={1.6} /></button>
        </header>
      ) : tab !== "me" ? (
      <header className="relative flex h-16 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Mark className="size-8" />
          <p className="font-display text-2xl leading-none font-bold">IronRoses <span className="grad-text">MSG</span></p>
        </div>
        <div className="flex items-center">
          <button type="button" className="tap relative grid size-11 place-items-center rounded-full" aria-label="News" onClick={() => { setNewsOpen(true); const t = news[0]?.at ?? Date.now(); setNewsSeen(t); localStorage.setItem("pry-news-seen", String(t)); }}>
            <Newspaper className="size-5" />
            {newsUnread ? <span className="badge-pop absolute top-2.5 right-2.5 size-2.5 rounded-full bg-hot ring-2 ring-ink" /> : null}
          </button>
          <button type="button" className="tap relative grid size-11 place-items-center rounded-full" aria-label="Notifications" onClick={() => setPingOpen(true)}>
            <Bell className="size-5" />
            {unread > 0 ? <span className="badge-pop absolute top-2.5 right-2.5 size-2.5 rounded-full bg-rose ring-2 ring-ink" /> : null}
          </button>
        </div>
      </header>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div key={tab} className="tab-flow" style={{ "--dir": tabDir } as CSSProperties}>
        {tab === "home" ? (
          <HomeView me={me} isAdmin={isAdmin} banner={config.bannerOn && config.banner.trim() ? config.banner : null} maintenance={!!config.maintenance}
            chatCount={visibleChats.length} unread={unread} squadCount={squads.length}
            stories={<StoriesStrip me={me} owners={storyOwners} onOpen={(i) => setStoryAt(i)} onCreate={() => setCreatorOpen(true)} />}
            requestCount={requests.length} requests={<ul className="space-y-2">{requests.map((r) => <RequestRow key={r.id} chat={r} me={me} onOpen={openChat} />)}</ul>}
            floatBtn={<FloatBtn />}
            onTab={(t) => setTab(t)} onNewSquad={() => setGroupFor("new")} onJoin={() => setJoinOpen(true)} onSecret={() => setSecretOpen(true)} onAi={() => setAiOpen(true)} onAdmin={() => setAdminOpen(true)} onStatus={(st) => void setStatus(me.uid, st)} />
        ) : null}

        {tab === "chats" ? (
          <div className="pb-4">
            <div className="px-3 pt-1">
              <label className="flex h-12 items-center gap-3 rounded-full bg-paper/10 px-4">
                <Search className="size-5 shrink-0 text-paper/70" />
                <input className="min-w-0 flex-1 bg-transparent text-[1.05rem] outline-none placeholder:text-paper/55" placeholder="Search chats" value={filter} onChange={(e) => setFilter(e.target.value)} />
                {filter ? <button type="button" aria-label="Clear" onClick={() => setFilter("")}><X className="size-4 text-paper/60" /></button> : null}
              </label>
            </div>
            <div className="mt-1"><NotesRow me={me} tiles={noteTiles} onOpen={(uid) => setNoteFor(uid)} /></div>
            <div className="flex items-center justify-between px-4 pt-1 pb-2">
              <p className="flex items-center gap-2 text-[1.35rem] font-bold">Messages {me.muted.length ? <BellOff className="size-5 text-paper/70" /> : null}</p>
              <button type="button" className="tap text-[1.1rem] font-semibold text-[#6f8cff]" onClick={() => setRequestsOpen(true)}>Requests{requests.length ? ` (${requests.length})` : ""}</button>
            </div>
            {chats === null ? (
              <div className="space-y-4 px-4 pt-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3.5">
                    <div className="shimmer size-14 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2"><div className="shimmer h-3.5 w-1/2 rounded-full" /><div className="shimmer h-3 w-3/4 rounded-full" /></div>
                  </div>
                ))}
              </div>
            ) : chatError ? (
              <p className="p-4 text-sm text-rose">{chatError}</p>
            ) : sorted.length === 0 ? (
              <div className="grid place-items-center px-6 pt-16 text-center">
                <div className="pop-in">
                  <p className="float text-5xl">💬</p>
                  <p className="mt-3 font-display text-3xl font-bold">No chats yet</p>
                  <p className="mt-2 text-sm text-pretty text-paper/60">Dost ki ID search karo aur pehla message bhejo.</p>
                  <button type="button" onClick={() => setTab("find")} className="btn-hot tap mt-5 h-12 rounded-2xl px-6 font-display text-lg font-bold tracking-wide">FIND FRIENDS</button>
                </div>
              </div>
            ) : (
              <ul>{sorted.map((c, i) => <ChatRow key={c.id} chat={c} me={me} index={i} filter={filter} onOpen={openChat} />)}</ul>
            )}
          </div>
        ) : null}

        {tab === "find" ? <FindTab me={me} onOpen={openChat} onProfile={setProfileFor} /> : null}

        {tab === "squads" ? (
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setGroupFor("new")} className="btn-hot tap flex h-13 items-center justify-center gap-2 rounded-2xl font-display text-lg font-bold tracking-wide"><Plus className="size-5" /> NEW</button>
              <button type="button" onClick={() => setJoinOpen(true)} className="glass tap h-13 rounded-2xl font-display text-lg font-bold tracking-wide">JOIN CODE</button>
            </div>
            {squads.length === 0 ? (
              <div className="pop-in mt-10 text-center">
                <p className="float text-5xl">🛡️</p>
                <p className="mt-3 text-sm text-pretty text-paper/55">Abhi koi squad nahi. Naam do, dosto ko add karo, admin tum ho.</p>
              </div>
            ) : (
              <ul className="mt-3 -mx-4">{squads.map((c, i) => <ChatRow key={c.id} chat={c} me={me} index={i} onOpen={openChat} />)}</ul>
            )}
          </div>
        ) : null}

        {tab === "me" ? (
          <ProfileView me={me} note={notes[me.uid] ?? null} unread={unread} myStories={myStories} onOpenProfile={setProfileFor}
            onCreateStory={() => setCreatorOpen(true)} onOpenStory={() => { const i = storyOwners.findIndex((o) => o.uid === me.uid); if (i >= 0) setStoryAt(i); }}
            onNote={() => setNoteFor(me.uid)} onEdit={() => setSettingsOpen(true)} onMenu={() => setMenuOpen(true)} />
        ) : null}
        </div>
      </div>

      <nav className="dock dock-float relative grid shrink-0 grid-cols-5 gap-1">
        <span aria-hidden="true" className="nav-liquid" style={{ "--i": tabIndex } as CSSProperties}><i /></span>
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button key={t.id} type="button" aria-label={t.label} onClick={() => setTab(t.id)} className={clsx("tap relative flex h-12 items-center justify-center rounded-full transition-colors duration-200", on ? "nav-on text-paper" : "text-paper/80")}>
              {t.id === "me" ? (
                <span className={clsx("relative rounded-full", on && "ring-2 ring-paper")}><Avatar src={me.avatar} name={me.displayName} size="xs" /></span>
              ) : (
                <Icon className={clsx("size-7 transition-transform duration-200", on && "scale-105")} strokeWidth={on ? 2.4 : 1.8} />
              )}
              {t.id === "chats" && unread > 0 ? <span className="badge-pop absolute top-0.5 right-[24%] grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[0.6rem] font-bold text-white">{unread > 9 ? "9+" : unread}</span> : null}
              {t.id === "home" && requests.length > 0 ? <span className="badge-pop absolute top-1.5 right-[30%] size-2.5 rounded-full bg-hot" /> : null}
            </button>
          );
        })}
      </nav>

      </div>
      <div className="relative w-0 lg:w-auto lg:min-w-0 lg:flex-1">
        {activeId ? <Thread key={activeId} chatId={activeId} me={me} onBack={closeThread} onGroup={(id) => setGroupFor(id)} onProfile={setProfileFor} /> : (
          <div className="hidden h-full place-items-center text-center lg:grid"><div><p className="float text-6xl">💬</p><p className="mt-3 font-display text-3xl font-bold text-paper/70">IronRoses MSG</p><p className="mt-1 text-sm text-paper/45">Koi chat kholo</p></div></div>
        )}
      </div>
      {newsOpen ? <NewsSheet me={me} isAdmin={isAdmin} news={news} onClose={() => setNewsOpen(false)} /> : null}
      {adminOpen && isAdmin ? <Suspense fallback={null}><AdminPanel config={config} onClose={() => setAdminOpen(false)} /></Suspense> : null}
      {requestsOpen ? (
        <Frame title="Requests" onClose={() => setRequestsOpen(false)} z={50}>
          {requests.length === 0 ? <p className="pt-10 text-center text-paper/55">Koi request nahi.</p> : <ul className="space-y-2">{requests.map((r) => <RequestRow key={r.id} chat={r} me={me} onOpen={(id) => { setRequestsOpen(false); openChat(id); }} />)}</ul>}
        </Frame>
      ) : null}
      {settingsOpen ? (
        <Frame title="Edit profile" onClose={() => setSettingsOpen(false)} z={56}>
          <Me me={me} isAdmin={isAdmin} onAdmin={() => setAdminOpen(true)} onPro={() => setProOpen(true)} onCloseFriends={() => setCloseOpen(true)} sound={sound} alerts={alerts} onAlerts={() => void enableAlerts()} onSound={(v) => { setSound(v); localStorage.setItem("pry-sound", v ? "1" : "0"); }} />
        </Frame>
      ) : null}
      {menuOpen ? (
        <Suspense fallback={null}><Settings me={me} isAdmin={isAdmin} sound={sound} alerts={alerts} onAlerts={() => void enableAlerts()} onSound={(v) => { setSound(v); localStorage.setItem("pry-sound", v ? "1" : "0"); }}
          onAdmin={() => setAdminOpen(true)} onPro={() => setProOpen(true)} onCloseFriends={() => setCloseOpen(true)} onEdit={() => setSettingsOpen(true)} onClose={() => setMenuOpen(false)} /></Suspense>
      ) : null}
      {noteFor === me.uid ? <NoteEditor me={me} current={notes[me.uid] ?? null} onClose={() => setNoteFor(null)} onChanged={() => setNoteTick((v) => v + 1)} /> : null}
      {noteFor && noteFor !== me.uid && contactUsers[noteFor] && notes[noteFor] ? <NoteViewer me={me} owner={contactUsers[noteFor]} note={notes[noteFor]} onClose={() => setNoteFor(null)} /> : null}
      {proOpen ? <ProSheet me={me} onClose={() => setProOpen(false)} /> : null}
      {closeOpen ? <CloseFriendsSheet me={me} contacts={Object.values(contactUsers)} onClose={() => setCloseOpen(false)} /> : null}
      {profileFor ? <ProfileSheet uid={profileFor} me={me} contactUids={contactUids} onClose={() => setProfileFor(null)} onMessage={(u) => void openProfileMessage(u)} onOpenProfile={setProfileFor} /> : null}
      {storyAt !== null && storyOwners.length ? <StoryViewer me={me} owners={storyOwners} start={Math.min(storyAt, storyOwners.length - 1)} onClose={() => setStoryAt(null)} onChanged={() => setStoryTick((v) => v + 1)} /> : null}
      {creatorOpen ? <StoryCreator me={me} contacts={Object.values(contactUsers)} onClose={() => setCreatorOpen(false)} onPublished={() => setStoryTick((v) => v + 1)} /> : null}
      <SpamGuard />
      {aiOpen ? <Suspense fallback={null}><AiChat uid={me.uid} name={me.displayName} onClose={() => setAiOpen(false)} /></Suspense> : null}
      {secretOpen ? <Suspense fallback={null}><Secret onClose={() => setSecretOpen(false)} /></Suspense> : null}
      {groupFor ? <GroupSheet mode={groupFor} me={me} onClose={() => setGroupFor(null)} onOpen={(id) => { setTab("chats"); openChat(id); }} onLeft={() => { setGroupFor(null); setActiveId(null); }} /> : null}
      {joinOpen ? <JoinSheet me={me} onClose={() => setJoinOpen(false)} onOpen={(id) => { setTab("chats"); openChat(id); }} /> : null}

      {pingOpen ? (
        <div className="sheet-up safe-top fixed inset-0 z-[45] flex flex-col bg-ink">
          <header className="flex h-16 items-center justify-between px-4">
            <h2 className="font-display text-3xl font-bold">Notifications</h2>
            <button type="button" className="tap grid size-11 place-items-center rounded-full" aria-label="Close" onClick={() => setPingOpen(false)}><X className="size-5" /></button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            {visibleChats.filter((c) => (c.unread?.[me.uid] ?? 0) > 0).length === 0 ? (
              <div className="pop-in mt-16 text-center"><p className="float text-5xl">🔔</p><p className="mt-3 text-sm text-paper/55">Sab clear hai. Naya message aate hi yahan dikhega.</p></div>
            ) : (
              <ul className="space-y-2">
                {visibleChats.filter((c) => (c.unread?.[me.uid] ?? 0) > 0).map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => openChat(c.id)} className="glass tap flex w-full items-center gap-3 rounded-2xl p-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{c.lastMessage?.senderName}{c.kind === "group" ? <span className="font-normal text-paper/50"> · {c.title}</span> : null}</span>
                        <span className="block truncate text-sm text-paper/65">{c.lastMessage?.text}</span>
                      </span>
                      <span className="grad grid min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold text-white">{c.unread?.[me.uid]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {notices.slice(0, 3).map((n) => (
          <button key={n.id} type="button" className="toast-in glass pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl p-3 text-left shadow-[0_18px_50px_-10px_rgba(225,29,72,0.5)]" onClick={() => openChat(n.chatId)}>
            <span className="flex items-center gap-3">
              <Avatar src={n.avatar} name={n.title} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg leading-tight font-bold">{n.title}</span>
                <span className="block truncate text-sm text-paper/70">{n.body}</span>
              </span>
              <span className="grad shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-bold tracking-wider text-white">NEW</span>
            </span>
            <span className="toast-bar grad absolute inset-x-0 bottom-0 h-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
