/**
 * Helper functions for rotation direction analysis.
 * These determine whether transformations are "inverted" based on rotation direction changes.
 */

/**
 * Invert motion type (pro ↔ anti).
 */
export function invertMotionType(type: string): string {
  if (type === "pro") return "anti";
  if (type === "anti") return "pro";
  return type;
}

/**
 * Invert rotation direction (cw ↔ ccw).
 * "Inverted" in LOOP terminology means the rotation direction is flipped.
 */
export function invertRotDir(dir: string): string {
  if (dir === "cw") return "ccw";
  if (dir === "ccw") return "cw";
  return dir; // noRotation stays the same
}

/**
 * Check if a beat pair has rotation data that can be used to determine inversion.
 * Returns true if at least one color in both steps has meaningful rotation direction.
 * Static motions are excluded - their rotation direction shouldn't determine inversion.
 */
export function hasRotationData(
  b1LeftPropRotDir: string,
  b1RightPropRotDir: string,
  b2LeftPropRotDir: string,
  b2RightPropRotDir: string,
  b1LeftMotionType?: string,
  b1RightMotionType?: string,
  b2LeftMotionType?: string,
  b2RightMotionType?: string
): boolean {
  // A prop has meaningful rotation if:
  // 1. It has a rotation direction (not noRotation)
  // 2. It's NOT a static motion (static props spinning in place don't count)
  const b1LeftHasRot = Boolean(
    b1LeftPropRotDir &&
    b1LeftPropRotDir !== "norotation" &&
    b1LeftMotionType !== "static"
  );
  const b1RightHasRot = Boolean(
    b1RightPropRotDir &&
    b1RightPropRotDir !== "norotation" &&
    b1RightMotionType !== "static"
  );
  const b2LeftHasRot = Boolean(
    b2LeftPropRotDir &&
    b2LeftPropRotDir !== "norotation" &&
    b2LeftMotionType !== "static"
  );
  const b2RightHasRot = Boolean(
    b2RightPropRotDir &&
    b2RightPropRotDir !== "norotation" &&
    b2RightMotionType !== "static"
  );

  // Has rotation data if at least one color has rotation in BOTH steps
  return (b1LeftHasRot && b2LeftHasRot) || (b1RightHasRot && b2RightHasRot);
}

/**
 * Check if rotation directions indicate an "inversion" for ROTATION transformations.
 * For rotations (90°, 180°), rotation direction should naturally STAY THE SAME.
 * Returns true if rotation direction changed (unexpected = inverted).
 */
export function areRotDirsInvertedForRotation(
  b1LeftPropRotDir: string,
  b1RightPropRotDir: string,
  b2LeftPropRotDir: string,
  b2RightPropRotDir: string
): boolean {
  const b1LeftHasRot = b1LeftPropRotDir && b1LeftPropRotDir !== "norotation";
  const b1RightHasRot = b1RightPropRotDir && b1RightPropRotDir !== "norotation";
  const b2LeftHasRot = b2LeftPropRotDir && b2LeftPropRotDir !== "norotation";
  const b2RightHasRot = b2RightPropRotDir && b2RightPropRotDir !== "norotation";

  // For rotations: "inverted" means rotation direction CHANGED (when it should stay same)
  let leftInverted = false;
  let rightInverted = false;

  if (b1LeftHasRot && b2LeftHasRot) {
    // For rotation, same rot dir is expected. Different = inverted.
    leftInverted = b1LeftPropRotDir !== b2LeftPropRotDir;
  }
  if (b1RightHasRot && b2RightHasRot) {
    rightInverted = b1RightPropRotDir !== b2RightPropRotDir;
  }

  // Consider inverted if at least one color shows inversion
  if (leftInverted && rightInverted) return true;
  if (leftInverted && !b1RightHasRot && !b2RightHasRot) return true;
  if (rightInverted && !b1LeftHasRot && !b2LeftHasRot) return true;

  return false;
}

/**
 * Check if rotation directions indicate an "inversion" for MIRROR/FLIP transformations.
 * For mirror/flip, rotation direction should naturally FLIP (cw↔ccw) due to reflection.
 * Returns true if rotation direction stayed the SAME (unexpected = inverted).
 */
export function areRotDirsInvertedForMirrorFlip(
  b1LeftPropRotDir: string,
  b1RightPropRotDir: string,
  b2LeftPropRotDir: string,
  b2RightPropRotDir: string
): boolean {
  const b1LeftHasRot = b1LeftPropRotDir && b1LeftPropRotDir !== "norotation";
  const b1RightHasRot = b1RightPropRotDir && b1RightPropRotDir !== "norotation";
  const b2LeftHasRot = b2LeftPropRotDir && b2LeftPropRotDir !== "norotation";
  const b2RightHasRot = b2RightPropRotDir && b2RightPropRotDir !== "norotation";

  // For mirror/flip: rotation direction should naturally flip.
  // "Inverted" means it STAYED THE SAME (someone counteracted the natural flip)
  let leftInverted = false;
  let rightInverted = false;

  if (b1LeftHasRot && b2LeftHasRot) {
    // For mirror/flip, different rot dir is expected. Same = inverted.
    leftInverted = b1LeftPropRotDir === b2LeftPropRotDir;
  }
  if (b1RightHasRot && b2RightHasRot) {
    rightInverted = b1RightPropRotDir === b2RightPropRotDir;
  }

  // Consider inverted if at least one color shows unexpected same direction
  if (leftInverted && rightInverted) return true;
  if (leftInverted && !b1RightHasRot && !b2RightHasRot) return true;
  if (rightInverted && !b1LeftHasRot && !b2LeftHasRot) return true;

  return false;
}
