import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export interface ChangedTransitionPlayback {
  readonly sequence: SequenceData;
  /**
   * Primitive token for the active document that produced this preview.
   * Sequence objects pass through Svelte proxies, so their identity is not a
   * safe invalidation signal.
   */
  readonly sourceSequenceRevision: number;
  /** One-based regular step number. */
  readonly stepNumber: number;
  /** Increments for every option activation, including repeated trials. */
  readonly requestId: number;
  /** Timestamp captured at option activation for preview-start measurements. */
  readonly activatedAt: number;
}

export interface ChangedTransitionPlaybackWindow {
  readonly startStep: number;
  readonly endStepExclusive: number;
  readonly changedStep: number;
}

/**
 * The workspace cursor indexes sequence.steps from zero, while the animation
 * engine reserves 0 for the held start pose and numbers motions from 1.
 */
export function toAnimatorMotionCursor(sequenceCursor: number): number {
  return sequenceCursor + 1;
}

export function getChangedTransitionPlaybackWindow(
  sequence: SequenceData,
  stepNumber: number
): ChangedTransitionPlaybackWindow {
  const changedStep = stepNumber - 1;

  if (
    !Number.isInteger(stepNumber) ||
    changedStep < 0 ||
    changedStep >= sequence.steps.length
  ) {
    throw new RangeError(`Step ${stepNumber} is outside the sequence`);
  }

  return {
    startStep: changedStep,
    endStepExclusive: changedStep + 1,
    changedStep,
  };
}
