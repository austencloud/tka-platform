/**
 * Background Lab Settings Types
 *
 * Defines the persisted settings for each background lab in the Background Builder.
 * These are stored in AppSettings and synced via localStorage/Firebase.
 */

import type { QualityLevel } from "@austencloud/backgrounds";

// ============================================================================
// Night Sky Lab
// ============================================================================

export interface NightSkyLabLayers {
  stars: boolean;
  nebula: boolean;
  aurora: boolean;
  milkyWay: boolean;
  meteors: boolean;
  comets: boolean;
  ufo: boolean; // Easter egg - intelligent UFO
}

export type NightSkyDensityPreset = "sparse" | "normal" | "dense" | "ultra";
export type NightSkyLabMode = "default" | "ufoLab";

export interface NightSkyLabSettings {
  quality: QualityLevel;
  layers: NightSkyLabLayers;
  densityPreset: NightSkyDensityPreset;
  mode: NightSkyLabMode;
}

// ============================================================================
// Firefly Forest Lab
// ============================================================================

export interface FireflyForestLabLayers {
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

export interface FireflyForestTreeTypes {
  pine: boolean;
  fir: boolean;
  spruce: boolean;
  oak: boolean;
  maple: boolean;
  poplar: boolean;
  willow: boolean;
  dead: boolean;
}

export interface FireflyForestLabSettings {
  quality: QualityLevel;
  layers: FireflyForestLabLayers;
  treeTypes: FireflyForestTreeTypes;
}

// ============================================================================
// Cherry Blossom Lab
// ============================================================================

export type CherryBlossomTimeOfDay = "twilight" | "goldenHour" | "night";

export interface CherryBlossomLabLayers {
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

export type CherryBlossomDensityPreset = "sparse" | "normal" | "dense" | "ultra";
export type CherryBlossomWindPreset = "calm" | "gentle" | "breezy" | "gusty";

export interface CherryBlossomLabSettings {
  quality: QualityLevel;
  timeOfDay: CherryBlossomTimeOfDay;
  layers: CherryBlossomLabLayers;
  densityPreset: CherryBlossomDensityPreset;
  windPreset: CherryBlossomWindPreset;
}

// ============================================================================
// Rainbow Lab
// ============================================================================

export type RainbowPridePalette =
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
  palette: RainbowPridePalette;
  layers: RainbowLabLayers;
}

// ============================================================================
// Deep Ocean Lab
// ============================================================================

export interface DeepOceanLabLayers {
  gradient: boolean;
  lightRays: boolean;
  caustics: boolean;
  particles: boolean;
  bubbles: boolean;
  fish: boolean;
  jellyfish: boolean;
  coral: boolean;
}

export interface DeepOceanLabSettings {
  quality: QualityLevel;
  layers: DeepOceanLabLayers;
}

export const DEFAULT_DEEP_OCEAN_SETTINGS: DeepOceanLabSettings = {
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
  nightSky?: NightSkyLabSettings;
  fireflyForest?: FireflyForestLabSettings;
  cherryBlossom?: CherryBlossomLabSettings;
  rainbow?: RainbowLabSettings;
  emberGlow?: EmberGlowLabSettings;
  deepOcean?: DeepOceanLabSettings;
  celestial?: CelestialLabSettings;
  pureBlack?: PureBlackLabSettings;
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_NIGHT_SKY_SETTINGS: NightSkyLabSettings = {
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

export const DEFAULT_FIREFLY_FOREST_SETTINGS: FireflyForestLabSettings = {
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

export const DEFAULT_CHERRY_BLOSSOM_SETTINGS: CherryBlossomLabSettings = {
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
// Ember Glow Lab
// ============================================================================

export interface EmberGlowLabLayers {
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

export type EmberGlowHeatIntensity = "smolder" | "warm" | "hot" | "blazing";
export type EmberGlowDensityPreset = "sparse" | "normal" | "dense" | "inferno";

export interface EmberGlowLabSettings {
  quality: QualityLevel;
  layers: EmberGlowLabLayers;
  heatIntensity: EmberGlowHeatIntensity;
  densityPreset: EmberGlowDensityPreset;
}

export const DEFAULT_EMBER_GLOW_SETTINGS: EmberGlowLabSettings = {
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
  godRays: boolean;
  islands: boolean;
  pillars: boolean;
}

export interface CelestialLabSettings {
  quality: QualityLevel;
  layers: CelestialLabLayers;
}

export const DEFAULT_CELESTIAL_LAB_SETTINGS: CelestialLabSettings = {
  quality: "high",
  layers: {
    clouds: true,
    godRays: true,
    islands: true,
    pillars: false,
  },
};

// ============================================================================
// Pure Black Lab
// ============================================================================

export interface PureBlackLabLayers {
  grid: boolean;
  vignette: boolean;
}

export interface PureBlackLabSettings {
  quality: QualityLevel;
  layers: PureBlackLabLayers;
  gridOpacity: number;
  gridSpacing: number;
}

export const DEFAULT_PURE_BLACK_LAB_SETTINGS: PureBlackLabSettings = {
  quality: "high",
  layers: {
    grid: false,
    vignette: false,
  },
  gridOpacity: 0.15,
  gridSpacing: 40,
};
