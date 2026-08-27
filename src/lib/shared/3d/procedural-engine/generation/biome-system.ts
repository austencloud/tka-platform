/**
 * Biome System
 *
 * Whittaker-style biome classification based on temperature and precipitation.
 * Creates varied terrain with smooth transitions between biome types.
 *
 * Temperature: Varies with latitude (distance from world origin) and altitude
 * Precipitation: Varies with separate noise patterns
 *
 * The intersection of temperature + precipitation determines biome type,
 * following the Whittaker biome diagram used in ecology.
 */

import type { SeededNoise } from "./seed-generator";


/**
 * All biome types in the world
 *
 * Organized roughly by temperature (hot to cold) and moisture (dry to wet)
 */
export enum BiomeType {
  // Water
  Ocean = "ocean",

  // Coastal
  Beach = "beach",
  RockyShore = "rocky_shore",

  // Hot biomes
  Desert = "desert",
  Savanna = "savanna",
  TropicalForest = "tropical_forest",

  // Temperate biomes
  Grassland = "grassland",
  TemperateForest = "temperate_forest",
  Wetland = "wetland",

  // Cold biomes
  Taiga = "taiga",
  Tundra = "tundra",

  // Mountain biomes
  Mountain = "mountain",
  SnowyMountain = "snowy_mountain",
  AlpineMeadow = "alpine_meadow",
}


export interface BiomeSystemConfig {
  /** Noise scale for temperature (lower = larger regions) */
  temperatureNoiseScale: number;
  /** Noise scale for precipitation (lower = larger regions) */
  precipitationNoiseScale: number;
  /** How much altitude reduces temperature (per meter) */
  altitudeTemperatureReduction: number;
  /** Ocean level (heights below this are underwater) */
  oceanLevel: number;
  /** Beach extends from ocean to ocean + beachWidth */
  beachWidth: number;
  /** Mountain threshold (heights above this) */
  mountainLevel: number;
  /** Snow line (heights above this get snow) */
  snowLine: number;
  /** World scale for latitude simulation (affects temperature gradient) */
  worldScale: number;
}

export const DEFAULT_BIOME_CONFIG: BiomeSystemConfig = {
  temperatureNoiseScale: 0.0015,    // Large-scale temperature regions
  precipitationNoiseScale: 0.002,   // Slightly smaller precipitation regions
  altitudeTemperatureReduction: 0.01, // Temperature drops 0.01 per meter of altitude
  oceanLevel: -10,
  beachWidth: 5,
  mountainLevel: 35,
  snowLine: 45,
  worldScale: 0.0005, // Latitude effect scale
};


/**
 * Characteristics that define how each biome looks and behaves
 */
export interface BiomeCharacteristics {
  /** Base blend weights (grass, rock, dirt, sand, snow) */
  blendWeights: {
    grass: number;
    rock: number;
    dirt: number;
    sand: number;
    snow: number;
  };
  /** Vegetation density multiplier (0-1) */
  vegetationDensity: number;
  /** Allowed vegetation types */
  vegetationTypes: VegetationType[];
  /** Base color tint (multiplied with procedural colors) */
  colorTint: { r: number; g: number; b: number };
  /** Roughness value for PBR materials */
  roughness: number;
}

export type VegetationType =
  | "tree_oak"
  | "tree_pine"
  | "tree_palm"
  | "tree_birch"
  | "bush_green"
  | "bush_dead"
  | "grass_tall"
  | "grass_short"
  | "flower"
  | "cactus"
  | "rock_small"
  | "rock_large"
  | "snow_drift";

/**
 * Characteristics for each biome type
 */
export const BIOME_CHARACTERISTICS: Record<BiomeType, BiomeCharacteristics> = {
  [BiomeType.Ocean]: {
    blendWeights: { grass: 0, rock: 0.1, dirt: 0, sand: 0.9, snow: 0 },
    vegetationDensity: 0,
    vegetationTypes: [],
    colorTint: { r: 0.1, g: 0.3, b: 0.6 },
    roughness: 0.2,
  },
  [BiomeType.Beach]: {
    blendWeights: { grass: 0.1, rock: 0.05, dirt: 0.05, sand: 0.8, snow: 0 },
    vegetationDensity: 0.05,
    vegetationTypes: ["grass_short", "rock_small"],
    colorTint: { r: 0.9, g: 0.85, b: 0.7 },
    roughness: 0.95,
  },
  [BiomeType.RockyShore]: {
    blendWeights: { grass: 0, rock: 0.7, dirt: 0.1, sand: 0.2, snow: 0 },
    vegetationDensity: 0.02,
    vegetationTypes: ["rock_small", "rock_large"],
    colorTint: { r: 0.5, g: 0.5, b: 0.55 },
    roughness: 0.8,
  },
  [BiomeType.Desert]: {
    blendWeights: { grass: 0, rock: 0.15, dirt: 0.05, sand: 0.8, snow: 0 },
    vegetationDensity: 0.03,
    vegetationTypes: ["cactus", "rock_small", "rock_large"],
    colorTint: { r: 0.85, g: 0.75, b: 0.55 },
    roughness: 0.95,
  },
  [BiomeType.Savanna]: {
    blendWeights: { grass: 0.5, rock: 0.1, dirt: 0.35, sand: 0.05, snow: 0 },
    vegetationDensity: 0.15,
    vegetationTypes: ["tree_oak", "grass_tall", "bush_dead", "rock_small"],
    colorTint: { r: 0.6, g: 0.55, b: 0.3 },
    roughness: 0.9,
  },
  [BiomeType.TropicalForest]: {
    blendWeights: { grass: 0.4, rock: 0.05, dirt: 0.5, sand: 0.05, snow: 0 },
    vegetationDensity: 0.9,
    vegetationTypes: ["tree_palm", "tree_oak", "bush_green", "grass_tall", "flower"],
    colorTint: { r: 0.2, g: 0.45, b: 0.15 },
    roughness: 0.85,
  },
  [BiomeType.Grassland]: {
    blendWeights: { grass: 0.75, rock: 0.05, dirt: 0.2, sand: 0, snow: 0 },
    vegetationDensity: 0.4,
    vegetationTypes: ["grass_tall", "grass_short", "flower", "bush_green"],
    colorTint: { r: 0.35, g: 0.55, b: 0.2 },
    roughness: 0.88,
  },
  [BiomeType.TemperateForest]: {
    blendWeights: { grass: 0.5, rock: 0.1, dirt: 0.4, sand: 0, snow: 0 },
    vegetationDensity: 0.7,
    vegetationTypes: ["tree_oak", "tree_birch", "bush_green", "grass_short", "flower", "rock_small"],
    colorTint: { r: 0.25, g: 0.45, b: 0.15 },
    roughness: 0.85,
  },
  [BiomeType.Wetland]: {
    blendWeights: { grass: 0.4, rock: 0.05, dirt: 0.5, sand: 0.05, snow: 0 },
    vegetationDensity: 0.5,
    vegetationTypes: ["grass_tall", "bush_green", "flower"],
    colorTint: { r: 0.2, g: 0.4, b: 0.2 },
    roughness: 0.9,
  },
  [BiomeType.Taiga]: {
    blendWeights: { grass: 0.3, rock: 0.15, dirt: 0.35, sand: 0, snow: 0.2 },
    vegetationDensity: 0.5,
    vegetationTypes: ["tree_pine", "bush_dead", "rock_small", "grass_short"],
    colorTint: { r: 0.2, g: 0.35, b: 0.2 },
    roughness: 0.85,
  },
  [BiomeType.Tundra]: {
    blendWeights: { grass: 0.2, rock: 0.3, dirt: 0.1, sand: 0, snow: 0.4 },
    vegetationDensity: 0.1,
    vegetationTypes: ["grass_short", "rock_small", "bush_dead", "snow_drift"],
    colorTint: { r: 0.5, g: 0.55, b: 0.5 },
    roughness: 0.8,
  },
  [BiomeType.Mountain]: {
    blendWeights: { grass: 0.15, rock: 0.7, dirt: 0.15, sand: 0, snow: 0 },
    vegetationDensity: 0.08,
    vegetationTypes: ["rock_small", "rock_large", "grass_short", "tree_pine"],
    colorTint: { r: 0.5, g: 0.48, b: 0.45 },
    roughness: 0.75,
  },
  [BiomeType.SnowyMountain]: {
    blendWeights: { grass: 0, rock: 0.4, dirt: 0, sand: 0, snow: 0.6 },
    vegetationDensity: 0.02,
    vegetationTypes: ["rock_large", "snow_drift"],
    colorTint: { r: 0.9, g: 0.92, b: 0.98 },
    roughness: 0.5,
  },
  [BiomeType.AlpineMeadow]: {
    blendWeights: { grass: 0.5, rock: 0.25, dirt: 0.1, sand: 0, snow: 0.15 },
    vegetationDensity: 0.25,
    vegetationTypes: ["grass_short", "flower", "rock_small"],
    colorTint: { r: 0.4, g: 0.55, b: 0.35 },
    roughness: 0.85,
  },
};


/**
 * Calculate temperature at a world position
 *
 * Temperature is influenced by:
 * 1. Large-scale noise (continental climate regions)
 * 2. Distance from world origin (simulates latitude - equator is warmer)
 * 3. Altitude (higher = colder)
 *
 * @returns Temperature in range [0, 1] where 0=frozen, 1=tropical
 */
export function calculateTemperature(
  noise: SeededNoise,
  worldX: number,
  worldZ: number,
  height: number,
  config: BiomeSystemConfig = DEFAULT_BIOME_CONFIG
): number {
  // Large-scale temperature noise (continental climate patterns)
  const tempNoise = (noise.fbm(
    worldX * config.temperatureNoiseScale,
    0,
    worldZ * config.temperatureNoiseScale,
    4,
    2.0,
    0.5
  ) + 1) / 2; // Normalize to 0-1

  // Latitude effect: distance from origin creates temperature gradient
  // Closer to origin = warmer (like equator)
  const distFromOrigin = Math.sqrt(worldX * worldX + worldZ * worldZ);
  const latitudeEffect = Math.max(0, 1 - distFromOrigin * config.worldScale);

  // Combine noise with latitude (weighted blend)
  let temperature = tempNoise * 0.6 + latitudeEffect * 0.4;

  // Altitude reduction: higher elevation = colder
  const altitudeReduction = Math.max(0, height) * config.altitudeTemperatureReduction;
  temperature = Math.max(0, temperature - altitudeReduction);

  return Math.min(1, Math.max(0, temperature));
}

/**
 * Calculate precipitation at a world position
 *
 * Precipitation is influenced by:
 * 1. Large-scale noise (rain patterns, rain shadows)
 * 2. Secondary noise for variation
 *
 * @returns Precipitation in range [0, 1] where 0=arid, 1=very wet
 */
export function calculatePrecipitation(
  noise: SeededNoise,
  worldX: number,
  worldZ: number,
  config: BiomeSystemConfig = DEFAULT_BIOME_CONFIG
): number {
  // Primary precipitation noise
  const precipNoise = (noise.fbm(
    worldX * config.precipitationNoiseScale + 500, // Offset to differ from temperature
    0,
    worldZ * config.precipitationNoiseScale + 500,
    4,
    2.0,
    0.5
  ) + 1) / 2;

  // Secondary variation (smaller scale patterns)
  const variation = (noise.fbm(
    worldX * config.precipitationNoiseScale * 3 + 1000,
    0,
    worldZ * config.precipitationNoiseScale * 3 + 1000,
    3,
    2.0,
    0.5
  ) + 1) / 2;

  // Combine with weighted blend
  const precipitation = precipNoise * 0.7 + variation * 0.3;

  return Math.min(1, Math.max(0, precipitation));
}

/**
 * Get biome type using Whittaker-style classification
 *
 * This uses a temperature-precipitation matrix to determine biome:
 *
 * ```
 *          Low Precip   Medium        High Precip
 * Hot      Desert       Savanna       Tropical Forest
 * Warm     Grassland    Temp Forest   Wetland
 * Cool     Grassland    Taiga         Taiga
 * Cold     Tundra       Tundra        Tundra
 * ```
 *
 * Height overrides are applied for:
 * - Ocean (below oceanLevel)
 * - Beach (near oceanLevel)
 * - Mountains (above mountainLevel)
 * - Snow (above snowLine)
 */
export function getBiomeType(
  noise: SeededNoise,
  worldX: number,
  worldZ: number,
  height: number,
  config: BiomeSystemConfig = DEFAULT_BIOME_CONFIG
): BiomeType {
  // Height-based overrides first
  if (height < config.oceanLevel) {
    return BiomeType.Ocean;
  }
  if (height < config.oceanLevel + config.beachWidth) {
    // Determine beach type based on nearby terrain steepness
    const steepness = calculateLocalSteepness(noise, worldX, worldZ, config);
    return steepness > 0.4 ? BiomeType.RockyShore : BiomeType.Beach;
  }
  if (height > config.snowLine) {
    return BiomeType.SnowyMountain;
  }
  if (height > config.mountainLevel) {
    // High elevation - determine mountain sub-type
    const temperature = calculateTemperature(noise, worldX, worldZ, height, config);
    const precipitation = calculatePrecipitation(noise, worldX, worldZ, config);

    if (temperature > 0.4 && precipitation > 0.5) {
      return BiomeType.AlpineMeadow;
    }
    return BiomeType.Mountain;
  }

  // Calculate climate factors
  const temperature = calculateTemperature(noise, worldX, worldZ, height, config);
  const precipitation = calculatePrecipitation(noise, worldX, worldZ, config);

  // Whittaker biome classification
  return whittakerLookup(temperature, precipitation);
}

/**
 * Whittaker diagram lookup
 *
 * Maps temperature and precipitation to biome type
 */
function whittakerLookup(temperature: number, precipitation: number): BiomeType {
  // Hot regions (temp > 0.7)
  if (temperature > 0.7) {
    if (precipitation < 0.25) {
      return BiomeType.Desert;
    }
    if (precipitation < 0.55) {
      return BiomeType.Savanna;
    }
    return BiomeType.TropicalForest;
  }

  // Warm regions (temp 0.45 - 0.7)
  if (temperature > 0.45) {
    if (precipitation < 0.3) {
      return BiomeType.Grassland;
    }
    if (precipitation < 0.7) {
      return BiomeType.TemperateForest;
    }
    return BiomeType.Wetland;
  }

  // Cool regions (temp 0.25 - 0.45)
  if (temperature > 0.25) {
    if (precipitation < 0.35) {
      return BiomeType.Grassland;
    }
    return BiomeType.Taiga;
  }

  // Cold regions (temp < 0.25)
  return BiomeType.Tundra;
}

/**
 * Calculate local terrain steepness for shore classification
 */
function calculateLocalSteepness(
  noise: SeededNoise,
  worldX: number,
  worldZ: number,
  config: BiomeSystemConfig
): number {
  const sampleDist = 5; // meters
  const scale = config.temperatureNoiseScale * 10; // Use similar scale as terrain

  // Sample heights in cardinal directions
  const hCenter = noise.fbm(worldX * scale, 0, worldZ * scale, 4) * 50;
  const hNorth = noise.fbm(worldX * scale, 0, (worldZ + sampleDist) * scale, 4) * 50;
  const hSouth = noise.fbm(worldX * scale, 0, (worldZ - sampleDist) * scale, 4) * 50;
  const hEast = noise.fbm((worldX + sampleDist) * scale, 0, worldZ * scale, 4) * 50;
  const hWest = noise.fbm((worldX - sampleDist) * scale, 0, worldZ * scale, 4) * 50;

  // Calculate max height difference
  const maxDiff = Math.max(
    Math.abs(hCenter - hNorth),
    Math.abs(hCenter - hSouth),
    Math.abs(hCenter - hEast),
    Math.abs(hCenter - hWest)
  );

  // Normalize to 0-1 range (assuming max reasonable slope)
  return Math.min(1, maxDiff / 10);
}


/**
 * Get blend weights for a position, smoothly transitioning between biomes
 *
 * This samples multiple nearby positions and blends their characteristics
 * for smooth biome boundaries (no hard edges).
 */
export function getBlendedBiomeWeights(
  noise: SeededNoise,
  worldX: number,
  worldZ: number,
  height: number,
  config: BiomeSystemConfig = DEFAULT_BIOME_CONFIG
): { grass: number; rock: number; dirt: number; sand: number; snow: number } {
  // Get primary biome
  const biome = getBiomeType(noise, worldX, worldZ, height, config);
  const characteristics = BIOME_CHARACTERISTICS[biome];

  // Start with primary biome weights
  const weights = { ...characteristics.blendWeights };

  // Add noise variation for natural look
  const variation = (noise.fbm(worldX * 0.05, 0, worldZ * 0.05, 3) + 1) / 2;
  const variationAmount = 0.15;

  // Subtle variation to grass/dirt balance
  if (weights.grass > 0.1 && weights.dirt > 0.1) {
    const shift = (variation - 0.5) * variationAmount;
    weights.grass = Math.max(0, weights.grass + shift);
    weights.dirt = Math.max(0, weights.dirt - shift);
  }

  // Normalize weights
  const total = weights.grass + weights.rock + weights.dirt + weights.sand + weights.snow;
  if (total > 0) {
    weights.grass /= total;
    weights.rock /= total;
    weights.dirt /= total;
    weights.sand /= total;
    weights.snow /= total;
  }

  return weights;
}

export function getBiomeVegetationDensity(biome: BiomeType): number {
  return BIOME_CHARACTERISTICS[biome].vegetationDensity;
}

export function getBiomeVegetationTypes(biome: BiomeType): VegetationType[] {
  return BIOME_CHARACTERISTICS[biome].vegetationTypes;
}

export function getBiomeColorTint(biome: BiomeType): { r: number; g: number; b: number } {
  return BIOME_CHARACTERISTICS[biome].colorTint;
}


/**
 * Convert new BiomeType to legacy biome string for backward compatibility
 */
export function biomeTypeToLegacy(biome: BiomeType): "ocean" | "plains" | "forest" | "mountains" | "desert" {
  switch (biome) {
    case BiomeType.Ocean:
      return "ocean";

    case BiomeType.Desert:
    case BiomeType.Beach:
    case BiomeType.RockyShore:
    case BiomeType.Savanna:
      return "desert";

    case BiomeType.TropicalForest:
    case BiomeType.TemperateForest:
    case BiomeType.Taiga:
    case BiomeType.Wetland:
      return "forest";

    case BiomeType.Mountain:
    case BiomeType.SnowyMountain:
    case BiomeType.AlpineMeadow:
      return "mountains";

    case BiomeType.Grassland:
    case BiomeType.Tundra:
    default:
      return "plains";
  }
}


export function getBiomeColor(biome: string, height: number): { r: number; g: number; b: number } {
  const heightFactor = Math.min(1, Math.max(0, height / 50));

  switch (biome) {
    case "ocean":
      return { r: 0.1, g: 0.3, b: 0.6 };
    case "plains":
      return {
        r: 0.3 + heightFactor * 0.2,
        g: 0.5 + heightFactor * 0.1,
        b: 0.2,
      };
    case "forest":
      return {
        r: 0.1,
        g: 0.4 - heightFactor * 0.1,
        b: 0.15,
      };
    case "mountains": {
      const snow = heightFactor > 0.8;
      return snow
        ? { r: 0.9, g: 0.9, b: 0.95 }
        : { r: 0.4 + heightFactor * 0.3, g: 0.35 + heightFactor * 0.3, b: 0.3 + heightFactor * 0.3 };
    }
    case "desert":
      return {
        r: 0.8,
        g: 0.7,
        b: 0.4,
      };
    default:
      return { r: 0.5, g: 0.5, b: 0.5 };
  }
}

export function getCampgroundColor(height: number): { r: number; g: number; b: number } {
  const heightFactor = Math.min(1, Math.max(0, height / 40));
  return {
    r: 0.25 + heightFactor * 0.15,
    g: 0.45 - heightFactor * 0.05,
    b: 0.15 + heightFactor * 0.05,
  };
}

export function getClearingGrassColor(height: number, waterLevel: number): { r: number; g: number; b: number } {
  const heightAboveWater = height - waterLevel;
  const heightFactor = Math.min(1, Math.max(0, heightAboveWater / 10));
  return {
    r: 0.2 + heightFactor * 0.1,
    g: 0.55 - heightFactor * 0.05,
    b: 0.15,
  };
}
