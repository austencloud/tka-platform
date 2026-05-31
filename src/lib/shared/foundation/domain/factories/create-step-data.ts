/**
 * Factory function for creating StepData
 *
 * Creates a beat with proper type discriminator.
 * Steps represent actual motions in a sequence (stepNumber >= 1).
 */
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

export function createStepData(data: Partial<StepData> = {}): StepData {
  return {
    // Type discriminator
    isStep: true as const,

    // PictographData properties
    id: data.id ?? crypto.randomUUID(),
    letter: data.letter ?? null,
    startPosition: data.startPosition ?? null,
    endPosition: data.endPosition ?? null,
    motions: data.motions ?? {},

    // Beat context properties
    stepNumber: data.stepNumber ?? 1, // Should always be >= 1
    duration: data.duration ?? 1.0,
    blueReversal: data.blueReversal ?? false,
    redReversal: data.redReversal ?? false,
    isBlank: data.isBlank ?? false,
    // Conditionally include isSelected only if it's defined
    ...(data.isSelected !== undefined && { isSelected: data.isSelected }),
  };
}
