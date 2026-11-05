import type { FeatureConfig } from "./featureSchema";

export const BUILTIN_FLAGS: readonly string[];
export const DEFAULTS: Record<"bg" | "text" | "muted" | "surface" | "accent", string>;
export const THEME_VAR_NAMES: readonly string[];
export const FONT_STACKS: Record<string, string>;
export function isHex(h: unknown): h is string;
export function parseHex(h: string): number[] | null;
export function toHex(rgb: number[]): string;
export function mix(a: string, b: string, t: number): string;
export function luminance(h: string): number;
export function contrast(a: string, b: string): number;
export function onColor(bg: string): string;
export function themeToVars(theme: unknown): { vars: Record<string, string>; notes: string[] };

export type LiveParsed = { version: number; active: boolean; revert: boolean; config: FeatureConfig | null; bad: boolean };
export function parseLive(raw: unknown): LiveParsed | null;
export function decideUpdate(appliedVersion: number | null | undefined, live: LiveParsed | null): "none" | "apply" | "prompt";
export function effectiveFlags(config: FeatureConfig | null, overrides?: Record<string, boolean> | null): Record<string, boolean>;
export function interpolate(text: string, vars?: Record<string, string>): string;
export function safeUrl(u: unknown): string | null;
export type ConfigSummary = { title: string; notes: string; accent: string | null; bg: string | null; themeKeys: number; flags: number; blocks: { type: string; slot: string; label: string }[] };
export function summarizeConfig(config: unknown): ConfigSummary;
export function draftStale(basedOnVersion: unknown, liveVersion: unknown): boolean;

