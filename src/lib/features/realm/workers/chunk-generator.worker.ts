/**
 * Chunk Generator Worker
 *
 * Runs procedural generation on a separate thread.
 * Main thread stays responsive, never blocks on terrain generation.
 *
 * Communication:
 * - Main → Worker: Generate chunk at (x, y, z) with seed
 * - Worker → Main: Chunk data (vertices, normals, colors)
 *
 * Real Terrain Support:
 * - Worker can receive real terrain zone data (e.g., Hannon's Camp)
 * - Blends real heightmap with procedural terrain at zone boundaries
 */

import {
  SeededNoise,
  createChunkRNG,
  getTerrainHeight,
  getBiome,
  getVegetationDensity,
  shouldPlaceTree,
  applyErosion,
  applyThermalErosion,
  mulberry32,
  type ErosionParams,
} from "../generation/seed-generator";
import {
  type RealTerrainZone,
  deserializeZoneInWorker,
  getBlendedHeight,
  chunkIntersectsZone,
  isPointInPolygon,
} from "../generation/real-terrain-zone";
import {
  BiomeType,
  getBiomeType,
  getBlendedBiomeWeights,
  getBiomeVegetationDensity,
  BIOME_CHARACTERISTICS,
  biomeTypeToLegacy,
  DEFAULT_BIOME_CONFIG,
} from "../generation/biome-system";
import { calculateDrainage } from "../generation/drainage-calculator";
import type { DrainageConfig, DrainageData } from "../generation/gpu/terrain-compute-types";
import { DEFAULT_DRAINAGE_CONFIG } from "../generation/gpu/terrain-compute-types";
import {
  generateVegetationScatter,
  toLegacyFormat,
  type TerrainSample,
  type LegacyVegetationType,
} from "../generation/vegetation-scatter";

// Drainage configuration (can be updated via message)
// Tuned for lakes/pools only - high minPoolSize prevents thin river artifacts
let drainageConfig: DrainageConfig = {
  ...DEFAULT_DRAINAGE_CONFIG,
  enabled: true,
  minPoolSize: 50,        // Much higher - only substantial water bodies (was 4)
  drainageThreshold: 0.3, // Higher threshold - needs more drainage to form water (was 0.15)
  heightTolerance: 8,     // Slightly more tolerance for pooling (was 5)
};

// Real terrain zone (loaded once, used for all chunks)
let realTerrainZone: RealTerrainZone | null = null;

// Stage zone - flat performance area
let stageZone: {
  center: { x: number; z: number };
  radius: number;
  blendWidth: number;
} | null = null;

// Spawn clearing - grassy meadow above water level
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

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Erosion configuration for worker
 */
export interface WorkerErosionConfig {
  enabled: boolean;
  iterations: number;
  erosionStrength: number;
  upliftRate: number;
  depositionRate: number;
  minSlope: number;
  rainAmount: number;
  evaporationRate: number;
}

export interface GenerateChunkMessage {
  type: "generate-chunk";
  id: number;
  chunkX: number;
  chunkY: number;
  chunkZ: number;
  worldSeed: number;
  chunkSize: number;
  resolution: number; // Vertices per side at LOD 0
  lod: number;
  /** Optional erosion configuration */
  erosion?: WorkerErosionConfig;
}

export interface LoadRealZoneMessage {
  type: "load-real-zone";
  zone: {
    name: string;
    boundary: Array<{ x: number; z: number }>;
    heightmapWidth: number;
    heightmapHeight: number;
    minElevation: number;
    maxElevation: number;
    heights: Float32Array;
    bounds: {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
      width: number;
      depth: number;
    };
    origin: { x: number; z: number };
  };
}

export interface ClearRealZoneMessage {
  type: "clear-real-zone";
}

export interface RealZoneLoadedMessage {
  type: "real-zone-loaded";
  name: string;
}

export interface ChunkResultMessage {
  type: "chunk-result";
  id: number;
  chunkX: number;
  chunkY: number;
  chunkZ: number;
  vertices: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  vegetation: VegetationData[];
  biome: string;
  /** Blend weights for terrain splatting (grass, rock, dirt) */
  blendWeights1: Float32Array;
  /** Blend weights for terrain splatting (sand, snow, unused) */
  blendWeights2: Float32Array;
  /** Drainage data for water placement (optional) */
  drainage?: DrainageData;
}

export interface VegetationData {
  type: "tree1" | "tree2" | "tree3" | "rock1" | "rock2" | "bush1" | "bush2" | "grass";
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
}

export interface SetStageZoneMessage {
  type: "set-stage-zone";
  center: { x: number; z: number };
  radius: number;  // Flat area radius (e.g., 15m)
  blendWidth: number;  // Transition width (e.g., 10m)
}

export interface ClearStageZoneMessage {
  type: "clear-stage-zone";
}

export interface SetSpawnClearingMessage {
  type: "set-spawn-clearing";
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
}

export interface ClearSpawnClearingMessage {
  type: "clear-spawn-clearing";
}

export type WorkerMessage = GenerateChunkMessage | LoadRealZoneMessage | ClearRealZoneMessage | SetStageZoneMessage | ClearStageZoneMessage | SetSpawnClearingMessage | ClearSpawnClearingMessage;
export type WorkerResponse = ChunkResultMessage | RealZoneLoadedMessage;

// ============================================================================
// CHUNK GENERATION
// ============================================================================

function generateChunk(msg: GenerateChunkMessage): ChunkResultMessage {
  const { chunkX, chunkY, chunkZ, worldSeed, chunkSize, resolution, lod, erosion } = msg;

  // Adjust resolution based on LOD
  const effectiveResolution = Math.max(4, Math.floor(resolution / Math.pow(2, lod)));

  const noise = new SeededNoise(worldSeed);
  const rng = createChunkRNG(worldSeed, chunkX, chunkY, chunkZ);

  // World position of chunk origin - use integer math to avoid floating point drift
  // This ensures chunk (0,0) right edge (0+32=32) exactly equals chunk (1,0) left edge (1*32=32)
  const originX = Math.round(chunkX * chunkSize);
  const originZ = Math.round(chunkZ * chunkSize);

  // Generate height map
  const vertexCount = effectiveResolution * effectiveResolution;
  const vertices = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  // Blend weights for terrain splatting (two vec3 attributes)
  // blendWeights1: grass (x), rock (y), dirt (z)
  // blendWeights2: sand (x), snow (y), unused (z)
  const blendWeights1 = new Float32Array(vertexCount * 3);
  const blendWeights2 = new Float32Array(vertexCount * 3);

  const step = chunkSize / (effectiveResolution - 1);

  // Check if this chunk intersects with the real terrain zone
  const usesRealTerrain = realTerrainZone
    ? chunkIntersectsZone(realTerrainZone, chunkX, chunkZ, chunkSize, 30)
    : false;

  // Debug logging for real terrain zone detection - DISABLED to prevent log spam
  // if (realTerrainZone && chunkX >= -30 && chunkX <= 10 && chunkZ >= -25 && chunkZ <= -10) {
  //   console.log(`[ChunkWorker] Chunk (${chunkX}, ${chunkZ}) at world (${originX}, ${originZ}): usesRealTerrain=${usesRealTerrain}`);
  // }

  // First pass: generate vertices
  // CRITICAL: Edge vertices must use EXACT chunk boundary coordinates
  // to ensure adjacent chunks sample identical heights at shared edges.
  // Using step * x can introduce floating-point errors that cause seams.
  for (let z = 0; z < effectiveResolution; z++) {
    for (let x = 0; x < effectiveResolution; x++) {
      const idx = (z * effectiveResolution + x) * 3;

      // Use exact boundary coordinates for edge vertices to prevent seams
      let worldX: number;
      let worldZ: number;

      if (x === 0) {
        worldX = originX; // Exact left edge
      } else if (x === effectiveResolution - 1) {
        worldX = originX + chunkSize; // Exact right edge
      } else {
        worldX = originX + x * step;
      }

      if (z === 0) {
        worldZ = originZ; // Exact bottom edge
      } else if (z === effectiveResolution - 1) {
        worldZ = originZ + chunkSize; // Exact top edge
      } else {
        worldZ = originZ + z * step;
      }

      // Get procedural height
      const proceduralHeight = getTerrainHeight(noise, worldX, worldZ);

      // Blend with real terrain if zone is loaded and chunk intersects
      let height = usesRealTerrain
        ? getBlendedHeight(realTerrainZone, worldX, worldZ, proceduralHeight, 30)
        : proceduralHeight;

      // Apply stage zone flattening (legacy - only if no spawn clearing)
      // The stage is a flat clearing at Y=0 (ground level) that blends up to terrain
      if (stageZone && !spawnClearing) {
        const dx = worldX - stageZone.center.x;
        const dz = worldZ - stageZone.center.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Stage is at Y=0 (ground level)
        // The terrain around it may be higher (hills/forest), and we blend up to it
        const stageHeight = 0;

        if (dist < stageZone.radius) {
          // Inside stage: completely flat at ground level
          height = stageHeight;
        } else if (dist < stageZone.radius + stageZone.blendWidth) {
          // Transition zone: blend from stage height UP to terrain
          const t = (dist - stageZone.radius) / stageZone.blendWidth;
          // Use smoothstep for a nicer transition
          const smooth = t * t * (3 - 2 * t);
          // Ensure terrain is at least at stage height (no dipping below)
          const targetHeight = Math.max(height, stageHeight);
          height = stageHeight + smooth * (targetHeight - stageHeight);
        }
      }

      // Apply spawn clearing (natural grassy meadow above water level)
      // This creates a safe spawn point that's guaranteed to be above water
      let isInClearing = false;
      let clearingBlendFactor = 0;
      if (spawnClearing) {
        const dx = worldX - spawnClearing.center.x;
        const dz = worldZ - spawnClearing.center.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Clearing height: water level + 3m + micro noise for natural look
        const microNoise = Math.sin(worldX * 0.5) * Math.cos(worldZ * 0.5) * 0.3;
        const clearingHeight = spawnClearing.waterLevel + 3 + microNoise;

        if (dist < spawnClearing.radius) {
          // Inside clearing: grassy meadow above water
          height = clearingHeight;
          isInClearing = true;
          clearingBlendFactor = 0;
        } else if (dist < spawnClearing.radius + spawnClearing.blendWidth) {
          // Transition zone: blend from clearing height to terrain
          const t = (dist - spawnClearing.radius) / spawnClearing.blendWidth;
          // Smoothstep for natural transition
          const smooth = t * t * (3 - 2 * t);
          // Ensure terrain is at least at clearing height (no dipping below)
          const targetHeight = Math.max(height, clearingHeight);
          height = clearingHeight + smooth * (targetHeight - clearingHeight);
          isInClearing = true;
          clearingBlendFactor = smooth;
        }
      }

      // Local position must match world coordinate calculation for edge vertices
      const localX = x === 0 ? 0 : (x === effectiveResolution - 1 ? chunkSize : x * step);
      const localZ = z === 0 ? 0 : (z === effectiveResolution - 1 ? chunkSize : z * step);

      vertices[idx] = localX;
      vertices[idx + 1] = height;
      vertices[idx + 2] = localZ;

      // Color based on biome and height
      // Use special coloring for real terrain zone (grassier, more natural)
      let biome = getBiome(noise, worldX, worldZ);
      let color: { r: number; g: number; b: number };

      if (isInClearing && spawnClearing) {
        // Spawn clearing - lush grass color
        const grassColor = getClearingGrassColor(height, spawnClearing.waterLevel);
        if (clearingBlendFactor > 0) {
          // Blend from grass to forest at edges
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
        // Inside real zone - use campground-appropriate colors
        color = getCampgroundColor(height);
      } else {
        color = getBiomeColor(biome, height);
      }

      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    }
  }

  // ============================================================================
  // EROSION SIMULATION (Optional)
  // ============================================================================
  // Apply hydraulic and thermal erosion to create more natural terrain features.
  // This creates realistic river valleys and mountain ridges.
  // Only applies at sufficient resolution (8+ vertices per side).
  if (erosion?.enabled && effectiveResolution >= 8) {
    // Extract heights from vertices into a 2D array for erosion processing
    const heights = new Float32Array(effectiveResolution * effectiveResolution);
    for (let i = 0; i < effectiveResolution * effectiveResolution; i++) {
      heights[i] = vertices[i * 3 + 1]!;
    }

    // Create deterministic RNG for this chunk's erosion
    const erosionSeed = worldSeed + chunkX * 10000 + chunkZ;
    const erosionRng = mulberry32(erosionSeed);

    // Apply hydraulic erosion (water flow)
    // Scale iterations based on LOD - coarser LODs need fewer iterations
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

    // Apply thermal erosion (weathering) - lighter touch
    applyThermalErosion(heights, effectiveResolution, 3, 0.5);

    // Write eroded heights back to vertices
    for (let i = 0; i < effectiveResolution * effectiveResolution; i++) {
      vertices[i * 3 + 1] = heights[i]!;
    }

    // Update colors based on new eroded heights
    // Erosion can create gullies and ridges that should affect coloring
    for (let z = 0; z < effectiveResolution; z++) {
      for (let x = 0; x < effectiveResolution; x++) {
        const idx = (z * effectiveResolution + x) * 3;
        const newHeight = vertices[idx + 1]!;

        // Get world position for biome lookup
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

        // Re-calculate color with eroded height
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

      // Get neighboring heights for normal calculation
      const currentHeight = vertices[idx + 1] ?? 0;
      const left = x > 0 ? (vertices[(z * effectiveResolution + (x - 1)) * 3 + 1] ?? currentHeight) : currentHeight;
      const right = x < effectiveResolution - 1 ? (vertices[(z * effectiveResolution + (x + 1)) * 3 + 1] ?? currentHeight) : currentHeight;
      const down = z > 0 ? (vertices[((z - 1) * effectiveResolution + x) * 3 + 1] ?? currentHeight) : currentHeight;
      const up = z < effectiveResolution - 1 ? (vertices[((z + 1) * effectiveResolution + x) * 3 + 1] ?? currentHeight) : currentHeight;

      // Calculate normal from height differences
      const nx = left - right;
      const ny = 2 * step;
      const nz = down - up;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

      normals[idx] = nx / len;
      normals[idx + 1] = ny / len;
      normals[idx + 2] = nz / len;
    }
  }

  // Third pass: calculate blend weights (requires normals for slope)
  for (let z = 0; z < effectiveResolution; z++) {
    for (let x = 0; x < effectiveResolution; x++) {
      const idx = (z * effectiveResolution + x) * 3;

      // Get world position
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

      // Calculate slope from normal
      const slopeAngle = calculateSlopeFromNormal(
        normals[idx] ?? 0,
        normalY,
        normals[idx + 2] ?? 0
      );

      // Get biome at this position
      const biome = getBiome(noise, worldX, worldZ);

      // Calculate blend weights
      const weights = calculateBlendWeights(biome, height, slopeAngle, noise, worldX, worldZ);

      // Store in blendWeights1 (grass, rock, dirt)
      blendWeights1[idx] = weights.grass;
      blendWeights1[idx + 1] = weights.rock;
      blendWeights1[idx + 2] = weights.dirt;

      // Store in blendWeights2 (sand, snow, unused)
      blendWeights2[idx] = weights.sand;
      blendWeights2[idx + 1] = weights.snow;
      blendWeights2[idx + 2] = 0;
    }
  }

  // ============================================================================
  // TERRAIN SKIRTS - Hide seams between chunks
  // ============================================================================
  // Add vertical "skirt" geometry around chunk edges that drops down.
  // This hides any gaps caused by LOD differences or floating-point precision.
  // Industry-standard technique used by Unity Terrain, Unreal, etc.

  // ADAPTIVE SKIRT DEPTH: Coarser LODs have larger gaps, need deeper skirts.
  // Also factor in terrain variance - hilly terrain needs deeper skirts.
  // Large base (50) ensures T-junction artifacts at LOD boundaries are fully hidden.
  const BASE_SKIRT = 50;
  const LOD_MULTIPLIER = 2.0;

  // Calculate height variance for this chunk
  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 1; i < vertices.length; i += 3) {
    const h = vertices[i]!;
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }
  const variance = maxH - minH;

  // Adaptive depth: deeper at coarser LODs + proportional to terrain variance
  // Minimum of 50 units ensures even flat terrain near water is fully hidden
  const SKIRT_DEPTH = Math.max(50, BASE_SKIRT * Math.pow(LOD_MULTIPLIER, lod) + variance * 0.5);

  const skirtVertexCount = effectiveResolution * 4; // 4 edges
  const totalVertexCount = vertexCount + skirtVertexCount;

  // Create expanded arrays to hold main terrain + skirts
  const finalVertices = new Float32Array(totalVertexCount * 3);
  const finalNormals = new Float32Array(totalVertexCount * 3);
  const finalColors = new Float32Array(totalVertexCount * 3);
  const finalBlendWeights1 = new Float32Array(totalVertexCount * 3);
  const finalBlendWeights2 = new Float32Array(totalVertexCount * 3);

  // Copy main terrain data
  finalVertices.set(vertices);
  finalNormals.set(normals);
  finalColors.set(colors);
  finalBlendWeights1.set(blendWeights1);
  finalBlendWeights2.set(blendWeights2);

  // Add skirt vertices (one for each edge vertex, dropped down by SKIRT_DEPTH)
  let skirtIdx = vertexCount * 3;

  // Bottom edge (z = 0)
  for (let x = 0; x < effectiveResolution; x++) {
    const srcIdx = x * 3;
    finalVertices[skirtIdx] = vertices[srcIdx] ?? 0;
    finalVertices[skirtIdx + 1] = (vertices[srcIdx + 1] ?? 0) - SKIRT_DEPTH;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2] ?? 0;
    // Use same normal as terrain vertex for seamless lighting
    finalNormals[skirtIdx] = normals[srcIdx] ?? 0;
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1] ?? 0;
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2] ?? 0;
    // Same color
    finalColors[skirtIdx] = colors[srcIdx] ?? 0;
    finalColors[skirtIdx + 1] = colors[srcIdx + 1] ?? 0;
    finalColors[skirtIdx + 2] = colors[srcIdx + 2] ?? 0;
    // Same blend weights
    finalBlendWeights1[skirtIdx] = blendWeights1[srcIdx] ?? 0;
    finalBlendWeights1[skirtIdx + 1] = blendWeights1[srcIdx + 1] ?? 0;
    finalBlendWeights1[skirtIdx + 2] = blendWeights1[srcIdx + 2] ?? 0;
    finalBlendWeights2[skirtIdx] = blendWeights2[srcIdx] ?? 0;
    finalBlendWeights2[skirtIdx + 1] = blendWeights2[srcIdx + 1] ?? 0;
    finalBlendWeights2[skirtIdx + 2] = blendWeights2[srcIdx + 2] ?? 0;
    skirtIdx += 3;
  }

  // Top edge (z = effectiveResolution - 1)
  for (let x = 0; x < effectiveResolution; x++) {
    const srcIdx = ((effectiveResolution - 1) * effectiveResolution + x) * 3;
    finalVertices[skirtIdx] = vertices[srcIdx] ?? 0;
    finalVertices[skirtIdx + 1] = (vertices[srcIdx + 1] ?? 0) - SKIRT_DEPTH;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2] ?? 0;
    finalNormals[skirtIdx] = normals[srcIdx] ?? 0;
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1] ?? 0;
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2] ?? 0;
    finalColors[skirtIdx] = colors[srcIdx] ?? 0;
    finalColors[skirtIdx + 1] = colors[srcIdx + 1] ?? 0;
    finalColors[skirtIdx + 2] = colors[srcIdx + 2] ?? 0;
    finalBlendWeights1[skirtIdx] = blendWeights1[srcIdx] ?? 0;
    finalBlendWeights1[skirtIdx + 1] = blendWeights1[srcIdx + 1] ?? 0;
    finalBlendWeights1[skirtIdx + 2] = blendWeights1[srcIdx + 2] ?? 0;
    finalBlendWeights2[skirtIdx] = blendWeights2[srcIdx] ?? 0;
    finalBlendWeights2[skirtIdx + 1] = blendWeights2[srcIdx + 1] ?? 0;
    finalBlendWeights2[skirtIdx + 2] = blendWeights2[srcIdx + 2] ?? 0;
    skirtIdx += 3;
  }

  // Left edge (x = 0)
  for (let z = 0; z < effectiveResolution; z++) {
    const srcIdx = (z * effectiveResolution) * 3;
    finalVertices[skirtIdx] = vertices[srcIdx] ?? 0;
    finalVertices[skirtIdx + 1] = (vertices[srcIdx + 1] ?? 0) - SKIRT_DEPTH;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2] ?? 0;
    finalNormals[skirtIdx] = normals[srcIdx] ?? 0;
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1] ?? 0;
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2] ?? 0;
    finalColors[skirtIdx] = colors[srcIdx] ?? 0;
    finalColors[skirtIdx + 1] = colors[srcIdx + 1] ?? 0;
    finalColors[skirtIdx + 2] = colors[srcIdx + 2] ?? 0;
    finalBlendWeights1[skirtIdx] = blendWeights1[srcIdx] ?? 0;
    finalBlendWeights1[skirtIdx + 1] = blendWeights1[srcIdx + 1] ?? 0;
    finalBlendWeights1[skirtIdx + 2] = blendWeights1[srcIdx + 2] ?? 0;
    finalBlendWeights2[skirtIdx] = blendWeights2[srcIdx] ?? 0;
    finalBlendWeights2[skirtIdx + 1] = blendWeights2[srcIdx + 1] ?? 0;
    finalBlendWeights2[skirtIdx + 2] = blendWeights2[srcIdx + 2] ?? 0;
    skirtIdx += 3;
  }

  // Right edge (x = effectiveResolution - 1)
  for (let z = 0; z < effectiveResolution; z++) {
    const srcIdx = (z * effectiveResolution + effectiveResolution - 1) * 3;
    finalVertices[skirtIdx] = vertices[srcIdx] ?? 0;
    finalVertices[skirtIdx + 1] = (vertices[srcIdx + 1] ?? 0) - SKIRT_DEPTH;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2] ?? 0;
    finalNormals[skirtIdx] = normals[srcIdx] ?? 0;
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1] ?? 0;
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2] ?? 0;
    finalColors[skirtIdx] = colors[srcIdx] ?? 0;
    finalColors[skirtIdx + 1] = colors[srcIdx + 1] ?? 0;
    finalColors[skirtIdx + 2] = colors[srcIdx + 2] ?? 0;
    finalBlendWeights1[skirtIdx] = blendWeights1[srcIdx] ?? 0;
    finalBlendWeights1[skirtIdx + 1] = blendWeights1[srcIdx + 1] ?? 0;
    finalBlendWeights1[skirtIdx + 2] = blendWeights1[srcIdx + 2] ?? 0;
    finalBlendWeights2[skirtIdx] = blendWeights2[srcIdx] ?? 0;
    finalBlendWeights2[skirtIdx + 1] = blendWeights2[srcIdx + 1] ?? 0;
    finalBlendWeights2[skirtIdx + 2] = blendWeights2[srcIdx + 2] ?? 0;
    skirtIdx += 3;
  }

  // ============================================================================
  // Generate indices for triangle mesh (main terrain + skirts)
  // ============================================================================
  const mainQuadCount = (effectiveResolution - 1) * (effectiveResolution - 1);
  const skirtQuadCount = (effectiveResolution - 1) * 4; // 4 edges
  const totalQuadCount = mainQuadCount + skirtQuadCount;
  const indices = new Uint32Array(totalQuadCount * 6);
  let indexIdx = 0;

  // Main terrain indices
  for (let z = 0; z < effectiveResolution - 1; z++) {
    for (let x = 0; x < effectiveResolution - 1; x++) {
      const topLeft = z * effectiveResolution + x;
      const topRight = topLeft + 1;
      const bottomLeft = (z + 1) * effectiveResolution + x;
      const bottomRight = bottomLeft + 1;

      // Two triangles per quad
      indices[indexIdx++] = topLeft;
      indices[indexIdx++] = bottomLeft;
      indices[indexIdx++] = topRight;

      indices[indexIdx++] = topRight;
      indices[indexIdx++] = bottomLeft;
      indices[indexIdx++] = bottomRight;
    }
  }

  // Skirt indices - connect edge vertices to dropped skirt vertices
  const skirtStartIdx = vertexCount;

  // Bottom edge skirt (z = 0) - skirt vertices start at skirtStartIdx
  for (let x = 0; x < effectiveResolution - 1; x++) {
    const topLeft = x;
    const topRight = x + 1;
    const bottomLeft = skirtStartIdx + x;
    const bottomRight = skirtStartIdx + x + 1;

    // Wind triangles to face outward (down)
    indices[indexIdx++] = topLeft;
    indices[indexIdx++] = bottomLeft;
    indices[indexIdx++] = topRight;

    indices[indexIdx++] = topRight;
    indices[indexIdx++] = bottomLeft;
    indices[indexIdx++] = bottomRight;
  }

  // Top edge skirt (z = max) - skirt vertices at skirtStartIdx + effectiveResolution
  const topEdgeSkirtStart = skirtStartIdx + effectiveResolution;
  for (let x = 0; x < effectiveResolution - 1; x++) {
    const topLeft = (effectiveResolution - 1) * effectiveResolution + x;
    const topRight = topLeft + 1;
    const bottomLeft = topEdgeSkirtStart + x;
    const bottomRight = topEdgeSkirtStart + x + 1;

    // Wind triangles to face outward (up, so reverse winding)
    indices[indexIdx++] = topLeft;
    indices[indexIdx++] = topRight;
    indices[indexIdx++] = bottomLeft;

    indices[indexIdx++] = topRight;
    indices[indexIdx++] = bottomRight;
    indices[indexIdx++] = bottomLeft;
  }

  // Left edge skirt (x = 0) - skirt vertices at skirtStartIdx + effectiveResolution * 2
  const leftEdgeSkirtStart = skirtStartIdx + effectiveResolution * 2;
  for (let z = 0; z < effectiveResolution - 1; z++) {
    const topLeft = z * effectiveResolution;
    const bottomLeft = (z + 1) * effectiveResolution;
    const topRight = leftEdgeSkirtStart + z;
    const bottomRight = leftEdgeSkirtStart + z + 1;

    // Wind triangles to face outward (left, so reverse winding)
    indices[indexIdx++] = topLeft;
    indices[indexIdx++] = topRight;
    indices[indexIdx++] = bottomLeft;

    indices[indexIdx++] = bottomLeft;
    indices[indexIdx++] = topRight;
    indices[indexIdx++] = bottomRight;
  }

  // Right edge skirt (x = max) - skirt vertices at skirtStartIdx + effectiveResolution * 3
  const rightEdgeSkirtStart = skirtStartIdx + effectiveResolution * 3;
  for (let z = 0; z < effectiveResolution - 1; z++) {
    const topLeft = z * effectiveResolution + effectiveResolution - 1;
    const bottomLeft = (z + 1) * effectiveResolution + effectiveResolution - 1;
    const topRight = rightEdgeSkirtStart + z;
    const bottomRight = rightEdgeSkirtStart + z + 1;

    // Wind triangles to face outward (right)
    indices[indexIdx++] = topLeft;
    indices[indexIdx++] = bottomLeft;
    indices[indexIdx++] = topRight;

    indices[indexIdx++] = bottomLeft;
    indices[indexIdx++] = bottomRight;
    indices[indexIdx++] = topRight;
  }

  // Calculate drainage-based water data FIRST (needed for vegetation placement)
  // Extract heights from main terrain vertices (not skirts) for drainage calculation
  let drainage: DrainageData | undefined;
  if (drainageConfig.enabled) {
    const heights = new Float32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      heights[i] = vertices[i * 3 + 1]!; // Y component is height
    }
    // Ocean level from biome config (default -10)
    const oceanLevel = -10;
    drainage = calculateDrainage(heights, effectiveResolution, chunkSize, drainageConfig, oceanLevel);
  }

  // Generate vegetation using ScatterMeshes-style placement
  // Deterministic, terrain-aware, with Poisson disk sampling for natural distribution
  let vegetation: VegetationData[] = [];

  if (lod <= 3) {
    // Create terrain sampler that uses heights/normals from vertex data
    // Also includes waterMask from drainage calculation to prevent vegetation in water
    const sampleTerrain = (worldX: number, worldZ: number): TerrainSample => {
      // Convert world coords to local chunk coords
      const localX = worldX - originX;
      const localZ = worldZ - originZ;

      // Find nearest vertex (simple nearest-neighbor for now)
      const gridX = Math.round(localX / step);
      const gridZ = Math.round(localZ / step);
      const clampedX = Math.max(0, Math.min(effectiveResolution - 1, gridX));
      const clampedZ = Math.max(0, Math.min(effectiveResolution - 1, gridZ));
      const vertexIdx = clampedZ * effectiveResolution + clampedX;

      const height = vertices[vertexIdx * 3 + 1] ?? 0;
      const nx = normals[vertexIdx * 3] ?? 0;
      const ny = normals[vertexIdx * 3 + 1] ?? 1;
      const nz = normals[vertexIdx * 3 + 2] ?? 0;

      // Calculate slope from normal (0 = flat, 1 = vertical)
      const slope = 1 - ny;

      // Get biome using legacy string format (matches vegetation rules)
      const biome = getBiome(noise, worldX, worldZ);

      // Get water mask from drainage data (if available)
      const waterMask = drainage?.waterMask[vertexIdx] ?? 0;

      return {
        height,
        slope,
        biome,
        waterMask,
      };
    };

    // Build exclude zone from spawn clearing or stage zone
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

    // Generate vegetation using the new scatter system
    const scatterInstances = generateVegetationScatter(chunkX, chunkZ, {
      chunkSize,
      worldSeed,
      lod,
      excludeZone,
    }, sampleTerrain);

    // Convert to legacy format for compatibility with existing rendering
    vegetation = toLegacyFormat(scatterInstances);
  }

  // Determine primary biome for this chunk
  const centerX = originX + chunkSize / 2;
  const centerZ = originZ + chunkSize / 2;
  const biome = getBiome(noise, centerX, centerZ);

  // Note: drainage was calculated earlier (before vegetation) so waterMask
  // could be used to prevent placing vegetation in water areas

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

function getBiomeColor(biome: string, height: number): { r: number; g: number; b: number } {
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
    case "mountains":
      const snow = heightFactor > 0.8;
      return snow
        ? { r: 0.9, g: 0.9, b: 0.95 }
        : { r: 0.4 + heightFactor * 0.3, g: 0.35 + heightFactor * 0.3, b: 0.3 + heightFactor * 0.3 };
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

/**
 * Colors for real terrain zone (Hannon's Camp)
 * Southwest Ohio campground - grassy fields, some bare earth
 */
function getCampgroundColor(height: number): { r: number; g: number; b: number } {
  const heightFactor = Math.min(1, Math.max(0, height / 40));

  // Mix of grass green and earthy brown based on height variation
  // Lower areas: greener (more moisture)
  // Higher areas: slightly browner (drier)
  return {
    r: 0.25 + heightFactor * 0.15,
    g: 0.45 - heightFactor * 0.05,
    b: 0.15 + heightFactor * 0.05,
  };
}

/**
 * Colors for spawn clearing (lush meadow grass)
 * Bright green grass that looks inviting and safe
 */
function getClearingGrassColor(height: number, waterLevel: number): { r: number; g: number; b: number } {
  // Height relative to clearing center
  const heightAboveWater = height - waterLevel;
  const heightFactor = Math.min(1, Math.max(0, heightAboveWater / 10));

  // Lush meadow green with slight variation
  return {
    r: 0.2 + heightFactor * 0.1,
    g: 0.55 - heightFactor * 0.05,
    b: 0.15,
  };
}

// ============================================================================
// BLEND WEIGHT CALCULATION
// ============================================================================

/**
 * Terrain blend weights for PBR splatting
 * Returns weights for: grass, rock, dirt, sand, snow
 * All weights sum to 1.0
 */
interface BlendWeights {
  grass: number;
  rock: number;
  dirt: number;
  sand: number;
  snow: number;
}

/**
 * Calculate blend weights based on biome, height, and slope
 *
 * @param biome - Current biome type
 * @param height - World height in meters
 * @param slopeAngle - Slope angle (0-1, where 1 = vertical)
 * @param noise - Noise generator for variation
 * @param worldX - World X coordinate
 * @param worldZ - World Z coordinate
 */
function calculateBlendWeights(
  legacyBiome: string,
  height: number,
  slopeAngle: number,
  noise: SeededNoise,
  worldX: number,
  worldZ: number
): BlendWeights {
  // Get Whittaker-style biome type based on temperature/precipitation
  const biomeType = getBiomeType(noise, worldX, worldZ, height, DEFAULT_BIOME_CONFIG);

  // Get base blend weights from biome characteristics
  const characteristics = BIOME_CHARACTERISTICS[biomeType];
  let { grass, rock, dirt, sand, snow } = { ...characteristics.blendWeights };

  // Step 1: Slope-based rock blending (steep surfaces = more rock)
  // This applies universally across all biomes
  const ROCK_SLOPE_START = 0.35;
  const ROCK_SLOPE_FULL = 0.75;
  if (slopeAngle > ROCK_SLOPE_START) {
    const rockFactor = Math.min(1, (slopeAngle - ROCK_SLOPE_START) / (ROCK_SLOPE_FULL - ROCK_SLOPE_START));
    const smoothRock = rockFactor * rockFactor * (3 - 2 * rockFactor);

    // Rock replaces grass, dirt, and sand on steep slopes
    const grassLoss = grass * smoothRock * 0.85;
    const dirtLoss = dirt * smoothRock * 0.7;
    const sandLoss = sand * smoothRock * 0.6;

    grass -= grassLoss;
    dirt -= dirtLoss;
    sand -= sandLoss;
    rock += grassLoss + dirtLoss + sandLoss;
  }

  // Step 2: Noise variation for natural look
  const variationNoise = (noise.fbm(worldX * 0.05, 0, worldZ * 0.05, 3) + 1) * 0.5;
  const variation = (variationNoise - 0.5) * 0.12;

  // Subtle variation to grass/dirt balance
  if (grass > 0.1 && dirt > 0.1) {
    grass += variation;
    dirt -= variation;
  }

  // Step 3: Normalize to ensure sum = 1.0
  const total = grass + rock + dirt + sand + snow;
  if (total > 0) {
    grass /= total;
    rock /= total;
    dirt /= total;
    sand /= total;
    snow /= total;
  } else {
    // Fallback
    grass = 1;
  }

  // Clamp to valid range
  grass = Math.max(0, Math.min(1, grass));
  rock = Math.max(0, Math.min(1, rock));
  dirt = Math.max(0, Math.min(1, dirt));
  sand = Math.max(0, Math.min(1, sand));
  snow = Math.max(0, Math.min(1, snow));

  return { grass, rock, dirt, sand, snow };
}

/**
 * Calculate slope angle from normal vector
 * Returns value 0-1 where 0 = flat, 1 = vertical
 */
function calculateSlopeFromNormal(nx: number, ny: number, nz: number): number {
  // Normal Y component indicates how "up" the surface is
  // Y=1 means flat ground, Y=0 means vertical wall
  return 1 - Math.abs(ny);
}

// ============================================================================
// WORKER MESSAGE HANDLER
// ============================================================================

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case "generate-chunk": {
      const result = generateChunk(msg);

      // Transfer ownership of typed arrays for zero-copy
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
      // Load real terrain zone data
      realTerrainZone = deserializeZoneInWorker(msg.zone);
      // Logging disabled to reduce overhead
      // console.log(`[ChunkWorker] Loaded real terrain zone: ${realTerrainZone.name}`);
      // console.log(`[ChunkWorker] Zone bounds: ${realTerrainZone.bounds.minX.toFixed(0)} to ${realTerrainZone.bounds.maxX.toFixed(0)} X, ${realTerrainZone.bounds.minZ.toFixed(0)} to ${realTerrainZone.bounds.maxZ.toFixed(0)} Z`);

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
