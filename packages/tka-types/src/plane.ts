/**
 * Spinning planes for prop rotation.
 *
 * Grounded in src/lib/shared/3d/domain/enums/Plane.ts (the app's canonical 9-value set).
 * All levels 1-7 use a single plane at a time; level 8 (atomics) introduces
 * multi-plane steps; level 9 adds fusion planes at 45° between primaries.
 *
 * Primary planes:
 *   - wall:  XY plane — performer facing audience (the classic 2D system plane)
 *   - wheel: YZ plane — perpendicular to wall (side view / cartwheel plane)
 *   - floor: XZ plane — horizontal, top-down at waist height
 *
 * Fusion planes (level 9 — 45° between two primaries):
 *   - right-shield / left-shield: between wall and wheel
 *   - forward-ramp / backward-ramp: between wall and floor
 *   - right-wing / left-wing: between wheel and floor
 */
export const Plane = {
  wall: "wall",
  wheel: "wheel",
  floor: "floor",
  rightShield: "right-shield",
  leftShield: "left-shield",
  forwardRamp: "forward-ramp",
  backwardRamp: "backward-ramp",
  rightWing: "right-wing",
  leftWing: "left-wing",
} as const;

export type Plane = (typeof Plane)[keyof typeof Plane];

export const PLANES: readonly Plane[] = Object.freeze(Object.values(Plane));

/** Primary planes available at level 8. */
export const PRIMARY_PLANES: readonly Plane[] = Object.freeze([
  Plane.wall,
  Plane.wheel,
  Plane.floor,
]);

/** Fusion planes introduced at level 9. */
export const FUSION_PLANES: readonly Plane[] = Object.freeze([
  Plane.rightShield,
  Plane.leftShield,
  Plane.forwardRamp,
  Plane.backwardRamp,
  Plane.rightWing,
  Plane.leftWing,
]);
