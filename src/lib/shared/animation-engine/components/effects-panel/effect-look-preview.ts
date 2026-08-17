import type { EffectPreset } from "./presets/types";

export type EffectLookMotif =
  | "trail"
  | "fire"
  | "led"
  | "embers"
  | "zap"
  | "sparkles"
  | "ghost"
  | "bloom"
  | "goo"
  | "bubbles"
  | "petals"
  | "smoke"
  | "ink"
  | "frost"
  | "silk"
  | "animal"
  | "pulse";

export interface EffectLookPreviewModel {
  motif: EffectLookMotif;
  variant: string;
  colors: string[];
  /** 0-1 - how much of it there is (rate, intensity, brightness). */
  energy: number;
  /** 0-1 - how far it reaches (spread, radius, thickness). */
  extent: number;
  /** 0-1 - how big each individual mark is (size, grain, scale). */
  grain: number;
  /** 0-1 - how hard it falls (gravity, weight). 0 for effects with no gravity. */
  fall: number;
  trait: string;
  signature: string;
}

const RAINBOW = ["#ef4444", "#f59e0b", "#22c55e", "#06b6d4", "#8b5cf6"];

const MOTIFS: Record<string, EffectLookMotif> = {
  trails: "trail",
  fire: "fire",
  led: "led",
  charcoal: "embers",
  zap: "zap",
  sparkles: "sparkles",
  ghost: "ghost",
  bloom: "bloom",
  goo: "goo",
  bubbles: "bubbles",
  petals: "petals",
  smoke: "smoke",
  ink: "ink",
  frost: "frost",
  silk: "silk",
  animal: "animal",
  pulse: "pulse",
};

function patchRecord(preset: EffectPreset): Record<string, unknown> {
  return (preset.patch ?? {}) as Record<string, unknown>;
}

function numberAt(
  patch: Record<string, unknown>,
  fields: string[],
  fallback: number
): number {
  for (const field of fields) {
    const value = patch[field];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return fallback;
}

function stringAt(
  patch: Record<string, unknown>,
  fields: string[],
  fallback: string
): string {
  for (const field of fields) {
    const value = patch[field];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeMetric(value: number): number {
  if (value <= 1) return clamp01(value);
  return clamp01(value / (value + 12));
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function percent(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function previewColors(
  preset: EffectPreset,
  patch: Record<string, unknown>
): string[] {
  if (preset.previewColor === "rainbow") return RAINBOW;

  const found: string[] = [];
  const add = (value: unknown) => {
    if (
      typeof value === "string" &&
      /^#[\da-f]{3,8}$/i.test(value) &&
      !found.includes(value)
    ) {
      found.push(value);
    }
  };

  add(preset.previewColor);
  add(preset.previewColor2);
  add(patch.color);
  add(patch.leftColor);
  add(patch.rightColor);
  add(patch.blueColor);
  add(patch.redColor);

  if (Array.isArray(patch.palette)) patch.palette.forEach(add);
  return found.length > 0 ? found.slice(0, 5) : ["#94a3b8", "#e2e8f0"];
}

function bloomVariant(patch: Record<string, unknown>): string {
  if (numberAt(patch, ["spikes"], 0) > 0.05) return "starburst";
  if (numberAt(patch, ["streak"], 0) > 0.05) return "comet";
  return "halo";
}

/**
 * LED presets are identified by their strip pattern, so the legacy preview
 * model keys off the generator id (or "image" for an uploaded pattern).
 */
function ledVariant(patch: Record<string, unknown>): string {
  const pattern = patch.pattern as
    | { source?: string; generatorId?: string }
    | undefined;
  if (pattern?.source === "image") return "image";
  return pattern?.generatorId ?? "glow";
}

function variantFor(
  effectType: string,
  patch: Record<string, unknown>
): string {
  switch (effectType) {
    case "trails":
      return patch.rainbow === true ? "rainbow" : "ribbon";
    case "led":
      return ledVariant(patch);
    case "zap":
      return stringAt(patch, ["style"], "branching");
    case "sparkles":
      return stringAt(patch, ["mode"], "stream");
    case "bloom":
      return bloomVariant(patch);
    case "ink":
    case "goo":
    case "bubbles":
    case "petals":
    case "smoke":
    case "frost":
    case "silk":
      return stringAt(patch, ["palette"], "classic");
    case "animal":
      return stringAt(patch, ["creature"], "snake");
    case "pulse":
      return stringAt(patch, ["trigger"], "beat");
    default:
      return "classic";
  }
}

function traitFor(
  effectType: string,
  patch: Record<string, unknown>,
  variant: string
): string {
  switch (effectType) {
    case "trails": {
      const thickness = numberAt(patch, ["thickness"], 4);
      return `${variant === "rainbow" ? "Spectrum" : "Dual color"} · ${thickness}px path`;
    }
    case "fire":
      return `Live flame · ${percent(numberAt(patch, ["intensity"], 0.75))} intensity`;
    case "led": {
      const device = patch.device as { kind?: string; ledCount?: number } | undefined;
      const deviceLabel =
        device?.kind === "pixel-staff"
          ? `${device.ledCount ?? 200} LEDs`
          : "Capsule";
      return `${deviceLabel} · ${titleCase(variant.replace(/-/g, " "))}`;
    }
    case "charcoal":
      return `Ember field · ${percent(numberAt(patch, ["spread"], 0.5))} spread`;
    case "zap": {
      const frequency = numberAt(patch, ["frequency"], 10);
      return `${titleCase(variant)} · ${frequency} strikes/s`;
    }
    case "sparkles": {
      const lifetime = numberAt(patch, ["lifetime"], 1);
      return `${titleCase(variant)} · ${lifetime.toFixed(1)}s hang`;
    }
    case "ghost": {
      const decay = numberAt(patch, ["decay"], 4);
      return `Afterimage · ${decay.toFixed(1)}s persistence`;
    }
    case "bloom": {
      const radius = numberAt(patch, ["radius"], 48);
      return `${titleCase(variant)} · ${Math.round(radius)}px glow`;
    }
    case "goo":
      return `${titleCase(variant)} · ${percent(numberAt(patch, ["motionEmission"], 0.65))} motion`;
    case "bubbles":
      return `${titleCase(variant)} · ${percent(numberAt(patch, ["buoyancy", "motionEmission"], 0.6))} rise`;
    case "petals":
      return `${titleCase(variant)} · ${percent(numberAt(patch, ["carry", "motionEmission"], 0.6))} carry`;
    case "smoke":
      return `${titleCase(variant)} · ${percent(numberAt(patch, ["curlStrength", "motionEmission"], 0.6))} curl`;
    case "ink":
      return `${titleCase(variant)} · ${percent(numberAt(patch, ["splatterIntensity"], 0.4))} splatter`;
    case "frost":
      return `${titleCase(variant)} · ${percent(numberAt(patch, ["crystallinity"], 0.55))} crystals`;
    case "silk":
      return `${titleCase(variant)} · ${percent(numberAt(patch, ["flutter"], 0.5))} flutter`;
    case "animal":
      return `${titleCase(variant)} · ${percent(numberAt(patch, ["slither"], 0.55))} movement`;
    case "pulse":
      return `${titleCase(variant)} trigger · ${percent(numberAt(patch, ["reach"], 0.65))} reach`;
    default:
      return "Ready to apply";
  }
}

// ── Sparkle field ────────────────────────────────────────────────────────
//
// The sparkles motif can't be a fixed row of diamonds: five presets that differ
// in density, glint size, fall and spawn mode all rendered identically apart
// from hue, which made the picker useless for choosing between them. These
// helpers lay out a field that actually derives from the preset, so Glitter
// reads as fine dust hugging the path and Aurora as a handful of big slow
// glints - the same difference you see on the canvas.

/** The swept tip path the field hangs off, in the 120x56 preview viewBox. */
export const SPARKLE_ARC = { x0: 8, y0: 46, cx: 58, cy: 4, x1: 114, y1: 12 };
export const SPARKLE_ARC_PATH = `M${SPARKLE_ARC.x0} ${SPARKLE_ARC.y0} Q${SPARKLE_ARC.cx} ${SPARKLE_ARC.cy} ${SPARKLE_ARC.x1} ${SPARKLE_ARC.y1}`;

export interface SparkleGlint {
  x: number;
  y: number;
  /** Arm half-length in viewBox units. */
  r: number;
  /** Index into the model's colors. */
  ci: number;
  /** Degrees. */
  rot: number;
  opacity: number;
}

/** Deterministic PRNG - the field must be stable across re-renders. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Point on the arc at parameter t. */
function arcAt(t: number): { x: number; y: number } {
  const u = 1 - t;
  const { x0, y0, cx, cy, x1, y1 } = SPARKLE_ARC;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
  };
}

export function createSparkleField(model: EffectLookPreviewModel): SparkleGlint[] {
  const rand = mulberry32(hashString(model.signature));
  const count = 4 + Math.round(model.energy * 16);
  const arm = 1.1 + model.grain * 7;
  const scatter = 3 + model.extent * 10;
  const drop = model.fall * 18;
  const burst = model.variant === "burst";
  const trail = model.variant === "trail";
  // Trail spawns along the path itself, so it stays tight to the arc; burst
  // pops in clumps; stream spreads out as it drifts.
  const cling = trail ? 0.45 : 1;

  const glints: SparkleGlint[] = [];
  for (let i = 0; i < count; i++) {
    const t = burst
      ? [0.18, 0.52, 0.84][i % 3]! + (rand() - 0.5) * 0.16
      : (i + 0.5) / count + (rand() - 0.5) * (0.7 / count);
    const base = arcAt(Math.max(0, Math.min(1, t)));
    // Age drives both how far it has drifted and how far it has faded.
    const age = rand();
    glints.push({
      x: base.x + (rand() - 0.5) * scatter * cling * (burst ? 1.5 : 1),
      y: base.y + (rand() - 0.5) * scatter * 0.7 * cling + drop * age,
      r: arm * (0.6 + rand() * 0.8),
      ci: i % Math.max(1, model.colors.length),
      rot: rand() * 90,
      opacity: 0.45 + (1 - age) * 0.55,
    });
  }
  return glints;
}

export function createEffectLookPreview(
  effectType: string,
  preset: EffectPreset
): EffectLookPreviewModel {
  const patch = patchRecord(preset);
  const motif = MOTIFS[effectType] ?? "trail";
  const variant = variantFor(effectType, patch);
  const colors = previewColors(preset, patch);
  const energy = normalizeMetric(
    numberAt(
      patch,
      ["intensity", "brightness", "rate", "motionEmission", "glow"],
      0.65
    )
  );
  const extent = normalizeMetric(
    numberAt(patch, ["spread", "radius", "width", "thickness", "reach"], 0.55)
  );
  const grain = clamp01(numberAt(patch, ["size", "grain", "scale"], 0.4));
  const fall = clamp01(numberAt(patch, ["gravity", "weight"], 0));
  const trait = traitFor(effectType, patch, variant);
  const signature = JSON.stringify({
    motif,
    variant,
    colors,
    energy,
    extent,
    grain,
    fall,
    trait,
  });

  return { motif, variant, colors, energy, extent, grain, fall, trait, signature };
}
