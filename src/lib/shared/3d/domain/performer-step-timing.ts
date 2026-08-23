/**
 * Give one performer a deliberate head start or delay without changing the
 * shared performance clock. This is what lets a tunnel ripple backward one
 * count at a time while the film still has one playhead.
 */
export function resolvePerformerPlaybackStep(
  sharedStep: number,
  beatOffset: number,
  totalSteps: number
): number {
  if (!Number.isFinite(sharedStep) || !Number.isFinite(beatOffset)) return 0;
  if (!Number.isFinite(totalSteps) || totalSteps <= 0) {
    return Math.max(0, sharedStep + beatOffset);
  }

  const shifted = sharedStep + beatOffset;
  return ((shifted % totalSteps) + totalSteps) % totalSteps;
}
