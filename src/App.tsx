import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { useAuth, useMe } from "./lib/hooks";
import { hasPin, popBack } from "./lib/util";
import { Auth } from "./components/Auth";
import { Boot } from "./components/Boot";
import { Lock } from "./components/Lock";
import { Setup } from "./components/Setup";
import { Start } from "./components/Start";
import { Shell } from "./components/Shell";
import { Maintenance } from "./components/Panels";
import { BanScreen, PendingScreen, RejectedScreen, UpdateModal, VpnBlock } from "./components/Gate";
import { isVpnActive } from "./lib/device";
import { findBan, syncDevice } from "./lib/security";
import { isAdminEmail, watchConfig } from "./lib/extra";
import { IS_FLOAT } from "./lib/floating";
import { EMPTY_CONFIG, type AppConfig, type BanDoc } from "./lib/types";
import { APP_VERSION, compareVersions } from "./lib/version";
import { setRole } from "./lib/extra";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { LocalNotifications } from "@capacitor/local-notifications";
import { setAutoDetect, watchAlerts } from "./lib/moderation";
import { watchRequests } from "./lib/security";
import { auth } from "./firebase";
import { getDoneVersion, reconcileUpdate } from "./lib/update";

function Stuck({ stage, error, onRetry, onLogout }: { stage: string; error: string; onRetry: () => void; onLogout: () => void }) {
  const rules = /rules|permission/i.test(error);
  return (
    <div className="fade-up relative mt-6 w-full max-w-xs rounded-2xl border border-rose/40 bg-black/60 p-4 text-center text-sm">
      <p className="font-display text-lg font-bold text-rose">Connect nahi ho paya</p>
      <p className="mt-1 text-paper/75">{error || (stage === "auth" ? "Login check atak gaya." : "Profile load nahi hua. Internet check karo.")}</p>
      {rules ? <p className="mt-2 text-xs text-paper/50">Firebase Console → Firestore Database banao, phir firestore.rules Publish karo.</p> : null}
      <p className="mt-2 text-[0.65rem] text-paper/35">step: {stage}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onRetry} className="btn-hot tap h-11 flex-1 rounded-xl font-display font-bold">RETRY</button>
        <button type="button" onClick={onLogout} className="tap h-11 flex-1 rounded-xl border border-paper/20 font-display font-bold">LOGOUT</button>
      </div>
    </div>
  );
}

function FloatNote() {
  return (
    <main className="grid h-dvh place-items-center bg-ink px-6 text-center text-paper">
      <div><p className="text-4xl">🔐</p><p className="mt-3 font-display text-2xl font-bold">Pehle login karo</p><p className="mt-1 text-sm text-paper/60">IronRoses MSG app kholke login karo, phir floating window dobara kholo.</p></div>
    </main>
  );
}

function Entering() {
  return (
    <main className="grid h-dvh place-items-center bg-ink">
      <span className="size-10 animate-spin rounded-full border-2 border-paper/15 border-t-rose" />
    </main>
  );
}

export function App() {
  const { user, ready } = useAuth();
  const { me, loading, error, retry } = useMe(user?.uid);
  const [slow, setSlow] = useState(false);
  const everReady = useRef(false);
  const [booted, setBooted] = useState(false);
  const [locked, setLocked] = useState(hasPin());
  const [started, setStarted] = useState(IS_FLOAT);
  const [celebrating, setCelebrating] = useState(false);
  const [config, setConfig] = useState<AppConfig>(EMPTY_CONFIG);
  const [doneVer, setDoneVer] = useState(getDoneVersion);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("pry-upd-skip") ?? "");
  useEffect(() => watchConfig(setConfig), []);
  useEffect(() => {
    const sync = () => setDoneVer(getDoneVersion());
    window.addEventListener("pry-upd-done", sync);
    void reconcileUpdate();
    return () => window.removeEventListener("pry-upd-done", sync);
  }, []);
  const isAdmin = isAdminEmail(user?.email);
  useEffect(() => setAutoDetect(config.autoDetect), [config.autoDetect]);
  const needsOwner = Boolean(me && isAdmin && me.role !== "owner");
  useEffect(() => { if (needsOwner && me) void setRole(me.uid, "owner").catch(() => undefined); }, [needsOwner, me?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = config.updateVersion && (config.updateUrl || config.updateParts > 0) && compareVersions(config.updateVersion, APP_VERSION) > 0 && doneVer !== config.updateVersion ? config : null;
  const [vpn, setVpn] = useState(false);
  const [deviceBan, setDeviceBan] = useState<BanDoc | null>(null);
  const meUid = me?.uid;

  // VPN / proxy check: on start, every few seconds and when the app comes back to the front (owner is exempt)
  const watchVpn = Boolean(user) && config.blockVpn && !isAdmin && !IS_FLOAT;
  const recheckVpn = () => { void isVpnActive().then(setVpn); };
  useEffect(() => {
    if (!watchVpn) { setVpn(false); return; }
    recheckVpn();
    const t = window.setInterval(recheckVpn, 4_000);
    return () => window.clearInterval(t);
  }, [watchVpn]);

  // owner gets a phone notification for every new signup request / new alert while the app is running
  useEffect(() => {
    if (!isAdmin || !meUid || !Capacitor.isNativePlatform()) return;
    const ping = (title: string, body: string) => void LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 2_000_000_000), title, body }] }).catch(() => undefined);
    let firstA = true;
    let firstR = true;
    const seenA = new Set<string>();
    const seenR = new Set<string>();
    const stopA = watchAlerts((list) => {
      const fresh = list.filter((a) => !a.seen && !seenA.has(a.id));
      list.forEach((a) => seenA.add(a.id));
      if (firstA) { firstA = false; return; }
      fresh.slice(0, 3).forEach((a) => ping(`⚠️ Alert: ${a.senderName}`, a.text.slice(0, 100)));
    });
    const stopR = watchRequests((list) => {
      const fresh = list.filter((u) => u.approval === "pending" && !seenR.has(u.uid));
      list.forEach((u) => seenR.add(u.uid));
      if (firstR) { firstR = false; return; }
      fresh.slice(0, 3).forEach((u) => ping("🆕 Nayi signup request", `${u.displayName} (@${u.username}) andar aana chahta hai`));
    });
    return () => { stopA(); stopR(); };
  }, [isAdmin, meUid]);

  // remember this phone + IP on the profile and refuse banned phones / networks
  useEffect(() => {
    if (!me || IS_FLOAT) return;
    let stop = false;
    void syncDevice(me).then(({ deviceId, ip }) => findBan(deviceId, ip)).then((b) => { if (!stop) setDeviceBan(b); }).catch(() => undefined);
    return () => { stop = true; };
  }, [meUid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = window.setTimeout(() => setBooted(true), IS_FLOAT ? 0 : 1200);
    if (Capacitor.isNativePlatform()) {
      void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      void StatusBar.setBackgroundColor({ color: "#07060d" }).catch(() => undefined);
      void SplashScreen.hide().catch(() => undefined);
    }
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let hiddenAt = 0;
    const subs = [
      CapApp.addListener("backButton", () => {
        if (!popBack()) void CapApp.minimizeApp();
      }),
      CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void reconcileUpdate();
        if (!isActive) hiddenAt = Date.now();
        else if (hiddenAt && Date.now() - hiddenAt > 15_000 && hasPin()) setLocked(true);
      }),
    ];
    return () => {
      subs.forEach((s) => void s.then((h) => h.remove()));
    };
  }, []);

  const waiting = !booted || !ready || (Boolean(user) && loading);
  const stage = !ready ? "auth" : "profile";
  if (!waiting && !error) everReady.current = true;

  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSlow(true), 8_000);
    return () => window.clearTimeout(t);
  }, [waiting]);

  const retryNow = () => {
    setSlow(false);
    if (stage === "auth") window.location.reload();
    else retry();
  };
  const logout = () => {
    void auth.signOut().catch(() => undefined);
    if (Capacitor.isNativePlatform()) void FirebaseAuthentication.signOut().catch(() => undefined);
    window.setTimeout(() => window.location.reload(), 300);
  };

  if (user && error) return <Boot><Stuck stage="profile" error={error} onRetry={retryNow} onLogout={logout} /></Boot>;
  if (waiting) {
    // the haunted splash plays once at app start; after sign-in only a quiet spinner shows (no second splash)
    if (everReady.current) return <Entering />;
    return <Boot>{slow ? <Stuck stage={stage} error="" onRetry={retryNow} onLogout={logout} /> : null}</Boot>;
  }
  if (!user) return IS_FLOAT ? <FloatNote /> : <Auth />;
  if (IS_FLOAT && !me) return <FloatNote />;
  if (!me || celebrating) return <Setup user={user} onBegin={() => setCelebrating(true)} onEnter={() => setCelebrating(false)} />;
  if (me.banned && !isAdmin) return <BanScreen reason={me.banReason} device={false} onLogout={logout} />;
  if (deviceBan && !isAdmin) return <BanScreen reason={deviceBan.reason} device onLogout={logout} />;
  if (vpn && !isAdmin) return <VpnBlock onRetry={recheckVpn} />;
  if (me.approval === "pending" && !isAdmin) return <PendingScreen me={me} onLogout={logout} />;
  if (me.approval === "rejected" && !isAdmin) return <RejectedScreen me={me} onLogout={logout} />;
  if (config.maintenance && !isAdmin) return <Maintenance message={config.message} onLogout={logout} />;
  return (
    <>
      {started ? <Shell me={me} isAdmin={isAdmin} config={config} float={IS_FLOAT} /> : <Start me={me} onStart={() => setStarted(true)} />}
      {locked ? <Lock onUnlock={() => setLocked(false)} /> : null}
      {update && !IS_FLOAT && (update.updateForce || dismissed !== update.updateVersion) ? (
        <UpdateModal config={update} onLater={() => { localStorage.setItem("pry-upd-skip", update.updateVersion); setDismissed(update.updateVersion); }} />
      ) : null}
    </>
  );
}
