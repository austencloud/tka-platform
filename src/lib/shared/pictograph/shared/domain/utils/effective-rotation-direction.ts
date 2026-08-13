interface RotationBearingMotion {
  readonly motionType?: string | null;
  readonly rotationDirection?: string | null;
  readonly prefloatRotationDirection?: string | null;
}

/**
 * Float renders without prop rotation, but its preserved Level 1 base state is
 * still the continuity signal. Legacy floats without pre-float metadata remain
 * neutral and fall back to their rendered rotation direction.
 */
export function getEffectiveRotationDirection(
  motion: RotationBearingMotion | null | undefined
): string | null {
  if (!motion) return null;

  const rendered = motion.rotationDirection
    ? String(motion.rotationDirection)
    : null;
  const prefloat = motion.prefloatRotationDirection
    ? String(motion.prefloatRotationDirection)
    : null;

  if (
    String(motion.motionType) === "float" &&
    prefloat &&
    prefloat !== "noRotation"
  ) {
    return prefloat;
  }

  return rendered;
}
