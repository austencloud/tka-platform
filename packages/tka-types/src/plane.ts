/**
 * Spinning planes for prop rotation.
 *
 * Grounded in packages/sequence-engine/src/core/types/sequence-engine-types.ts (MotionData.plane).
 *   - wall: rotation in the plane facing the performer (default)
 *   - wheel: rotation in the plane perpendicular to the performer's gaze
 *   - overhead: rotation in the horizontal plane above the head
 */
export const Plane = {
  wall: "wall",
  wheel: "wheel",
  overhead: "overhead",
} as const;

export type Plane = (typeof Plane)[keyof typeof Plane];

export const PLANES: readonly Plane[] = Object.freeze(Object.values(Plane));
