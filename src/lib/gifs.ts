import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import paise from "../assets/gifs/paise.jpg";
import cat from "../assets/gifs/cat.jpg";
import type { GifItem } from "./types";

// Built-in GIFs (hamesha rehte hain). Naye GIF Admin Panel → GIFs se add karo, code badalne ki zaroorat nahi.
export const BUILTIN_GIFS: GifItem[] = [
  { id: "paise", src: paise, label: "Paise ki dikkat", tag: "paise money" },
  { id: "cat", src: cat, label: "Kro muje kya", tag: "cat billi" },
];

const cache = new Map<string, GifItem>();
BUILTIN_GIFS.forEach((g) => cache.set(g.id, g));

function fromDoc(id: string, d: Record<string, unknown>): GifItem | null {
  const src = typeof d.url === "string" && d.url ? d.url : typeof d.data === "string" ? d.data : "";
  if (!src) return null;
  return { id, src, label: String(d.label ?? "GIF"), tag: String(d.tag ?? "") };
}

/** Admin ke added GIFs + built-in, naye pehle. */
export async function loadGifs(): Promise<GifItem[]> {
  const snap = await getDocs(query(collection(db, "gifs"), orderBy("at", "desc"), limit(80)));
  const remote: GifItem[] = [];
  snap.docs.forEach((d) => {
    const g = fromDoc(d.id, d.data());
    if (g) {
      cache.set(g.id, g);
      remote.push(g);
    }
  });
  return [...remote, ...BUILTIN_GIFS];
}

export async function addGif(by: string, input: { label: string; tag: string; url?: string; data?: string }) {
  const label = input.label.trim().slice(0, 40) || "GIF";
  const url = (input.url ?? "").trim();
  const data = input.data ?? "";
  if (!url && !data) throw new Error("GIF link ya file do");
  if (url && !/^https:\/\//i.test(url)) throw new Error("Link https:// se shuru hona chahiye");
  if (data.length > 700_000) throw new Error("File bahut badi hai. Link se add karo ya chhota GIF chuno (500KB tak)");
  const ref = doc(collection(db, "gifs"));
  await setDoc(ref, { label, tag: input.tag.trim().toLowerCase().slice(0, 60), url: url || null, data: data || null, at: Date.now(), by });
}

export const deleteGif = (id: string) => deleteDoc(doc(db, "gifs", id));

/** Ek GIF ka src nikalta hai: cache mein hai to turant, warna Firestore se. */
export function useGif(id: string | null): { src: string | null; failed: boolean } {
  const [state, setState] = useState<{ id: string | null; src: string | null; failed: boolean }>(() => ({ id, src: id ? cache.get(id)?.src ?? null : null, failed: false }));
  useEffect(() => {
    if (!id) return;
    const hit = cache.get(id);
    if (hit) {
      setState({ id, src: hit.src, failed: false });
      return;
    }
    let stop = false;
    setState({ id, src: null, failed: false });
    getDoc(doc(db, "gifs", id))
      .then((s) => {
        const g = s.exists() ? fromDoc(s.id, s.data()) : null;
        if (g) cache.set(g.id, g);
        if (!stop) setState({ id, src: g?.src ?? null, failed: !g });
      })
      .catch(() => {
        if (!stop) setState({ id, src: null, failed: true });
      });
    return () => {
      stop = true;
    };
  }, [id]);
  if (!id) return { src: null, failed: false };
  return state.id === id ? { src: state.src, failed: state.failed } : { src: cache.get(id)?.src ?? null, failed: false };
}
