import type { WingTheme } from "./museum-grid-types";
import type { Object3D } from "three";

/** A merged straight stretch of wall in TILE coordinates (inclusive endpoints). */
export interface WallRun {
  axis: "x" | "z"; // direction the run advances
  fixed: number; // the constant tile coordinate (y for x-runs, x for z-runs)
  start: number; // first tile along `axis`
  end: number; // last tile along `axis` (>= start)
}

/** A doorway opening on a wall border, in TILE coordinates. */
export interface DoorOpening {
  axis: "x" | "z";
  fixed: number;
  start: number;
  end: number;
}

export interface ResolvedWalls {
  runs: WallRun[];
  doors: DoorOpening[];
  /** Corner/junction tiles emitted as posts (tile coords). */
  posts: { x: number; y: number }[];
}

/** A provider turns resolved walls into Three.js objects for one wing theme. */
export interface KitPieceProvider {
  /**
   * Build all wall geometry for a room. `tileSize`/`wallHeight` are world units.
   * Returns one parent Object3D to add to the chunk (caller sets cameraCollider).
   */
  buildWalls(
    walls: ResolvedWalls,
    theme: WingTheme,
    tileSize: number,
    wallHeight: number,
    color: string,
  ): Object3D;
}
