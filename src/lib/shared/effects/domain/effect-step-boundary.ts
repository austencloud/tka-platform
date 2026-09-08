export interface EffectStepBoundary {
  previousStep: number;
  currentStep: number;
  totalSteps: number;
  seamlesslyLoopable: boolean;
}

/**
 * Backward scrubbing starts a different visual timeline. A seamless LOOP wrap
 * is the opposite: count one continues the closing count, so persistent
 * effects keep the state they carried across that boundary.
 */
export function shouldResetEffectStateAtStepBoundary({
  previousStep,
  currentStep,
  totalSteps,
  seamlesslyLoopable,
}: EffectStepBoundary): boolean {
  if (currentStep + 0.0001 >= previousStep) return false;

  const crossedSeam =
    seamlesslyLoopable &&
    totalSteps > 0 &&
    previousStep >= totalSteps - 1 &&
    currentStep < 1;

  return !crossedSeam;
}
