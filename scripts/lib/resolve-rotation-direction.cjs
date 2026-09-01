/**
 * Resolve Rotation Direction for Turned Motions
 *
 * When applying turns > 0 to a dash or static motion that has rotationDirection
 * "noRotation", we must assign a valid rotation direction. The prop IS rotating
 * now — it needs to know which way.
 *
 * For continuous (non-reversing) sequences, the rotation direction is inherited
 * from the neighboring motions in the same sequence. We scan the sequence for
 * the nearest motion on the same hand that has a real rotation direction.
 *
 * If no context is found, defaults to "cw" (clockwise).
 */

/**
 * Resolve rotation directions for all motions in a step array.
 * Mutates the steps in place.
 *
 * For each hand: if the motion has turns > 0 and rotationDirection is
 * "noRotation", scan forward and backward through the sequence to find
 * the nearest motion on that hand with a real rotation direction, and
 * inherit it.
 *
 * @param {Array} steps - Array of step objects with current left/right motions
 * @param {number} turnValue - The turn value being applied (for the > 0 check)
 */
function resolveRotationDirections(steps, turnValue) {
  if (turnValue === 0) return; // No turns = no rotation needed

  for (const hand of ["left", "right"]) {
    // Collect all rotation directions for this hand
    const dirs = steps
      .map((s) => s.motions?.[hand]?.rotationDirection)
      .filter(Boolean);

    // Find the dominant real direction (most common non-noRotation)
    const realDirs = dirs.filter((d) => d !== "noRotation");
    const dominant = realDirs.length > 0 ? mostCommon(realDirs) : "cw";

    // Apply to any motion that needs it
    for (const step of steps) {
      const motion = step.motions?.[hand];
      if (!motion) continue;

      if (
        motion.rotationDirection === "noRotation" ||
        !motion.rotationDirection
      ) {
        motion.rotationDirection = dominant;
      }
    }
  }
}

/**
 * Validate that no motion has turns > 0 with rotationDirection "noRotation".
 * Throws if validation fails.
 *
 * @param {Array} steps - Array of step objects
 * @param {string} context - Description for error messages (e.g. sequence word)
 */
function validateRotationDirections(steps, context) {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    for (const hand of ["left", "right"]) {
      const m = step.motions?.[hand];
      if (!m) continue;
      const turns = m.turns ?? 0;
      if (
        turns > 0 &&
        (m.rotationDirection === "noRotation" || !m.rotationDirection)
      ) {
        throw new Error(
          `[${context}] Beat ${i} ${hand} has ${turns} turns but rotationDirection is "${m.rotationDirection}". ` +
            `Every motion with turns > 0 must have a valid rotation direction (cw or ccw).`
        );
      }
    }
  }
}

function mostCommon(arr) {
  const counts = {};
  for (const v of arr) {
    counts[v] = (counts[v] || 0) + 1;
  }
  let best = arr[0];
  let bestCount = 0;
  for (const [v, c] of Object.entries(counts)) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

module.exports = { resolveRotationDirections, validateRotationDirections };
