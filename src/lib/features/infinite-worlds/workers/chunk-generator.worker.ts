/**
 * Chunk Generator Worker
 *
 * Runs procedural generation on a separate thread.
 * Main thread stays responsive, never blocks on terrain generation.
 *
 * Communication:
 * - Main → Worker: Generate chunk at (x, y, z) with seed
 * - Worker → Main: Chunk data (vertices, normals, colors)
 */

import { SeededNoise, createChunkRNG, getTerrainHeight, getBiome, getVegetationDensity, shouldPlaceTree } from "../generation/seed-generator";

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
  type: "tree" | "rock" | "grass";
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
}

export type WorkerMessage = GenerateChunkMessage;
export type WorkerResponse = ChunkResultMessage;

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

  // First pass: generate vertices
  for (let z = 0; z < effectiveResolution; z++) {
    for (let x = 0; x < effectiveResolution; x++) {
      const idx = (z * effectiveResolution + x) * 3;

      const worldX = originX + x * step;
      const worldZ = originZ + z * step;
      const height = getTerrainHeight(noise, worldX, worldZ);

      vertices[idx] = x * step;
      vertices[idx + 1] = height;
      vertices[idx + 2] = z * step;

      // Color based on biome and height
      const biome = getBiome(noise, worldX, worldZ);
      const color = getBiomeColor(biome, height);
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

  // Generate indices for triangle mesh
  const quadCount = (effectiveResolution - 1) * (effectiveResolution - 1);
  const indices = new Uint32Array(quadCount * 6);
  let indexIdx = 0;

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

  // Generate vegetation (for chunks up to LOD 2)
  const vegetation: VegetationData[] = [];

  if (lod <= 2) {
    const vegStep = Math.max(2, step);
    for (let z = 0; z < chunkSize; z += vegStep) {
      for (let x = 0; x < chunkSize; x += vegStep) {
        const worldX = originX + x;
        const worldZ = originZ + z;
        const height = getTerrainHeight(noise, worldX, worldZ);
        const localBiome = getBiome(noise, worldX, worldZ);
        const density = getVegetationDensity(noise, worldX, worldZ);

        // Trees in forests and plains (not in water, desert, or high mountains)
        if (localBiome === "forest" || localBiome === "plains") {
          if (shouldPlaceTree(worldSeed, worldX, worldZ, density)) {
            vegetation.push({
              type: "tree",
              x: x,
              y: height,
              z: z,
              rotation: rng() * Math.PI * 2,
              scale: 0.8 + rng() * 0.4,
            });
          }
        }

        // Rocks in mountains and desert
        if (localBiome === "mountains" || localBiome === "desert") {
          // Use different seed offset for rocks
          const rockChance = rng();
          if (rockChance < density * 0.3) {
            vegetation.push({
              type: "rock",
              x: x + (rng() - 0.5) * 2,
              y: height,
              z: z + (rng() - 0.5) * 2,
              rotation: rng() * Math.PI * 2,
              scale: 0.5 + rng() * 1.5,
            });
          }
        }
      }
    }
  }

  // Determine primary biome for this chunk
  const centerX = originX + chunkSize / 2;
  const centerZ = originZ + chunkSize / 2;
  const biome = getBiome(noise, centerX, centerZ);

  // Only log chunks that should have vegetation (LOD <= 2) or have vegetation
  if (lod <= 2 || vegetation.length > 0) {
    console.log(`[ChunkWorker] Chunk (${chunkX},${chunkZ}) LOD ${lod} biome ${biome}: ${vegetation.length} vegetation`);
  }

  return {
    type: "chunk-result",
    id: msg.id,
    chunkX,
    chunkY,
    chunkZ,
    vertices,
    normals,
    colors,
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

// ============================================================================
// WORKER MESSAGE HANDLER
// ============================================================================

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  if (msg.type === "generate-chunk") {
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
  }
};
