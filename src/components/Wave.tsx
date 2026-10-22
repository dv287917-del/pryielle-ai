import clsx from "clsx";

const PEAKS: [number, number][] = [[0.07, 0.45], [0.19, 0.72], [0.32, 1], [0.45, 0.6], [0.57, 0.82], [0.69, 0.55], [0.81, 1], [0.93, 0.5]];

function profile(n: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const x = i / (n - 1);
    let h = 0.12;
    for (const [c, a] of PEAKS) h = Math.max(h, a * Math.exp(-((x - c) ** 2) / 0.0016));
    const j = ((i * 37) % 11) / 11;
    return Math.min(1, h * (0.72 + 0.28 * j) + 0.05 * j);
  });
}

/** Animated sound-track (waveform) bars. */
export function Wave({ bars = 43, active = true, fast = false, className }: { bars?: number; active?: boolean; fast?: boolean; className?: string }) {
  const hs = profile(bars);
  return (
    <div className={clsx("wave", className)} aria-hidden="true">
      {hs.map((h, i) => (
        <span
          key={i}
          className="wave-bar"
          style={{
            height: `${Math.round(h * 100)}%`,
            animationDuration: `${(fast ? 0.28 : 0.55) + ((i * 13) % 7) * (fast ? 0.045 : 0.085)}s`,
            animationDelay: `${-((i * 5) % 9) * 0.07}s`,
            animationPlayState: active ? "running" : "paused",
          }}
        />
      ))}
    </div>
  );
}
