/**
 * StepPair Mode State
 *
 * Reactive state for step-pair relationship labeling.
 * Handles beat pair selection, component selection, and saved relationships.
 */

import type { StepPairRelationship } from "../domain/models/steppair-models";
import type {
  LabeledSequence,
  TransformationInterval,
  TransformationIntervals,
} from "../domain/models/label-models";
import type { ComponentId } from "../domain/constants/loop-components";
import { BASE_COMPONENTS } from "../domain/constants/loop-components";

export interface StepPairModeState {
  // Beat pair selection
  firstStep: number | null;
  secondStep: number | null;

  // Component selection (same as whole mode)
  selectedComponents: Set<ComponentId>;

  // Transformation intervals (same as whole mode)
  transformationIntervals: TransformationIntervals;

  // Saved beat pairs
  savedStepPairs: StepPairRelationship[];

  // Actions
  actions: {
    selectStep(stepNumber: number): void;
    toggleComponent(component: ComponentId): void;
    setTransformationInterval(
      key: keyof TransformationIntervals,
      value: TransformationInterval
    ): void;
    addStepPair(): void;
    removeStepPair(index: number): void;
    clearSelection(): void;
    loadSavedBeatPairs(label: LabeledSequence | null): void;
  };
}

/**
 * Create step-pair mode state for a LOOP labeler instance
 */
export function createBeatPairModeState(): StepPairModeState {
  // State
  let firstStep = $state<number | null>(null);
  let secondStep = $state<number | null>(null);
  let selectedComponents = $state(new Set<ComponentId>());
  let transformationIntervals = $state<TransformationIntervals>({});
  let savedStepPairs = $state<StepPairRelationship[]>([]);

  // Map component IDs to interval keys
  const COMPONENT_TO_INTERVAL_KEY: Record<
    string,
    keyof TransformationIntervals
  > = {
    rotated: "rotation",
    swapped: "swap",
    mirrored: "mirror",
    flipped: "flip",
    inverted: "invert",
  };

  // Actions
  const actions = {
    selectStep(stepNumber: number) {
      if (firstStep === null) {
        // Select first beat
        firstStep = stepNumber;
        secondStep = null;
        selectedComponents = new Set();
        transformationIntervals = {};
      } else if (firstStep === stepNumber) {
        // Deselect first beat
        firstStep = null;
        secondStep = null;
        selectedComponents = new Set();
        transformationIntervals = {};
      } else if (secondStep === stepNumber) {
        // Deselect second beat
        secondStep = null;
        selectedComponents = new Set();
        transformationIntervals = {};
      } else {
        // Select second beat
        secondStep = stepNumber;
      }
    },

    toggleComponent(component: ComponentId) {
      const newSet = new Set(selectedComponents);
      if (newSet.has(component)) {
        newSet.delete(component);
        // Also clear the interval for this component
        const intervalKey = COMPONENT_TO_INTERVAL_KEY[component];
        if (intervalKey) {
          const newIntervals = { ...transformationIntervals };
          delete newIntervals[intervalKey];
          transformationIntervals = newIntervals;
        }
      } else {
        newSet.add(component);
      }
      selectedComponents = newSet;
    },

    setTransformationInterval(
      key: keyof TransformationIntervals,
      value: TransformationInterval
    ) {
      // Toggle: if same value, clear it; otherwise set it
      const currentValue = transformationIntervals[key];
      if (currentValue === value) {
        const newIntervals = { ...transformationIntervals };
        delete newIntervals[key];
        transformationIntervals = newIntervals;
      } else {
        transformationIntervals = { ...transformationIntervals, [key]: value };
      }
    },

    addStepPair() {
      if (firstStep === null || secondStep === null) {
        console.warn("[StepPairModeState] Cannot add: steps not selected");
        return;
      }

      if (selectedComponents.size === 0) {
        console.warn("[StepPairModeState] Cannot add: no components selected");
        return;
      }

      // Build transformation string from selected components with intervals
      const transformationParts = Array.from(selectedComponents).map((c) => {
        const label = BASE_COMPONENTS.find((b) => b.id === c)?.label ?? c;
        const intervalKey = COMPONENT_TO_INTERVAL_KEY[c];
        const interval = intervalKey
          ? transformationIntervals[intervalKey]
          : undefined;

        if (interval === 2) return `½ ${label}`;
        if (interval === 4) return `¼ ${label}`;
        return label;
      });

      const stepPair: StepPairRelationship = {
        keyStep: firstStep,
        correspondingStep: secondStep,
        detectedTransformations: [], // No auto-detection, manual selection
        confirmedTransformation: transformationParts.join(" + "),
      };

      // Add to saved beat pairs
      savedStepPairs = [...savedStepPairs, stepPair];

      // Clear selection for next beat pair
      this.clearSelection();
    },

    removeStepPair(index: number) {
      savedStepPairs = savedStepPairs.filter((_, i) => i !== index);
    },

    clearSelection() {
      firstStep = null;
      secondStep = null;
      selectedComponents = new Set();
      transformationIntervals = {};
    },

    loadSavedBeatPairs(label: LabeledSequence | null) {
      // Only load beat pairs that have been explicitly confirmed by the user
      // Auto-detected beat pairs (those without confirmedTransformation) are
      // displayed separately in the StepPairAnalysisDisplay component
      const allBeatPairs = label?.stepPairs ?? [];
      savedStepPairs = allBeatPairs.filter((bp) => bp.confirmedTransformation);
    },
  };

  return {
    get firstStep() {
      return firstStep;
    },
    get secondStep() {
      return secondStep;
    },
    get selectedComponents() {
      return selectedComponents;
    },
    get transformationIntervals() {
      return transformationIntervals;
    },
    get savedStepPairs() {
      return savedStepPairs;
    },
    actions,
  };
}
