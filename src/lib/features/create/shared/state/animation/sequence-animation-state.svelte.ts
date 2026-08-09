/**
 * Sequence Animation State
 *
 * Manages animation state for:
 * - Beat removal animations
 * - Sequence clearing animations
 * - Multi-beat removal tracking
 * - Undo/redo transition plans
 *
 * RESPONSIBILITY: Pure animation state tracking
 */

import type { HistoryTransitionPlan } from "../../services/history-transition-planner";

const HISTORY_TRANSITION_DURATION_MS = 360;

export interface SequenceAnimationStateData {
  removingStepIndex: number | null;
  removingStepIndices: Set<number>;
  isClearing: boolean;
  historyTransition: HistoryTransitionPlan | null;
  historyTransitionEpoch: number;
}

export function createSequenceAnimationState() {
  const state = $state<SequenceAnimationStateData>({
    removingStepIndex: null,
    removingStepIndices: new Set<number>(),
    isClearing: false,
    historyTransition: null,
    historyTransitionEpoch: 0,
  });
  let historyTransitionTimer: ReturnType<typeof setTimeout> | null = null;

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
    get historyTransition() {
      return state.historyTransition;
    },
    get historyTransitionEpoch() {
      return state.historyTransitionEpoch;
    },

    // Computed
    get isAnimating() {
      return (
        state.removingStepIndex !== null ||
        state.removingStepIndices.size > 0 ||
        state.isClearing ||
        state.historyTransition !== null
      );
    },

    startHistoryTransition(plan: HistoryTransitionPlan) {
      if (historyTransitionTimer !== null) {
        clearTimeout(historyTransitionTimer);
      }

      state.historyTransition = plan;
      state.historyTransitionEpoch += 1;
      historyTransitionTimer = setTimeout(() => {
        state.historyTransition = null;
        historyTransitionTimer = null;
      }, HISTORY_TRANSITION_DURATION_MS);
    },

    endHistoryTransition() {
      if (historyTransitionTimer !== null) {
        clearTimeout(historyTransitionTimer);
        historyTransitionTimer = null;
      }
      state.historyTransition = null;
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
      if (historyTransitionTimer !== null) {
        clearTimeout(historyTransitionTimer);
        historyTransitionTimer = null;
      }
      state.removingStepIndex = null;
      state.removingStepIndices = new Set();
      state.isClearing = false;
      state.historyTransition = null;
    },
  };
}

export type SequenceAnimationState = ReturnType<
  typeof createSequenceAnimationState
>;
