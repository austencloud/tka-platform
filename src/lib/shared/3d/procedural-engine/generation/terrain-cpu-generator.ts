import type {
  TerrainComputeConfig,
  GPUChunkResult,
  GPUVegetationData,
} from "./gpu/terrain-compute-types";
import { applyErosion, applyThermalErosion, mulberry32, SeededNoise } from "./seed-generator";
import {
  generateVegetationScatter,
  toLegacyFormat,
  type TerrainSample,
} from "./vegetation-scatter";
import {
  getBiomeType,
  BIOME_CHARACTERISTICS,
  biomeTypeToLegacy,
  DEFAULT_BIOME_CONFIG,
} from "./biome-system";
import { buildTerrainGeometry, addSkirtGeometry } from "./terrain-mesh-builder";

export function generateChunkCPU(
  chunkX: number,
  chunkZ: number,
  resolution: number,
  lod: number,
  config: TerrainComputeConfig,
  noise: SeededNoise,
): GPUChunkResult {
  const { chunkSize } = config;
  const vertexCount = resolution * resolution;
  const originX = chunkX * chunkSize;
  const originZ = chunkZ * chunkSize;
  const step = chunkSize / (resolution - 1);

  const heights = new Float32Array(vertexCount);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  // Generate heights
  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const idx = z * resolution + x;
      const worldX = originX + x * step;
      const worldZ = originZ + z * step;
      heights[idx] = cpuFBM(worldX * config.noise.baseScale, worldZ * config.noise.baseScale, config) * config.noise.heightScale;
    }
  }

  // Apply erosion simulation if enabled
  const erosionConfig = config.erosion;
  if (erosionConfig?.enabled && resolution >= 8) {
    const erosionSeed = config.worldSeed + chunkX * 10000 + chunkZ;
    const rng = mulberry32(erosionSeed);

    applyErosion(heights, resolution, {
      iterations: Math.max(5, Math.floor(erosionConfig.iterations / (lod + 1))),
      erosionStrength: erosionConfig.erosionStrength,
      upliftRate: erosionConfig.upliftRate,
      depositionRate: erosionConfig.depositionRate,
      minSlope: erosionConfig.minSlope,
      rainAmount: erosionConfig.rainAmount,
      evaporationRate: erosionConfig.evaporationRate,
    }, rng);

    applyThermalErosion(heights, resolution, 3, 0.5);
  }

  // Calculate normals
  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const idx = z * resolution + x;
      const current = heights[idx] ?? 0;
      const left = x > 0 ? (heights[z * resolution + (x - 1)] ?? current) : current;
      const right = x < resolution - 1 ? (heights[z * resolution + (x + 1)] ?? current) : current;
      const down = z > 0 ? (heights[(z - 1) * resolution + x] ?? current) : current;
      const up = z < resolution - 1 ? (heights[(z + 1) * resolution + x] ?? current) : current;

      const nx = left - right;
      const ny = step * 2;
      const nz = down - up;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

      normals[idx * 3] = nx / len;
      normals[idx * 3 + 1] = ny / len;
      normals[idx * 3 + 2] = nz / len;
    }
  }

  for (let i = 0; i < vertexCount; i++) {
    const h = heights[i] ?? 0;
    const color = cpuBiomeColor(h, config);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const { vertices, indices } = buildTerrainGeometry(heights, resolution, originX, originZ, chunkSize);

  // Generate blend weights
  const { blendWeights1, blendWeights2 } = generateBlendWeights(heights, normals, resolution, originX, originZ, config);

  // Determine biome
  const biome = getBiomeFromHeight(heights[Math.floor(vertexCount / 2)] ?? 0, config);

  // Generate vegetation
  const vegetation = generateVegetationForChunk(heights, normals, originX, originZ, resolution, biome, lod, config, noise);

  const withSkirts = addSkirtGeometry(
    vertices,
    normals,
    colors,
    blendWeights1,
    blendWeights2,
    indices,
    resolution,
    lod,
    heights,
  );

  return {
    vertices: withSkirts.vertices,
    normals: withSkirts.normals,
    colors: withSkirts.colors,
    indices: withSkirts.indices,
    blendWeights1: withSkirts.blendWeights1,
    blendWeights2: withSkirts.blendWeights2,
    vegetation,
    biome,
    usedGPU: false,
  };
}

function cpuFBM(x: number, z: number, config: TerrainComputeConfig): number {
  const { octaves, lacunarity, persistence } = config.noise;
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    const n = cpuNoise(x * frequency, z * frequency, config.worldSeed);
    value += amplitude * n;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

function cpuNoise(x: number, z: number, worldSeed: number): number {
  const dot = x * 12.9898 + z * 78.233 + worldSeed * 0.0001;
  return Math.sin(dot) * 43758.5453 % 1;
}

function cpuBiomeColor(height: number, config: TerrainComputeConfig): { r: number; g: number; b: number } {
  const { oceanLevel, mountainLevel } = config.biome;

  if (height < oceanLevel) {
    return { r: 0.1, g: 0.3, b: 0.6 };
  }
  if (height > mountainLevel * 1.5) {
    return { r: 0.9, g: 0.9, b: 0.95 };
  }
  if (height > mountainLevel) {
    return { r: 0.6, g: 0.6, b: 0.65 };
  }
  return { r: 0.3, g: 0.5, b: 0.2 };
}

function getBiomeFromHeight(height: number, config: TerrainComputeConfig): string {
  const { oceanLevel, mountainLevel } = config.biome;
  if (height < oceanLevel) return "ocean";
  if (height > mountainLevel) return "mountains";
  return "plains";
}

function generateBlendWeights(
  heights: Float32Array,
  normals: Float32Array,
  resolution: number,
  originX: number,
  originZ: number,
  config: TerrainComputeConfig,
): { blendWeights1: Float32Array; blendWeights2: Float32Array } {
  const vertexCount = resolution * resolution;
  const blendWeights1 = new Float32Array(vertexCount * 3);
  const blendWeights2 = new Float32Array(vertexCount * 3);
  const { chunkSize } = config;
  const step = chunkSize / (resolution - 1);

  const noise = new SeededNoise(config.worldSeed);

  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const i = z * resolution + x;
      const height = heights[i] ?? 0;
      const ny = normals[i * 3 + 1] ?? 1;
      const slope = 1 - ny;

      const worldX = originX + x * step;
      const worldZ = originZ + z * step;

      const biomeType = getBiomeType(noise, worldX, worldZ, height, DEFAULT_BIOME_CONFIG);
      const characteristics = BIOME_CHARACTERISTICS[biomeType];
      let { grass, rock, dirt, sand, snow } = { ...characteristics.blendWeights };

      const ROCK_SLOPE_START = 0.35;
      const ROCK_SLOPE_FULL = 0.75;
      if (slope > ROCK_SLOPE_START) {
        const rockFactor = Math.min(1, (slope - ROCK_SLOPE_START) / (ROCK_SLOPE_FULL - ROCK_SLOPE_START));
        const smoothRock = rockFactor * rockFactor * (3 - 2 * rockFactor);

        const grassLoss = grass * smoothRock * 0.85;
        const dirtLoss = dirt * smoothRock * 0.7;
        const sandLoss = sand * smoothRock * 0.6;

        grass -= grassLoss;
        dirt -= dirtLoss;
        sand -= sandLoss;
        rock += grassLoss + dirtLoss + sandLoss;
      }

      const variationNoise = (noise.fbm(worldX * 0.05, 0, worldZ * 0.05, 3) + 1) * 0.5;
      const variation = (variationNoise - 0.5) * 0.12;

      if (grass > 0.1 && dirt > 0.1) {
        grass += variation;
        dirt -= variation;
      }

      const total = grass + rock + dirt + sand + snow;
      if (total > 0) {
        grass /= total;
        rock /= total;
        dirt /= total;
        sand /= total;
        snow /= total;
      }

      grass = Math.max(0, Math.min(1, grass));
      rock = Math.max(0, Math.min(1, rock));
      dirt = Math.max(0, Math.min(1, dirt));
      sand = Math.max(0, Math.min(1, sand));
      snow = Math.max(0, Math.min(1, snow));

      blendWeights1[i * 3] = grass;
      blendWeights1[i * 3 + 1] = rock;
      blendWeights1[i * 3 + 2] = dirt;

      blendWeights2[i * 3] = sand;
      blendWeights2[i * 3 + 1] = snow;
      blendWeights2[i * 3 + 2] = 0;
    }
  }

  return { blendWeights1, blendWeights2 };
}

function generateVegetationForChunk(
  heights: Float32Array,
  normals: Float32Array,
  originX: number,
  originZ: number,
  resolution: number,
  biome: string,
  lod: number,
  config: TerrainComputeConfig,
  noise: SeededNoise,
): GPUVegetationData[] {
  const { chunkSize, worldSeed } = config;

  const chunkX = Math.round(originX / chunkSize);
  const chunkZ = Math.round(originZ / chunkSize);

  const step = chunkSize / (resolution - 1);
  const sampleTerrain = (worldX: number, worldZ: number): TerrainSample => {
    const localX = worldX - originX;
    const localZ = worldZ - originZ;
    const gx = Math.floor(localX / step);
    const gz = Math.floor(localZ / step);

    const clampedGx = Math.max(0, Math.min(resolution - 1, gx));
    const clampedGz = Math.max(0, Math.min(resolution - 1, gz));
    const idx = clampedGz * resolution + clampedGx;

    const height = heights[idx] ?? 0;
    const normalY = normals[idx * 3 + 1] ?? 1;
    const slope = 1 - Math.abs(normalY);

    const biomeEnum = getBiomeType(noise, worldX, worldZ, height, DEFAULT_BIOME_CONFIG);
    const localBiome = biomeTypeToLegacy(biomeEnum);

    return { height, slope, biome: localBiome };
  };

  const instances = generateVegetationScatter(
    chunkX,
    chunkZ,
    { worldSeed, chunkSize, lod, densityMultiplier: 1.0 },
    sampleTerrain,
  );

  const legacyInstances = toLegacyFormat(instances);

  return legacyInstances.map(inst => ({
    type: mapVegetationType(inst.type),
    x: originX + inst.x,
    y: inst.y,
    z: originZ + inst.z,
    scale: inst.scale,
    rotation: inst.rotation,
  }));
}

function mapVegetationType(
  type: "tree1" | "tree2" | "tree3" | "rock1" | "rock2" | "bush1" | "bush2" | "grass",
): GPUVegetationData["type"] {
  switch (type) {
    case "tree1":
    case "tree2":
    case "tree3":
      return "tree";
    case "rock1":
    case "rock2":
      return "rock";
    case "bush1":
    case "bush2":
      return "bush";
    case "grass":
      return "grass";
    default:
      return "grass";
  }
}
