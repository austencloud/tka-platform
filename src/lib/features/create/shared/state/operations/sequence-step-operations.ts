/**
 * Sequence Step Operations
 *
 * Handles step-level operations with animation support:
 * - Adding/removing steps
 * - Updating step data
 * - Step insertion
 * - Animated step removal
 *
 * RESPONSIBILITY: Step operations coordinator, orchestrates state + services
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import type { SequenceAnimationState } from "../animation/sequence-animation-state.svelte";
import type { SequenceCoreState } from "../core/sequence-core-state.svelte";
import type { SequenceSelectionState } from "../selection/sequence-selection-state.svelte";
import type { ReversalDetector } from "$lib/shared/create/services/reversal-detector";
import {
  withLoopCertificateCleared,
  invalidateLoopDisplayCache,
} from "$lib/shared/create/services/loop-certificate";

export interface StepOperationsConfig {
  coreState: SequenceCoreState;
  selectionState: SequenceSelectionState;
  animationState: SequenceAnimationState;
  ReversalDetector?: ReversalDetector;
  onError?: (error: string) => void;
  onSave?: () => Promise<void>;
}

export function createSequenceStepOperations(config: StepOperationsConfig) {
  const {
    coreState,
    selectionState,
    animationState,
    ReversalDetector,
    onError,
    onSave,
  } = config;

  // Helper functions for in-memory sequence manipulation
  function addStepToSequence(
    sequence: SequenceData,
    stepData?: Partial<StepData>
  ): SequenceData {
    const newStep: StepData = createStepData({
      isBlank: true,
      ...(stepData ?? {}),
      stepNumber: stepData?.stepNumber ?? sequence.steps.length + 1,
    });
    return { ...sequence, steps: [...sequence.steps, newStep] };
  }

  function removeStepFromSequence(
    sequence: SequenceData,
    stepIndex: number
  ): SequenceData {
    if (stepIndex < 0 || stepIndex >= sequence.steps.length) {
      return sequence;
    }
    const newSteps = sequence.steps.filter((_, index) => index !== stepIndex);
    return { ...sequence, steps: newSteps };
  }

  function removeStepAndSubsequentFromSequence(
    sequence: SequenceData,
    stepIndex: number
  ): SequenceData {
    if (stepIndex < 0 || stepIndex >= sequence.steps.length) {
      return sequence;
    }
    const newSteps = sequence.steps.slice(0, stepIndex);
    return { ...sequence, steps: newSteps };
  }

  function updateStepInSequence(
    sequence: SequenceData,
    stepIndex: number,
    stepData: Partial<StepData>
  ): SequenceData {
    if (stepIndex < 0 || stepIndex >= sequence.steps.length) {
      return sequence;
    }
    const newSteps = [...sequence.steps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], ...stepData } as StepData;
    return { ...sequence, steps: newSteps };
  }

  function insertStepInSequence(
    sequence: SequenceData,
    stepIndex: number,
    stepData: Partial<StepData>
  ): SequenceData {
    const newStep: StepData = createStepData({
      isBlank: true,
      ...stepData,
      stepNumber: stepData.stepNumber ?? stepIndex + 1,
    });
    const newSteps = [
      ...sequence.steps.slice(0, stepIndex),
      newStep,
      ...sequence.steps.slice(stepIndex),
    ];
    return { ...sequence, steps: newSteps };
  }

  function clearSequenceBeats(sequence: SequenceData): SequenceData {
    return { ...sequence, steps: [] };
  }

  function getSelectedBeat(
    sequence: SequenceData,
    index: number
  ): StepData | null {
    if (index < 0 || index >= sequence.steps.length) {
      return null;
    }
    return sequence.steps[index] ?? null;
  }

  function handleError(message: string, error?: unknown) {
    const errorMsg = error instanceof Error ? error.message : message;
    coreState.setError(errorMsg);
    onError?.(errorMsg);
    console.error(message, error);
  }

  return {
    addStep(stepData?: Partial<StepData>) {
      if (!coreState.currentSequence) return;

      try {
        let updatedSequence = addStepToSequence(
          coreState.currentSequence,
          stepData
        );
        // Process reversals to ensure correct reversal indicators
        if (ReversalDetector) {
          updatedSequence = ReversalDetector.processReversals(updatedSequence);
        }
        coreState.setCurrentSequence(withLoopCertificateCleared(updatedSequence));
        invalidateLoopDisplayCache();
        coreState.clearError();
      } catch (error) {
        handleError("Failed to add beat", error);
      }
    },

    removeStep(stepIndex: number) {
      if (!coreState.currentSequence) return;

      try {
        let updatedSequence = removeStepFromSequence(
          coreState.currentSequence,
          stepIndex
        );
        // Process reversals to ensure correct reversal indicators
        if (ReversalDetector) {
          updatedSequence = ReversalDetector.processReversals(updatedSequence);
        }
        coreState.setCurrentSequence(withLoopCertificateCleared(updatedSequence));
        invalidateLoopDisplayCache();
        selectionState.adjustSelectionForRemovedStep(stepIndex);
        coreState.clearError();
        onSave?.().catch((err) =>
          console.error("Failed to auto-save after beat removal:", err)
        );
      } catch (error) {
        handleError("Failed to remove beat", error);
      }
    },

    removeStepWithAnimation(stepIndex: number, onComplete?: () => void) {
      if (!coreState.currentSequence) return;

      animationState.startRemovingBeat(stepIndex);

      // Wait for fade animation (updated to match new faster animation: 250ms)
      setTimeout(() => {
        try {
          if (!coreState.currentSequence) return;

          let updatedSequence = removeStepFromSequence(
            coreState.currentSequence,
            stepIndex
          );
          // Process reversals to ensure correct reversal indicators
          if (ReversalDetector) {
            updatedSequence =
              ReversalDetector.processReversals(updatedSequence);
          }
          coreState.setCurrentSequence(withLoopCertificateCleared(updatedSequence));
          invalidateLoopDisplayCache();
          selectionState.adjustSelectionForRemovedStep(stepIndex);
          coreState.clearError();
          onSave?.().catch((err) =>
            console.error("Failed to auto-save after beat removal:", err)
          );

          // Wait for slide animation (updated to match new faster animation: 200ms)
          setTimeout(() => {
            animationState.endRemovingBeat();
            onComplete?.();
          }, 200);
        } catch (error) {
          handleError("Failed to remove beat", error);
          animationState.endRemovingBeat();
        }
      }, 250);
    },

    removeStepAndSubsequent(stepIndex: number) {
      if (!coreState.currentSequence) return;

      try {
        let updatedSequence = removeStepAndSubsequentFromSequence(
          coreState.currentSequence,
          stepIndex
        );
        // Process reversals to ensure correct reversal indicators
        if (ReversalDetector) {
          updatedSequence = ReversalDetector.processReversals(updatedSequence);
        }
        coreState.setCurrentSequence(withLoopCertificateCleared(updatedSequence));
        invalidateLoopDisplayCache();
        selectionState.clearSelection();
        coreState.clearError();
        onSave?.().catch((err) =>
          console.error("Failed to auto-save after beat removal:", err)
        );
      } catch (error) {
        handleError("Failed to remove beat and subsequent steps", error);
      }
    },

    removeStepAndSubsequentWithAnimation(
      stepIndex: number,
      onComplete?: () => void
    ) {
      if (!coreState.currentSequence) return;

      const _stepsToRemove = coreState.currentSequence.steps.length - stepIndex;
      const removingIndices: number[] = [];
      for (let i = stepIndex; i < coreState.currentSequence.steps.length; i++) {
        removingIndices.push(i);
      }

      const fadeAnimationDuration = 250;

      // Add ALL steps to removing set at once - they all fade simultaneously
      animationState.startRemovingBeats(removingIndices);

      // Remove steps after fade animation completes
      setTimeout(() => {
        try {
          if (!coreState.currentSequence) return;

          let updatedSequence = removeStepAndSubsequentFromSequence(
            coreState.currentSequence,
            stepIndex
          );
          // Process reversals to ensure correct reversal indicators
          if (ReversalDetector) {
            updatedSequence =
              ReversalDetector.processReversals(updatedSequence);
          }
          coreState.setCurrentSequence(withLoopCertificateCleared(updatedSequence));
          invalidateLoopDisplayCache();
          // NOTE: Don't clear selection here - the onComplete callback will select the appropriate next beat
          // This prevents the mobile Beat Editor controls from disappearing during the animation
          coreState.clearError();
          onSave?.().catch((err) =>
            console.error("Failed to auto-save after beat removal:", err)
          );

          // Small delay for visual feedback before completing
          setTimeout(() => {
            animationState.endRemovingBeats();
            onComplete?.();
          }, 50);
        } catch (error) {
          handleError("Failed to remove beat and subsequent steps", error);
          animationState.endRemovingBeats();
        }
      }, fadeAnimationDuration);
    },

    updateStep(stepIndex: number, stepData: Partial<StepData>) {
      if (!coreState.currentSequence) return;

      try {
        let updatedSequence = updateStepInSequence(
          coreState.currentSequence,
          stepIndex,
          stepData
        );
        // Process reversals to ensure correct reversal indicators
        if (ReversalDetector) {
          updatedSequence = ReversalDetector.processReversals(updatedSequence);
        }
        coreState.setCurrentSequence(withLoopCertificateCleared(updatedSequence));
        invalidateLoopDisplayCache();
        coreState.clearError();
      } catch (error) {
        handleError("Failed to update beat", error);
      }
    },

    insertStep(stepIndex: number, stepData?: Partial<StepData>) {
      if (!coreState.currentSequence) return;

      try {
        let updatedSequence = insertStepInSequence(
          coreState.currentSequence,
          stepIndex,
          stepData ?? {}
        );
        // Process reversals to ensure correct reversal indicators
        if (ReversalDetector) {
          updatedSequence = ReversalDetector.processReversals(updatedSequence);
        }
        coreState.setCurrentSequence(withLoopCertificateCleared(updatedSequence));
        invalidateLoopDisplayCache();
        selectionState.adjustSelectionForInsertedStep(stepIndex);
        coreState.clearError();
      } catch (error) {
        handleError("Failed to insert beat", error);
      }
    },

    clearSequence() {
      if (!coreState.currentSequence) return;

      try {
        const updatedSequence = clearSequenceBeats(coreState.currentSequence);
        coreState.setCurrentSequence(withLoopCertificateCleared(updatedSequence));
        invalidateLoopDisplayCache();
        selectionState.clearSelection();
        coreState.clearError();
      } catch (error) {
        handleError("Failed to clear sequence", error);
      }
    },

    getStep(index: number): StepData | null {
      if (!coreState.currentSequence) return null;
      return getSelectedBeat(coreState.currentSequence, index);
    },

    getStepCount(): number {
      return coreState.currentSequence?.steps?.length ?? 0;
    },

    hasContent(): boolean {
      return coreState.currentSequence?.steps?.some((b) => !b.isBlank) ?? false;
    },
  };
}

export type SequenceStepOperations = ReturnType<
  typeof createSequenceStepOperations
>;
