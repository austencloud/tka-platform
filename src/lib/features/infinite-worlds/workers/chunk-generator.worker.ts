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

/**
 * Neighbor LOD information for T-junction stitching
 * -1 means no neighbor (edge of loaded area)
 * >= 0 is the LOD level of that neighbor
 * Includes diagonals for corner vertex coordination
 */
export interface NeighborLODs {
  north: number; // +Z direction
  south: number; // -Z direction
  east: number;  // +X direction
  west: number;  // -X direction
  // Diagonals for corner coordination
  northEast: number;
  northWest: number;
  southEast: number;
  southWest: number;
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
  /** Neighbor LODs for T-junction stitching. If not provided, assumes same LOD. */
  neighborLODs?: NeighborLODs;
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

// ============================================================================
// T-JUNCTION STITCHING HELPERS
// ============================================================================

/**
 * Calculate how many vertices a given LOD level has along an edge
 * LOD 0 = base resolution, each higher LOD halves it
 */
function getEdgeVertexCount(baseResolution: number, lod: number): number {
  return Math.max(4, Math.floor(baseResolution / Math.pow(2, lod)));
}

/**
 * Calculate the interpolated height at a position along an edge when stitching
 * to a coarser neighbor. The coarser grid has fewer vertices, so we interpolate
 * between the two coarse vertices that bracket this position.
 *
 * This implements the clipmap formula: z' = (1-α)z1 + α*z2
 *
 * @param finePosition Position along the edge (0 to fineResolution-1)
 * @param fineResolution Number of vertices at fine LOD
 * @param coarseResolution Number of vertices at coarse LOD
 * @param getCoarseHeight Function to get height at coarse vertex index
 * @returns Interpolated height that matches the coarser grid
 */
function interpolateToCoarseEdge(
  finePosition: number,
  fineResolution: number,
  coarseResolution: number,
  getCoarseHeight: (coarseIdx: number) => number
): number {
  // Map fine position to coarse coordinate space
  // Fine positions 0...(fineRes-1) map to coarse 0...(coarseRes-1)
  const fineMaxIdx = fineResolution - 1;
  const coarseMaxIdx = coarseResolution - 1;

  // Position in 0..1 space along the edge
  const t = finePosition / fineMaxIdx;

  // Corresponding position in coarse index space
  const coarseFloat = t * coarseMaxIdx;

  // Find the two coarse vertices that bracket this position
  const coarseIdx1 = Math.floor(coarseFloat);
  const coarseIdx2 = Math.min(coarseIdx1 + 1, coarseMaxIdx);

  // Interpolation factor between the two coarse vertices
  const alpha = coarseFloat - coarseIdx1;

  // Get heights at the coarse vertices
  const h1 = getCoarseHeight(coarseIdx1);
  const h2 = getCoarseHeight(coarseIdx2);

  // Interpolate: z' = (1-α)*h1 + α*h2
  return h1 + alpha * (h2 - h1);
}

/**
 * Check if an edge needs stitching to a coarser neighbor
 * Stitching is needed when neighbor LOD > our LOD (coarser = higher LOD number)
 */
function needsStitching(ourLod: number, neighborLod: number): boolean {
  // -1 means no neighbor, no stitching needed
  if (neighborLod < 0) return false;
  // Stitch when neighbor is coarser (higher LOD number)
  return neighborLod > ourLod;
}

function generateChunk(msg: GenerateChunkMessage): ChunkResultMessage {
  const { chunkX, chunkY, chunkZ, worldSeed, chunkSize, resolution, lod, neighborLODs } = msg;

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

  // ============================================================================
  // T-JUNCTION STITCHING - Adjust edge heights to match coarser neighbors
  // ============================================================================
  // When a neighbor has a coarser LOD (higher LOD number), they have fewer
  // vertices along the shared edge. We adjust our edge vertex heights to
  // interpolate to what the coarser grid would produce, eliminating seams.
  //
  // This implements the GPU Gems 2 Geometry Clipmaps technique:
  // z' = (1-α)zf + αzc
  //
  // We keep skirts as a safety net for any remaining precision issues.

  if (neighborLODs) {
    // Helper to get height at a world position using the same noise function
    // This samples at the positions the coarser grid would use
    const getHeightAtWorldPos = (worldX: number, worldZ: number): number => {
      // Get procedural height
      let height = getTerrainHeight(noise, worldX, worldZ);

      // Apply the same zone blending as the main vertex pass
      if (usesRealTerrain) {
        height = getBlendedHeight(realTerrainZone, worldX, worldZ, height, 30);
      }

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

      if (spawnClearing) {
        const dx = worldX - spawnClearing.center.x;
        const dz = worldZ - spawnClearing.center.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const microNoise = Math.sin(worldX * 0.5) * Math.cos(worldZ * 0.5) * 0.3;
        const clearingHeight = spawnClearing.waterLevel + 3 + microNoise;
        if (dist < spawnClearing.radius) {
          height = clearingHeight;
        } else if (dist < spawnClearing.radius + spawnClearing.blendWidth) {
          const t = (dist - spawnClearing.radius) / spawnClearing.blendWidth;
          const smooth = t * t * (3 - 2 * t);
          const targetHeight = Math.max(height, clearingHeight);
          height = clearingHeight + smooth * (targetHeight - clearingHeight);
        }
      }

      return height;
    };

    // SOUTH EDGE (z = 0) - neighbor is at z-1 (south)
    if (needsStitching(lod, neighborLODs.south)) {
      const coarseRes = getEdgeVertexCount(resolution, neighborLODs.south);
      const coarseStep = chunkSize / (coarseRes - 1);

      // Get coarse height function - samples at positions the coarse neighbor uses
      // CRITICAL: Use exact boundary coordinates for first/last vertices to avoid floating-point drift
      const getCoarseHeight = (coarseIdx: number): number => {
        let worldX: number;
        if (coarseIdx === 0) {
          worldX = originX; // Exact boundary
        } else if (coarseIdx === coarseRes - 1) {
          worldX = originX + chunkSize; // Exact boundary
        } else {
          worldX = originX + coarseIdx * coarseStep;
        }
        const worldZ = originZ; // z = 0 edge
        return getHeightAtWorldPos(worldX, worldZ);
      };

      // Adjust heights along south edge
      for (let x = 0; x < effectiveResolution; x++) {
        const idx = x * 3; // z = 0 row
        const stitchedHeight = interpolateToCoarseEdge(
          x, effectiveResolution, coarseRes, getCoarseHeight
        );
        vertices[idx + 1] = stitchedHeight;
      }
    }

    // NORTH EDGE (z = max) - neighbor is at z+1 (north)
    if (needsStitching(lod, neighborLODs.north)) {
      const coarseRes = getEdgeVertexCount(resolution, neighborLODs.north);
      const coarseStep = chunkSize / (coarseRes - 1);

      // CRITICAL: Use exact boundary coordinates for first/last vertices
      const getCoarseHeight = (coarseIdx: number): number => {
        let worldX: number;
        if (coarseIdx === 0) {
          worldX = originX; // Exact boundary
        } else if (coarseIdx === coarseRes - 1) {
          worldX = originX + chunkSize; // Exact boundary
        } else {
          worldX = originX + coarseIdx * coarseStep;
        }
        const worldZ = originZ + chunkSize; // z = max edge
        return getHeightAtWorldPos(worldX, worldZ);
      };

      for (let x = 0; x < effectiveResolution; x++) {
        const idx = ((effectiveResolution - 1) * effectiveResolution + x) * 3;
        const stitchedHeight = interpolateToCoarseEdge(
          x, effectiveResolution, coarseRes, getCoarseHeight
        );
        vertices[idx + 1] = stitchedHeight;
      }
    }

    // WEST EDGE (x = 0) - neighbor is at x-1 (west)
    if (needsStitching(lod, neighborLODs.west)) {
      const coarseRes = getEdgeVertexCount(resolution, neighborLODs.west);
      const coarseStep = chunkSize / (coarseRes - 1);

      // CRITICAL: Use exact boundary coordinates for first/last vertices
      const getCoarseHeight = (coarseIdx: number): number => {
        const worldX = originX; // x = 0 edge
        let worldZ: number;
        if (coarseIdx === 0) {
          worldZ = originZ; // Exact boundary
        } else if (coarseIdx === coarseRes - 1) {
          worldZ = originZ + chunkSize; // Exact boundary
        } else {
          worldZ = originZ + coarseIdx * coarseStep;
        }
        return getHeightAtWorldPos(worldX, worldZ);
      };

      for (let z = 0; z < effectiveResolution; z++) {
        const idx = (z * effectiveResolution) * 3; // x = 0 column
        const stitchedHeight = interpolateToCoarseEdge(
          z, effectiveResolution, coarseRes, getCoarseHeight
        );
        vertices[idx + 1] = stitchedHeight;
      }
    }

    // EAST EDGE (x = max) - neighbor is at x+1 (east)
    if (needsStitching(lod, neighborLODs.east)) {
      const coarseRes = getEdgeVertexCount(resolution, neighborLODs.east);
      const coarseStep = chunkSize / (coarseRes - 1);

      // CRITICAL: Use exact boundary coordinates for first/last vertices
      const getCoarseHeight = (coarseIdx: number): number => {
        const worldX = originX + chunkSize; // x = max edge
        let worldZ: number;
        if (coarseIdx === 0) {
          worldZ = originZ; // Exact boundary
        } else if (coarseIdx === coarseRes - 1) {
          worldZ = originZ + chunkSize; // Exact boundary
        } else {
          worldZ = originZ + coarseIdx * coarseStep;
        }
        return getHeightAtWorldPos(worldX, worldZ);
      };

      for (let z = 0; z < effectiveResolution; z++) {
        const idx = (z * effectiveResolution + effectiveResolution - 1) * 3;
        const stitchedHeight = interpolateToCoarseEdge(
          z, effectiveResolution, coarseRes, getCoarseHeight
        );
        vertices[idx + 1] = stitchedHeight;
      }
    }

    // ========================================================================
    // CORNER VERTEX COORDINATION
    // ========================================================================
    // Corner vertices are where 4 chunks meet. We ensure deterministic heights
    // by sampling at the exact corner world coordinates. All 4 chunks sharing
    // a corner will sample the same world position, guaranteeing agreement.
    //
    // Corner positions (in local grid coordinates):
    //   SW: (0, 0)                   SE: (res-1, 0)
    //   NW: (0, res-1)               NE: (res-1, res-1)

    const cornerConfigs = [
      { x: 0, z: 0, name: 'SW' },
      { x: effectiveResolution - 1, z: 0, name: 'SE' },
      { x: 0, z: effectiveResolution - 1, name: 'NW' },
      { x: effectiveResolution - 1, z: effectiveResolution - 1, name: 'NE' },
    ];

    for (const corner of cornerConfigs) {
      // Sample height at exact corner world position
      // This ensures all 4 chunks meeting at this corner get the same height
      const worldX = corner.x === 0 ? originX : originX + chunkSize;
      const worldZ = corner.z === 0 ? originZ : originZ + chunkSize;
      const cornerHeight = getHeightAtWorldPos(worldX, worldZ);

      const idx = (corner.z * effectiveResolution + corner.x) * 3;
      vertices[idx + 1] = cornerHeight;
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

  // ADAPTIVE SKIRT DEPTH: Coarser LODs have larger gaps, need deeper skirts.
  // Also factor in terrain variance - hilly terrain needs deeper skirts.
  const BASE_SKIRT = 15;
  const LOD_MULTIPLIER = 1.5;

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
  const SKIRT_DEPTH = BASE_SKIRT * Math.pow(LOD_MULTIPLIER, lod) + variance * 0.3;

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
