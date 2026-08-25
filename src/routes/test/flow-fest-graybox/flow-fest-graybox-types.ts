import type { FlowFestTerrainHostMode } from "./flow-fest-terrain-host";

export interface FlowFestGrayboxReadyDetails {
  hostMode: FlowFestTerrainHostMode;
  buildMilliseconds: number;
  renderMeshes: number;
  colliderMeshes: number;
  vertices: number;
  triangles: number;
  geometryBytes: number;
  barrierProxies: number;
  spawnGroundY: number;
  eyeHeightMeters: number;
}
