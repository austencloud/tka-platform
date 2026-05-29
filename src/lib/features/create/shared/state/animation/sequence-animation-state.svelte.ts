/**
 * Sequence Animation State
 *
 * Manages animation state for:
 * - Beat removal animations
 * - Sequence clearing animations
 * - Multi-beat removal tracking
 *
 * RESPONSIBILITY: Pure animation state tracking
 */

export interface SequenceAnimationStateData {
  removingStepIndex: number | null;
  removingStepIndices: Set<number>;
  isClearing: boolean;
}

export function createSequenceAnimationState() {
  const state = $state<SequenceAnimationStateData>({
    removingStepIndex: null,
    removingStepIndices: new Set<number>(),
    isClearing: false,
  });

  return {
    // Getters
    get removingStepIndex() {
      return state.removingStepIndex;
    },
    get removingStepIndices() {
      return state.removingStepIndices;
    },
    get isClearing() {
      return state.isClearing;
    },

    // Computed
    get isAnimating() {
      return (
        state.removingStepIndex !== null ||
        state.removingStepIndices.size > 0 ||
        state.isClearing
      );
    },

    // Single beat removal animation
    startRemovingBeat(index: number) {
      state.removingStepIndex = index;
    },

    endRemovingBeat() {
      state.removingStepIndex = null;
    },

    // Multi-beat removal animation
    startRemovingBeats(indices: number[]) {
      state.removingStepIndices = new Set(indices);
    },

    addRemovingBeat(index: number) {
      // Create new Set to trigger Svelte reactivity
      state.removingStepIndices = new Set([
        ...state.removingStepIndices,
        index,
      ]);
    },

    endRemovingBeats() {
      state.removingStepIndices = new Set();
    },

    isStepRemoving(index: number): boolean {
      return (
        state.removingStepIndex === index ||
        state.removingStepIndices.has(index)
      );
    },

    // Sequence clearing animation
    startClearing() {
      state.isClearing = true;
    },

    endClearing() {
      state.isClearing = false;
    },

    reset() {
      state.removingStepIndex = null;
      state.removingStepIndices = new Set();
      state.isClearing = false;
    },
  };
}

export type SequenceAnimationState = ReturnType<
  typeof createSequenceAnimationState
>;
