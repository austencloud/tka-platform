import type { FlowFestTerrainHostMode } from "./flow-fest-terrain-host";

export interface FlowFestGrayboxReadyDetails {
  hostMode: FlowFestTerrainHostMode;
  buildMilliseconds: number;
  renderMeshes: number;
  colliderMeshes: number;
  vertices: number;
  triangles: number;
  geometryBytes: number;
  barrierCells: number;
  spawnGroundY: number;
  eyeHeightMeters: number;
  /**
   * Bilinear ground height from the same measured heightmap the colliders use.
   * Hosts that need terrain relief outside the scene — the positional audio
   * field's line-of-sight occlusion pass, for one — sample through this rather
   * than loading a second copy of the terrain.
   */
  sampleGroundY: (x: number, z: number) => number;
}
