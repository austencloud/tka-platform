/**
 * Motion types for hand movements.
 *
 * Enumeration grounded in packages/sequence-engine/src/core/types/sequence-engine-types.ts
 * and confirmed against MCP flow-arts-knowledge domain reference.
 */
export const MotionType = {
  shift: "shift",
  dash: "dash",
  static: "static",
  pro: "pro",
  anti: "anti",
  float: "float",
} as const;

export type MotionType = (typeof MotionType)[keyof typeof MotionType];

export const MOTION_TYPES: readonly MotionType[] = Object.freeze(
  Object.values(MotionType)
);
