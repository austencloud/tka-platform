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

import { SeededNoise, createChunkRNG, getTerrainHeight, getBiome, getVegetationDensity, shouldPlaceTree } from "../generation/seed-generator";
import {
  type RealTerrainZone,
  deserializeZoneInWorker,
  getBlendedHeight,
  chunkIntersectsZone,
  isPointInPolygon,
} from "../generation/real-terrain-zone";

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

export interface GenerateChunkMessage {
  type: "generate-chunk";
  id: number;
  chunkX: number;
  chunkY: number;
  chunkZ: number;
  worldSeed: number;
  chunkSize: number;
  resolution: number; // Vertices per side
  lod: number;
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
  const { chunkX, chunkY, chunkZ, worldSeed, chunkSize, resolution, lod } = msg;

  // Adjust resolution based on LOD
  const effectiveResolution = Math.max(4, Math.floor(resolution / Math.pow(2, lod)));

  const noise = new SeededNoise(worldSeed);
  const rng = createChunkRNG(worldSeed, chunkX, chunkY, chunkZ);

  // World position of chunk origin
  const originX = chunkX * chunkSize;
  const originZ = chunkZ * chunkSize;

  // Generate height map
  const vertexCount = effectiveResolution * effectiveResolution;
  const vertices = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  const step = chunkSize / (effectiveResolution - 1);

  // Check if this chunk intersects with the real terrain zone
  const usesRealTerrain = realTerrainZone
    ? chunkIntersectsZone(realTerrainZone, chunkX, chunkZ, chunkSize, 30)
    : false;

  // Debug logging for real terrain zone detection
  if (realTerrainZone && chunkX >= -30 && chunkX <= 10 && chunkZ >= -25 && chunkZ <= -10) {
    console.log(`[ChunkWorker] Chunk (${chunkX}, ${chunkZ}) at world (${originX}, ${originZ}): usesRealTerrain=${usesRealTerrain}`);
  }

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

  // ============================================================================
  // TERRAIN SKIRTS - Hide seams between chunks
  // ============================================================================
  // Add vertical "skirt" geometry around chunk edges that drops down.
  // This hides any gaps caused by LOD differences or floating-point precision.
  // Industry-standard technique used by Unity Terrain, Unreal, etc.

  const SKIRT_DEPTH = 15; // How far down skirts extend (meters) - increased to hide larger gaps
  const skirtVertexCount = effectiveResolution * 4; // 4 edges
  const totalVertexCount = vertexCount + skirtVertexCount;

  // Create expanded arrays to hold main terrain + skirts
  const finalVertices = new Float32Array(totalVertexCount * 3);
  const finalNormals = new Float32Array(totalVertexCount * 3);
  const finalColors = new Float32Array(totalVertexCount * 3);

  // Copy main terrain data
  finalVertices.set(vertices);
  finalNormals.set(normals);
  finalColors.set(colors);

  // Add skirt vertices (one for each edge vertex, dropped down by SKIRT_DEPTH)
  let skirtIdx = vertexCount * 3;

  // Bottom edge (z = 0)
  for (let x = 0; x < effectiveResolution; x++) {
    const srcIdx = x * 3;
    finalVertices[skirtIdx] = vertices[srcIdx];
    finalVertices[skirtIdx + 1] = vertices[srcIdx + 1] - SKIRT_DEPTH;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2];
    // Use same normal as terrain vertex for seamless lighting
    finalNormals[skirtIdx] = normals[srcIdx];
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1];
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2];
    // Same color
    finalColors[skirtIdx] = colors[srcIdx];
    finalColors[skirtIdx + 1] = colors[srcIdx + 1];
    finalColors[skirtIdx + 2] = colors[srcIdx + 2];
    skirtIdx += 3;
  }

  // Top edge (z = effectiveResolution - 1)
  for (let x = 0; x < effectiveResolution; x++) {
    const srcIdx = ((effectiveResolution - 1) * effectiveResolution + x) * 3;
    finalVertices[skirtIdx] = vertices[srcIdx];
    finalVertices[skirtIdx + 1] = vertices[srcIdx + 1] - SKIRT_DEPTH;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2];
    finalNormals[skirtIdx] = normals[srcIdx];
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1];
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2];
    finalColors[skirtIdx] = colors[srcIdx];
    finalColors[skirtIdx + 1] = colors[srcIdx + 1];
    finalColors[skirtIdx + 2] = colors[srcIdx + 2];
    skirtIdx += 3;
  }

  // Left edge (x = 0)
  for (let z = 0; z < effectiveResolution; z++) {
    const srcIdx = (z * effectiveResolution) * 3;
    finalVertices[skirtIdx] = vertices[srcIdx];
    finalVertices[skirtIdx + 1] = vertices[srcIdx + 1] - SKIRT_DEPTH;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2];
    finalNormals[skirtIdx] = normals[srcIdx];
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1];
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2];
    finalColors[skirtIdx] = colors[srcIdx];
    finalColors[skirtIdx + 1] = colors[srcIdx + 1];
    finalColors[skirtIdx + 2] = colors[srcIdx + 2];
    skirtIdx += 3;
  }

  // Right edge (x = effectiveResolution - 1)
  for (let z = 0; z < effectiveResolution; z++) {
    const srcIdx = (z * effectiveResolution + effectiveResolution - 1) * 3;
    finalVertices[skirtIdx] = vertices[srcIdx];
    finalVertices[skirtIdx + 1] = vertices[srcIdx + 1] - SKIRT_DEPTH;
    finalVertices[skirtIdx + 2] = vertices[srcIdx + 2];
    finalNormals[skirtIdx] = normals[srcIdx];
    finalNormals[skirtIdx + 1] = normals[srcIdx + 1];
    finalNormals[skirtIdx + 2] = normals[srcIdx + 2];
    finalColors[skirtIdx] = colors[srcIdx];
    finalColors[skirtIdx + 1] = colors[srcIdx + 1];
    finalColors[skirtIdx + 2] = colors[srcIdx + 2];
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

  // Generate vegetation (LOD 0-2 full density, LOD 3 sparse trees only)
  const vegetation: VegetationData[] = [];

  // Helper to pick random tree variant
  const pickTreeVariant = (): "tree1" | "tree2" | "tree3" => {
    const r = rng();
    if (r < 0.4) return "tree1";
    if (r < 0.7) return "tree2";
    return "tree3";
  };

  // Helper to pick random rock variant
  const pickRockVariant = (): "rock1" | "rock2" => {
    return rng() < 0.5 ? "rock1" : "rock2";
  };

  // Helper to pick random bush variant
  const pickBushVariant = (): "bush1" | "bush2" => {
    return rng() < 0.5 ? "bush1" : "bush2";
  };

  if (lod <= 3) {
    const lodMultiplier = lod === 3 ? 4 : 1;
    const vegStep = Math.max(2, step) * lodMultiplier;

    for (let z = 0; z < chunkSize; z += vegStep) {
      for (let x = 0; x < chunkSize; x += vegStep) {
        const worldX = originX + x;
        const worldZ = originZ + z;

        // Skip vegetation in stage zone (legacy)
        if (stageZone && !spawnClearing) {
          const dx = worldX - stageZone.center.x;
          const dz = worldZ - stageZone.center.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          // No vegetation within stage radius + half blend width
          if (dist < stageZone.radius + stageZone.blendWidth * 0.5) {
            continue;
          }
        }

        // Skip vegetation in spawn clearing (keep meadow clear)
        if (spawnClearing) {
          const dx = worldX - spawnClearing.center.x;
          const dz = worldZ - spawnClearing.center.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          // No vegetation within clearing radius + half blend width
          // This keeps the meadow clear and lets trees form a ring at the edge
          if (dist < spawnClearing.radius + spawnClearing.blendWidth * 0.5) {
            continue;
          }
        }

        const height = getTerrainHeight(noise, worldX, worldZ);
        const localBiome = getBiome(noise, worldX, worldZ);
        const density = getVegetationDensity(noise, worldX, worldZ);

        // FOREST BIOME: Dense trees and bushes
        if (localBiome === "forest") {
          const effectiveDensity = lod === 3 ? density * 0.5 : density;
          if (shouldPlaceTree(worldSeed, worldX, worldZ, effectiveDensity)) {
            vegetation.push({
              type: pickTreeVariant(),
              x: x,
              y: height,
              z: z,
              rotation: rng() * Math.PI * 2,
              scale: 0.7 + rng() * 0.5,
            });
          }
          // Add bushes between trees (LOD 0-2 only)
          if (lod <= 2 && rng() < density * 0.4) {
            vegetation.push({
              type: pickBushVariant(),
              x: x + (rng() - 0.5) * 3,
              y: height,
              z: z + (rng() - 0.5) * 3,
              rotation: rng() * Math.PI * 2,
              scale: 0.6 + rng() * 0.4,
            });
          }
        }

        // PLAINS BIOME: Sparse trees, some bushes
        if (localBiome === "plains") {
          const effectiveDensity = lod === 3 ? density * 0.3 : density * 0.5;
          if (shouldPlaceTree(worldSeed, worldX, worldZ, effectiveDensity)) {
            vegetation.push({
              type: pickTreeVariant(),
              x: x,
              y: height,
              z: z,
              rotation: rng() * Math.PI * 2,
              scale: 0.8 + rng() * 0.4,
            });
          }
          // Occasional bushes
          if (lod <= 2 && rng() < density * 0.2) {
            vegetation.push({
              type: pickBushVariant(),
              x: x + (rng() - 0.5) * 2,
              y: height,
              z: z + (rng() - 0.5) * 2,
              rotation: rng() * Math.PI * 2,
              scale: 0.5 + rng() * 0.3,
            });
          }
        }

        // MOUNTAINS BIOME: Rocks, very sparse trees at lower elevations
        if (localBiome === "mountains") {
          // Rocks are common
          if (lod <= 2 && rng() < density * 0.5) {
            vegetation.push({
              type: pickRockVariant(),
              x: x + (rng() - 0.5) * 2,
              y: height,
              z: z + (rng() - 0.5) * 2,
              rotation: rng() * Math.PI * 2,
              scale: 0.8 + rng() * 1.5,
            });
          }
          // Sparse trees only at lower mountain elevations
          if (height < 35 && rng() < density * 0.15) {
            vegetation.push({
              type: pickTreeVariant(),
              x: x,
              y: height,
              z: z,
              rotation: rng() * Math.PI * 2,
              scale: 0.5 + rng() * 0.3, // Smaller trees
            });
          }
        }

        // DESERT BIOME: Only rocks, no vegetation
        if (localBiome === "desert") {
          if (lod <= 2 && rng() < density * 0.3) {
            vegetation.push({
              type: pickRockVariant(),
              x: x + (rng() - 0.5) * 3,
              y: height,
              z: z + (rng() - 0.5) * 3,
              rotation: rng() * Math.PI * 2,
              scale: 0.4 + rng() * 1.2,
            });
          }
        }

        // OCEAN BIOME: Nothing (underwater)
        // No vegetation placed
      }
    }
  }

  // Determine primary biome for this chunk
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
        ]
      });
      break;
    }

    case "load-real-zone": {
      // Load real terrain zone data
      realTerrainZone = deserializeZoneInWorker(msg.zone);
      console.log(`[ChunkWorker] Loaded real terrain zone: ${realTerrainZone.name}`);
      console.log(`[ChunkWorker] Zone bounds: ${realTerrainZone.bounds.minX.toFixed(0)} to ${realTerrainZone.bounds.maxX.toFixed(0)} X, ${realTerrainZone.bounds.minZ.toFixed(0)} to ${realTerrainZone.bounds.maxZ.toFixed(0)} Z`);

      self.postMessage({
        type: "real-zone-loaded",
        name: realTerrainZone.name,
      } as RealZoneLoadedMessage);
      break;
    }

    case "clear-real-zone": {
      const name = realTerrainZone?.name ?? "none";
      realTerrainZone = null;
      console.log(`[ChunkWorker] Cleared real terrain zone: ${name}`);
      break;
    }

    case "set-stage-zone": {
      stageZone = {
        center: msg.center,
        radius: msg.radius,
        blendWidth: msg.blendWidth,
      };
      console.log(`[ChunkWorker] Set stage zone: center=(${msg.center.x}, ${msg.center.z}), radius=${msg.radius}m, blend=${msg.blendWidth}m`);
      break;
    }

    case "clear-stage-zone": {
      stageZone = null;
      console.log(`[ChunkWorker] Cleared stage zone`);
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
      console.log(`[ChunkWorker] Set spawn clearing: center=(${msg.center.x}, ${msg.center.z}), radius=${msg.radius}m, blend=${msg.blendWidth}m, waterLevel=${msg.waterLevel}`);
      break;
    }

    case "clear-spawn-clearing": {
      spawnClearing = null;
      console.log(`[ChunkWorker] Cleared spawn clearing`);
      break;
    }
  }
};
