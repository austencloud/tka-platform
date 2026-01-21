/**
 * Game State Types
 *
 * Core types for game state representation.
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  yaw: number;
  pitch: number;
}

export interface GameState {
  position: Vector3;
  rotation: Rotation;
  velocity: Vector3;
  grounded: boolean;
  cameraMode: string;
  isPlaying: boolean;
  hasSequence: boolean;
  timestamp: number;
}

export interface CompactGameState {
  x: number;
  y: number;
  z: number;
  g: boolean; // grounded
}

export interface SceneObject {
  id: string;
  type: string;
  position: Vector3;
  distance: number;
  interactable?: boolean;
  action?: string;
}

export interface TerrainInfo {
  type: string;
  height: number;
  biome?: string;
}

export interface SceneInfo {
  terrain: TerrainInfo;
  objects: SceneObject[];
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export interface RaycastResult {
  hit: boolean;
  point?: Vector3;
  normal?: Vector3;
  distance?: number;
  object?: {
    id: string;
    type: string;
  };
}

export interface InteractionResult {
  success: boolean;
  action: string;
  target: string;
  result?: unknown;
  error?: string;
}
