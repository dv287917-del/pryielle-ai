import { registerPlugin } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

/** true inside the small floating-window WebView (loaded with ?float=1) */
export const IS_FLOAT = typeof location !== "undefined" && new URLSearchParams(location.search).has("float");

type FloatingWindowPlugin = {
  hasPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
};
const FloatingWindow = registerPlugin<FloatingWindowPlugin>("FloatingWindow");

export async function openFloating(): Promise<"ok" | "perm"> {
  const { granted } = await FloatingWindow.hasPermission();
  if (!granted) {
    await FloatingWindow.requestPermission();
    return "perm";
  }
  await FloatingWindow.show();
  await CapApp.minimizeApp();
  return "ok";
}
