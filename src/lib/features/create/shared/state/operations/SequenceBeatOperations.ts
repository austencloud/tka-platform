/**
 * Sequence Beat Operations
 *
 * Handles beat-level operations with animation support:
 * - Adding/removing beats
 * - Updating beat data
 * - Beat insertion
 * - Animated beat removal
 *
 * RESPONSIBILITY: Beat operations coordinator, orchestrates state + services
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "../../domain/models/BeatData";
import type { SequenceAnimationState } from "../animation/SequenceAnimationState.svelte";
import type { SequenceCoreState } from "../core/SequenceCoreState.svelte";
import type { SequenceSelectionState } from "../selection/SequenceSelectionState.svelte";
import type { IReversalDetector } from "../../services/contracts/IReversalDetector";

export interface BeatOperationsConfig {
  coreState: SequenceCoreState;
  selectionState: SequenceSelectionState;
  animationState: SequenceAnimationState;
  ReversalDetector?: IReversalDetector;
  onError?: (error: string) => void;
  onSave?: () => Promise<void>;
}

export function createSequenceBeatOperations(config: BeatOperationsConfig) {
  const {
    coreState,
    selectionState,
    animationState,
    ReversalDetector,
    onError,
    onSave,
  } = config;

  // Helper functions for in-memory sequence manipulation
  function addBeatToSequence(
    sequence: SequenceData,
    beatData?: Partial<BeatData>
  ): SequenceData {
    const newBeat: BeatData = {
      id: beatData?.id ?? crypto.randomUUID(),
      beatNumber: sequence.beats.length + 1,
      isBlank: beatData?.isBlank ?? true,
      duration: beatData?.duration ?? 1,
      blueReversal: beatData?.blueReversal ?? false,
      redReversal: beatData?.redReversal ?? false,
      letter: beatData?.letter ?? null,
      startPosition: beatData?.startPosition ?? null,
      endPosition: beatData?.endPosition ?? null,
      motions: beatData?.motions ?? {},
      ...(beatData ?? {}),
    };
    return { ...sequence, beats: [...sequence.beats, newBeat] };
  }

  function removeBeatFromSequence(
    sequence: SequenceData,
    beatIndex: number
  ): SequenceData {
    if (beatIndex < 0 || beatIndex >= sequence.beats.length) {
      return sequence;
    }
    const newBeats = sequence.beats.filter((_, index) => index !== beatIndex);
    return { ...sequence, beats: newBeats };
  }

  function removeBeatAndSubsequentFromSequence(
    sequence: SequenceData,
    beatIndex: number
  ): SequenceData {
    if (beatIndex < 0 || beatIndex >= sequence.beats.length) {
      return sequence;
    }
    const newBeats = sequence.beats.slice(0, beatIndex);
    return { ...sequence, beats: newBeats };
  }

  function updateBeatInSequence(
    sequence: SequenceData,
    beatIndex: number,
    beatData: Partial<BeatData>
  ): SequenceData {
    if (beatIndex < 0 || beatIndex >= sequence.beats.length) {
      return sequence;
    }
    const newBeats = [...sequence.beats];
    newBeats[beatIndex] = { ...newBeats[beatIndex], ...beatData } as BeatData;
    return { ...sequence, beats: newBeats };
  }

  function insertBeatInSequence(
    sequence: SequenceData,
    beatIndex: number,
    beatData: Partial<BeatData>
  ): SequenceData {
    const newBeat: BeatData = {
      id: beatData.id ?? crypto.randomUUID(),
      beatNumber: beatIndex + 1,
      isBlank: beatData.isBlank ?? true,
      duration: beatData.duration ?? 1,
      blueReversal: beatData.blueReversal ?? false,
      redReversal: beatData.redReversal ?? false,
      letter: beatData.letter ?? null,
      startPosition: beatData.startPosition ?? null,
      endPosition: beatData.endPosition ?? null,
      motions: beatData.motions ?? {},
      ...beatData,
    };
    const newBeats = [
      ...sequence.beats.slice(0, beatIndex),
      newBeat,
      ...sequence.beats.slice(beatIndex),
    ];
    return { ...sequence, beats: newBeats };
  }

  function clearSequenceBeats(sequence: SequenceData): SequenceData {
    return { ...sequence, beats: [] };
  }

  function getSelectedBeat(
    sequence: SequenceData,
    index: number
  ): BeatData | null {
    if (index < 0 || index >= sequence.beats.length) {
      return null;
    }
    return sequence.beats[index] ?? null;
  }

  function handleError(message: string, error?: unknown) {
    const errorMsg = error instanceof Error ? error.message : message;
    coreState.setError(errorMsg);
    onError?.(errorMsg);
    console.error(message, error);
  }

  return {
    addBeat(beatData?: Partial<BeatData>) {
      if (!coreState.currentSequence) return;

      try {
        let updatedSequence = addBeatToSequence(
          coreState.currentSequence,
          beatData
        );
        // Process reversals to ensure correct reversal indicators
        if (ReversalDetector) {
          updatedSequence = ReversalDetector.processReversals(updatedSequence);
        }
        coreState.setCurrentSequence(updatedSequence);
        coreState.clearError();
      } catch (error) {
        handleError("Failed to add beat", error);
      }
    },

    removeBeat(beatIndex: number) {
      if (!coreState.currentSequence) return;

      try {
        let updatedSequence = removeBeatFromSequence(
          coreState.currentSequence,
          beatIndex
        );
        // Process reversals to ensure correct reversal indicators
        if (ReversalDetector) {
          updatedSequence = ReversalDetector.processReversals(updatedSequence);
        }
        coreState.setCurrentSequence(updatedSequence);
        selectionState.adjustSelectionForRemovedBeat(beatIndex);
        coreState.clearError();
        onSave?.().catch((err) =>
          console.error("Failed to auto-save after beat removal:", err)
        );
      } catch (error) {
        handleError("Failed to remove beat", error);
      }
    },

    removeBeatWithAnimation(beatIndex: number, onComplete?: () => void) {
      if (!coreState.currentSequence) return;

      animationState.startRemovingBeat(beatIndex);

      // Wait for fade animation (updated to match new faster animation: 250ms)
      setTimeout(() => {
        try {
          if (!coreState.currentSequence) return;

          let updatedSequence = removeBeatFromSequence(
            coreState.currentSequence,
            beatIndex
          );
          // Process reversals to ensure correct reversal indicators
          if (ReversalDetector) {
            updatedSequence =
              ReversalDetector.processReversals(updatedSequence);
          }
          coreState.setCurrentSequence(updatedSequence);
          selectionState.adjustSelectionForRemovedBeat(beatIndex);
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

    removeBeatAndSubsequent(beatIndex: number) {
      if (!coreState.currentSequence) return;

      try {
        let updatedSequence = removeBeatAndSubsequentFromSequence(
          coreState.currentSequence,
          beatIndex
        );
        // Process reversals to ensure correct reversal indicators
        if (ReversalDetector) {
          updatedSequence = ReversalDetector.processReversals(updatedSequence);
        }
        coreState.setCurrentSequence(updatedSequence);
        selectionState.clearSelection();
        coreState.clearError();
        onSave?.().catch((err) =>
          console.error("Failed to auto-save after beat removal:", err)
        );
      } catch (error) {
        handleError("Failed to remove beat and subsequent beats", error);
      }
    },

    removeBeatAndSubsequentWithAnimation(
      beatIndex: number,
      onComplete?: () => void
    ) {
      if (!coreState.currentSequence) return;

      const beatsToRemove = coreState.currentSequence.beats.length - beatIndex;
      const removingIndices: number[] = [];
      for (let i = beatIndex; i < coreState.currentSequence.beats.length; i++) {
        removingIndices.push(i);
      }

      const fadeAnimationDuration = 250;

      // Add ALL beats to removing set at once - they all fade simultaneously
      animationState.startRemovingBeats(removingIndices);

      // Remove beats after fade animation completes
      setTimeout(() => {
        try {
          if (!coreState.currentSequence) return;

          let updatedSequence = removeBeatAndSubsequentFromSequence(
            coreState.currentSequence,
            beatIndex
          );
          // Process reversals to ensure correct reversal indicators
          if (ReversalDetector) {
            updatedSequence =
              ReversalDetector.processReversals(updatedSequence);
          }
          coreState.setCurrentSequence(updatedSequence);
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
          handleError("Failed to remove beat and subsequent beats", error);
          animationState.endRemovingBeats();
        }
      }, fadeAnimationDuration);
    },

    updateBeat(beatIndex: number, beatData: Partial<BeatData>) {
      if (!coreState.currentSequence) return;

      try {
        let updatedSequence = updateBeatInSequence(
          coreState.currentSequence,
          beatIndex,
          beatData
        );
        // Process reversals to ensure correct reversal indicators
        if (ReversalDetector) {
          updatedSequence = ReversalDetector.processReversals(updatedSequence);
        }
        coreState.setCurrentSequence(updatedSequence);
        coreState.clearError();
      } catch (error) {
        handleError("Failed to update beat", error);
      }
    },

    insertBeat(beatIndex: number, beatData?: Partial<BeatData>) {
      if (!coreState.currentSequence) return;

      try {
        let updatedSequence = insertBeatInSequence(
          coreState.currentSequence,
          beatIndex,
          beatData ?? {}
        );
        // Process reversals to ensure correct reversal indicators
        if (ReversalDetector) {
          updatedSequence = ReversalDetector.processReversals(updatedSequence);
        }
        coreState.setCurrentSequence(updatedSequence);
        selectionState.adjustSelectionForInsertedBeat(beatIndex);
        coreState.clearError();
      } catch (error) {
        handleError("Failed to insert beat", error);
      }
    },

    clearSequence() {
      if (!coreState.currentSequence) return;

      try {
        const updatedSequence = clearSequenceBeats(coreState.currentSequence);
        coreState.setCurrentSequence(updatedSequence);
        selectionState.clearSelection();
        coreState.clearError();
      } catch (error) {
        handleError("Failed to clear sequence", error);
      }
    },

    getBeat(index: number): BeatData | null {
      if (!coreState.currentSequence) return null;
      return getSelectedBeat(coreState.currentSequence, index);
    },

    getBeatCount(): number {
      return coreState.currentSequence?.beats.length ?? 0;
    },

    hasContent(): boolean {
      return coreState.currentSequence?.beats.some((b) => !b.isBlank) ?? false;
    },
  };
}

export type SequenceBeatOperations = ReturnType<
  typeof createSequenceBeatOperations
>;
