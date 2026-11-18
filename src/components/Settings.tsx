import { liteModeOn, setLiteMode as setLiteModeFlag } from "../lib/perf";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { isUninstallProtected, enableUninstallProtection, disableUninstallProtection } from "../lib/device";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { signOut as fbSignOut } from "firebase/auth";
import clsx from "clsx";
import {
  Accessibility, ArrowLeft, Bell, BellRing, Ban, ChevronRight, Crown, Info, Lock, LogOut, Mic, Moon, PictureInPicture2, Search, ShieldCheck,
  Smartphone, SquareUserRound, Palette, Star, UserRound, Volume2, X,
} from "lucide-react";
import { auth } from "../firebase";
import { setPrivate, togglePref } from "../lib/data";
import { useUser } from "../lib/hooks";
import { sfx } from "../lib/sfx";
import type { UserDoc } from "../lib/types";
import { THEMES, applyTheme, clearPin, errorText, hasPin, pushBack, setPin } from "../lib/util";
import { APP_VERSION } from "../lib/version";
import { Avatar, Mark, Toggle, fieldClass } from "./ui";
import { FloatBtn } from "./FloatBtn";

type View = "root" | "notifications" | "lock" | "privacy" | "blocked" | "theme" | "permissions" | "access" | "about" | "protect";

export const applyAccess = () => {
  const r = document.documentElement;
  r.dataset.motion = localStorage.getItem("iron-motion") === "reduced" ? "reduced" : "full";
  r.dataset.bigtext = localStorage.getItem("iron-bigtext") === "1" ? "true" : "false";
};

type Row = { id: View | "edit" | "pro" | "admin" | "close" | "logout"; label: string; icon: ReactNode; value?: string; danger?: boolean; keys: string };

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="px-4 pt-4 pb-2 text-[0.95rem] text-paper/55">{children}</p>;
}
const Divider = () => <div className="h-2 bg-paper/[0.07]" />;

function RowBtn({ row, onClick }: { row: Row; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="tap flex w-full items-center gap-4 px-4 py-[0.95rem] text-left active:bg-paper/5">
      <span className={clsx("grid size-7 shrink-0 place-items-center", row.danger ? "text-rose" : "text-paper")}>{row.icon}</span>
      <span className={clsx("min-w-0 flex-1 text-[1.08rem]", row.danger && "text-rose")}>{row.label}</span>
      {row.value ? <span className="max-w-[9rem] truncate text-[0.95rem] text-paper/50">{row.value}</span> : null}
      {row.danger ? null : <ChevronRight className="size-5 shrink-0 text-paper/45" />}
    </button>
  );
}

function ToggleRow({ icon, label, hint, on, onChange }: { icon: ReactNode; label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="tap flex w-full items-center gap-4 px-4 py-[0.95rem] text-left active:bg-paper/5">
      <span className="grid size-7 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-[1.08rem]">{label}</span>{hint ? <span className="block text-sm text-paper/50">{hint}</span> : null}</span>
      <Toggle on={on} />
    </button>
  );
}

function BlockedRow({ uid, me }: { uid: string; me: UserDoc }) {
  const u = useUser(uid);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Avatar src={u?.avatar ?? null} name={u?.displayName ?? "?"} size="sm" />
      <span className="min-w-0 flex-1 truncate">{u?.displayName ?? uid.slice(0, 6)}</span>
      <button type="button" className="tap h-9 rounded-xl border border-paper/20 px-4 text-sm font-semibold" onClick={() => void togglePref(me.uid, "blocked", uid, false)}>Unblock</button>
    </li>
  );
}

export function Settings({ me, sound, onSound, alerts, onAlerts, isAdmin, onAdmin, onPro, onCloseFriends, onEdit, onClose }: {
  me: UserDoc; sound: boolean; onSound: (v: boolean) => void; alerts: string; onAlerts: () => void; isAdmin: boolean;
  onAdmin: () => void; onPro: () => void; onCloseFriends: () => void; onEdit: () => void; onClose: () => void;
}) {
  const [stack, setStack] = useState<View[]>(["root"]);
  const view = stack[stack.length - 1];
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState(localStorage.getItem("pry-theme") ?? "haunted");
  const [amoled, setAmoled] = useState(localStorage.getItem("pry-amoled") === "1");
  const [horror, setHorror] = useState(!sfx.isMuted());
  const [pin, setPinOn] = useState(hasPin());
  const [pinDraft, setPinDraft] = useState("");
  const [reduced, setReduced] = useState(localStorage.getItem("iron-motion") === "reduced");
  const [lite, setLite] = useState(liteModeOn());
  const [big, setBig] = useState(localStorage.getItem("iron-bigtext") === "1");
  const [mic, setMic] = useState("check");
  const [protOn, setProtOn] = useState(false);
  const [protPass, setProtPass] = useState("");
  const [protMsg, setProtMsg] = useState("");
  const [error, setError] = useState("");

  const back = () => (stack.length > 1 ? setStack((s) => s.slice(0, -1)) : onClose());
  useEffect(() => pushBack(back)); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (v: View) => setStack((s) => [...s, v]);

  useEffect(() => {
    if (view === "protect") { void isUninstallProtected().then(setProtOn).catch(() => setProtOn(false)); }
    if (view !== "permissions") return;
    void navigator.permissions?.query({ name: "microphone" as PermissionName }).then((p) => setMic(p.state)).catch(() => setMic("unknown"));
  }, [view]);

  async function logout() {
    try {
      if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signOut();
    } catch {
      /* ignore */
    }
    await fbSignOut(auth);
  }

  const alertValue = alerts === "granted" ? "On" : alerts === "denied" ? "Blocked" : "Off";
  const sections: Array<{ title: string; rows: Row[] }> = useMemo(() => [
    { title: "Your account", rows: [
      { id: "edit", label: "Edit profile", icon: <UserRound className="size-6" />, value: `@${me.username}`, keys: "profile name username bio avatar free fire uid rank" },
      { id: "pro", label: "Pro plan", icon: <Crown className="size-6 text-amber-300" />, value: me.pro ? "Active" : "₹129/-", keys: "pro premium plan" },
      ...(isAdmin ? [{ id: "admin" as const, label: "Admin panel", icon: <ShieldCheck className="size-6 text-hot" />, keys: "admin owner panel" }] : []),
    ] },
    { title: "How you use IronRoses MSG", rows: [
      { id: "notifications", label: "Notifications", icon: <Bell className="size-6" />, value: alertValue, keys: "notification alert sound message" },
      { id: "lock", label: "App lock", icon: <Lock className="size-6" />, value: pin ? "On" : "Off", keys: "pin lock password security" },
      { id: "protect" as const, label: "Uninstall protection", icon: <Lock className="size-6" />, keys: "uninstall delete protect password 1711 device admin" },
      ...(Capacitor.isNativePlatform() ? [{ id: "permissions" as const, label: "Floating window", icon: <PictureInPicture2 className="size-6" />, keys: "floating window popup overlay" }] : []),
    ] },
    { title: "Who can see your content", rows: [
      { id: "privacy", label: "Account privacy", icon: <Lock className="size-6" />, value: me.private ? "Private" : "Public", keys: "private public privacy account" },
      { id: "close", label: "Close Friends", icon: <Star className="size-6" />, value: String(me.closeFriends.length), keys: "close friends story note" },
      { id: "blocked", label: "Blocked accounts", icon: <Ban className="size-6" />, value: String(me.blocked.length), keys: "block unblock" },
    ] },
    { title: "What you see", rows: [
      { id: "theme", label: "Theme and colours", icon: <Palette className="size-6" />, value: THEMES.find((t) => t.id === theme)?.label ?? "", keys: "theme colour color amoled dark black horror sound" },
    ] },
    { title: "Your app and media", rows: [
      { id: "permissions", label: "Device permissions", icon: <Smartphone className="size-6" />, keys: "permission microphone mic notification device" },
      { id: "access", label: "Accessibility", icon: <Accessibility className="size-6" />, value: reduced ? "Reduced motion" : big ? "Large text" : "", keys: "accessibility animation motion text size large" },
    ] },
    { title: "More info and support", rows: [
      { id: "about", label: "About", icon: <Info className="size-6" />, value: `v${APP_VERSION}`, keys: "about version contact support help pryielle" },
      { id: "logout", label: "Log out", icon: <LogOut className="size-6" />, danger: true, keys: "logout sign out" },
    ] },
  ], [me, isAdmin, alertValue, pin, theme, reduced, big]);

  const term = q.trim().toLowerCase();
  const shown = sections.map((s) => ({ ...s, rows: term ? s.rows.filter((r) => `${r.label} ${r.keys}`.toLowerCase().includes(term)) : s.rows })).filter((s) => s.rows.length);

  function open(r: Row) {
    if (r.id === "edit") return onEdit();
    if (r.id === "pro") return onPro();
    if (r.id === "admin") return onAdmin();
    if (r.id === "close") return onCloseFriends();
    if (r.id === "logout") return void logout();
    go(r.id);
  }

  const titles: Record<View, string> = {
    root: "Settings and activity", notifications: "Notifications", lock: "App lock", privacy: "Account privacy", blocked: "Blocked accounts",
    theme: "Theme and colours", permissions: "Device permissions", access: "Accessibility", about: "About", protect: "Uninstall protection",
  };

  return (
    <div className="fixed inset-0 z-[44] flex flex-col bg-ink text-paper" style={{ animation: "slide-in 300ms cubic-bezier(0.22,1,0.36,1) both" }}>
      <header className="flex h-16 shrink-0 items-center gap-3 px-3 pt-[env(safe-area-inset-top)]">
        <button type="button" className="tap grid size-11 place-items-center rounded-full" aria-label="Back" onClick={back}><ArrowLeft className="size-6" /></button>
        <h2 className="min-w-0 flex-1 truncate text-[1.35rem] font-bold">{titles[view]}</h2>
        {view === "root" ? null : <button type="button" className="tap grid size-11 place-items-center rounded-full" aria-label="Close" onClick={onClose}><X className="size-5" /></button>}
      </header>

      <div key={view} className="fade-up min-h-0 flex-1 overflow-y-auto pb-10">
        {view === "root" ? (
          <>
            <div className="px-4 pb-1">
              <label className="flex h-11 items-center gap-3 rounded-xl bg-paper/10 px-3">
                <Search className="size-5 text-paper/55" />
                <input className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-paper/45" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
                {q ? <button type="button" aria-label="Clear" onClick={() => setQ("")}><X className="size-4 text-paper/55" /></button> : null}
              </label>
            </div>
            {shown.length === 0 ? <p className="pt-12 text-center text-paper/50">“{q}” ke liye kuch nahi mila.</p> : null}
            {shown.map((s, i) => (
              <div key={s.title}>
                {i > 0 ? <Divider /> : null}
                <SectionTitle>{s.title}</SectionTitle>
                {s.rows.map((r) => <RowBtn key={r.id + r.label} row={r} onClick={() => open(r)} />)}
              </div>
            ))}
          </>
        ) : null}

        {view === "notifications" ? (
          <>
            <ToggleRow icon={<Volume2 className="size-6" />} label="Message sound" hint="Naya message aane par awaaz" on={sound} onChange={onSound} />
            {alerts !== "unsupported" ? (
              <button type="button" disabled={alerts === "granted"} onClick={onAlerts} className="tap flex w-full items-center gap-4 px-4 py-[0.95rem] text-left disabled:opacity-100">
                <span className="grid size-7 place-items-center"><BellRing className="size-6" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[1.08rem]">Phone alerts</span><span className="block text-sm text-paper/50">{alerts === "denied" ? "Blocked: phone Settings se allow karo" : "Lock screen / background notification"}</span></span>
                <span className={clsx("text-sm font-semibold", alerts === "granted" ? "text-aqua" : "text-hot")}>{alertValue === "Off" ? "Turn on" : alertValue}</span>
              </button>
            ) : null}
          </>
        ) : null}

        {view === "lock" ? (
          <div className="space-y-3 p-4">
            <ToggleRow icon={<Lock className="size-6" />} label="App lock (PIN)" hint="App wapas khulne par PIN maangega" on={pin} onChange={(v) => { if (!v) { clearPin(); setPinOn(false); } }} />
            {!pin ? (
              <div className="flex gap-2">
                <input className={fieldClass} inputMode="numeric" maxLength={4} placeholder="4-digit PIN" value={pinDraft} onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ""))} />
                <button type="button" disabled={pinDraft.length !== 4} className="btn-hot tap h-12 shrink-0 rounded-2xl px-6 font-display font-bold" onClick={() => void setPin(pinDraft).then(() => { setPinOn(true); setPinDraft(""); })}>SET</button>
              </div>
            ) : <p className="px-1 text-sm text-paper/55">PIN on hai. Band karne ke liye upar toggle dabao.</p>}
          </div>
        ) : null}

        {view === "privacy" ? (
          <>
            <ToggleRow icon={<Lock className="size-6" />} label="Private account" hint="Rank, UID aur stories sirf contacts ko dikhenge" on={me.private} onChange={(v) => void setPrivate(me.uid, v).catch((e) => setError(errorText(e)))} />
            {error ? <p className="px-4 text-sm text-rose">{error}</p> : null}
          </>
        ) : null}

        {view === "blocked" ? (
          me.blocked.length ? <ul>{me.blocked.map((u) => <BlockedRow key={u} uid={u} me={me} />)}</ul> : <p className="pt-16 text-center text-paper/50">Kisi ko block nahi kiya.</p>
        ) : null}

        {view === "theme" ? (
          <div className="p-4">
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map((t) => (
                <button key={t.id} type="button" aria-label={t.label} onClick={() => { setTheme(t.id); applyTheme(t.id, amoled); }} className={clsx("tap flex flex-col items-center gap-1.5")}>
                  <span data-theme={t.art ? t.id : undefined} className={clsx("theme-swatch h-14 w-full rounded-2xl ring-2", theme === t.id ? "ring-paper" : "ring-transparent")} style={{ background: t.art ? "var(--bg)" : `linear-gradient(135deg, ${t.colors.join(",")})` }}>{t.art ? <><i className="theme-art" /><i className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: `linear-gradient(90deg, ${t.colors.join(",")})` }} /></> : null}</span>
                  <span className="text-xs text-paper/65">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 -mx-4">
              <ToggleRow icon={<Moon className="size-6" />} label="AMOLED black" hint="Pure black background" on={amoled} onChange={(v) => { setAmoled(v); applyTheme(theme, v); }} />
              <ToggleRow icon={<Volume2 className="size-6" />} label="Horror sounds" hint="Heartbeat aur haunted awaazein" on={horror} onChange={() => { sfx.setMuted(horror); setHorror(!horror); if (!horror) sfx.heartbeat(); }} />
            </div>
          </div>
        ) : null}

        {view === "permissions" ? (
          <div className="space-y-1">
            <div className="flex items-center gap-4 px-4 py-[0.95rem]"><Bell className="size-6" /><span className="flex-1 text-[1.08rem]">Notifications</span><span className="text-sm text-paper/60">{alertValue}</span>{alerts !== "granted" && alerts !== "unsupported" ? <button type="button" className="btn-hot tap h-9 rounded-xl px-4 text-sm font-bold" onClick={onAlerts}>Allow</button> : null}</div>
            <div className="flex items-center gap-4 px-4 py-[0.95rem]"><Mic className="size-6" /><span className="flex-1 text-[1.08rem]">Microphone</span><span className="text-sm text-paper/60">{mic === "granted" ? "Allowed" : mic === "denied" ? "Blocked" : "Not asked"}</span>
              {mic !== "granted" ? <button type="button" className="btn-hot tap h-9 rounded-xl px-4 text-sm font-bold" onClick={() => void navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => { s.getTracks().forEach((t) => t.stop()); setMic("granted"); }).catch(() => setMic("denied"))}>Allow</button> : null}</div>
            {mic === "denied" ? <p className="px-4 text-sm text-paper/50">Blocked hai to phone Settings → Apps → IronRoses MSG → Permissions se allow karo.</p> : null}
            <div className="px-4 pt-3"><FloatBtn /></div>
          </div>
        ) : null}

        {view === "access" ? (
          <>
            <ToggleRow icon={<SquareUserRound className="size-6" />} label="Reduce motion" hint="Animations band, app aur bhi halka chalega" on={reduced} onChange={(v) => { setReduced(v); localStorage.setItem("iron-motion", v ? "reduced" : "full"); applyAccess(); }} />
            <ToggleRow icon={<SquareUserRound className="size-6" />} label="Lite mode" hint="Kam RAM wale phone ke liye: heavy effects band, ek dam smooth" on={lite} onChange={(v) => { setLite(v); setLiteModeFlag(v); }} />
            <ToggleRow icon={<Accessibility className="size-6" />} label="Larger text" hint="Poore app mein bada text" on={big} onChange={(v) => { setBig(v); localStorage.setItem("iron-bigtext", v ? "1" : "0"); applyAccess(); }} />
          </>
        ) : null}

        {view === "about" ? (
          <div className="flex flex-col items-center gap-3 px-6 pt-14 text-center">
            <Mark className="size-20" />
            <p className="font-display text-4xl font-bold">IronRoses <span className="grad-text">MSG</span></p>
            <p className="text-sm text-paper/55">Version {APP_VERSION}</p>
            <p className="mt-4 text-sm text-paper/70">Made by <span className="font-semibold text-paper">Pryielle</span></p>
          </div>
        ) : null}

        {view === "protect" ? (
          <div className="space-y-4 p-4">
            {!Capacitor.isNativePlatform() ? (
              <div className="rounded-2xl border border-paper/15 bg-paper/5 p-4 text-sm text-paper/60">
                Uninstall protection sirf installed APK mein kaam karta hai. Web version mein available nahi hai.
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-paper/10 bg-paper/5 p-4 text-sm text-paper/70">
                  {protOn
                    ? "App abhi protected hai. System se uninstall nahi ho sakta jab tak password dalo."
                    : "Enable karo taaki app ko system settings se delete nahi kar saken bina password ke."}
                </div>
                {!protOn ? (
                  <button
                    type="button"
                    className="btn-hot tap h-12 w-full rounded-2xl font-display text-lg font-bold"
                    onClick={() => {
                      void enableUninstallProtection()
                        .then(() => { setProtOn(true); setProtMsg("Protection ON ho gayi ✓"); window.setTimeout(() => setProtMsg(""), 2500); })
                        .catch((e) => setError(errorText(e)));
                    }}
                  >
                    ENABLE PROTECTION
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold tracking-widest text-paper/50">PASSWORD DAL KAR BAND KARO</p>
                    <input
                      className="h-12 w-full rounded-2xl border border-paper/12 bg-paper/5 px-4 outline-none focus:border-rose/70"
                      type="password"
                      inputMode="numeric"
                      placeholder="Password"
                      value={protPass}
                      onChange={(e) => setProtPass(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={!protPass}
                      className="glass tap h-12 w-full rounded-2xl font-semibold disabled:opacity-40"
                      onClick={() => {
                        void disableUninstallProtection(protPass).then((res) => {
                          if (res.ok) { setProtOn(false); setProtPass(""); setProtMsg("Protection band ho gayi ✓"); window.setTimeout(() => setProtMsg(""), 2500); }
                          else setError("Galat password");
                        }).catch((e) => setError(errorText(e)));
                      }}
                    >
                      DISABLE PROTECTION
                    </button>
                  </div>
                )}
                {protMsg ? <p className="text-sm font-semibold text-emerald-400">{protMsg}</p> : null}
                {error ? <p className="text-sm text-rose">{error}</p> : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
