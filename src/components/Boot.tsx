import type { ReactNode } from "react";
import { useStatusBar } from "./Brand";

// Purani rose wali loading screen hata di gayi. Ab sirf saaf safed screen (naye Welcome jaisa bg);
// sirf tab kuch dikhta hai jab koi error/"Stuck" panel (children) aaye.
export function Boot({ children }: { children?: ReactNode }) {
  useStatusBar("#ffffff");
  return (
    <main
      className="relative flex h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center"
      style={{ background: "linear-gradient(#fff, #f6f8fb)", color: "#111" }}
    >
      {children}
    </main>
  );
}
