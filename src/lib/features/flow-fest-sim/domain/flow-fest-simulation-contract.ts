export const FLOW_FEST_MASTER_SEED = "flow-fest-thursday-01" as const;

// Ground speeds the avatar's own clips can actually carry.
//
// These used to be 4.2 and 1.8, chosen to make a square kilometre feel small.
// 4.2 m/s is 2.8x the walk clip's measured 1.517 m/s, which pushes the animator
// past both of its honest corrections: stride saturates at its 1.15 ceiling and
// playback rate saturates at 2x, so the remaining speed comes out as a body
// skating over the ground with its legs cycling too fast. Sprint made it 7.56
// m/s - faster than any human has ever run, on a walk clip.
//
// 1.7 m/s is a brisk walk the clip carries at stride 1.06 and rate 1.06. Sprint
// reaches 3.91 m/s on the run clip's own 3.099 m/s cycle: stride 1.12, rate
// 1.12. Held-Shift traversal barely changes, and the electric unicycle's 14.5
// to 22 m/s finally means something next to it.
export const FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND = 1.7;
export const FLOW_FEST_GAMEPLAY_SPRINT_MULTIPLIER = 2.3;
export const FLOW_FEST_GAMEPLAY_JUMP_FORCE = 5;

/**
 * How fast the walker's horizontal velocity may build, in m/s^2.
 *
 * 8 reaches the 1.7 m/s walk in 0.21 s and the 3.91 m/s run in 0.49 s, which
 * is inside the band a person actually covers and still lands well under the
 * quarter second where WASD starts to feel like it is lagging the key.
 */
export const FLOW_FEST_GAMEPLAY_GROUND_ACCELERATION_METERS_PER_SECOND_SQUARED = 8;

/**
 * How fast it may shed that velocity, in m/s^2.
 *
 * Braking is faster than accelerating because stopping puts both feet down
 * against the ground while starting has to push a standing mass into motion.
 * 12 stops the run in 0.33 s over roughly 0.65 m - about a stride and a half,
 * which is the distance the terminal-stop clips are authored to absorb.
 */
export const FLOW_FEST_GAMEPLAY_GROUND_DECELERATION_METERS_PER_SECOND_SQUARED = 12;

export interface FlowFestProductionCollisionMesh {
  vertices: Float32Array;
  indices: Uint32Array;
  visibleObjectCount: number;
}

export interface FlowFestProductionCollisionSet {
  staticMesh: FlowFestProductionCollisionMesh;
  campEstablishedMesh: FlowFestProductionCollisionMesh;
  festivalActiveMesh: FlowFestProductionCollisionMesh;
  visibleSolidCounts: {
    treeTrunks: number;
    tents: number;
    vehicles: number;
    entranceFixtures: number;
    festivalFixtures: number;
  };
}
