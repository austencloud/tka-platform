/**
 * Anatomical hand identity, always relative to the performer.
 *
 * Canonical TKA presentation renders the left hand blue and the right hand
 * red, but palette choices never change which physical hand owns a motion.
 */
export const HandSide = {
  LEFT: "left",
  RIGHT: "right",
} as const;

export type HandSide = (typeof HandSide)[keyof typeof HandSide];

export const HAND_SIDES: readonly HandSide[] = Object.freeze(
  Object.values(HandSide)
);
