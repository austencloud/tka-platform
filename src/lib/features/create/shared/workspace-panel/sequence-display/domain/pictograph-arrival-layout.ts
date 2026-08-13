import type { PictographArrivalRequest } from "../state/step-grid-display-state.svelte";

/**
 * Keep the just-committed step on the arrival stage until landing begins.
 * The sequence itself is already committed, so only the grid presentation is
 * held. A stale request must never hide an unrelated step.
 */
export function getArrivalPresentedStepCount(
  committedStepCount: number,
  request: PictographArrivalRequest | null
): number {
  const safeCommittedCount = Math.max(0, committedStepCount);
  if (
    request?.owner === "stage" &&
    request.phase === "preview" &&
    request.stepIndex === safeCommittedCount - 1
  ) {
    return request.stepIndex;
  }

  return safeCommittedCount;
}
