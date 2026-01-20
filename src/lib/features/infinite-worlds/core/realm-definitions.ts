/**
 * Realm Definitions
 *
 * Pre-configured realms for the 3D worlds system.
 * Each realm has unique terrain, physics, and feature settings.
 */

import type { RealmConfig } from "./realm-config";

// ============================================================================
// HANNON'S CAMP
// ============================================================================

/**
 * Hannon's Camp America
 *
 * Real-world terrain data from the Kinetic Fire festival site
 * in Southwest Ohio. Features satellite imagery overlay and
 * object placement for event planning.
 */
export const HANNONS_CAMP_CONFIG: RealmConfig = {
  id: "hannons-camp",
  name: "Hannon's Camp",
  description: "Kinetic Fire festival site - real terrain from Southwest Ohio",

  terrain: {
    type: "real-terrain",
    dataPath: "../data/hannons-camp-terrain.json",
  },

  chunks: {
    size: 32,
    viewDistance: 256,
    lodDistances: [32, 64, 128, 256],
  },

  features: {
    objectPlacement: true,
    boundaryEditing: true,
    satelliteImagery: true,
  },

  spawn: {
    // Main field area
    position: [231, 0, -96],
    // Face roughly east (88 degrees)
    yaw: (88 * Math.PI) / 180,
  },

  physics: {
    walkSpeed: 3,
    runSpeed: 8,
    flySpeed: 50,
    gravity: 25,
    jumpForce: 8,
    playerHeight: 1.7,
  },
};

// ============================================================================
// PERFORMANCE STAGE
// ============================================================================

/**
 * Performance Stage
 *
 * Stage area surrounded by forest. The stage is a flat circular
 * area at the world origin, with forest terrain blending in beyond.
 * Users can perform sequences on the stage grid, then walk away
 * into the procedural forest terrain.
 */
export const PERFORMANCE_STAGE_CONFIG: RealmConfig = {
  id: "performance-stage",
  name: "Performance Stage",
  description: "Stage area surrounded by forest",

  terrain: {
    type: "procedural",
    seed: 42,  // Forest seed
  },

  chunks: {
    size: 32,
    viewDistance: 256,
    lodDistances: [32, 64, 128, 256],
  },

  features: {
    objectPlacement: false,
    boundaryEditing: false,
    satelliteImagery: false,
  },

  spawn: {
    position: [0, 0, 0],  // Center of stage
    yaw: 0,
  },

  physics: {
    walkSpeed: 3.5,
    runSpeed: 7,
    flySpeed: 50,
    gravity: 9.81,
    jumpForce: 5,
    playerHeight: 1.7,
  },

  stageZone: {
    enabled: true,
    radius: 15,      // 15m flat stage area
    blendWidth: 10,  // 10m transition to forest
  },
};

// ============================================================================
// PROCEDURAL WORLD
// ============================================================================

/**
 * Infinite Procedural World
 *
 * Procedurally generated terrain with no boundaries.
 * Good for exploration and testing.
 */
export const PROCEDURAL_WORLD_CONFIG: RealmConfig = {
  id: "procedural",
  name: "Infinite World",
  description: "Procedurally generated infinite terrain",

  terrain: {
    type: "procedural",
    seed: 42,
  },

  chunks: {
    size: 32,
    viewDistance: 256,
    lodDistances: [32, 64, 128, 256],
  },

  features: {
    objectPlacement: false,
    boundaryEditing: false,
    satelliteImagery: false,
  },

  spawn: {
    // Start elevated for procedural terrain
    position: [0, 50, 0],
    yaw: 0,
  },

  physics: {
    walkSpeed: 5,
    runSpeed: 10,
    flySpeed: 50,
    gravity: 25,
    jumpForce: 8,
    playerHeight: 1.7,
  },
};

// ============================================================================
// FLAT TESTING REALM
// ============================================================================

/**
 * Flat Testing Realm
 *
 * Simple flat plane for testing object placement
 * and other features without terrain complexity.
 */
export const FLAT_TESTING_CONFIG: RealmConfig = {
  id: "flat-testing",
  name: "Flat Testing",
  description: "Flat plane for testing features",

  terrain: {
    type: "procedural",
    seed: 0, // Seed 0 = flat terrain
  },

  chunks: {
    size: 64,
    viewDistance: 128,
    lodDistances: [64, 128],
  },

  features: {
    objectPlacement: true,
    boundaryEditing: true,
    satelliteImagery: false,
  },

  spawn: {
    position: [0, 2, 0],
    yaw: 0,
  },

  physics: {
    walkSpeed: 5,
    runSpeed: 10,
    flySpeed: 30,
    gravity: 25,
    jumpForce: 8,
    playerHeight: 1.7,
  },
};

// ============================================================================
// REALM REGISTRY
// ============================================================================

/**
 * All available realms
 */
export const REALM_CONFIGS: Record<string, RealmConfig> = {
  "hannons-camp": HANNONS_CAMP_CONFIG,
  "performance-stage": PERFORMANCE_STAGE_CONFIG,
  procedural: PROCEDURAL_WORLD_CONFIG,
  "flat-testing": FLAT_TESTING_CONFIG,
};

/**
 * Get realm config by ID
 */
export function getRealmConfig(id: string): RealmConfig | null {
  return REALM_CONFIGS[id] ?? null;
}

/**
 * List all available realm IDs
 */
export function listRealmIds(): string[] {
  return Object.keys(REALM_CONFIGS);
}

/**
 * Get default realm config
 */
export function getDefaultRealmConfig(): RealmConfig {
  return PROCEDURAL_WORLD_CONFIG;
}
