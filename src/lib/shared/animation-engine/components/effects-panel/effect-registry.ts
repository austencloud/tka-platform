/**
 * Shared effect metadata. Single source of truth for id/label/icon/color
 * across the 2D EffectsPanel (desktop), MobileEffectsPanel, and
 * EffectSelector. Phase 2 will extend EffectMeta with a `modes` field
 * and add the 3D-only Motion entry; for now this is 2D's 10 effects.
 */

export interface EffectMeta {
  readonly id: string;
  readonly label: string;
  readonly icon: `fa-${string}`;
  readonly color: `#${string}`;
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
] as const;

export const EFFECT_COLORS: Record<string, string> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e.color]),
);

export const EFFECT_LABELS: Record<string, string> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e.label]),
);
