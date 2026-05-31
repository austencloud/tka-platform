/**
 * Twin Transform — pure geometry for the mirror-swap "twin" of a sequence.
 *
 * A card's twin = color-swap ∘ vertical-mirror, applied to the FULL
 * loop-executed steps (start position + beats). Both operations are involutions
 * on independent axes (color vs geometry) so the pair map is an involution:
 * twin(twin(x)) === x.
 *
 * This module is intentionally dependency-free. The caller (enumerate-deck.cjs)
 * injects the engine's vertical-mirror location map and rotation-flip function,
 * and a location->position table built from the CSV. Letter re-derivation and
 * orientation propagation are the caller's job (they need the CSV + the engine
 * orientation calculator), so they are NOT done here — this module only moves
 * hands and colors and derives positions from the resulting location pairs.
 *
 * Mirrors the scripts/apply-reversal-pattern.cjs helper pattern: plain
 * CommonJS, no top-level side effects, module.exports at the bottom.
 */

/**
 * Build a `${blueLoc}|${redLoc}` -> position lookup from the CSV edges. A
 * position IS the encoding of an ordered (blue, red) hand-location pair, so each
 * edge contributes two facts: its start pair -> startPos and end pair -> endPos.
 *
 * @param {Array<{blueStartLoc:string,redStartLoc:string,startPos:string,blueEndLoc:string,redEndLoc:string,endPos:string}>} edges
 * @returns {Record<string,string>}
 */
function buildLocationToPositionMap(edges) {
  const map = {};
  for (const e of edges) {
    map[`${e.blueStartLoc}|${e.redStartLoc}`] = e.startPos;
    map[`${e.blueEndLoc}|${e.redEndLoc}`] = e.endPos;
  }
  return map;
}

/** Mirror one motion's locations + rotation; preserve everything else. */
function mirrorMotion(motion, mirrorLocationMap, mirrorRotation) {
  return {
    ...motion,
    startLocation: mirrorLocationMap[motion.startLocation] ?? motion.startLocation,
    endLocation: mirrorLocationMap[motion.endLocation] ?? motion.endLocation,
    rotationDirection: mirrorRotation(motion.rotationDirection),
  };
}

/**
 * Produce the twin of one step: swap colors, mirror both hands, derive the
 * step's start/end positions from the transformed location pairs. Letter and
 * orientations are carried through unchanged for the caller to recompute.
 * Position is null when the transformed pair is absent from locToPos.
 */
function twinStep(step, { mirrorLocationMap, mirrorRotation, locToPos }) {
  // Color swap: blue takes old red's motion, red takes old blue's motion.
  const swappedBlueSrc = step.motions.red;
  const swappedRedSrc = step.motions.blue;

  const blue = {
    ...mirrorMotion(swappedBlueSrc, mirrorLocationMap, mirrorRotation),
    color: "blue",
  };
  const red = {
    ...mirrorMotion(swappedRedSrc, mirrorLocationMap, mirrorRotation),
    color: "red",
  };

  const startPosition =
    locToPos[`${blue.startLocation}|${red.startLocation}`] ?? null;
  const endPosition =
    locToPos[`${blue.endLocation}|${red.endLocation}`] ?? null;

  return {
    ...step,
    startPosition,
    endPosition,
    motions: { blue, red },
  };
}

/** Twin every step of a full sequence (start position + beats). */
function twinSequence(fullSteps, deps) {
  return fullSteps.map((s) => twinStep(s, deps));
}

/**
 * True when the twin is geometrically identical to the original (a card that is
 * its own mirror-swap). Compared on the position + per-hand location/motionType
 * across every step — orientation/letter are derived, not identity.
 */
function isSelfTwin(orig, twin) {
  if (orig.length !== twin.length) return false;
  for (let i = 0; i < orig.length; i++) {
    const a = orig[i];
    const b = twin[i];
    if (a.startPosition !== b.startPosition) return false;
    if (a.endPosition !== b.endPosition) return false;
    for (const color of ["blue", "red"]) {
      const am = a.motions[color];
      const bm = b.motions[color];
      if (am.startLocation !== bm.startLocation) return false;
      if (am.endLocation !== bm.endLocation) return false;
      if (am.motionType !== bm.motionType) return false;
    }
  }
  return true;
}

module.exports = {
  buildLocationToPositionMap,
  twinSequence,
  twinStep,
  isSelfTwin,
};
