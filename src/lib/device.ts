import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

type UpdaterPlugin = {
  /** direct https link se APK app cache me download (progress event: "progress") */
  download(opts: { url: string }): Promise<{ bytes: number }>;
  /** Firestore piece (base64) likho */
  writeChunk(opts: { index: number; data: string }): Promise<void>;
  /** download hui APK ke liye system installer kholo */
  install(): Promise<void>;
  /** phone par sach me installed version */
  info(): Promise<{ versionName: string; versionCode: number; lastUpdate: number }>;
  /** download hui APK ke andar ka version / package */
  inspect(opts?: { expectPackage?: string }): Promise<{ versionName: string; versionCode: number; packageName: string }>;
  appInfo(opts: { packageName: string }): Promise<{ installed: boolean; versionName: string; versionCode: number }>;
  launchApp(opts: { packageName: string }): Promise<void>;
  addListener(event: "progress", cb: (e: { done: number; total: number }) => void): Promise<PluginListenerHandle>;
};

export const Updater = registerPlugin<UpdaterPlugin>("Updater");
