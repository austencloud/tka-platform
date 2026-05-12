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
  b1BluePropRotDir: string,
  b1RedPropRotDir: string,
  b2BluePropRotDir: string,
  b2RedPropRotDir: string,
  b1BlueMotionType?: string,
  b1RedMotionType?: string,
  b2BlueMotionType?: string,
  b2RedMotionType?: string
): boolean {
  // A prop has meaningful rotation if:
  // 1. It has a rotation direction (not noRotation)
  // 2. It's NOT a static motion (static props spinning in place don't count)
  const b1BlueHasRot = Boolean(
    b1BluePropRotDir &&
    b1BluePropRotDir !== "norotation" &&
    b1BlueMotionType !== "static"
  );
  const b1RedHasRot = Boolean(
    b1RedPropRotDir &&
    b1RedPropRotDir !== "norotation" &&
    b1RedMotionType !== "static"
  );
  const b2BlueHasRot = Boolean(
    b2BluePropRotDir &&
    b2BluePropRotDir !== "norotation" &&
    b2BlueMotionType !== "static"
  );
  const b2RedHasRot = Boolean(
    b2RedPropRotDir &&
    b2RedPropRotDir !== "norotation" &&
    b2RedMotionType !== "static"
  );

  // Has rotation data if at least one color has rotation in BOTH steps
  return (b1BlueHasRot && b2BlueHasRot) || (b1RedHasRot && b2RedHasRot);
}

/**
 * Check if rotation directions indicate an "inversion" for ROTATION transformations.
 * For rotations (90°, 180°), rotation direction should naturally STAY THE SAME.
 * Returns true if rotation direction changed (unexpected = inverted).
 */
export function areRotDirsInvertedForRotation(
  b1BluePropRotDir: string,
  b1RedPropRotDir: string,
  b2BluePropRotDir: string,
  b2RedPropRotDir: string
): boolean {
  const b1BlueHasRot = b1BluePropRotDir && b1BluePropRotDir !== "norotation";
  const b1RedHasRot = b1RedPropRotDir && b1RedPropRotDir !== "norotation";
  const b2BlueHasRot = b2BluePropRotDir && b2BluePropRotDir !== "norotation";
  const b2RedHasRot = b2RedPropRotDir && b2RedPropRotDir !== "norotation";

  // For rotations: "inverted" means rotation direction CHANGED (when it should stay same)
  let blueInverted = false;
  let redInverted = false;

  if (b1BlueHasRot && b2BlueHasRot) {
    // For rotation, same rot dir is expected. Different = inverted.
    blueInverted = b1BluePropRotDir !== b2BluePropRotDir;
  }
  if (b1RedHasRot && b2RedHasRot) {
    redInverted = b1RedPropRotDir !== b2RedPropRotDir;
  }

  // Consider inverted if at least one color shows inversion
  if (blueInverted && redInverted) return true;
  if (blueInverted && !b1RedHasRot && !b2RedHasRot) return true;
  if (redInverted && !b1BlueHasRot && !b2BlueHasRot) return true;

  return false;
}

/**
 * Check if rotation directions indicate an "inversion" for MIRROR/FLIP transformations.
 * For mirror/flip, rotation direction should naturally FLIP (cw↔ccw) due to reflection.
 * Returns true if rotation direction stayed the SAME (unexpected = inverted).
 */
export function areRotDirsInvertedForMirrorFlip(
  b1BluePropRotDir: string,
  b1RedPropRotDir: string,
  b2BluePropRotDir: string,
  b2RedPropRotDir: string
): boolean {
  const b1BlueHasRot = b1BluePropRotDir && b1BluePropRotDir !== "norotation";
  const b1RedHasRot = b1RedPropRotDir && b1RedPropRotDir !== "norotation";
  const b2BlueHasRot = b2BluePropRotDir && b2BluePropRotDir !== "norotation";
  const b2RedHasRot = b2RedPropRotDir && b2RedPropRotDir !== "norotation";

  // For mirror/flip: rotation direction should naturally flip.
  // "Inverted" means it STAYED THE SAME (someone counteracted the natural flip)
  let blueInverted = false;
  let redInverted = false;

  if (b1BlueHasRot && b2BlueHasRot) {
    // For mirror/flip, different rot dir is expected. Same = inverted.
    blueInverted = b1BluePropRotDir === b2BluePropRotDir;
  }
  if (b1RedHasRot && b2RedHasRot) {
    redInverted = b1RedPropRotDir === b2RedPropRotDir;
  }

  // Consider inverted if at least one color shows unexpected same direction
  if (blueInverted && redInverted) return true;
  if (blueInverted && !b1RedHasRot && !b2RedHasRot) return true;
  if (redInverted && !b1BlueHasRot && !b2BlueHasRot) return true;

  return false;
}
