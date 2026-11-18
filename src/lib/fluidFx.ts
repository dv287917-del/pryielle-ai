/** Touch par halka liquid ring. Ek hi listener, low-end mode mein band. */
export function initFluidFx() {
  if (typeof document === "undefined") return;
  const SEL = "button, [role='button'], a[href]";
  let busy = 0;
  document.addEventListener(
    "pointerdown",
    (e) => {
      const root = document.documentElement;
      if (root.dataset.perf === "low" || root.dataset.motion === "reduced" || busy >= 3) return;
      const el = (e.target as Element | null)?.closest?.(SEL) as HTMLButtonElement | null;
      if (!el || el.disabled || el.closest(".no-fx") || el.getAttribute("aria-disabled") === "true") return;
      const ring = document.createElement("span");
      ring.className = "fx-ring";
      ring.style.left = `${e.clientX}px`;
      ring.style.top = `${e.clientY}px`;
      document.body.appendChild(ring);
      busy += 1;
      const done = () => { if (ring.isConnected) { ring.remove(); busy -= 1; } };
      ring.addEventListener("animationend", done, { once: true });
      window.setTimeout(done, 1000);
    },
    { passive: true, capture: true },
  );
}
