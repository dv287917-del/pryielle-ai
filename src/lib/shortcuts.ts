import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import type { Shortcut } from "./types";

/** Admin ne kuch add nahi kiya to yeh default shortcuts dikhte hain. */
export const DEFAULT_SHORTCUTS: string[] = [
  "Ready? 🔥", "Squad aa jao 🎮", "Rush karte hain ⚡", "GG 🏆", "Bhai heal de 💉", "Wait karo ✋", "Drop kaha? 🪂", "Nice shot 🎯",
];
export const MAX_SHORTCUTS = 40;
export const SHORTCUT_EMOJIS = ["🔥", "🎮", "⚡", "🏆", "💉", "✋", "🪂", "🎯", "💀", "👑", "🚀", "💥", "🛡️", "😂", "👀", "💯"];

const fallback = (): Shortcut[] => DEFAULT_SHORTCUTS.map((text, i) => ({ id: `default-${i}`, text, order: i, on: true }));

export const cleanShortcut = (raw: string) => {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) throw new Error("Shortcut khali nahi ho sakta");
  if (t.length > 40) throw new Error("Shortcut 40 characters tak ka rakho");
  return t;
};

/** Raw list (admin ke liye): fromDb=false matlab abhi default dikh rahe hain. */
export function watchShortcuts(cb: (list: Shortcut[], fromDb: boolean) => void) {
  return onSnapshot(
    query(collection(db, "shortcuts"), orderBy("order", "asc")),
    (s) => {
      if (s.empty) { cb(fallback(), false); return; }
      cb(s.docs.map((d) => {
        const x = d.data() as Partial<Shortcut>;
        return { id: d.id, text: String(x.text ?? ""), order: Number(x.order ?? 0), on: x.on !== false };
      }).filter((x) => x.text), true);
    },
    () => cb(fallback(), false),
  );
}

let shared: Shortcut[] = fallback();

/** Chat ke liye: sirf ON wale shortcuts, live update. */
export function useShortcuts(): Shortcut[] {
  const [list, setList] = useState<Shortcut[]>(shared);
  useEffect(() => watchShortcuts((l) => { shared = l.filter((x) => x.on); setList(shared); }), []);
  return list;
}

export async function addShortcut(text: string, order: number) {
  const t = cleanShortcut(text);
  await setDoc(doc(collection(db, "shortcuts")), { text: t, order, on: true, at: Date.now() });
}
export const editShortcut = (id: string, text: string) => updateDoc(doc(db, "shortcuts", id), { text: cleanShortcut(text) });
export const toggleShortcut = (id: string, on: boolean) => updateDoc(doc(db, "shortcuts", id), { on });
export const deleteShortcut = (id: string) => deleteDoc(doc(db, "shortcuts", id));

/** Do shortcuts ki jagah badal deta hai (up/down). */
export async function swapShortcuts(a: Shortcut, b: Shortcut) {
  const batch = writeBatch(db);
  batch.update(doc(db, "shortcuts", a.id), { order: b.order });
  batch.update(doc(db, "shortcuts", b.id), { order: a.order });
  await batch.commit();
}

/** Default shortcuts ko database mein daal deta hai taaki edit/delete ho saken. */
export async function importDefaults() {
  const batch = writeBatch(db);
  DEFAULT_SHORTCUTS.forEach((text, i) => batch.set(doc(collection(db, "shortcuts")), { text, order: i, on: true, at: Date.now() }));
  await batch.commit();
}

/** Saare shortcuts hata do (wapas default dikhne lagenge). */
export async function clearShortcuts(list: Shortcut[]) {
  const batch = writeBatch(db);
  list.forEach((s) => batch.delete(doc(db, "shortcuts", s.id)));
  await batch.commit();
}
