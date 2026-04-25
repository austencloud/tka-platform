/**
 * Whole Mode State
 *
 * Reactive state for whole-sequence LOOP labeling.
 * Handles component selection, multiple designations, and freeform labeling.
 */

import { getLOOPLabelsFirebaseRepository } from "$lib/features/loop-labeler/getLOOPLabelsFirebaseRepository";
import { getLOOPDesignator } from "$lib/features/loop-labeler/getLOOPDesignator";
import type { ILOOPLabelsFirebaseRepository } from "../services/contracts/ILOOPLabelsFirebaseRepository";
import type { ILOOPDesignator } from "../services/contracts/ILOOPDesignator";
import type {
  LOOPDesignation,
  LabeledSequence,
  TransformationIntervals,
  TransformationInterval,
} from "../domain/models/label-models";
import type { ComponentId } from "../domain/constants/loop-components";
import type { SliceSize } from "$lib/features/create/generate/circular/domain/models/circular-models";

/**
 * Map component IDs to their corresponding interval keys
 */
function componentToIntervalKey(
  component: ComponentId
): keyof TransformationIntervals | null {
  const map: Record<ComponentId, keyof TransformationIntervals | null> = {
    rotated: "rotation",
    swapped: "swap",
    mirrored: "mirror",
    flipped: "flip",
    inverted: "invert",
    rewound: null, // rewound doesn't have an interval concept
    repeated: null, // repeated doesn't have an interval - it's about repetition count
    modular: null, // modular has multiple motifs with different intervals each
  };
  return map[component] ?? null;
}

export interface WholeModeState {
  // Component selection
  selectedComponents: Set<ComponentId>;
  isFreeform: boolean;
  selectedSliceSize: SliceSize | null;

  // Per-transformation intervals
  transformationIntervals: TransformationIntervals;

  // Multiple designations
  pendingDesignations: LOOPDesignation[];

  // Actions
  actions: {
    toggleComponent(component: ComponentId): void;
    setSliceSize(size: SliceSize | null): void;
    setTransformationInterval(
      transformation: keyof TransformationIntervals,
      interval: TransformationInterval
    ): void;
    setFreeform(isFreeform: boolean): void;
    addDesignation(derivedLoopType: string | null): void;
    removeDesignation(index: number): void;
    labelSequence(
      currentWord: string,
      notes: string,
      derivedLoopType: string | null
    ): Promise<void>;
    markAsUnknown(currentWord: string, notes: string): Promise<void>;
    clearSelection(): void;
  };
}

/**
 * Create whole mode state for a LOOP labeler instance
 */
export function createWholeModeState(): WholeModeState {
  // State
  let selectedComponents = $state(new Set<ComponentId>());
  let isFreeform = $state(false);
  let selectedSliceSize = $state<SliceSize | null>(null);
  let transformationIntervals = $state<TransformationIntervals>({});
  let pendingDesignations = $state<LOOPDesignation[]>([]);

  // Services
  const labelsService =
    getLOOPLabelsFirebaseRepository() as ILOOPLabelsFirebaseRepository | null;
  const designationService =
    getLOOPDesignator() as ILOOPDesignator | null;

  // Actions
  const actions = {
    toggleComponent(component: ComponentId) {
      if (isFreeform) {
        isFreeform = false;
      }
      const newSet = new Set(selectedComponents);
      if (newSet.has(component)) {
        newSet.delete(component);
        // Clear interval for this component when deselected
        const intervalKey = componentToIntervalKey(component);
        if (intervalKey) {
          transformationIntervals = {
            ...transformationIntervals,
            [intervalKey]: undefined,
          };
        }
      } else {
        newSet.add(component);
      }
      selectedComponents = newSet;
    },

    setSliceSize(size: SliceSize | null) {
      selectedSliceSize = size;
      // Also update transformationIntervals.rotation for backwards compatibility
      if (size) {
        transformationIntervals = {
          ...transformationIntervals,
          rotation: size,
        };
      }
    },

    setTransformationInterval(
      transformation: keyof TransformationIntervals,
      interval: TransformationInterval
    ) {
      transformationIntervals = {
        ...transformationIntervals,
        [transformation]: interval,
      };
      // Keep selectedSliceSize in sync for backwards compatibility
      if (transformation === "rotation") {
        selectedSliceSize =
          interval === "halved" || interval === "quartered"
            ? (interval as SliceSize)
            : null;
      }
    },

    setFreeform(freeform: boolean) {
      isFreeform = freeform;
      if (freeform) {
        selectedComponents = new Set();
        transformationIntervals = {};
      }
    },

    addDesignation(derivedLoopType: string | null) {
      if (selectedComponents.size === 0) {
        console.warn(
          "[WholeModeState] Cannot add designation: no components selected"
        );
        return;
      }

      // Build intervals only for selected components
      const relevantIntervals: TransformationIntervals = {};
      if (
        selectedComponents.has("rotated") &&
        transformationIntervals.rotation
      ) {
        relevantIntervals.rotation = transformationIntervals.rotation;
      }
      if (selectedComponents.has("swapped") && transformationIntervals.swap) {
        relevantIntervals.swap = transformationIntervals.swap;
      }
      if (
        selectedComponents.has("mirrored") &&
        transformationIntervals.mirror
      ) {
        relevantIntervals.mirror = transformationIntervals.mirror;
      }
      if (selectedComponents.has("flipped") && transformationIntervals.flip) {
        relevantIntervals.flip = transformationIntervals.flip;
      }
      if (
        selectedComponents.has("inverted") &&
        transformationIntervals.invert
      ) {
        relevantIntervals.invert = transformationIntervals.invert;
      }

      const designation: LOOPDesignation = {
        components: Array.from(selectedComponents),
        loopType: derivedLoopType,
        sliceSize: selectedComponents.has("rotated") ? selectedSliceSize : null,
        transformationIntervals:
          Object.keys(relevantIntervals).length > 0
            ? relevantIntervals
            : undefined,
      };

      // Check if this exact combination already exists
      if (designationService) {
        const exists = designationService.isDuplicateDesignation(
          designation,
          pendingDesignations
        );
        if (exists) {
          console.warn("[WholeModeState] Designation already exists");
          return;
        }
      }

      pendingDesignations = [...pendingDesignations, designation];

      // Clear selection for next designation
      selectedComponents = new Set();
      selectedSliceSize = null;
      transformationIntervals = {};
    },

    removeDesignation(index: number) {
      pendingDesignations = pendingDesignations.filter((_, i) => i !== index);
    },

    async labelSequence(
      currentWord: string,
      notes: string,
      derivedLoopType: string | null
    ) {
      if (!labelsService) {
        console.warn("[WholeModeState] LabelsService not available");
        return;
      }

      // Build all designations (pending + current selection if any)
      const allDesignations = [...pendingDesignations];
      if (selectedComponents.size > 0) {
        // Build intervals for current selection
        const relevantIntervals: TransformationIntervals = {};
        if (
          selectedComponents.has("rotated") &&
          transformationIntervals.rotation
        ) {
          relevantIntervals.rotation = transformationIntervals.rotation;
        }
        if (selectedComponents.has("swapped") && transformationIntervals.swap) {
          relevantIntervals.swap = transformationIntervals.swap;
        }
        if (
          selectedComponents.has("mirrored") &&
          transformationIntervals.mirror
        ) {
          relevantIntervals.mirror = transformationIntervals.mirror;
        }
        if (selectedComponents.has("flipped") && transformationIntervals.flip) {
          relevantIntervals.flip = transformationIntervals.flip;
        }
        if (
          selectedComponents.has("inverted") &&
          transformationIntervals.invert
        ) {
          relevantIntervals.invert = transformationIntervals.invert;
        }

        allDesignations.push({
          components: Array.from(selectedComponents),
          loopType: derivedLoopType,
          sliceSize: selectedComponents.has("rotated")
            ? selectedSliceSize
            : null,
          transformationIntervals:
            Object.keys(relevantIntervals).length > 0
              ? relevantIntervals
              : undefined,
        });
      }

      const label: LabeledSequence = {
        word: currentWord,
        designations: allDesignations,
        isFreeform,
        labeledAt: new Date().toISOString(),
        notes,
      };

      try {
        await labelsService.saveLabelToFirebase(currentWord, label);
      } catch (error) {
        console.error("[WholeModeState] Failed to label sequence:", error);
      }

      // Clear after labeling
      this.clearSelection();
    },

    async markAsUnknown(currentWord: string, notes: string) {
      if (!labelsService) {
        console.warn("[WholeModeState] LabelsService not available");
        return;
      }

      const label: LabeledSequence = {
        word: currentWord,
        designations: [],
        isFreeform: false,
        isUnknown: true,
        labeledAt: new Date().toISOString(),
        notes,
      };

      try {
        await labelsService.saveLabelToFirebase(currentWord, label);
      } catch (error) {
        console.error("[WholeModeState] Failed to mark as unknown:", error);
      }

      this.clearSelection();
    },

    clearSelection() {
      selectedComponents = new Set();
      isFreeform = false;
      pendingDesignations = [];
      selectedSliceSize = null;
      transformationIntervals = {};
    },
  };

  return {
    get selectedComponents() {
      return selectedComponents;
    },
    get isFreeform() {
      return isFreeform;
    },
    get selectedSliceSize() {
      return selectedSliceSize;
    },
    get transformationIntervals() {
      return transformationIntervals;
    },
    get pendingDesignations() {
      return pendingDesignations;
    },
    actions,
  };
}
