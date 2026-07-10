/**
 * Factory function for creating StepData
 *
 * Creates a beat with proper type discriminator.
 * Steps represent actual motions in a sequence (stepNumber >= 1).
 *
 * `motions` in the input may carry 0, 1, or 2 hands; the factory fills every
 * missing hand with an invisible static placeholder so the output always
 * satisfies the both-required canonical `Step` shape. Callers that mean
 * "this hand is not really there" simply omit it, exactly as before.
 */
import type { StepData, StepMotions } from "$lib/shared/foundation/domain/models/step-data";
import {
  createPlaceholderMotion,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export type CreateStepDataInput = Omit<Partial<StepData>, "motions"> & {
  readonly motions?: Partial<Record<MotionColor, MotionData | undefined>>;
};

export function createStepData(data: CreateStepDataInput = {}): StepData {
  const motions: StepMotions = {
    blue: data.motions?.blue ?? createPlaceholderMotion(MotionColor.BLUE),
    red: data.motions?.red ?? createPlaceholderMotion(MotionColor.RED),
  };
  return {
    // Canonical Step properties
    id: data.id ?? crypto.randomUUID(),
    letter: data.letter ?? null,
    startPosition: data.startPosition ?? null,
    endPosition: data.endPosition ?? null,
    motions,

    // Beat context properties
    stepNumber: data.stepNumber ?? 1, // Should always be >= 1
    duration: data.duration ?? 1.0,
    blueReversal: data.blueReversal ?? false,
    redReversal: data.redReversal ?? false,
    isBlank: data.isBlank ?? false,
    // Beta offset swap — preserve if set
    ...(data.betaSwapped !== undefined && { betaSwapped: data.betaSwapped }),
  };
}
