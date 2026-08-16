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
  energy: number;
  extent: number;
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

function variantFor(
  effectType: string,
  patch: Record<string, unknown>
): string {
  switch (effectType) {
    case "trails":
      return patch.rainbow === true ? "rainbow" : "ribbon";
    case "led":
      return stringAt(patch, ["colorMode", "patternId"], "glow");
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
      const pattern = titleCase(stringAt(patch, ["patternId"], "solid"));
      const brightness = numberAt(patch, ["brightness"], 3);
      return `${pattern} · brightness ${brightness}`;
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
  const trait = traitFor(effectType, patch, variant);
  const signature = JSON.stringify({
    motif,
    variant,
    colors,
    energy,
    extent,
    trait,
  });

  return { motif, variant, colors, energy, extent, trait, signature };
}
