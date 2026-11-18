import { useEffect, type CSSProperties } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar } from "@capacitor/status-bar";
import { ROSE_SVG } from "./roseArt";

/** Premium IronRoses emblem: pearl-to-sapphire layered rose with soft glow. */
export function RoseEmblem({ className, spin = false }: { className?: string; spin?: boolean }) {
  return (
    <svg
      viewBox="-110 -110 220 220"
      className={`${className ?? ""} ${spin ? "ir-spin" : ""}`}
      style={{ filter: "drop-shadow(0 14px 26px rgba(4, 30, 150, 0.55)) drop-shadow(0 0 22px rgba(170, 205, 255, 0.55))" }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ROSE_SVG }}
    />
  );
}

export function Sparkle({ className, d = 0 }: { className?: string; d?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={`ir-sparkle ${className ?? ""}`} style={{ "--d": d } as CSSProperties} aria-hidden="true">
      <path d="M12 0c.9 6.4 5.6 11.1 12 12-6.4.9-11.1 5.6-12 12-.9-6.4-5.6-11.1-12-12C6.4 11.1 11.1 6.4 12 0Z" fill="currentColor" />
    </svg>
  );
}

/** Status bar ka rang screen se milata hai (native only), unmount par app ka dark rang wapas. */
export function useStatusBar(color: string, back = "#07060d") {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setBackgroundColor({ color }).catch(() => undefined);
    return () => { void StatusBar.setBackgroundColor({ color: back }).catch(() => undefined); };
  }, [color, back]);
}
