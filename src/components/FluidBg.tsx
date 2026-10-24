import { useEffect, useRef, useState } from "react";
import { isLite, perfTier, reportSlow } from "../lib/perf";

/**
 * Liquid background (optimised):
 *  - low-res canvas (0.4x), ~30fps cap, sirf 5 orbs
 *  - tab hide ya low-end mode mein poori tarah band
 *  - FPS watchdog: agar phone struggle kare to khud band + app "lite" mode mein
 */
type Orb = { x: number; y: number; vx: number; vy: number; r: number; ph: number; sp: number; ci: number };
type RGB = [number, number, number];

function parseColor(v: string, fb: RGB): RGB {
  const s = v.trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const r = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(s);
  return r ? [Number(r[1]), Number(r[2]), Number(r[3])] : fb;
}

export function FluidBg() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [on] = useState(() => !isLite());

  useEffect(() => {
    const cv = ref.current;
    if (!on || !cv) return;
    const ctx = cv.getContext("2d", { alpha: true });
    if (!ctx) return;

    const hi = perfTier() === "high";
    const SCALE = hi ? 0.55 : 0.4;
    const FRAME_MS = hi ? 15 : 30; // flagship: 60fps, baaki 30fps
    let w = 0, h = 0, raf = 0, lastRaw = 0, lastDraw = 0, colT = 0, stopped = false;
    let cols: RGB[] = [[255, 122, 26], [255, 46, 126], [139, 92, 246]];
    const pointer = { x: -1, y: -1, active: false, power: 0 };
    const orbs: Orb[] = Array.from({ length: hi ? 8 : 5 }, (_, i) => ({
      x: Math.random(), y: Math.random(), vx: 0, vy: 0,
      r: 0.3 + Math.random() * 0.2, ph: Math.random() * 6.28, sp: 0.12 + Math.random() * 0.16, ci: i % 3,
    }));

    // watchdog
    const win: number[] = [];
    let warm = 0, slowWins = 0;
    const watch = (raw: number) => {
      warm += raw;
      if (warm < 2500 || raw > 250) return; // load ke jank / tab switch ko ignore
      win.push(raw);
      if (win.length >= 90) {
        const sorted = [...win].sort((a, b) => a - b);
        const med = sorted[sorted.length >> 1];
        win.length = 0;
        slowWins = med > 36 ? slowWins + 1 : 0;
        if (slowWins >= 2) { stop(); reportSlow(); }
      }
    };

    const stop = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
      cv.style.display = "none";
    };

    const resize = () => {
      const b = cv.getBoundingClientRect();
      w = Math.max(1, Math.round(b.width * SCALE));
      h = Math.max(1, Math.round(b.height * SCALE));
      cv.width = w; cv.height = h;
    };
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      cols = [parseColor(cs.getPropertyValue("--c1"), cols[0]), parseColor(cs.getPropertyValue("--c2"), cols[1]), parseColor(cs.getPropertyValue("--c3"), cols[2])];
    };
    const onMove = (e: PointerEvent) => {
      const b = cv.getBoundingClientRect();
      pointer.x = (e.clientX - b.left) / b.width;
      pointer.y = (e.clientY - b.top) / b.height;
      pointer.active = true;
      pointer.power = 1;
    };
    const onUp = () => { pointer.active = false; };
    const still = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";

    const frame = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (lastRaw) watch(now - lastRaw);
      lastRaw = now;
      if (document.hidden) { lastDraw = now; return; }
      if (document.documentElement.dataset.perf === "low") { stop(); return; }
      if (now - lastDraw < FRAME_MS) return;
      const dt = Math.min(0.06, (now - lastDraw) / 1000);
      lastDraw = now;
      colT += dt;
      if (colT > 2) { colT = 0; readColors(); }
      const calm = still();
      const t = now / 1000;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      pointer.power *= pointer.active ? 0.995 : 0.95;

      for (const o of orbs) {
        if (!calm) {
          const tx = 0.5 + Math.sin(t * o.sp + o.ph) * 0.42 + Math.sin(t * o.sp * 2.3 + o.ph * 1.7) * 0.1;
          const ty = 0.5 + Math.cos(t * o.sp * 0.8 + o.ph * 1.3) * 0.42 + Math.cos(t * o.sp * 1.9 + o.ph) * 0.1;
          let ax = (tx - o.x) * 1.6, ay = (ty - o.y) * 1.6;
          if (pointer.power > 0.03 && pointer.x >= 0) {
            const dx = pointer.x - o.x, dy = pointer.y - o.y;
            const pull = (0.9 * pointer.power) / (Math.hypot(dx, dy) + 0.08);
            ax += dx * pull; ay += dy * pull;
          }
          o.vx = (o.vx + ax * dt) * 0.94; o.vy = (o.vy + ay * dt) * 0.94;
          o.x += o.vx * dt * 6; o.y += o.vy * dt * 6;
        }
        const speed = Math.min(1, Math.hypot(o.vx, o.vy) * 3);
        const rad = Math.max(w, h) * (o.r + speed * 0.05 + Math.sin(t * 0.9 + o.ph) * 0.02);
        const [r, g, b] = cols[o.ci];
        const gr = ctx.createRadialGradient(o.x * w, o.y * h, 0, o.x * w, o.y * h, rad);
        gr.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
        gr.addColorStop(0.5, `rgba(${r},${g},${b},0.1)`);
        gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gr;
        ctx.fillRect(o.x * w - rad, o.y * h - rad, rad * 2, rad * 2); // poora canvas nahi, sirf orb ka box
      }
    };

    resize(); readColors();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [on]);

  if (!on) return null;
  return <canvas ref={ref} className="fluid-canvas" aria-hidden="true" />;
}
