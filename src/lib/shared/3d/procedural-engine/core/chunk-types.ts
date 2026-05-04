import type { VegetationData } from "../workers/chunk-worker-messages";
import type { DrainageData } from "../generation/gpu/terrain-compute-types";

export interface ChunkEntity {
  chunk: {
    chunkX: number;
    chunkY: number;
    chunkZ: number;
    lod: number;
    seed: number;
    generated: boolean;
    lastAccessTime: number;
  };
  mesh?: {
    object3D: import("three").Object3D;
    visible: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
  };
}

export function createChunkEntity(
  chunkX: number,
  chunkY: number,
  chunkZ: number,
  seed: number,
): ChunkEntity {
  return {
    chunk: {
      chunkX,
      chunkY,
      chunkZ,
      lod: 0,
      seed,
      generated: false,
      lastAccessTime: Date.now(),
    },
  };
}

export interface ChunkManagerConfig {
  chunkSize: number;
  viewDistance: number;
  lodDistances: number[];
  maxConcurrentLoads: number;
  memoryBudgetMB: number;
  resolution: number;
}

export interface ChunkState {
  entity: ChunkEntity;
  meshData: ChunkMeshData | null;
  loadState: "pending" | "loading" | "loaded" | "unloading";
  priority: number;
  lod: number;
  lastAccessTime: number;
  memoryBytes: number;
}

export interface ChunkMeshData {
  vertices: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  vegetation: VegetationData[];
  biome: string;
  blendWeights1: Float32Array;
  blendWeights2: Float32Array;
  drainage?: DrainageData;
}

export type ChunkKey = string;
