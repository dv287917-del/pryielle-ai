import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import clsx from "clsx";
import { Ban, BellRing, Check, Copy, Crown, Lock, LogOut, Moon, ShieldCheck, Users, Volume2, VolumeX } from "lucide-react";
import { signOut as fbSignOut } from "firebase/auth";
import { auth } from "../firebase";
import { setPrivate, togglePref, updateProfile } from "../lib/data";
import { useUser } from "../lib/hooks";
import type { UserDoc } from "../lib/types";
import { THEMES, applyTheme, clearPin, compressImage, errorText, hasPin, setPin } from "../lib/util";
import { Avatar, Field, Toggle, fieldClass } from "./ui";
import { FloatBtn } from "./FloatBtn";
import { sfx } from "../lib/sfx";

function BlockedRow({ uid, me }: { uid: string; me: UserDoc }) {
  const u = useUser(uid);
  return (
    <li className="glass flex items-center gap-3 rounded-2xl p-2.5">
      <Avatar src={u?.avatar ?? null} name={u?.displayName ?? "?"} size="xs" />
      <span className="min-w-0 flex-1 truncate">{u?.displayName ?? uid.slice(0, 6)}</span>
      <button type="button" className="tap h-9 rounded-xl border border-paper/15 px-3 text-xs font-semibold" onClick={() => void togglePref(me.uid, "blocked", uid, false)}>
        Unblock
      </button>
    </li>
  );
}

export function Me({ me, sound, onSound, alerts, onAlerts, isAdmin, onAdmin, onPro, onCloseFriends }: { me: UserDoc; sound: boolean; onSound: (v: boolean) => void; alerts: string; onAlerts: () => void; isAdmin: boolean; onAdmin: () => void; onPro: () => void; onCloseFriends: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const [avatar, setAvatar] = useState<string | null>(me.avatar);
  const [ffUid, setFfUid] = useState(me.ffUid);
  const [ffRank, setFfRank] = useState(me.ffRank);
  const [bio, setBio] = useState(me.bio);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [theme, setTheme] = useState(localStorage.getItem("pry-theme") ?? "haunted");
  const [amoled, setAmoled] = useState(localStorage.getItem("pry-amoled") === "1");
  const [pin, setPinOn] = useState(hasPin());
  const [horror, setHorror] = useState(!sfx.isMuted());
  const [pinDraft, setPinDraft] = useState("");

  useEffect(() => {
    setName(me.displayName);
    setUsername(me.username);
    setAvatar(me.avatar);
    setFfUid(me.ffUid);
    setFfRank(me.ffRank);
    setBio(me.bio);
  }, [me]);

  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1200);
  };

  async function save() {
    setBusy(true);
    setError("");
    try {
      await updateProfile(me, { username, displayName: name, avatar, ffUid, ffRank, bio });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signOut();
    } catch {
      /* ignore */
    }
    await fbSignOut(auth);
  }

  return (
    <form className="space-y-4 p-4 pb-8" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="glass flex items-center gap-4 rounded-3xl p-4">
        <button type="button" className="tap rounded-full" aria-label="Change photo" onClick={() => fileRef.current?.click()}>
          <Avatar src={avatar} name={name || me.displayName} size="lg" />
        </button>
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold tracking-widest text-paper/45">YOUR ID</p>
          <p className="grad-text font-display text-3xl leading-none font-bold tabular-nums">{me.publicId}</p>
          <button type="button" className="mt-2 inline-flex items-center gap-1 text-sm text-paper/70" onClick={() => copy("id", me.publicId)}>
            {copied === "id" ? <Check className="size-4 text-aqua" /> : <Copy className="size-4" />} {copied === "id" ? "Copied" : "Copy ID"}
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void compressImage(f, 256, 0.75, 60_000).then(setAvatar).catch((x) => setError(errorText(x))); }} />
      <Field label="DISPLAY NAME"><input className={fieldClass} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="USERNAME"><input className={fieldClass} value={username} maxLength={16} autoCapitalize="none" spellCheck={false} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} /></Field>

      <Field label="BIO" hint={<span>{bio.length}/150</span>}><textarea className="min-h-20 w-full rounded-2xl border border-paper/12 bg-paper/5 p-4 text-base outline-none focus:border-rose/70" maxLength={150} value={bio} placeholder="Apne baare mein likho…" onChange={(e) => setBio(e.target.value)} /></Field>

      <div className="glass space-y-3 rounded-3xl p-4">
        <p className="font-display text-xl font-bold">🎮 Free Fire card</p>
        <Field label="FREE FIRE UID"><input className={fieldClass} inputMode="numeric" value={ffUid} maxLength={14} placeholder="Apna FF UID" onChange={(e) => setFfUid(e.target.value.replace(/\D/g, ""))} /></Field>
        <Field label="RANK"><input className={fieldClass} value={ffRank} maxLength={20} placeholder="Heroic, Grandmaster…" onChange={(e) => setFfRank(e.target.value)} /></Field>
        {me.ffUid ? (
          <button type="button" className="tap flex items-center gap-2 text-sm text-paper/70" onClick={() => copy("ff", me.ffUid)}>
            {copied === "ff" ? <Check className="size-4 text-aqua" /> : <Copy className="size-4" />} Copy FF UID
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose">{error}</p> : null}
      <button type="submit" disabled={busy} className="btn-hot tap h-13 w-full rounded-2xl font-display text-lg font-bold tracking-wide">
        {busy ? "SAVING…" : saved ? "SAVED ✓" : "SAVE PROFILE"}
      </button>

    </form>
  );
}
