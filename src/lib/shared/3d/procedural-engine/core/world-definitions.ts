/**
 * Realm Definitions
 *
 * Pre-configured realms for the 3D worlds system.
 * Each realm has unique terrain, physics, and feature settings.
 */

import type { RealmConfig } from "./world-config";


/**
 * Flow Fest Sim Earth Site
 *
 * A neutral festival-simulator landscape built from public, meter-true Earth
 * data in southwest Ohio. The internal destination id is preserved while the
 * disabled prototype migrates away from its earlier branded name.
 */
export const FLOW_FEST_SIM_CONFIG: RealmConfig = {
  id: "flow-fest-sim",
  name: "Flow Fest Sim",
  description: "Meter-true Earth terrain for a fictional flow festival",

  terrain: {
    type: "real-terrain",
    dataPath: "/data/flow-fest-sim/terrain.manifest.json",
  },

  chunks: {
    size: 32,
    viewDistance: 256,
    lodDistances: [32, 64, 128, 256],
  },

  features: {
    objectPlacement: true,
    boundaryEditing: true,
    satelliteImagery: false,
  },

  spawn: {
    // Gate 1 will move this to the approved arrival route. Until then the
    // measured origin is the only location the foundation can guarantee.
    position: [0, 5, 0],
    yaw: 0,
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

/** @deprecated Internal compatibility name while the disabled feature folder migrates. */
export const HANNONS_CAMP_CONFIG = FLOW_FEST_SIM_CONFIG;


/**
 * Performance Stage
 *
 * Spawn in a natural campground clearing, then browse procedural forest.
 * The clearing is a grassy meadow above water level with campground objects
 * (fire pit, tent, log seating, torches). Forest blends in at the perimeter.
 */
export const PERFORMANCE_STAGE_CONFIG: RealmConfig = {
  id: "performance-stage",
  name: "Performance Stage",
  description: "Campground clearing surrounded by forest",

  terrain: {
    type: "procedural",
    seed: 42, // Forest seed
    waterLevel: 5, // Water at Y=5
  },

  chunks: {
    size: 32,
    viewDistance: 256,
    // Single LOD - no seams
    lodDistances: [],
  },

  features: {
    objectPlacement: false,
    boundaryEditing: false,
    satelliteImagery: false,
  },

  spawn: {
    position: [0, 50, 0], // Center of clearing - Y ignored, snapToGround finds actual ground
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

  // Spawn clearing replaces stage zone for a more natural feel
  spawnClearing: {
    enabled: true,
    center: { x: 0, z: 0 },
    radius: 20, // 20m clear meadow
    blendWidth: 15, // 15m transition to forest
    campground: {
      enabled: true,
      firePit: true,
      tent: true,
      seatingLogs: 3,
      torches: 4,
    },
  },
};


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
    waterLevel: 5, // Water at Y=5, prevents spawning in underwater pits
  },

  chunks: {
    size: 32,
    viewDistance: 256,
    // Single LOD - no transitions, no seams. Just works.
    lodDistances: [],
  },

  features: {
    objectPlacement: false,
    boundaryEditing: false,
    satelliteImagery: false,
  },

  spawn: {
    position: [0, 50, 0], // Y ignored, snapToGround finds actual ground
    yaw: 0,
  },

  physics: {
    walkSpeed: 5,
    runSpeed: 10,
    flySpeed: 50,
    gravity: 12, // Low gravity for floaty exploration feel
    jumpForce: 10, // Good jump height with low gravity
    playerHeight: 1.7,
  },

  // Spawn clearing ensures player spawns above water level in a safe meadow
  spawnClearing: {
    enabled: true,
    center: { x: 0, z: 0 },
    radius: 15, // 15m clear meadow
    blendWidth: 10, // 10m transition to natural terrain
    campground: {
      enabled: false, // No campground objects for procedural world
      firePit: false,
      tent: false,
      seatingLogs: 0,
      torches: 0,
    },
  },
};


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
    // Single LOD - no seams
    lodDistances: [],
  },

  features: {
    objectPlacement: true,
    boundaryEditing: true,
    satelliteImagery: false,
  },

  spawn: {
    position: [0, 50, 0], // Y ignored, snapToGround finds actual ground
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


/**
 * Museum Grounds
 *
 * Open-air museum with pavilion structures on natural terrain.
 * Large clearing for museum pavilions, no campground objects.
 * Player spawns facing pavilions (negative Z direction).
 */
export const MUSEUM_GROUNDS_CONFIG: RealmConfig = {
  id: "museum-grounds",
  name: "Museum Grounds",
  description: "Open-air museum with pavilion structures in natural terrain",

  terrain: {
    type: "procedural",
    seed: 314,
    waterLevel: 5,
  },

  chunks: {
    size: 32,
    viewDistance: 256,
    lodDistances: [],
  },

  features: {
    objectPlacement: false,
    boundaryEditing: false,
    satelliteImagery: false,
  },

  spawn: {
    position: [0, 50, 0],
    yaw: Math.PI, // Face toward pavilions (negative Z)
  },

  physics: {
    walkSpeed: 3.5,
    runSpeed: 7,
    flySpeed: 50,
    gravity: 9.81,
    jumpForce: 5,
    playerHeight: 1.7,
  },

  spawnClearing: {
    enabled: true,
    center: { x: 0, z: 0 },
    radius: 40,
    blendWidth: 20,
    campground: {
      enabled: false,
      firePit: false,
      tent: false,
      seatingLogs: 0,
      torches: 0,
    },
  },
};

// ARCHIVE - THE KINETIC ARCHIVE (Wing 1: Discovery Chamber)

/**
 * Archive Wing 1 - Discovery Chamber
 *
 * Indoor cave room for the narrative museum experience.
 * Flat terrain with massive clearing so the room sits on clean ground.
 * No vegetation, no water, no campground objects.
 * Player spawns inside the chamber facing the exhibit.
 */
export const ARCHIVE_WING1_CONFIG: RealmConfig = {
  id: "archive-wing1",
  name: "The Kinetic Archive",
  description: "Wing 1: Ancient Origins - The Discovery Chamber",

  terrain: {
    type: "procedural",
    seed: 0, // Flat terrain
    waterLevel: 5, // Standard level; room sits above at Y=8
  },

  chunks: {
    size: 32,
    viewDistance: 64, // Minimal - indoor scene
    lodDistances: [],
  },

  features: {
    objectPlacement: false,
    boundaryEditing: false,
    satelliteImagery: false,
  },

  spawn: {
    position: [0, 50, 3.5], // Inside room; Y=50 is high, ground snap finds correct Y
    yaw: 0, // Default facing; camera controller handles orientation
  },

  physics: {
    walkSpeed: 2.5, // Slower walk for museum atmosphere
    runSpeed: 4,
    flySpeed: 20,
    gravity: 9.81,
    jumpForce: 4,
    playerHeight: 1.7,
  },

  spawnClearing: {
    enabled: true,
    center: { x: 0, z: 0 },
    radius: 60, // Large flat area
    blendWidth: 20,
    campground: {
      enabled: false,
      firePit: false,
      tent: false,
      seatingLogs: 0,
      torches: 0,
    },
  },
};


/**
 * All available realms
 */
export const REALM_CONFIGS: Record<string, RealmConfig> = {
  "flow-fest-sim": FLOW_FEST_SIM_CONFIG,
  "performance-stage": PERFORMANCE_STAGE_CONFIG,
  procedural: PROCEDURAL_WORLD_CONFIG,
  "flat-testing": FLAT_TESTING_CONFIG,
  "museum-grounds": MUSEUM_GROUNDS_CONFIG,
  "archive-wing1": ARCHIVE_WING1_CONFIG,
};

export function getRealmConfig(id: string): RealmConfig | null {
  return REALM_CONFIGS[id] ?? null;
}

/**
 * List all available realm IDs
 */
export function listRealmIds(): string[] {
  return Object.keys(REALM_CONFIGS);
}

export function getDefaultRealmConfig(): RealmConfig {
  return PROCEDURAL_WORLD_CONFIG;
}
