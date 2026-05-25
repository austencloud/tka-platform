/**
 * Shared effect metadata. Single source of truth for id/label/icon/color
 * across the 2D EffectsPanel (desktop), MobileEffectsPanel, and
 * EffectSelector. Currently 13 effects; the "none" chip is rendered
 * separately by consumers that need it.
 */

import type { Component } from "svelte";
import type { EffectPresetGroup } from "./presets/types";
import type { PrimaryParamSpec } from "./effect-primary-param";
import { PRIMARY_PARAMS } from "./effect-primary-param";
import { TRAIL_PRESET_GROUP } from "./presets/trail-presets";
import { FIRE_PRESET_GROUP } from "./presets/fire-presets";
import { LED_PRESET_GROUP } from "./presets/led-presets";
import { CHARCOAL_PRESET_GROUP } from "./presets/charcoal-presets";
import { ZAP_PRESET_GROUP } from "./presets/zap-presets";
import { SPARKLES_PRESET_GROUP } from "./presets/sparkles-presets";
import { ECHO_PRESET_GROUP } from "./presets/echo-presets";
import { BLOOM_PRESET_GROUP } from "./presets/bloom-presets";
import { WATER_PRESET_GROUP } from "./presets/water-presets";
import { BUBBLES_PRESET_GROUP } from "./presets/bubbles-presets";
import { PETALS_PRESET_GROUP } from "./presets/petals-presets";
import { SMOKE_PRESET_GROUP } from "./presets/smoke-presets";
import { INK_PRESET_GROUP } from "./presets/ink-presets";
import { FROST_PRESET_GROUP } from "./presets/frost-presets";
import { SILK_PRESET_GROUP } from "./presets/silk-presets";
import { PULSE_PRESET_GROUP } from "./presets/pulse-presets";

export interface EffectMeta {
  readonly id: string;
  readonly label: string;
  readonly icon: `fa-${string}`;
  readonly color: `#${string}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface EffectRegistration {
  meta: EffectMeta;
  presetGroup: EffectPresetGroup;
  // Component<any> — each customize component has its own required props (e.g. onBack)
  // that the registry does not need to know about; consumers cast as needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customizeComponent: () => Promise<{ default: Component<any> }>;
  primaryParam?: PrimaryParamSpec;
}

export const EFFECTS: readonly EffectMeta[] = [
  { id: "trails", label: "Trails", icon: "fa-route", color: "#60a5fa" },
  { id: "fire", label: "Fire", icon: "fa-fire", color: "#f97316" },
  { id: "led", label: "LED", icon: "fa-lightbulb", color: "#22c55e" },
  { id: "charcoal", label: "Coal", icon: "fa-diamond", color: "#a855f7" },
  { id: "zap", label: "Zap", icon: "fa-bolt", color: "#38bdf8" },
  { id: "sparkles", label: "Sparkle", icon: "fa-star", color: "#fbbf24" },
  { id: "echo", label: "Echo", icon: "fa-clone", color: "#22d3ee" },
  { id: "bloom", label: "Bloom", icon: "fa-sun", color: "#f472b6" },
  { id: "water", label: "Water", icon: "fa-droplet", color: "#3a7fd9" },
  { id: "bubbles", label: "Bubbles", icon: "fa-circle-notch", color: "#c8e0ff" },
  { id: "petals", label: "Petals", icon: "fa-leaf", color: "#ffc0d8" },
  { id: "smoke", label: "Smoke", icon: "fa-smog", color: "#c0c0c8" },
  { id: "ink", label: "Ink", icon: "fa-paint-brush", color: "#b8956a" },
  { id: "frost", label: "Frost", icon: "fa-snowflake", color: "#a0d8ff" },
  { id: "silk", label: "Silk", icon: "fa-wind", color: "#c0c0d0" },
  { id: "pulse", label: "Pulse", icon: "fa-bullseye", color: "#38bdf8" },
] as const;

export const EFFECT_COLORS: Record<string, string> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e.color]),
);

export const EFFECT_LABELS: Record<string, string> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e.label]),
);

// ── Registration map ─────────────────────────────────────────────────────

const REGISTRY = new Map<string, EffectRegistration>();

export function registerEffect(reg: EffectRegistration): void {
  REGISTRY.set(reg.meta.id, reg);
}

export function getRegistration(id: string): EffectRegistration | undefined {
  return REGISTRY.get(id);
}

export function getAllRegistrations(): EffectRegistration[] {
  return EFFECTS.map((e) => REGISTRY.get(e.id)).filter(Boolean) as EffectRegistration[];
}

// ── Self-registration at module load ─────────────────────────────────────

const presetGroups: Record<string, EffectPresetGroup> = {
  trails: TRAIL_PRESET_GROUP,
  fire: FIRE_PRESET_GROUP,
  led: LED_PRESET_GROUP,
  charcoal: CHARCOAL_PRESET_GROUP,
  zap: ZAP_PRESET_GROUP,
  sparkles: SPARKLES_PRESET_GROUP,
  echo: ECHO_PRESET_GROUP,
  bloom: BLOOM_PRESET_GROUP,
  water: WATER_PRESET_GROUP,
  bubbles: BUBBLES_PRESET_GROUP,
  petals: PETALS_PRESET_GROUP,
  smoke: SMOKE_PRESET_GROUP,
  ink: INK_PRESET_GROUP,
  frost: FROST_PRESET_GROUP,
  silk: SILK_PRESET_GROUP,
  pulse: PULSE_PRESET_GROUP,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const customizeLoaders: Record<string, () => Promise<{ default: Component<any> }>> = {
  trails: () => import("./customize/TrailCustomize.svelte"),
  fire: () => import("./customize/FireCustomize.svelte"),
  led: () => import("./customize/LedCustomize.svelte"),
  charcoal: () => import("./customize/CharcoalCustomize.svelte"),
  zap: () => import("./customize/ZapCustomize.svelte"),
  sparkles: () => import("./customize/SparklesCustomize.svelte"),
  echo: () => import("./customize/EchoCustomize.svelte"),
  bloom: () => import("./customize/BloomCustomize.svelte"),
  water: () => import("./customize/WaterCustomize.svelte"),
  bubbles: () => import("./customize/BubblesCustomize.svelte"),
  petals: () => import("./customize/PetalsCustomize.svelte"),
  smoke: () => import("./customize/SmokeCustomize.svelte"),
  ink: () => import("./customize/InkCustomize.svelte"),
  frost: () => import("./customize/FrostCustomize.svelte"),
  silk: () => import("./customize/SilkCustomize.svelte"),
  pulse: () => import("./customize/PulseCustomize.svelte"),
};

for (const meta of EFFECTS) {
  registerEffect({
    meta,
    presetGroup: presetGroups[meta.id]!,
    customizeComponent: customizeLoaders[meta.id]!,
    primaryParam: PRIMARY_PARAMS[meta.id],
  });
}
