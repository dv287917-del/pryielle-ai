// Welcome screen ke liye illustrated portraits (koi external photo nahi chahiye)
type Style = "long" | "short" | "bun" | "afro" | "cap" | "bob" | "curly" | "beard";

export type FaceSpec = {
  bg: [string, string];
  skin: string;
  hair: string;
  cloth: string;
  style: Style;
  glasses?: boolean;
  gray?: boolean;
};

export const FACES: FaceSpec[] = [
  { bg: ["#1d2a36", "#0b0f14"], skin: "#8a5a3c", hair: "#0d0d0d", cloth: "#2b3440", style: "short", gray: true },
  { bg: ["#2aa4c9", "#0b5d86"], skin: "#c98f68", hair: "#141414", cloth: "#0f2f45", style: "beard" },
  { bg: ["#e9e9e9", "#9a9a9a"], skin: "#d9b79e", hair: "#1a1a1a", cloth: "#333", style: "long", gray: true },
  { bg: ["#f6d9b0", "#e9a96b"], skin: "#6f4430", hair: "#120a06", cloth: "#7a3b2e", style: "afro", glasses: true },
  { bg: ["#cfcfcf", "#6e6e6e"], skin: "#e3c3ab", hair: "#2a2a2a", cloth: "#1c1c1c", style: "bun", gray: true },
  { bg: ["#f5c9a3", "#d7824f"], skin: "#a86d4b", hair: "#1b100b", cloth: "#f2efe9", style: "curly" },
  { bg: ["#e6e6e6", "#8c8c8c"], skin: "#dcb89f", hair: "#111", cloth: "#2a2a2a", style: "bob", gray: true },
  { bg: ["#caa27a", "#8a5a3a"], skin: "#f0cdb4", hair: "#3b2416", cloth: "#e8e0d6", style: "long" },
  { bg: ["#3a3a3a", "#0e0e0e"], skin: "#c8a58d", hair: "#0c0c0c", cloth: "#444", style: "cap", gray: true },
  { bg: ["#bcd6e6", "#6c96b3"], skin: "#e8c4a8", hair: "#5a3a22", cloth: "#f4f4f4", style: "short", glasses: true },
  { bg: ["#f3c6d6", "#d9779c"], skin: "#d9a07c", hair: "#1a0f0c", cloth: "#7b2c4d", style: "bob" },
  { bg: ["#c7e3d4", "#5fa986"], skin: "#a0684a", hair: "#0f0a08", cloth: "#1f4d3a", style: "bun" },
];

export function Face({ spec, id }: { spec: FaceSpec; id: string }) {
  const { bg, skin, hair, cloth, style, glasses } = spec;
  const g = `wf-${id}`;
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bg[0]} />
          <stop offset="1" stopColor={bg[1]} />
        </linearGradient>
        <radialGradient id={`${g}-l`} cx="0.35" cy="0.25" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${g})`} />
      {/* back hair */}
      {style === "long" && <path d="M26 52 Q22 18 50 17 Q78 18 74 52 L78 92 L22 92 Z" fill={hair} />}
      {style === "bob" && <path d="M27 58 Q22 20 50 19 Q78 20 73 58 Q72 66 66 66 L34 66 Q28 66 27 58Z" fill={hair} />}
      {style === "afro" && <circle cx="50" cy="38" r="26" fill={hair} />}
      {style === "curly" && (
        <g fill={hair}>
          <circle cx="32" cy="36" r="12" /><circle cx="44" cy="26" r="13" /><circle cx="58" cy="26" r="13" />
          <circle cx="69" cy="36" r="12" /><circle cx="30" cy="50" r="9" /><circle cx="71" cy="50" r="9" />
        </g>
      )}
      {/* shoulders + neck */}
      <path d="M8 100 Q10 74 50 72 Q90 74 92 100 Z" fill={cloth} />
      <path d="M40 74 Q50 84 60 74 L58 62 L42 62 Z" fill={skin} />
      <path d="M42 62 L58 62 L58 68 Q50 73 42 68 Z" fill="#000" opacity="0.14" />
      {/* head */}
      <ellipse cx="50" cy="47" rx="17" ry="20.5" fill={skin} />
      <ellipse cx="33.2" cy="48" rx="2.6" ry="4" fill={skin} />
      <ellipse cx="66.8" cy="48" rx="2.6" ry="4" fill={skin} />
      {/* front hair */}
      {style === "short" && <path d="M32 44 Q30 24 50 24 Q70 24 68 44 Q64 34 50 33 Q36 34 32 44Z" fill={hair} />}
      {style === "beard" && (
        <>
          <path d="M32 44 Q30 25 50 25 Q70 25 68 44 Q63 34 50 34 Q37 34 32 44Z" fill={hair} />
          <path d="M33 52 Q36 70 50 70 Q64 70 67 52 Q60 60 50 60 Q40 60 33 52Z" fill={hair} />
        </>
      )}
      {style === "long" && <path d="M32 46 Q32 26 50 26 Q68 26 68 46 Q60 34 50 35 Q40 34 32 46Z" fill={hair} />}
      {style === "bob" && <path d="M31 46 Q32 25 50 25 Q68 25 69 46 Q58 32 44 36 Q36 38 31 46Z" fill={hair} />}
      {style === "bun" && (
        <>
          <circle cx="50" cy="20" r="8" fill={hair} />
          <path d="M32 45 Q31 26 50 26 Q69 26 68 45 Q60 33 50 33 Q40 33 32 45Z" fill={hair} />
        </>
      )}
      {style === "afro" && <path d="M33 45 Q34 29 50 29 Q66 29 67 45 Q60 36 50 36 Q40 36 33 45Z" fill={hair} />}
      {style === "curly" && <path d="M33 45 Q34 30 50 30 Q66 30 67 45 Q60 37 50 37 Q40 37 33 45Z" fill={hair} />}
      {style === "cap" && (
        <>
          <path d="M31 42 Q32 22 50 22 Q68 22 69 42 Z" fill={hair} />
          <path d="M30 42 Q50 38 78 44 Q78 48 70 46 Q50 42 30 46Z" fill={hair} />
        </>
      )}
      {/* face */}
      <ellipse cx="43" cy="48" rx="1.7" ry="2.1" fill="#1a1210" />
      <ellipse cx="57" cy="48" rx="1.7" ry="2.1" fill="#1a1210" />
      <path d="M44 57 Q50 62 56 57" stroke="#1a1210" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity={style === "beard" ? 0.0 : 0.85} />
      {style === "beard" && <path d="M45 58 Q50 61 55 58" stroke="#e9d9cc" strokeWidth="1.4" fill="none" strokeLinecap="round" />}
      {glasses && (
        <g fill="none" stroke="#111" strokeWidth="1.5">
          <circle cx="43" cy="48" r="5.6" /><circle cx="57" cy="48" r="5.6" /><path d="M48.6 48 H51.4" />
        </g>
      )}
      <rect width="100" height="100" fill={`url(#${g}-l)`} />
    </svg>
  );
}
