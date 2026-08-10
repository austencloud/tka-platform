/**
 * Background Lab Settings Types
 *
 * Defines the persisted settings for each background lab in the Background Builder.
 * These are stored in AppSettings and synced via localStorage/Firebase.
 */

import type { QualityLevel } from "@austencloud/backgrounds";

// ============================================================================
// Cosmic Lab
// ============================================================================

export interface CosmicLabLayers {
  stars: boolean;
  nebula: boolean;
  aurora: boolean;
  milkyWay: boolean;
  meteors: boolean;
  comets: boolean;
  ufo: boolean; // Easter egg - intelligent UFO
}

export type CosmicDensityPreset = "sparse" | "normal" | "dense" | "ultra";
export type CosmicLabMode = "default" | "ufoLab";

export interface CosmicLabSettings {
  quality: QualityLevel;
  layers: CosmicLabLayers;
  densityPreset: CosmicDensityPreset;
  mode: CosmicLabMode;
}

// ============================================================================
// Forest Lab
// ============================================================================

export interface ForestLabLayers {
  gradient: boolean;
  stars: boolean;
  moon: boolean;
  shootingStars: boolean;
  trees: boolean;
  grass: boolean;
  ambientParticles: boolean;
  campfire: boolean;
  fireflies: boolean;
}

export interface ForestTreeTypes {
  pine: boolean;
  fir: boolean;
  spruce: boolean;
  oak: boolean;
  maple: boolean;
  poplar: boolean;
  willow: boolean;
  dead: boolean;
}

export interface ForestLabSettings {
  quality: QualityLevel;
  layers: ForestLabLayers;
  treeTypes: ForestTreeTypes;
}

// ============================================================================
// Blossom Lab
// ============================================================================

export type BlossomTimeOfDay = "twilight" | "goldenHour" | "night";

export interface BlossomLabLayers {
  gradient: boolean;
  petals: boolean;
  petalsFar: boolean;
  petalsMid: boolean;
  petalsNear: boolean;
  trails: boolean;
  accumulation: boolean;
  vortex: boolean;
  moon: boolean;
  stars: boolean;
  trees: boolean;
  lanterns: boolean;
  reflection: boolean;
}

export type BlossomDensityPreset = "sparse" | "normal" | "dense" | "ultra";
export type BlossomWindPreset = "calm" | "gentle" | "breezy" | "gusty";

export interface BlossomLabSettings {
  quality: QualityLevel;
  timeOfDay: BlossomTimeOfDay;
  layers: BlossomLabLayers;
  densityPreset: BlossomDensityPreset;
  windPreset: BlossomWindPreset;
}

// ============================================================================
// Rainbow Lab
// ============================================================================

export type RainbowPaletteOption =
  | "classic"
  | "progress"
  | "trans"
  | "bisexual"
  | "pansexual"
  | "nonbinary"
  | "lesbian"
  | "asexual"
  | "gay";

export interface RainbowLabLayers {
  gradient: boolean;
  bands: boolean;
  shimmer: boolean;
  bokeh: boolean;
  sparkles: boolean;
  hearts: boolean;
}

export interface RainbowLabSettings {
  quality: QualityLevel;
  palette: RainbowPaletteOption;
  layers: RainbowLabLayers;
}

// ============================================================================
// Ocean Lab
// ============================================================================

export interface OceanLabLayers {
  gradient: boolean;
  lightRays: boolean;
  caustics: boolean;
  particles: boolean;
  bubbles: boolean;
  fish: boolean;
  jellyfish: boolean;
  coral: boolean;
}

export interface OceanLabSettings {
  quality: QualityLevel;
  layers: OceanLabLayers;
}

export const DEFAULT_OCEAN_SETTINGS: OceanLabSettings = {
  quality: "high",
  layers: {
    gradient: true,
    lightRays: true,
    caustics: true,
    particles: true,
    bubbles: true,
    fish: true,
    jellyfish: true,
    coral: true,
  },
};

// ============================================================================
// Combined Lab Settings
// ============================================================================

export interface BackgroundLabSettings {
  cosmic?: CosmicLabSettings;
  forest?: ForestLabSettings;
  blossom?: BlossomLabSettings;
  rainbow?: RainbowLabSettings;
  ember?: EmberLabSettings;
  ocean?: OceanLabSettings;
  celestial?: CelestialLabSettings;
  void?: VoidLabSettings;
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_COSMIC_SETTINGS: CosmicLabSettings = {
  quality: "high",
  layers: {
    stars: true,
    nebula: true,
    aurora: true,
    milkyWay: true,
    meteors: true,
    comets: true,
    ufo: false, // Easter egg - off by default
  },
  densityPreset: "normal",
  mode: "default",
};

export const DEFAULT_FOREST_SETTINGS: ForestLabSettings = {
  quality: "high",
  layers: {
    gradient: true,
    stars: true,
    moon: true,
    shootingStars: true,
    trees: true,
    grass: true,
    ambientParticles: true,
    campfire: false, // Off by default - optional cozy element
    fireflies: true,
  },
  treeTypes: {
    pine: true,
    fir: true,
    spruce: true,
    oak: true,
    maple: true,
    poplar: true,
    willow: false,
    dead: false,
  },
};

export const DEFAULT_BLOSSOM_SETTINGS: BlossomLabSettings = {
  quality: "high",
  timeOfDay: "twilight",
  layers: {
    gradient: true,
    petals: true,
    petalsFar: true,
    petalsMid: true,
    petalsNear: true,
    trails: false,
    accumulation: false,
    vortex: false,
    moon: false,
    stars: false,
    trees: false,
    lanterns: false,
    reflection: false,
  },
  densityPreset: "normal",
  windPreset: "gentle",
};

export const DEFAULT_RAINBOW_SETTINGS: RainbowLabSettings = {
  quality: "high",
  palette: "classic",
  layers: {
    gradient: true,
    bands: true,
    shimmer: true,
    bokeh: true,
    sparkles: true,
    hearts: true,
  },
};

// ============================================================================
// Ember Lab
// ============================================================================

export interface EmberLabLayers {
  gradient: boolean;
  coalBed: boolean; // A+ - glowing heat source at bottom
  smoke: boolean;
  embers: boolean;
  sparks: boolean;
  // Enhancement layers
  vignette: boolean;
  bottomGlow: boolean;
  sparkTrails: boolean;
  breathing: boolean;
}

export type EmberHeatIntensity = "smolder" | "warm" | "hot" | "blazing";
export type EmberDensityPreset = "sparse" | "normal" | "dense" | "inferno";

export interface EmberLabSettings {
  quality: QualityLevel;
  layers: EmberLabLayers;
  heatIntensity: EmberHeatIntensity;
  densityPreset: EmberDensityPreset;
}

export const DEFAULT_EMBER_SETTINGS: EmberLabSettings = {
  quality: "high",
  layers: {
    gradient: true,
    coalBed: true, // A+ - on by default, grounds the scene
    smoke: true,
    embers: true,
    sparks: true,
    // Enhancements off by default so user can try them
    vignette: false,
    bottomGlow: false,
    sparkTrails: false,
    breathing: false,
  },
  heatIntensity: "warm",
  densityPreset: "normal",
};

// ============================================================================
// Celestial Lab
// ============================================================================

export interface CelestialLabLayers {
  clouds: boolean;
  sunGlow: boolean;
  atmosphere: boolean;
  vignette: boolean;
}

export interface CelestialLabSettings {
  quality: QualityLevel;
  layers: CelestialLabLayers;
}

export const DEFAULT_CELESTIAL_LAB_SETTINGS: CelestialLabSettings = {
  quality: "high",
  layers: {
    clouds: true,
    sunGlow: true,
    atmosphere: true,
    vignette: true,
  },
};

// ============================================================================
// Void Lab
// ============================================================================

export interface VoidLabLayers {
  grid: boolean;
  vignette: boolean;
}

export interface VoidLabSettings {
  quality: QualityLevel;
  layers: VoidLabLayers;
  gridOpacity: number;
  gridSpacing: number;
}

export const DEFAULT_VOID_LAB_SETTINGS: VoidLabSettings = {
  quality: "high",
  layers: {
    grid: false,
    vignette: false,
  },
  gridOpacity: 0.15,
  gridSpacing: 40,
};
