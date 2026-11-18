import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ChevronRight, PictureInPicture2 } from "lucide-react";
import { IS_FLOAT, openFloating } from "../lib/floating";
import { errorText } from "../lib/util";

export function FloatBtn() {
  const [msg, setMsg] = useState("");
  if (!Capacitor.isNativePlatform() || IS_FLOAT) return null;
  return (
    <div>
      <button
        type="button"
        className="tap flex h-14 w-full items-center gap-3 px-4 text-left"
        onClick={() => {
          setMsg("");
          openFloating()
            .then((r) => { if (r === "perm") setMsg("Settings mein “Display over other apps” ON karo, phir wapas aake dobara dabao."); })
            .catch((e) => setMsg(errorText(e)));
        }}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-paper/8 text-aqua"><PictureInPicture2 className="size-4" /></span>
        <span className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold">Floating window</span>
        <ChevronRight className="size-4 shrink-0 text-paper/35" />
      </button>
      {msg ? <p className="px-4 pb-3 text-xs text-hot">{msg}</p> : null}
    </div>
  );
}
