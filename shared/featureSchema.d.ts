export const SCHEMA_VERSION: number;
export const SLOTS: readonly string[];
export const BLOCK_TYPES: readonly string[];
export const FONTS: readonly string[];
export const TONES: readonly string[];
export const BUTTON_ACTIONS: readonly string[];
export const SLOT_RULES: Record<string, string[]>;
export const LIMITS: Record<string, number>;
export const SCHEMA_PROMPT: string;

export type Slot = "home-top" | "home-hero" | "home-suggestions" | "chat-top" | "drawer";
export type FeatureTheme = { accent?: string; bg?: string; surface?: string; text?: string; muted?: string; font?: "system" | "serif" | "mono" | "rounded"; radius?: number };
type Base = { id: string; slot: Slot };
export type FeatureBlock =
  | (Base & { type: "banner"; text: string; tone: "info" | "success" | "warn" | "promo"; emoji?: string; actionLabel?: string; actionUrl?: string })
  | (Base & { type: "badge"; text: string; color?: string })
  | (Base & { type: "button"; label: string; action: "openUrl" | "sendPrompt" | "copyText"; value: string; emoji?: string })
  | (Base & { type: "card"; title: string; body: string; emoji?: string })
  | (Base & { type: "hero"; title: string; subtitle: string })
  | (Base & { type: "chips"; items: { label: string; prompt: string }[] })
  | (Base & { type: "toggle"; label: string; flag: string; default: boolean });

export type FeatureConfig = { schemaVersion: number; title: string; notes: string; theme: FeatureTheme; flags: Record<string, boolean>; blocks: FeatureBlock[] };
/** Firestore me jo save hota hai: config + server ke meta fields */
export type FeatureDoc = FeatureConfig & { version: number; publishedAt?: number; publishedBy?: string; active?: boolean };

export function validateFeatureConfig(input: unknown): { ok: boolean; config: FeatureConfig | null; warnings: string[] };
