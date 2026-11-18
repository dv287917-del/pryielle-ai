export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";

const parts = (v: string) => v.trim().replace(/^v/i, "").split(".").map((n) => Number.parseInt(n, 10) || 0);

/** 1 agar a > b, -1 agar a < b, 0 barabar. */
export function compareVersions(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length, 3); i += 1) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}
