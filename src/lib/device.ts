import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

type SecurityPlugin = {
  getDeviceId(): Promise<{ id: string }>;
  isVpn(): Promise<{ vpn: boolean }>;
  isUninstallProtected(): Promise<{ protected: boolean }>;
  enableUninstallProtection(): Promise<void>;
  disableUninstallProtection(o: { password: string }): Promise<{ ok: boolean }>;
};
type UpdaterPlugin = {
  /** download an APK from a direct https link into the app cache (progress events: "progress") */
  download(opts: { url: string }): Promise<{ bytes: number }>;
  /** chunked upload path: write one base64 piece of the APK */
  writeChunk(opts: { index: number; data: string }): Promise<void>;
  /** open the system installer for the downloaded APK */
  install(): Promise<void>;
  /** version that is really installed (versionName / versionCode / lastUpdateTime of the app) */
  info(): Promise<{ versionName: string; versionCode: number; lastUpdate: number }>;
  /** version inside the downloaded APK file */
  inspect(): Promise<{ versionName: string; versionCode: number }>;
  addListener(event: "progress", cb: (e: { done: number; total: number }) => void): Promise<PluginListenerHandle>;
};

const Security = registerPlugin<SecurityPlugin>("Security");
export const Updater = registerPlugin<UpdaterPlugin>("Updater");

const LS_ID = "pry-device-id";

/** Stable per-device id. Android: ANDROID_ID (survives reinstall). Web: random id kept in localStorage. */
export async function getDeviceId(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { id } = await Security.getDeviceId();
      if (id && id.length >= 6) return `a${id}`;
    } catch { /* fall through to the random id */ }
  }
  try {
    let v = localStorage.getItem(LS_ID);
    if (!v) {
      v = `w${crypto.randomUUID().replace(/-/g, "")}`;
      localStorage.setItem(LS_ID, v);
    }
    return v;
  } catch {
    return "w-unknown-device";
  }
}

/** true when ANY VPN app is active on the phone (Android reports the VPN transport) */
export async function isVpnActive(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return (await Security.isVpn()).vpn;
  } catch {
    return false;
  }
}

export async function isUninstallProtected(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return (await Security.isUninstallProtected()).protected;
  } catch {
    return false;
  }
}

export async function enableUninstallProtection(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await Security.enableUninstallProtection();
}

/** Only succeeds with password "1711". After this, system uninstall is allowed. */
export async function disableUninstallProtection(password: string): Promise<{ ok: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) return { ok: false, error: "native only" };
  try {
    await Security.disableUninstallProtection({ password });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Firestore document ids cannot hold / . : etc, so ids and IPs are turned into a safe key */
export const safeKey = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 80);

let ipCache: string | null = null;
/** Public IP of the phone (free lookup, no key). Empty string if every provider fails. */
export async function getPublicIp(): Promise<string> {
  if (ipCache !== null) return ipCache;
  const urls = ["https://api.ipify.org?format=json", "https://api64.ipify.org?format=json", "https://ipwho.is/"];
  for (const u of urls) {
    try {
      const ctl = new AbortController();
      const t = window.setTimeout(() => ctl.abort(), 4_000);
      const r = await fetch(u, { signal: ctl.signal });
      window.clearTimeout(t);
      const j = (await r.json()) as { ip?: string };
      if (j.ip) {
        ipCache = safeKey(j.ip);
        return ipCache;
      }
    } catch { /* try the next provider */ }
  }
  return "";
}
