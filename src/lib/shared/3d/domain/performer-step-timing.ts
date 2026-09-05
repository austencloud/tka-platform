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

/**
 * Choose where one performer's step comes from.
 *
 * The shared clock is the default: everyone performs the same sequence, so a
 * performer's step is the playhead plus that performer's deliberate offset.
 * A host whose performers hold independent choreography — the Stage, where
 * each lane carries its own sequence over its own counts — resolves the step
 * itself and supplies it whole. A host that drives only part of the cast
 * leaves the rest on the shared clock rather than freezing them at zero.
 */
export function resolvePerformerStepSource(
  hostStep: number | null | undefined,
  sharedStep: number,
  beatOffset: number,
  totalSteps: number
): number {
  if (hostStep != null && Number.isFinite(hostStep)) {
    if (!Number.isFinite(totalSteps) || totalSteps <= 0) {
      return Math.max(0, hostStep);
    }
    return ((hostStep % totalSteps) + totalSteps) % totalSteps;
  }
  return resolvePerformerPlaybackStep(sharedStep, beatOffset, totalSteps);
}

export interface PerformerPlaybackTarget {
  totalSteps: number;
  goToStep(step: number): void;
  setProgress(progress: number): void;
}

/**
 * Put one performer at the exact beat and in-between-beat progress chosen by
 * the app's shared clock. Both renderer backends call this owner so moving the
 * expensive drawing work into a worker cannot change what a Choreo Card means.
 */
export function synchronizePerformerPlayback(
  performer: PerformerPlaybackTarget,
  hostStep: number | null | undefined,
  sharedStep: number,
  beatOffset: number
): number {
  const performerStep = resolvePerformerStepSource(
    hostStep,
    sharedStep,
    beatOffset,
    performer.totalSteps
  );
  const performerBeat = Math.floor(performerStep);
  performer.goToStep(performerBeat);
  performer.setProgress(performerStep - performerBeat);
  return performerStep;
}
