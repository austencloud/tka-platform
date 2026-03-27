/**
 * Plane Enum - Defines the three orthogonal planes in 3D flow arts space
 *
 * Each plane has a canonical viewpoint from which N/E/S/W directions are defined:
 *
 * WALL (XY plane):
 *   - Viewpoint: Behind performer, looking at audience
 *   - N = Sky, E = Performer's right, S = Floor, W = Performer's left
 *   - This is the current 2D system's plane
 *
 * WHEEL (YZ plane):
 *   - Viewpoint: Stage right, looking at performer's side
 *   - N = Sky, E = Audience/downstage, S = Floor, W = Backstage/upstage
 *   - Perpendicular to Wall, like a cartwheel plane
 *
 * FLOOR (XZ plane):
 *   - Viewpoint: Above stage, looking down
 *   - N = Audience/downstage, E = Performer's right, S = Backstage/upstage, W = Performer's left
 *   - Horizontal plane at performer's waist/chest level
 */
export enum Plane {
  /** XY plane - performer facing audience (current 2D system) */
  WALL = "wall",

  /** YZ plane - perpendicular to wall (side view / cartwheel plane) */
  WHEEL = "wheel",

  /** XZ plane - horizontal (top-down view) */
  FLOOR = "floor",
}

/**
 * Human-readable labels for each plane
 */
export const PLANE_LABELS: Record<Plane, string> = {
  [Plane.WALL]: "Wall Plane",
  [Plane.WHEEL]: "Wheel Plane",
  [Plane.FLOOR]: "Floor Plane",
};

/**
 * Colors for visualizing each plane
 */
export const PLANE_COLORS: Record<Plane, string> = {
  [Plane.WALL]: "#8b5cf6", // Purple
  [Plane.WHEEL]: "#3b82f6", // Blue
  [Plane.FLOOR]: "#22c55e", // Green
};
