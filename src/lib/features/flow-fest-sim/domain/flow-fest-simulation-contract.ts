export const FLOW_FEST_MASTER_SEED = "flow-fest-thursday-01" as const;

// The survey uses real walking pace for route measurement. The playable festival
// covers a square kilometre, so it needs the brisk navigation pace players expect.
export const FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND = 4.2;
export const FLOW_FEST_GAMEPLAY_SPRINT_MULTIPLIER = 1.8;
export const FLOW_FEST_GAMEPLAY_JUMP_FORCE = 5;

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
