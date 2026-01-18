/**
 * Realm Configuration
 *
 * Defines the configuration structure for 3D world realms.
 * Each realm has its own terrain, physics, spawn, and feature settings.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Terrain configuration
 */
export interface TerrainConfig {
  /** Terrain generation type */
  type: "procedural" | "real-terrain";
  /** Path to terrain data JSON (for real-terrain) */
  dataPath?: string;
  /** Random seed (for procedural) */
  seed?: number;
}

/**
 * Chunk/LOD configuration
 */
export interface ChunkConfig {
  /** Chunk size in world units */
  size: number;
  /** View distance in world units */
  viewDistance: number;
  /** LOD distance thresholds */
  lodDistances: number[];
}

/**
 * Feature flags
 */
export interface FeatureConfig {
  /** Enable object placement system */
  objectPlacement: boolean;
  /** Enable boundary editing system */
  boundaryEditing: boolean;
  /** Enable satellite imagery overlay */
  satelliteImagery: boolean;
}

/**
 * Spawn point configuration
 */
export interface SpawnConfig {
  /** World position [x, y, z] */
  position: [number, number, number];
  /** Initial yaw angle in radians */
  yaw: number;
}

/**
 * Physics configuration
 */
export interface PhysicsConfig {
  /** Walking speed in m/s */
  walkSpeed: number;
  /** Running speed in m/s */
  runSpeed: number;
  /** Flying speed in m/s */
  flySpeed: number;
  /** Gravity acceleration in m/s² */
  gravity: number;
  /** Jump force */
  jumpForce: number;
  /** Player eye height in meters */
  playerHeight: number;
}

/**
 * Complete realm configuration
 */
export interface RealmConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description?: string;

  /** Terrain generation settings */
  terrain: TerrainConfig;

  /** Chunk and LOD settings */
  chunks: ChunkConfig;

  /** Feature toggles */
  features: FeatureConfig;

  /** Player spawn configuration */
  spawn: SpawnConfig;

  /** Physics settings */
  physics: PhysicsConfig;
}

// ============================================================================
// DEFAULTS
// ============================================================================

/**
 * Default physics configuration
 */
export const DEFAULT_PHYSICS: PhysicsConfig = {
  walkSpeed: 5,
  runSpeed: 10,
  flySpeed: 50,
  gravity: 25,
  jumpForce: 8,
  playerHeight: 1.7,
};

/**
 * Default chunk configuration
 */
export const DEFAULT_CHUNKS: ChunkConfig = {
  size: 32,
  viewDistance: 256,
  lodDistances: [32, 64, 128, 256],
};

/**
 * Default feature configuration (all disabled)
 */
export const DEFAULT_FEATURES: FeatureConfig = {
  objectPlacement: false,
  boundaryEditing: false,
  satelliteImagery: false,
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Merge partial config with defaults
 */
export function createRealmConfig(partial: Partial<RealmConfig> & { id: string; name: string }): RealmConfig {
  return {
    id: partial.id,
    name: partial.name,
    description: partial.description,
    terrain: partial.terrain ?? { type: "procedural" },
    chunks: { ...DEFAULT_CHUNKS, ...partial.chunks },
    features: { ...DEFAULT_FEATURES, ...partial.features },
    spawn: partial.spawn ?? { position: [0, 50, 0], yaw: 0 },
    physics: { ...DEFAULT_PHYSICS, ...partial.physics },
  };
}

/**
 * Validate realm configuration
 */
export function validateRealmConfig(config: RealmConfig): string[] {
  const errors: string[] = [];

  if (!config.id) {
    errors.push("Realm ID is required");
  }

  if (!config.name) {
    errors.push("Realm name is required");
  }

  if (config.terrain.type === "real-terrain" && !config.terrain.dataPath) {
    errors.push("Real terrain requires a dataPath");
  }

  if (config.chunks.size <= 0) {
    errors.push("Chunk size must be positive");
  }

  if (config.physics.playerHeight <= 0) {
    errors.push("Player height must be positive");
  }

  return errors;
}
