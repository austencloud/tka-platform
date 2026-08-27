import {
  SeededNoise,
  createChunkRNG,
  getTerrainHeight,
  getBiome,
  applyErosion,
  applyThermalErosion,
  mulberry32,
} from "../generation/seed-generator";
import {
  type RealTerrainZone,
  deserializeZoneInWorker,
  getBlendedHeight,
  chunkIntersectsZone,
  isPointInPolygon,
} from "../generation/real-terrain-zone";
import {
  getBiomeType,
  BIOME_CHARACTERISTICS,
  DEFAULT_BIOME_CONFIG,
  getBiomeColor,
  getCampgroundColor,
  getClearingGrassColor,
} from "../generation/biome-system";
import { calculateDrainage } from "../generation/drainage-calculator";
import type { DrainageConfig, DrainageData } from "../generation/gpu/terrain-compute-types";
import { DEFAULT_DRAINAGE_CONFIG } from "../generation/gpu/terrain-compute-types";
import {
  generateVegetationScatter,
  toLegacyFormat,
  type TerrainSample,
} from "../generation/vegetation-scatter";
import { generateSkirtVertices, generateSkirtIndices, calculateSkirtDepth } from "../generation/skirt-geometry";
import type {
  GenerateChunkMessage,
  ChunkResultMessage,
  RealZoneLoadedMessage,
  VegetationData,
  WorkerMessage,
} from "./chunk-worker-messages";

export type {
  WorkerErosionConfig,
  GenerateChunkMessage,
  LoadRealZoneMessage,
  ClearRealZoneMessage,
  RealZoneLoadedMessage,
  ChunkResultMessage,
  VegetationData,
  SetStageZoneMessage,
  ClearStageZoneMessage,
  SetSpawnClearingMessage,
  ClearSpawnClearingMessage,
  WorkerMessage,
  WorkerResponse,
} from "./chunk-worker-messages";

const drainageConfig: DrainageConfig = {
  ...DEFAULT_DRAINAGE_CONFIG,
  enabled: true,
  minPoolSize: 50,
  drainageThreshold: 0.3,
  heightTolerance: 8,
};

let realTerrainZone: RealTerrainZone | null = null;

let stageZone: {
  center: { x: number; z: number };
  radius: number;
  blendWidth: number;
} | null = null;

let spawnClearing: {
  center: { x: number; z: number };
  radius: number;
  blendWidth: number;
  waterLevel: number;
  campground: {
    enabled: boolean;
    firePit: boolean;
    tent: boolean;
    seatingLogs: number;
    torches: number;
  };
} | null = null;


function generateChunk(msg: GenerateChunkMessage): ChunkResultMessage {
  const { chunkX, chunkY, chunkZ, worldSeed, chunkSize, resolution, lod, erosion } = msg;

  const effectiveResolution = Math.max(4, Math.floor(resolution / Math.pow(2, lod)));

  const noise = new SeededNoise(worldSeed);
  const rng = createChunkRNG(worldSeed, chunkX, chunkY, chunkZ); // eslint-disable-line @typescript-eslint/no-unused-vars

  const originX = Math.round(chunkX * chunkSize);
  const originZ = Math.round(chunkZ * chunkSize);

  const vertexCount = effectiveResolution * effectiveResolution;
  const vertices = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const blendWeights1 = new Float32Array(vertexCount * 3);
  const blendWeights2 = new Float32Array(vertexCount * 3);

  const step = chunkSize / (effectiveResolution - 1);

  const usesRealTerrain = realTerrainZone
    ? chunkIntersectsZone(realTerrainZone, chunkX, chunkZ, chunkSize, 30)
    : false;

  // First pass: generate vertices
  for (let z = 0; z < effectiveResolution; z++) {
    for (let x = 0; x < effectiveResolution; x++) {
      const idx = (z * effectiveResolution + x) * 3;

      let worldX: number;
      let worldZ: number;

      if (x === 0) {
        worldX = originX;
      } else if (x === effectiveResolution - 1) {
        worldX = originX + chunkSize;
      } else {
        worldX = originX + x * step;
      }

      if (z === 0) {
        worldZ = originZ;
      } else if (z === effectiveResolution - 1) {
        worldZ = originZ + chunkSize;
      } else {
        worldZ = originZ + z * step;
      }

      const proceduralHeight = getTerrainHeight(noise, worldX, worldZ);

      let height = usesRealTerrain
        ? getBlendedHeight(realTerrainZone, worldX, worldZ, proceduralHeight, 30)
        : proceduralHeight;

      if (stageZone && !spawnClearing) {
        const dx = worldX - stageZone.center.x;
        const dz = worldZ - stageZone.center.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const stageHeight = 0;

        if (dist < stageZone.radius) {
          height = stageHeight;
        } else if (dist < stageZone.radius + stageZone.blendWidth) {
          const t = (dist - stageZone.radius) / stageZone.blendWidth;
          const smooth = t * t * (3 - 2 * t);
          const targetHeight = Math.max(height, stageHeight);
          height = stageHeight + smooth * (targetHeight - stageHeight);
        }
      }

      let isInClearing = false;
      let clearingBlendFactor = 0;
      if (spawnClearing) {
        const dx = worldX - spawnClearing.center.x;
        const dz = worldZ - spawnClearing.center.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        const microNoise = Math.sin(worldX * 0.5) * Math.cos(worldZ * 0.5) * 0.3;
        const clearingHeight = spawnClearing.waterLevel + 3 + microNoise;

        if (dist < spawnClearing.radius) {
          height = clearingHeight;
          isInClearing = true;
          clearingBlendFactor = 0;
        } else if (dist < spawnClearing.radius + spawnClearing.blendWidth) {
          const t = (dist - spawnClearing.radius) / spawnClearing.blendWidth;
          const smooth = t * t * (3 - 2 * t);
          const targetHeight = Math.max(height, clearingHeight);
          height = clearingHeight + smooth * (targetHeight - clearingHeight);
          isInClearing = true;
          clearingBlendFactor = smooth;
        }
      }

      const localX = x === 0 ? 0 : (x === effectiveResolution - 1 ? chunkSize : x * step);
      const localZ = z === 0 ? 0 : (z === effectiveResolution - 1 ? chunkSize : z * step);

      vertices[idx] = localX;
      vertices[idx + 1] = height;
      vertices[idx + 2] = localZ;

      let color: { r: number; g: number; b: number };

      if (isInClearing && spawnClearing) {
        const grassColor = getClearingGrassColor(height, spawnClearing.waterLevel);
        if (clearingBlendFactor > 0) {
          const forestColor = getBiomeColor("forest", height);
          color = {
            r: grassColor.r + clearingBlendFactor * (forestColor.r - grassColor.r),
            g: grassColor.g + clearingBlendFactor * (forestColor.g - grassColor.g),
            b: grassColor.b + clearingBlendFactor * (forestColor.b - grassColor.b),
          };
        } else {
          color = grassColor;
        }
      } else if (usesRealTerrain && realTerrainZone && isPointInPolygon(worldX, worldZ, realTerrainZone.boundary)) {
        color = getCampgroundColor(height);
      } else {
        const biome = getBiome(noise, worldX, worldZ);
        color = getBiomeColor(biome, height);
      }

      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    }
  }

  // Erosion simulation
  if (erosion?.enabled && effectiveResolution >= 8) {
    const heights = new Float32Array(effectiveResolution * effectiveResolution);
    for (let i = 0; i < effectiveResolution * effectiveResolution; i++) {
      heights[i] = vertices[i * 3 + 1]!;
    }

    const erosionSeed = worldSeed + chunkX * 10000 + chunkZ;
    const erosionRng = mulberry32(erosionSeed);

    const scaledIterations = Math.max(5, Math.floor(erosion.iterations / (lod + 1)));
    applyErosion(heights, effectiveResolution, {
      iterations: scaledIterations,
      erosionStrength: erosion.erosionStrength,
      depositionRate: erosion.depositionRate,
      evaporationRate: erosion.evaporationRate,
      minSlope: erosion.minSlope,
      rainAmount: erosion.rainAmount,
      upliftRate: erosion.upliftRate,
    }, erosionRng);

    applyThermalErosion(heights, effectiveResolution, 3, 0.5);

    for (let i = 0; i < effectiveResolution * effectiveResolution; i++) {
      vertices[i * 3 + 1] = heights[i]!;
    }

    for (let z = 0; z < effectiveResolution; z++) {
      for (let x = 0; x < effectiveResolution; x++) {
        const idx = (z * effectiveResolution + x) * 3;
        const newHeight = vertices[idx + 1]!;

        let worldX: number;
        let worldZ: number;
        if (x === 0) {
          worldX = originX;
        } else if (x === effectiveResolution - 1) {
          worldX = originX + chunkSize;
        } else {
          worldX = originX + x * step;
        }
        if (z === 0) {
          worldZ = originZ;
        } else if (z === effectiveResolution - 1) {
          worldZ = originZ + chunkSize;
        } else {
          worldZ = originZ + z * step;
        }

        const biome = getBiome(noise, worldX, worldZ);
        const color = getBiomeColor(biome, newHeight);
        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;
      }
    }
  }

  // Second pass: calculate normals
  for (let z = 0; z < effectiveResolution; z++) {
    for (let x = 0; x < effectiveResolution; x++) {
      const idx = (z * effectiveResolution + x) * 3;

      const currentHeight = vertices[idx + 1] ?? 0;
      const left = x > 0 ? (vertices[(z * effectiveResolution + (x - 1)) * 3 + 1] ?? currentHeight) : currentHeight;
      const right = x < effectiveResolution - 1 ? (vertices[(z * effectiveResolution + (x + 1)) * 3 + 1] ?? currentHeight) : currentHeight;
      const down = z > 0 ? (vertices[((z - 1) * effectiveResolution + x) * 3 + 1] ?? currentHeight) : currentHeight;
      const up = z < effectiveResolution - 1 ? (vertices[((z + 1) * effectiveResolution + x) * 3 + 1] ?? currentHeight) : currentHeight;

      const nx = left - right;
      const ny = 2 * step;
      const nz = down - up;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

      normals[idx] = nx / len;
      normals[idx + 1] = ny / len;
      normals[idx + 2] = nz / len;
    }
  }

  // Third pass: blend weights
  for (let z = 0; z < effectiveResolution; z++) {
    for (let x = 0; x < effectiveResolution; x++) {
      const idx = (z * effectiveResolution + x) * 3;

      let worldX: number;
      let worldZ: number;
      if (x === 0) {
        worldX = originX;
      } else if (x === effectiveResolution - 1) {
        worldX = originX + chunkSize;
      } else {
        worldX = originX + x * step;
      }
      if (z === 0) {
        worldZ = originZ;
      } else if (z === effectiveResolution - 1) {
        worldZ = originZ + chunkSize;
      } else {
        worldZ = originZ + z * step;
      }

      const height = vertices[idx + 1] ?? 0;
      const normalY = normals[idx + 1] ?? 1;

      const slopeAngle = calculateSlopeFromNormal(
        normals[idx] ?? 0,
        normalY,
        normals[idx + 2] ?? 0,
      );

      const biome = getBiome(noise, worldX, worldZ);
      const weights = calculateBlendWeights(biome, height, slopeAngle, noise, worldX, worldZ);

      blendWeights1[idx] = weights.grass;
      blendWeights1[idx + 1] = weights.rock;
      blendWeights1[idx + 2] = weights.dirt;

      blendWeights2[idx] = weights.sand;
      blendWeights2[idx + 1] = weights.snow;
      blendWeights2[idx + 2] = 0;
    }
  }

  // Skirts
  const skirtDepth = calculateSkirtDepth(vertices, lod);
  const { finalVertices, finalNormals, finalColors, finalBlendWeights1, finalBlendWeights2 } =
    generateSkirtVertices(vertices, normals, colors, blendWeights1, blendWeights2, effectiveResolution, vertexCount, skirtDepth);

  // Indices (main terrain)
  const mainQuadCount = (effectiveResolution - 1) * (effectiveResolution - 1);
  const mainIndices = new Uint32Array(mainQuadCount * 6);
  let indexIdx = 0;

  for (let z = 0; z < effectiveResolution - 1; z++) {
    for (let x = 0; x < effectiveResolution - 1; x++) {
      const topLeft = z * effectiveResolution + x;
      const topRight = topLeft + 1;
      const bottomLeft = (z + 1) * effectiveResolution + x;
      const bottomRight = bottomLeft + 1;

      mainIndices[indexIdx++] = topLeft;
      mainIndices[indexIdx++] = bottomLeft;
      mainIndices[indexIdx++] = topRight;
      mainIndices[indexIdx++] = topRight;
      mainIndices[indexIdx++] = bottomLeft;
      mainIndices[indexIdx++] = bottomRight;
    }
  }

  const indices = generateSkirtIndices(mainIndices, effectiveResolution, vertexCount);

  // Drainage
  let drainage: DrainageData | undefined;
  if (drainageConfig.enabled) {
    const heights = new Float32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      heights[i] = vertices[i * 3 + 1]!;
    }
    const oceanLevel = -10;
    drainage = calculateDrainage(heights, effectiveResolution, chunkSize, drainageConfig, oceanLevel);
  }

  // Vegetation
  let vegetation: VegetationData[] = [];

  if (lod <= 3) {
    const sampleTerrain = (worldX: number, worldZ: number): TerrainSample => {
      const localX = worldX - originX;
      const localZ = worldZ - originZ;

      const gridX = Math.round(localX / step);
      const gridZ = Math.round(localZ / step);
      const clampedX = Math.max(0, Math.min(effectiveResolution - 1, gridX));
      const clampedZ = Math.max(0, Math.min(effectiveResolution - 1, gridZ));
      const vertexIdx = clampedZ * effectiveResolution + clampedX;

      const height = vertices[vertexIdx * 3 + 1] ?? 0;
      const ny = normals[vertexIdx * 3 + 1] ?? 1;
      const slope = 1 - ny;

      const biome = getBiome(noise, worldX, worldZ);
      const waterMask = drainage?.waterMask[vertexIdx] ?? 0;

      return { height, slope, biome, waterMask };
    };

    let excludeZone: { centerX: number; centerZ: number; radius: number } | undefined;
    if (spawnClearing) {
      excludeZone = {
        centerX: spawnClearing.center.x,
        centerZ: spawnClearing.center.z,
        radius: spawnClearing.radius + spawnClearing.blendWidth * 0.5,
      };
    } else if (stageZone) {
      excludeZone = {
        centerX: stageZone.center.x,
        centerZ: stageZone.center.z,
        radius: stageZone.radius + stageZone.blendWidth * 0.5,
      };
    }

    const scatterInstances = generateVegetationScatter(chunkX, chunkZ, {
      chunkSize,
      worldSeed,
      lod,
      excludeZone,
    }, sampleTerrain);

    vegetation = toLegacyFormat(scatterInstances);
  }

  // Primary biome
  const centerX = originX + chunkSize / 2;
  const centerZ = originZ + chunkSize / 2;
  const biome = getBiome(noise, centerX, centerZ);

  return {
    type: "chunk-result",
    id: msg.id,
    chunkX,
    chunkY,
    chunkZ,
    vertices: finalVertices,
    normals: finalNormals,
    colors: finalColors,
    indices,
    vegetation,
    biome,
    blendWeights1: finalBlendWeights1,
    blendWeights2: finalBlendWeights2,
    drainage,
  };
}


interface BlendWeights {
  grass: number;
  rock: number;
  dirt: number;
  sand: number;
  snow: number;
}

function calculateBlendWeights(
  legacyBiome: string,
  height: number,
  slopeAngle: number,
  noise: SeededNoise,
  worldX: number,
  worldZ: number,
): BlendWeights {
  const biomeType = getBiomeType(noise, worldX, worldZ, height, DEFAULT_BIOME_CONFIG);
  const characteristics = BIOME_CHARACTERISTICS[biomeType];
  let { grass, rock, dirt, sand, snow } = { ...characteristics.blendWeights };

  const ROCK_SLOPE_START = 0.35;
  const ROCK_SLOPE_FULL = 0.75;
  if (slopeAngle > ROCK_SLOPE_START) {
    const rockFactor = Math.min(1, (slopeAngle - ROCK_SLOPE_START) / (ROCK_SLOPE_FULL - ROCK_SLOPE_START));
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
  } else {
    grass = 1;
  }

  grass = Math.max(0, Math.min(1, grass));
  rock = Math.max(0, Math.min(1, rock));
  dirt = Math.max(0, Math.min(1, dirt));
  sand = Math.max(0, Math.min(1, sand));
  snow = Math.max(0, Math.min(1, snow));

  return { grass, rock, dirt, sand, snow };
}

function calculateSlopeFromNormal(nx: number, ny: number, _nz: number): number {
  return 1 - Math.abs(ny);
}


self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case "generate-chunk": {
      const result = generateChunk(msg);

      self.postMessage(result, {
        transfer: [
          result.vertices.buffer,
          result.normals.buffer,
          result.colors.buffer,
          result.indices.buffer,
          result.blendWeights1.buffer,
          result.blendWeights2.buffer,
        ]
      });
      break;
    }

    case "load-real-zone": {
      realTerrainZone = deserializeZoneInWorker(msg.zone);
      self.postMessage({
        type: "real-zone-loaded",
        name: realTerrainZone.name,
      } as RealZoneLoadedMessage);
      break;
    }

    case "clear-real-zone": {
      realTerrainZone = null;
      break;
    }

    case "set-stage-zone": {
      stageZone = {
        center: msg.center,
        radius: msg.radius,
        blendWidth: msg.blendWidth,
      };
      break;
    }

    case "clear-stage-zone": {
      stageZone = null;
      break;
    }

    case "set-spawn-clearing": {
      spawnClearing = {
        center: msg.center,
        radius: msg.radius,
        blendWidth: msg.blendWidth,
        waterLevel: msg.waterLevel,
        campground: msg.campground,
      };
      break;
    }

    case "clear-spawn-clearing": {
      spawnClearing = null;
      break;
    }
  }
};
