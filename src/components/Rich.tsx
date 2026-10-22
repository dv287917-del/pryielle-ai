import clsx from "clsx";
import { emojiSrc, onlyEmoji, splitEmoji } from "../lib/emoji";

/** text + custom sticker emoji (inline). */
export function Rich({ text, size = 22 }: { text: string; size?: number }) {
  const parts = splitEmoji(text);
  if (!parts.some((p) => p.t === "emoji")) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.t === "text" ? <span key={i}>{p.v}</span> : <img key={i} loading="lazy" decoding="async" src={emojiSrc(p.id)} alt="" draggable={false} className="sticker-img inline-block align-text-bottom" style={{ width: size, height: size }} />,
      )}
    </>
  );
}

/** Sirf sticker wala message: bubble ke bina bada sticker. Animation sirf `animate` (bhejte/aate waqt) par, baaki seedha aur static. */
export function StickerOnly({ ids, animate, mine }: { ids: string[]; animate: boolean; mine: boolean }) {
  const big = ids.length === 1;
  return (
    <div className={clsx("flex flex-wrap gap-1.5 p-2", mine ? "justify-end" : "justify-start")}>
      {ids.map((id, i) => (
        <img
          loading="lazy"
          decoding="async"
          key={`${id}-${i}`}
          src={emojiSrc(id)}
          alt=""
          draggable={false}
          className={clsx("sticker-img select-none", animate && "sticker-pop")}
          style={{ width: big ? 128 : 76, height: big ? 128 : 76, animationDelay: animate ? `${i * 70}ms` : undefined }}
        />
      ))}
    </div>
  );
}

export const stickerIds = onlyEmoji;
