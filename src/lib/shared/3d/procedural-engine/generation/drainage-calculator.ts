/**
 * Drainage Calculator
 *
 * Implements D8 flow direction and flow accumulation algorithms for
 * realistic water placement that follows terrain topology.
 *
 * The D8 algorithm assigns one of 8 flow directions to each cell based on
 * the steepest downslope neighbor. Flow accumulation then counts how many
 * upstream cells drain through each point.
 *
 * High flow accumulation + low elevation = lakes and rivers
 *
 * References:
 * - O'Callaghan & Mark (1984) "The extraction of drainage networks"
 * - Jenson & Domingue (1988) "Extracting topographic structure from DEMs"
 */

import type { DrainageConfig, DrainageData } from "./gpu/terrain-compute-types";

/**
 * Flow direction encoding (D8 algorithm)
 * Encoded as direction index 0-7, or 255 for sink (local minimum)
 *
 *   NW(7)  N(0)  NE(1)
 *    W(6)   X   E(2)
 *   SW(5)  S(4)  SE(3)
 */
const DIRECTION_DX = [0, 1, 1, 1, 0, -1, -1, -1]; // Column offsets
const DIRECTION_DZ = [-1, -1, 0, 1, 1, 1, 0, -1]; // Row offsets
const DIRECTION_DIST = [
  1.0, // N
  Math.SQRT2, // NE
  1.0, // E
  Math.SQRT2, // SE
  1.0, // S
  Math.SQRT2, // SW
  1.0, // W
  Math.SQRT2, // NW
];

const SINK_MARKER = 255;

/**
 * Calculate drainage data for a terrain chunk
 *
 * @param heights - Height values per vertex (1D array, row-major)
 * @param resolution - Grid resolution (vertices per side)
 * @param chunkSize - World units per chunk side
 * @param config - Drainage configuration
 * @param oceanLevel - Height threshold for ocean
 * @returns Drainage data with flow direction, accumulation, and water mask
 */
export function calculateDrainage(
  heights: Float32Array,
  resolution: number,
  chunkSize: number,
  config: DrainageConfig,
  oceanLevel: number
): DrainageData {
  const vertexCount = resolution * resolution;
  const _step = chunkSize / (resolution - 1);

  // Step 1: Calculate flow direction for each cell (D8 algorithm)
  const flowDirection = calculateFlowDirection(heights, resolution);

  // Step 2: Calculate flow accumulation (how much drains through each cell)
  const drainageAccumulation = calculateFlowAccumulation(flowDirection, resolution);

  // Step 3: Normalize accumulation to 0-1 range
  const maxAccumulation = Math.max(...drainageAccumulation);
  const normalizedAccumulation = new Float32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    normalizedAccumulation[i] = maxAccumulation > 0 ? (drainageAccumulation[i] ?? 0) / maxAccumulation : 0;
  }

  // Step 4: Calculate water mask based on drainage + height
  const { waterMask, waterDepth, waterBounds } = calculateWaterMask(
    heights,
    normalizedAccumulation,
    resolution,
    config,
    oceanLevel
  );

  return {
    drainageAccumulation: normalizedAccumulation,
    flowDirection,
    waterMask,
    waterDepth,
    waterBounds,
  };
}

/**
 * D8 Flow Direction Algorithm
 *
 * For each cell, finds the steepest downhill neighbor and assigns
 * flow direction to that neighbor. Uses slope (drop/distance) to
 * account for diagonal neighbors being farther away.
 */
function calculateFlowDirection(heights: Float32Array, resolution: number): Uint8Array {
  const flowDir = new Uint8Array(resolution * resolution);

  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const idx = z * resolution + x;
      const height = heights[idx]!;

      let steepestDir = SINK_MARKER;
      let steepestSlope = 0;

      // Check all 8 neighbors
      for (let dir = 0; dir < 8; dir++) {
        const nx = x + DIRECTION_DX[dir]!;
        const nz = z + DIRECTION_DZ[dir]!;

        // Skip out-of-bounds neighbors
        if (nx < 0 || nx >= resolution || nz < 0 || nz >= resolution) {
          continue;
        }

        const neighborIdx = nz * resolution + nx;
        const neighborHeight = heights[neighborIdx]!;

        // Calculate slope (drop / distance)
        const drop = height - neighborHeight;
        const distance = DIRECTION_DIST[dir]!;
        const slope = drop / distance;

        // Track steepest downhill direction
        if (slope > steepestSlope) {
          steepestSlope = slope;
          steepestDir = dir;
        }
      }

      flowDir[idx] = steepestDir;
    }
  }

  return flowDir;
}

/**
 * Flow Accumulation Algorithm
 *
 * Counts how many upstream cells drain through each cell.
 * Uses topological sort approach: process cells in order of decreasing height.
 *
 * Every cell contributes 1 + its upstream accumulation to downstream neighbor.
 */
function calculateFlowAccumulation(flowDirection: Uint8Array, resolution: number): Float32Array {
  const vertexCount = resolution * resolution;
  const accumulation = new Float32Array(vertexCount);

  // Initialize all cells with 1 (self)
  accumulation.fill(1);

  // Create sorted indices by height (process high to low)
  // This ensures upstream cells are processed before downstream
  const indices = new Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    indices[i] = i;
  }

  // We need heights to sort - reconstruct from flow direction isn't possible
  // So we'll use a different approach: recursive accumulation with memoization

  // Build upstream count (how many cells flow into each cell)
  const upstreamCount = new Uint16Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    const dir = flowDirection[i]!;
    if (dir !== SINK_MARKER) {
      const x = i % resolution;
      const z = Math.floor(i / resolution);
      const nx = x + DIRECTION_DX[dir]!;
      const nz = z + DIRECTION_DZ[dir]!;
      if (nx >= 0 && nx < resolution && nz >= 0 && nz < resolution) {
        const neighborIdx = nz * resolution + nx;
        upstreamCount[neighborIdx] = (upstreamCount[neighborIdx] ?? 0) + 1;
      }
    }
  }

  // Process cells with no upstream first (sources), then propagate
  const queue: number[] = [];

  // Find all source cells (no upstream contributors)
  for (let i = 0; i < vertexCount; i++) {
    if (upstreamCount[i] === 0) {
      queue.push(i);
    }
  }

  // Process queue - each cell passes its accumulation downstream
  while (queue.length > 0) {
    const idx = queue.shift()!;
    const dir = flowDirection[idx]!;

    if (dir === SINK_MARKER) {
      continue;
    }

    const x = idx % resolution;
    const z = Math.floor(idx / resolution);
    const nx = x + DIRECTION_DX[dir]!;
    const nz = z + DIRECTION_DZ[dir]!;

    if (nx >= 0 && nx < resolution && nz >= 0 && nz < resolution) {
      const neighborIdx = nz * resolution + nx;

      // Add our accumulation to downstream neighbor
      accumulation[neighborIdx] = (accumulation[neighborIdx] ?? 0) + (accumulation[idx] ?? 0);

      // Decrease upstream count and add to queue if ready
      upstreamCount[neighborIdx] = (upstreamCount[neighborIdx] ?? 0) - 1;
      if ((upstreamCount[neighborIdx] ?? 0) === 0) {
        queue.push(neighborIdx);
      }
    }
  }

  return accumulation;
}

/**
 * Calculate water mask and depth based on drainage accumulation
 *
 * Water appears where:
 * 1. Drainage accumulation is above threshold
 * 2. Height is below ocean level + tolerance
 *
 * This creates realistic lakes that pool in terrain depressions
 * where water would naturally collect.
 */
function calculateWaterMask(
  heights: Float32Array,
  accumulation: Float32Array,
  resolution: number,
  config: DrainageConfig,
  oceanLevel: number
): {
  waterMask: Float32Array;
  waterDepth: Float32Array;
  waterBounds: DrainageData["waterBounds"];
} {
  const vertexCount = resolution * resolution;
  const waterMask = new Float32Array(vertexCount);
  const waterDepth = new Float32Array(vertexCount);

  const maxWaterHeight = oceanLevel + config.heightTolerance;

  // Track water bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let hasWater = false;

  // First pass: mark water cells
  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const idx = z * resolution + x;
      const height = heights[idx]!;
      const drainage = accumulation[idx]!;

      // Water conditions:
      // 1. Height is below max water height
      // 2. Drainage accumulation exceeds threshold
      const isBelowWaterLine = height <= maxWaterHeight;
      const hasSufficientDrainage = drainage >= config.drainageThreshold;

      if (isBelowWaterLine && hasSufficientDrainage) {
        waterMask[idx] = 1.0;
        waterDepth[idx] = Math.max(0, maxWaterHeight - height);
        hasWater = true;

        // Update bounds
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }
  }

  // Second pass: flood fill to ensure connected pools
  // Remove isolated water cells (smaller than minPoolSize)
  if (config.minPoolSize > 1) {
    removeIsolatedPools(waterMask, resolution, config.minPoolSize);
  }

  // Third pass: smooth edges if enabled
  if (config.edgeSmoothing) {
    smoothWaterEdges(waterMask, waterDepth, heights, resolution, maxWaterHeight);
  }

  return {
    waterMask,
    waterDepth,
    waterBounds: {
      minX: hasWater ? minX : 0,
      maxX: hasWater ? maxX : 0,
      minZ: hasWater ? minZ : 0,
      maxZ: hasWater ? maxZ : 0,
      hasWater,
    },
  };
}

/**
 * Remove isolated water pools smaller than minimum size
 * Uses flood-fill to find connected components
 */
function removeIsolatedPools(waterMask: Float32Array, resolution: number, minSize: number): void {
  const visited = new Uint8Array(resolution * resolution);
  const dx = [1, -1, 0, 0, 1, -1, 1, -1];
  const dz = [0, 0, 1, -1, 1, -1, -1, 1];

  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const idx = z * resolution + x;

      if (waterMask[idx]! > 0 && !visited[idx]) {
        // Flood fill to find pool
        const pool: number[] = [];
        const queue: number[] = [idx];
        visited[idx] = 1;

        while (queue.length > 0) {
          const currentIdx = queue.shift()!;
          pool.push(currentIdx);

          const cx = currentIdx % resolution;
          const cz = Math.floor(currentIdx / resolution);

          for (let d = 0; d < 8; d++) {
            const nx = cx + dx[d]!;
            const nz = cz + dz[d]!;

            if (nx >= 0 && nx < resolution && nz >= 0 && nz < resolution) {
              const neighborIdx = nz * resolution + nx;
              if (waterMask[neighborIdx]! > 0 && !visited[neighborIdx]) {
                visited[neighborIdx] = 1;
                queue.push(neighborIdx);
              }
            }
          }
        }

        // Remove pool if too small
        if (pool.length < minSize) {
          for (const poolIdx of pool) {
            waterMask[poolIdx] = 0;
          }
        }
      }
    }
  }
}

/**
 * Smooth water edges for natural-looking shores
 * Applies gradual falloff at water boundaries
 */
function smoothWaterEdges(
  waterMask: Float32Array,
  waterDepth: Float32Array,
  heights: Float32Array,
  resolution: number,
  maxWaterHeight: number
): void {
  const dx = [1, -1, 0, 0];
  const dz = [0, 0, 1, -1];

  // Create copy for reading while we modify
  const originalMask = new Float32Array(waterMask);

  for (let z = 1; z < resolution - 1; z++) {
    for (let x = 1; x < resolution - 1; x++) {
      const idx = z * resolution + x;

      // Only process land cells adjacent to water
      if (originalMask[idx]! > 0) continue;

      // Check if any neighbor is water
      let hasWaterNeighbor = false;
      let waterNeighborCount = 0;

      for (let d = 0; d < 4; d++) {
        const neighborIdx = (z + dz[d]!) * resolution + (x + dx[d]!);
        if (originalMask[neighborIdx]! > 0) {
          hasWaterNeighbor = true;
          waterNeighborCount++;
        }
      }

      if (hasWaterNeighbor) {
        // Partial water based on neighbor count and height
        const height = heights[idx]!;
        const heightFactor = Math.max(0, 1 - (height - maxWaterHeight) / 2);
        const neighborFactor = waterNeighborCount / 4;

        const partialWater = heightFactor * neighborFactor * 0.5;

        if (partialWater > 0.1) {
          waterMask[idx] = partialWater;
          waterDepth[idx] = Math.max(0, maxWaterHeight - height) * partialWater;
        }
      }
    }
  }
}
