export type PatternCategory =
  | "solid"
  | "breathe"
  | "chase"
  | "spectrum"
  | "texture"
  | "tka-aware";

export interface LedPatternDescriptor {
  id: string;
  name: string;
  category: PatternCategory;
  requiresTipContext: boolean;
  usesSecondaryColor: boolean;
  sortOrder: number;
}

export const PATTERN_DESCRIPTORS: readonly LedPatternDescriptor[] = [
  // Solid & Static
  { id: "solid", name: "Solid", category: "solid", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 0 },
  { id: "split", name: "Split", category: "solid", requiresTipContext: false, usesSecondaryColor: true, sortOrder: 1 },
  { id: "quad", name: "Quad", category: "solid", requiresTipContext: false, usesSecondaryColor: true, sortOrder: 2 },
  // Breathing & Fades
  { id: "breathe", name: "Breathe", category: "breathe", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 0 },
  { id: "pulse", name: "Pulse", category: "breathe", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 1 },
  { id: "heartbeat", name: "Heartbeat", category: "breathe", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 2 },
  { id: "color-morph", name: "Color Morph", category: "breathe", requiresTipContext: false, usesSecondaryColor: true, sortOrder: 3 },
  // Motion & Chase
  { id: "chase", name: "Chase", category: "chase", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 0 },
  { id: "comet", name: "Comet", category: "chase", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 1 },
  { id: "wave", name: "Wave", category: "chase", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 2 },
  { id: "cascade", name: "Cascade", category: "chase", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 3 },
  // Spectrum & Color
  { id: "rainbow", name: "Rainbow", category: "spectrum", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 0 },
  { id: "warm-shift", name: "Warm Shift", category: "spectrum", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 1 },
  { id: "cool-shift", name: "Cool Shift", category: "spectrum", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 2 },
  { id: "neon", name: "Neon", category: "spectrum", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 3 },
  // Texture & Organic
  { id: "sparkle", name: "Sparkle", category: "texture", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 0 },
  { id: "flicker", name: "Flicker", category: "texture", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 1 },
  { id: "aurora", name: "Aurora", category: "texture", requiresTipContext: false, usesSecondaryColor: false, sortOrder: 2 },
  // TKA-Aware
  { id: "proximity", name: "Proximity", category: "tka-aware", requiresTipContext: true, usesSecondaryColor: false, sortOrder: 0 },
  { id: "velocity", name: "Velocity", category: "tka-aware", requiresTipContext: true, usesSecondaryColor: false, sortOrder: 1 },
  { id: "mirror-sync", name: "Mirror Sync", category: "tka-aware", requiresTipContext: true, usesSecondaryColor: false, sortOrder: 2 },
  { id: "beat-pulse", name: "Beat Pulse", category: "tka-aware", requiresTipContext: true, usesSecondaryColor: false, sortOrder: 3 },
];

export const CATEGORY_LABELS: Record<PatternCategory, string> = {
  solid: "Solid & Static",
  breathe: "Breathing & Fades",
  chase: "Motion & Chase",
  spectrum: "Spectrum & Color",
  texture: "Texture & Organic",
  "tka-aware": "TKA-Aware",
};

export function getPatternDescriptor(id: string): LedPatternDescriptor | undefined {
  return PATTERN_DESCRIPTORS.find((p) => p.id === id);
}

export function getPatternsByCategory(category: PatternCategory): LedPatternDescriptor[] {
  return PATTERN_DESCRIPTORS.filter((p) => p.category === category);
}
