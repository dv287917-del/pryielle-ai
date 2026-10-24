/**
 * Vercel par deploy hua AI server. APK ke andar relative "/api/ai" kaam NAHI karta
 * (wo https://localhost par jaata hai), isliye poora Vercel URL chahiye.
 * Apna Vercel domain yahan daalo (Vercel -> Project -> Domains), bina last "/" ke.
 * Ya build time par VITE_AI_BASE_URL environment variable do.
 */
const FALLBACK_BASE = "https://pryielle-ai.vercel.app";
const envBase = (import.meta.env.VITE_AI_BASE_URL as string | undefined)?.trim();
export const AI_API_URL = `${(envBase || FALLBACK_BASE).replace(/\/+$/, "")}/api/ai`;
