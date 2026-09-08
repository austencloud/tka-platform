/**
 * Shared effect metadata. Single source of truth for id/label/icon/color
 * across the unified EffectsPanel (sidebar/strip/grid layouts) and
 * EffectSelector. The canonical roster contains 16 effects; the "none" chip is rendered
 * separately by consumers that need it.
 */

import type { Component } from "svelte";
import type { EffectPresetGroup } from "./presets/types";
import type { PrimaryParamSpec } from "./effect-primary-param";
import { PRIMARY_PARAMS } from "./effect-primary-param";
import { resilientLazyImport } from "$lib/shared/hmr-helper";
import { TRAIL_PRESET_GROUP } from "./presets/trail-presets";
import { FIRE_PRESET_GROUP } from "./presets/fire-presets";
import { LED_PRESET_GROUP } from "./presets/led-presets";
import { CHARCOAL_PRESET_GROUP } from "./presets/charcoal-presets";
import { ZAP_PRESET_GROUP } from "./presets/zap-presets";
import { SPARKLES_PRESET_GROUP } from "./presets/sparkles-presets";
import { GHOST_PRESET_GROUP } from "./presets/ghost-presets";
import { BLOOM_PRESET_GROUP } from "./presets/bloom-presets";
import { GOO_PRESET_GROUP } from "./presets/goo-presets";
import { BUBBLES_PRESET_GROUP } from "./presets/bubbles-presets";
import { PETALS_PRESET_GROUP } from "./presets/petals-presets";
import { SMOKE_PRESET_GROUP } from "./presets/smoke-presets";
import { INK_PRESET_GROUP } from "./presets/ink-presets";
import { FROST_PRESET_GROUP } from "./presets/frost-presets";
import { SILK_PRESET_GROUP } from "./presets/silk-presets";
import { ANIMAL_PRESET_GROUP } from "./presets/animal-presets";
import { PULSE_PRESET_GROUP } from "./presets/pulse-presets";

export interface EffectMeta {
  readonly id: string;
  readonly label: string;
  readonly icon: `fa-${string}`;
  readonly color: `#${string}`;
  /** Show this effect's coven in the hub. Defaults to true when omitted. */
  readonly ready3d?: boolean;
  /** GLB path for the coven stage; omitted → stone-disc platform. */
  readonly stageModel?: string;
  /** Acolyte skin id; omitted → default avatar. (Deferred capability.) */
  readonly skin?: string;
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
  { id: "ghost", label: "Ghost", icon: "fa-ghost", color: "#22d3ee" },
  { id: "bloom", label: "Bloom", icon: "fa-sun", color: "#f472b6" },
  { id: "goo", label: "Goo", icon: "fa-droplet", color: "#3a7fd9" },
  { id: "bubbles", label: "Bubbles", icon: "fa-circle-notch", color: "#c8e0ff" },
  { id: "petals", label: "Petals", icon: "fa-leaf", color: "#ffc0d8" },
  { id: "smoke", label: "Smoke", icon: "fa-smog", color: "#c0c0c8" },
  { id: "ink", label: "Ink", icon: "fa-paint-brush", color: "#b8956a" },
  // frost: retired from the roster (Animal took its slot). Its config,
  // renderer, and preset/customize map entries stay dormant — deletion tracked
  // in a follow-up spec. Registration loops over EFFECTS, so dropping it here
  // unregisters the chip without touching the dormant code.
  { id: "silk", label: "Silk", icon: "fa-wind", color: "#c0c0d0" },
  { id: "animal", label: "Animal", icon: "fa-dragon", color: "#3aa655" },
  { id: "pulse", label: "Pulse", icon: "fa-bullseye", color: "#38bdf8" },
] as const;

export const EFFECT_COLORS: Record<string, string> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e.color]),
);

export const EFFECT_LABELS: Record<string, string> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e.label]),
);

export const EFFECT_ICONS: Record<string, string> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e.icon]),
);

/** Generic Effects glyph, used only while nothing is chosen. */
export const EFFECTS_FALLBACK_ICON = "fa-wand-magic-sparkles";

/**
 * The glyph a nav pill should wear for the currently chosen effect. A selected
 * effect names itself the way the Props pill shows the chosen prop; the wand is
 * for "none", where there is no effect to show.
 */
export function effectNavIcon(effectId: string | null | undefined): string {
  if (!effectId || effectId === "none") return EFFECTS_FALLBACK_ICON;
  return EFFECT_ICONS[effectId] ?? EFFECTS_FALLBACK_ICON;
}

/** Effect ids whose covens should appear in the hub (ready3d !== false). */
export function readyEffectIds(): string[] {
  return EFFECTS.filter((e) => e.ready3d !== false).map((e) => e.id);
}

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
  ghost: GHOST_PRESET_GROUP,
  bloom: BLOOM_PRESET_GROUP,
  goo: GOO_PRESET_GROUP,
  bubbles: BUBBLES_PRESET_GROUP,
  petals: PETALS_PRESET_GROUP,
  smoke: SMOKE_PRESET_GROUP,
  ink: INK_PRESET_GROUP,
  frost: FROST_PRESET_GROUP,
  silk: SILK_PRESET_GROUP,
  animal: ANIMAL_PRESET_GROUP,
  pulse: PULSE_PRESET_GROUP,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const customizeLoaders: Record<string, () => Promise<{ default: Component<any> }>> = {
  trails: resilientLazyImport(() => import("./customize/TrailCustomize.svelte")),
  fire: resilientLazyImport(() => import("./customize/FireCustomize.svelte")),
  led: resilientLazyImport(() => import("./customize/LedCustomize.svelte")),
  charcoal: resilientLazyImport(() => import("./customize/CharcoalCustomize.svelte")),
  zap: resilientLazyImport(() => import("./customize/ZapCustomize.svelte")),
  sparkles: resilientLazyImport(() => import("./customize/SparklesCustomize.svelte")),
  ghost: resilientLazyImport(() => import("./customize/GhostCustomize.svelte")),
  bloom: resilientLazyImport(() => import("./customize/BloomCustomize.svelte")),
  goo: resilientLazyImport(() => import("./customize/GooCustomize.svelte")),
  bubbles: resilientLazyImport(() => import("./customize/BubblesCustomize.svelte")),
  petals: resilientLazyImport(() => import("./customize/PetalsCustomize.svelte")),
  smoke: resilientLazyImport(() => import("./customize/SmokeCustomize.svelte")),
  ink: resilientLazyImport(() => import("./customize/InkCustomize.svelte")),
  frost: resilientLazyImport(() => import("./customize/FrostCustomize.svelte")),
  silk: resilientLazyImport(() => import("./customize/SilkCustomize.svelte")),
  animal: resilientLazyImport(() => import("./customize/AnimalCustomize.svelte")),
  pulse: resilientLazyImport(() => import("./customize/PulseCustomize.svelte")),
};

for (const meta of EFFECTS) {
  registerEffect({
    meta,
    presetGroup: presetGroups[meta.id]!,
    customizeComponent: customizeLoaders[meta.id]!,
    primaryParam: PRIMARY_PARAMS[meta.id],
  });
}
