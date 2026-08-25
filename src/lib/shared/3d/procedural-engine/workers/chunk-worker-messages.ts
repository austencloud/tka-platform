import type { DrainageData } from "../generation/gpu/terrain-compute-types";

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
  resolution: number;
  lod: number;
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
    verticalOriginMeters: number;
    verticalScale: number;
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
  blendWeights1: Float32Array;
  blendWeights2: Float32Array;
  drainage?: DrainageData;
}

export interface VegetationData {
  type:
    | "tree1"
    | "tree2"
    | "tree3"
    | "rock1"
    | "rock2"
    | "bush1"
    | "bush2"
    | "grass";
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
}

export interface SetStageZoneMessage {
  type: "set-stage-zone";
  center: { x: number; z: number };
  radius: number;
  blendWidth: number;
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

export type WorkerMessage =
  | GenerateChunkMessage
  | LoadRealZoneMessage
  | ClearRealZoneMessage
  | SetStageZoneMessage
  | ClearStageZoneMessage
  | SetSpawnClearingMessage
  | ClearSpawnClearingMessage;

export type WorkerResponse = ChunkResultMessage | RealZoneLoadedMessage;
