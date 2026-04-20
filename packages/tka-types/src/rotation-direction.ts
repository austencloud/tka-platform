/**
 * Rotation directions for prop spin around its long axis.
 *
 * Enumeration grounded in packages/sequence-engine/src/core/types/sequence-engine-types.ts.
 * `noRotation` is the canonical engine spelling; static motions and dash-without-turns use it.
 */
export const RotationDirection = {
  cw: "cw",
  ccw: "ccw",
  noRotation: "noRotation",
} as const;

export type RotationDirection =
  (typeof RotationDirection)[keyof typeof RotationDirection];

export const ROTATION_DIRECTIONS: readonly RotationDirection[] = Object.freeze(
  Object.values(RotationDirection)
);
