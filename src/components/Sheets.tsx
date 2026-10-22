import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import clsx from "clsx";
import { Copy, Plus, Share2, Shield, Users, X } from "lucide-react";
import { addMember, createGroup, joinByCode, removeMember, renameGroup, searchUsers, setAdmin, watchChat } from "../lib/data";
import { useUser } from "../lib/hooks";
import type { ChatDoc, UserDoc } from "../lib/types";
import { errorText } from "../lib/util";
import { Avatar, Field, fieldClass } from "./ui";

function useSearch(term: string, me: string) {
  const [hits, setHits] = useState<UserDoc[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setHits([]);
      setBusy(false);
      return;
    }
    let stop = false;
    setBusy(true);
    const t = window.setTimeout(() => {
      searchUsers(q, me)
        .then((r) => !stop && setHits(r))
        .catch(() => !stop && setHits([]))
        .finally(() => !stop && setBusy(false));
    }, 250);
    return () => {
      stop = true;
      window.clearTimeout(t);
    };
  }, [term, me]);
  return { hits, busy };
}

export { useSearch };

function Frame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="sheet-up safe-top fixed inset-0 z-[45] flex flex-col bg-ink">
      <header className="flex h-16 shrink-0 items-center justify-between px-4">
        <h2 className="font-display text-3xl font-bold">{title}</h2>
        <button type="button" className="tap grid size-11 place-items-center rounded-full" aria-label="Close" onClick={onClose}>
          <X className="size-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-10">{children}</div>
    </div>
  );
}

function MemberRow({ uid, chat, me, onError }: { uid: string; chat: ChatDoc; me: UserDoc; onError: (m: string) => void }) {
  const u = useUser(uid);
  const mine = uid === me.uid;
  const admin = chat.admins.includes(uid);
  const iAmAdmin = chat.admins.includes(me.uid);
  const run = (p: Promise<unknown>) => void p.catch((e) => onError(errorText(e)));
  return (
    <li className="glass flex items-center gap-3 rounded-2xl p-2.5">
      <Avatar src={u?.avatar ?? null} name={u?.displayName ?? "?"} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          {u?.displayName ?? "…"} {mine ? "(you)" : ""}
        </span>
        <span className="text-xs text-paper/50">{u?.publicId}</span>
      </span>
      {admin ? <Shield className="size-4 shrink-0 text-hot" /> : null}
      {!mine && iAmAdmin ? (
        <span className="flex gap-1">
          <button type="button" className="tap h-9 rounded-xl border border-paper/15 px-3 text-xs font-semibold" onClick={() => run(setAdmin(chat.id, uid, !admin))}>
            {admin ? "Demote" : "Make admin"}
          </button>
          <button type="button" className="tap h-9 rounded-xl border border-rose/40 px-3 text-xs font-semibold text-rose" onClick={() => run(removeMember(chat.id, uid))}>
            Kick
          </button>
        </span>
      ) : null}
    </li>
  );
}

export function GroupSheet({ mode, me, onClose, onOpen, onLeft }: { mode: string; me: UserDoc; onClose: () => void; onOpen: (id: string) => void; onLeft: () => void }) {
  const creating = mode === "new";
  const [chat, setChat] = useState<ChatDoc | null>(null);
  const [title, setTitle] = useState("");
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<UserDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const { hits, busy: searching } = useSearch(term, me.uid);

  useEffect(() => {
    if (creating) return;
    return watchChat(mode, (c) => {
      setChat(c);
      if (c) setTitle((t) => t || c.title);
    });
  }, [mode, creating]);

  const iAmAdmin = Boolean(chat?.admins.includes(me.uid));

  async function create() {
    setBusy(true);
    setError("");
    try {
      onOpen(await createGroup(me, title, picked.map((p) => p.publicId)));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function add(u: UserDoc) {
    setTerm("");
    if (creating) return setPicked((p) => (p.some((x) => x.uid === u.uid) ? p : [...p, u]));
    try {
      await addMember(mode, u.uid);
    } catch (e) {
      setError(errorText(e));
    }
  }

  const link = chat?.inviteCode ?? "";
  return (
    <Frame title={creating ? "New squad" : "Squad"} onClose={onClose}>
      <Field label="SQUAD NAME">
        <input className={fieldClass} value={title} maxLength={32} placeholder="Squad ka naam" onChange={(e) => setTitle(e.target.value)} />
      </Field>
      {creating ? (
        <button type="button" disabled={busy || !title.trim()} onClick={() => void create()} className="btn-hot tap h-13 w-full rounded-2xl font-display text-lg font-bold tracking-wide">
          {busy ? "CREATING…" : "CREATE SQUAD"}
        </button>
      ) : (
        <button type="button" disabled={!iAmAdmin || !title.trim()} onClick={() => void renameGroup(mode, title).catch((e) => setError(errorText(e)))} className="glass tap h-11 w-full rounded-2xl font-display font-bold tracking-wide disabled:opacity-40">
          RENAME
        </button>
      )}

      {!creating && link ? (
        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-widest text-paper/50">INVITE CODE</p>
          <p className="grad-text font-display text-4xl font-bold tracking-[0.3em]">{link}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="tap flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-paper/15 text-sm font-semibold" onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }}>
              <Copy className="size-4" /> {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              className="btn-hot tap flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold"
              onClick={() => {
                const text = `IronRoses MSG pe mera squad "${chat?.title}" join karo. Invite code: ${link}`;
                if (Capacitor.isNativePlatform()) void Share.share({ text });
                else void navigator.clipboard?.writeText(text);
              }}
            >
              <Share2 className="size-4" /> Share
            </button>
          </div>
        </div>
      ) : null}

      {creating || iAmAdmin ? (
        <>
          <Field label="ADD BY ID OR USERNAME">
            <input className={fieldClass} value={term} placeholder="ID ya username" onChange={(e) => setTerm(e.target.value)} />
          </Field>
          {searching ? <p className="text-sm text-paper/50">Searching…</p> : null}
          <ul className="space-y-2">
            {hits.map((u) => (
              <li key={u.uid}>
                <button type="button" onClick={() => void add(u)} className="glass tap flex w-full items-center gap-3 rounded-2xl p-2.5 text-left">
                  <Avatar src={u.avatar} name={u.displayName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{u.displayName}</span>
                    <span className="text-xs text-paper/50">{u.publicId}</span>
                  </span>
                  <Plus className="size-5 text-hot" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {creating && picked.length ? (
        <div className="flex flex-wrap gap-2">
          {picked.map((u) => (
            <button key={u.uid} type="button" className="pop-in rounded-full bg-rose/15 px-3 py-1.5 text-sm font-semibold text-rose" onClick={() => setPicked((p) => p.filter((x) => x.uid !== u.uid))}>
              {u.displayName} ×
            </button>
          ))}
        </div>
      ) : null}

      {!creating && chat ? (
        <>
          <ul className="space-y-2">
            {chat.members.map((uid) => (
              <MemberRow key={uid} uid={uid} chat={chat} me={me} onError={setError} />
            ))}
          </ul>
          <button
            type="button"
            className="tap h-12 w-full rounded-2xl border border-rose/40 font-semibold text-rose"
            onClick={() => void removeMember(chat.id, me.uid).then(onLeft).catch((e) => setError(errorText(e)))}
          >
            Leave squad
          </button>
        </>
      ) : null}
      {error ? <p className="text-sm text-rose">{error}</p> : null}
    </Frame>
  );
}

export function JoinSheet({ me, onClose, onOpen }: { me: UserDoc; onClose: () => void; onOpen: (id: string) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Frame title="Join squad" onClose={onClose}>
      <Field label="INVITE CODE">
        <input className={clsx(fieldClass, "text-center font-display text-3xl tracking-[0.3em] uppercase")} value={code} maxLength={8} autoCapitalize="characters" placeholder="ABCD2345" onChange={(e) => setCode(e.target.value.toUpperCase())} />
      </Field>
      {error ? <p className="text-sm text-rose">{error}</p> : null}
      <button
        type="button"
        disabled={busy || code.length < 8}
        className="btn-hot tap h-13 w-full rounded-2xl font-display text-lg font-bold tracking-wide"
        onClick={() => {
          setBusy(true);
          setError("");
          joinByCode(me, code)
            .then(onOpen)
            .catch((e) => setError(errorText(e)))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "JOINING…" : "JOIN"}
      </button>
    </Frame>
  );
}

export function SquadIcon() {
  return (
    <span className="grad grid size-12 shrink-0 place-items-center rounded-full text-white">
      <Users className="size-5" />
    </span>
  );
}
