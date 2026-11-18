// Custom sticker emoji set (24). Message mein ":e07:" jaisa token jata hai, screen par image dikhti hai.
const files = import.meta.glob("../assets/emoji/e*.png", { eager: true, import: "default" }) as Record<string, string>;

export const EMOJI_IDS: string[] = Object.keys(files)
  .map((p) => /e(\d+)\.png$/.exec(p)?.[1] ?? "")
  .filter(Boolean)
  .sort();

const byId: Record<string, string> = {};
for (const [p, url] of Object.entries(files)) {
  const id = /e(\d+)\.png$/.exec(p)?.[1];
  if (id) byId[id] = url;
}

export const emojiSrc = (id: string) => byId[id] ?? "";
export const emojiToken = (id: string) => `:e${id}:`;

const TOKEN = /:e(\d{2}):/g;
export const isEmojiToken = (s: string) => /^:e\d{2}:$/.test(s.trim());

/** text ko plain text + sticker parts mein todta hai */
export type Piece = { t: "text"; v: string } | { t: "emoji"; id: string };
export function splitEmoji(text: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (!byId[m[1]]) continue;
    if (m.index! > last) out.push({ t: "text", v: text.slice(last, m.index) });
    out.push({ t: "emoji", id: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

/** sirf stickers (max 5), koi aur text nahi -> bada sticker dikhao */
export function onlyEmoji(text: string): string[] | null {
  const parts = splitEmoji(text.trim());
  if (!parts.length || parts.length > 5) return null;
  return parts.every((p) => p.t === "emoji") ? parts.map((p) => (p as { id: string }).id) : null;
}

/** preview/notification ke liye: tokens ko 😀 bana do */
export const plainEmoji = (text: string) => text.replace(TOKEN, "😊");
