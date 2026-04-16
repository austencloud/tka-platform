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

  // ── Fusion planes (L9 — data model only, no UI at L8) ──

  /** 45° between Wall and Wheel, tilted right */
  RIGHT_SHIELD = "right-shield",
  /** 45° between Wall and Wheel, tilted left */
  LEFT_SHIELD = "left-shield",
  /** 45° between Wall and Floor, top toward audience */
  FORWARD_RAMP = "forward-ramp",
  /** 45° between Wall and Floor, top away from audience */
  BACKWARD_RAMP = "backward-ramp",
  /** 45° between Wheel and Floor, tilted right */
  RIGHT_WING = "right-wing",
  /** 45° between Wheel and Floor, tilted left */
  LEFT_WING = "left-wing",
}

/**
 * Human-readable labels for each plane
 */
export const PLANE_LABELS: Record<Plane, string> = {
  [Plane.WALL]: "Wall Plane",
  [Plane.WHEEL]: "Wheel Plane",
  [Plane.FLOOR]: "Floor Plane",
  [Plane.RIGHT_SHIELD]: "Right Shield",
  [Plane.LEFT_SHIELD]: "Left Shield",
  [Plane.FORWARD_RAMP]: "Forward Ramp",
  [Plane.BACKWARD_RAMP]: "Backward Ramp",
  [Plane.RIGHT_WING]: "Right Wing",
  [Plane.LEFT_WING]: "Left Wing",
};

/**
 * Colors for visualizing each plane
 */
export const PLANE_COLORS: Record<Plane, string> = {
  [Plane.WALL]: "#8b5cf6",          // Purple
  [Plane.WHEEL]: "#3b82f6",         // Blue
  [Plane.FLOOR]: "#22c55e",         // Green
  [Plane.RIGHT_SHIELD]: "#c084fc",  // Light purple
  [Plane.LEFT_SHIELD]: "#818cf8",   // Indigo
  [Plane.FORWARD_RAMP]: "#86efac",  // Light green
  [Plane.BACKWARD_RAMP]: "#6ee7b7", // Emerald
  [Plane.RIGHT_WING]: "#5eead4", // Teal
  [Plane.LEFT_WING]: "#2dd4bf",  // Cyan-teal
};

/** Primary planes available at L8 */
export const PRIMARY_PLANES: ReadonlySet<Plane> = new Set([
  Plane.WALL, Plane.WHEEL, Plane.FLOOR,
]);
