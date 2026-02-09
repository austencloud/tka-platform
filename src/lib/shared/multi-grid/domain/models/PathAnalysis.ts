/**
 * PathAnalysis - Types for cross-grid path detection
 *
 * Classifies the hand path between any two points in a topology.
 * Same-grid paths delegate to existing adjacency rules.
 * Cross-grid paths are detected geometrically (straight-line collinearity).
 */

/**
 * Classification of a hand path between two points.
 *
 * Same-grid paths:
 * - "shift"  — Adjacent points, curved arc around perimeter
 * - "dash"   — Diametrically opposite points, straight line
 * - "hash"   — Center ↔ perimeter, straight line (L5+)
 * - "static" — Same point, no movement
 *
 * Cross-grid paths:
 * - "cross-dash" — Points on different grids, straight line through junction(s)
 *
 * Invalid:
 * - "unreachable" — No valid hand path exists between these points
 */
export type PathType =
  | "shift"
  | "dash"
  | "hash"
  | "static"
  | "cross-dash"
  | "unreachable";

/**
 * Analysis result for a path between two points in a topology.
 */
export interface PathAnalysis {
  /** The classified path type */
  readonly pathType: PathType;
  /** Euclidean distance in world space (abstract units) */
  readonly worldDistance: number;
  /** Grid IDs the straight line passes through (for cross-dash, includes start and end grids) */
  readonly gridsCrossed: readonly string[];
}
