/** Sub-step count for trail accumulation across one export frame's beat advance.
 *  We over-sample and let the trail capturer's 0.75px distance-gate prune to
 *  exact live density. ~24 samples per full beat is dense enough for the fastest
 *  sweep at any export resolution; capped at 32 to bound cost on loop seams. */
const SUBSTEPS_PER_BEAT = 24;
const MAX_SUBSTEPS = 32;

export function computeTrailSubSteps(beatDelta: number): number {
  const n = Math.ceil(Math.abs(beatDelta) * SUBSTEPS_PER_BEAT);
  return Math.max(1, Math.min(MAX_SUBSTEPS, n));
}
