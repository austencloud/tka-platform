/**
 * BeatPair Mode State
 *
 * Reactive state for beat-pair relationship labeling.
 * Handles beat pair selection, component selection, and saved relationships.
 */

import type { BeatPairRelationship } from "../domain/models/beatpair-models";
import type {
  LabeledSequence,
  TransformationInterval,
  TransformationIntervals,
} from "../domain/models/label-models";
import type { ComponentId } from "../domain/constants/loop-components";
import { BASE_COMPONENTS } from "../domain/constants/loop-components";

export interface BeatPairModeState {
  // Beat pair selection
  firstBeat: number | null;
  secondBeat: number | null;

  // Component selection (same as whole mode)
  selectedComponents: Set<ComponentId>;

  // Transformation intervals (same as whole mode)
  transformationIntervals: TransformationIntervals;

  // Saved beat pairs
  savedBeatPairs: BeatPairRelationship[];

  // Actions
  actions: {
    selectBeat(beatNumber: number): void;
    toggleComponent(component: ComponentId): void;
    setTransformationInterval(
      key: keyof TransformationIntervals,
      value: TransformationInterval
    ): void;
    addBeatPair(): void;
    removeBeatPair(index: number): void;
    clearSelection(): void;
    loadSavedBeatPairs(label: LabeledSequence | null): void;
  };
}

/**
 * Create beat-pair mode state for a LOOP labeler instance
 */
export function createBeatPairModeState(): BeatPairModeState {
  // State
  let firstBeat = $state<number | null>(null);
  let secondBeat = $state<number | null>(null);
  let selectedComponents = $state(new Set<ComponentId>());
  let transformationIntervals = $state<TransformationIntervals>({});
  let savedBeatPairs = $state<BeatPairRelationship[]>([]);

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
    selectBeat(beatNumber: number) {
      if (firstBeat === null) {
        // Select first beat
        firstBeat = beatNumber;
        secondBeat = null;
        selectedComponents = new Set();
        transformationIntervals = {};
      } else if (firstBeat === beatNumber) {
        // Deselect first beat
        firstBeat = null;
        secondBeat = null;
        selectedComponents = new Set();
        transformationIntervals = {};
      } else if (secondBeat === beatNumber) {
        // Deselect second beat
        secondBeat = null;
        selectedComponents = new Set();
        transformationIntervals = {};
      } else {
        // Select second beat
        secondBeat = beatNumber;
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

    addBeatPair() {
      if (firstBeat === null || secondBeat === null) {
        console.warn("[BeatPairModeState] Cannot add: beats not selected");
        return;
      }

      if (selectedComponents.size === 0) {
        console.warn("[BeatPairModeState] Cannot add: no components selected");
        return;
      }

      // Build transformation string from selected components with intervals
      const transformationParts = Array.from(selectedComponents).map((c) => {
        const label = BASE_COMPONENTS.find((b) => b.id === c)?.label ?? c;
        const intervalKey = COMPONENT_TO_INTERVAL_KEY[c];
        const interval = intervalKey
          ? transformationIntervals[intervalKey]
          : undefined;

        if (interval === "halved") return `½ ${label}`;
        if (interval === "quartered") return `¼ ${label}`;
        return label;
      });

      const beatPair: BeatPairRelationship = {
        keyBeat: firstBeat,
        correspondingBeat: secondBeat,
        detectedTransformations: [], // No auto-detection, manual selection
        confirmedTransformation: transformationParts.join(" + "),
      };

      // Add to saved beat pairs
      savedBeatPairs = [...savedBeatPairs, beatPair];

      // Clear selection for next beat pair
      this.clearSelection();
    },

    removeBeatPair(index: number) {
      savedBeatPairs = savedBeatPairs.filter((_, i) => i !== index);
    },

    clearSelection() {
      firstBeat = null;
      secondBeat = null;
      selectedComponents = new Set();
      transformationIntervals = {};
    },

    loadSavedBeatPairs(label: LabeledSequence | null) {
      // Only load beat pairs that have been explicitly confirmed by the user
      // Auto-detected beat pairs (those without confirmedTransformation) are
      // displayed separately in the BeatPairAnalysisDisplay component
      const allBeatPairs = label?.beatPairs ?? [];
      savedBeatPairs = allBeatPairs.filter((bp) => bp.confirmedTransformation);
    },
  };

  return {
    get firstBeat() {
      return firstBeat;
    },
    get secondBeat() {
      return secondBeat;
    },
    get selectedComponents() {
      return selectedComponents;
    },
    get transformationIntervals() {
      return transformationIntervals;
    },
    get savedBeatPairs() {
      return savedBeatPairs;
    },
    actions,
  };
}
