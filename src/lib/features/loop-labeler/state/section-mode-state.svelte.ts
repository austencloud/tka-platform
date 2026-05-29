/**
 * Section Mode State
 *
 * Reactive state for section-based LOOP labeling.
 * Handles beat selection, section designation, and saved sections.
 */

import { getLOOPLabelsFirebaseRepository } from "$lib/features/loop-labeler/get-loop-labels-firebase-repository";
import type { SectionDesignation } from "../domain/models/section-models";
import type { LabeledSequence } from "../domain/models/label-models";
import type { ComponentId } from "../domain/constants/loop-components";
import type { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
import type { LOOPLabelsFirebaseRepository } from "../services/loop-labels-firebase-repository";

export interface SectionModeState {
  // Beat selection
  selectedSteps: Set<number>;
  lastClickedStep: number | null;
  isShiftHeld: boolean;

  // Component selection
  selectedComponents: Set<ComponentId>;
  selectedPeriod: Period | null;

  // Saved sections
  savedSections: SectionDesignation[];

  // Base word selection
  selectedBaseWord: string | null;

  // Actions
  actions: {
    selectStep(stepNumber: number, isShiftKey: boolean): void;
    clearBeatSelection(): void;
    setShiftHeld(held: boolean): void;
    toggleComponent(component: ComponentId): void;
    setPeriod(size: Period | null): void;
    setBaseWord(baseWord: string | null): void;
    addSection(
      currentWord: string,
      notes: string,
      derivedLoopType: string | null
    ): Promise<void>;
    removeSection(
      currentWord: string,
      index: number,
      notes: string
    ): Promise<void>;
    clearSelection(): void;
    loadSavedSections(label: LabeledSequence | null): void;
  };
}

/**
 * Create section mode state for a LOOP labeler instance
 */
export function createSectionModeState(): SectionModeState {
  // State
  let selectedSteps = $state(new Set<number>());
  let lastClickedStep = $state<number | null>(null);
  let isShiftHeld = $state(false);
  let selectedComponents = $state(new Set<ComponentId>());
  let selectedPeriod = $state<Period | null>(null);
  let savedSections = $state<SectionDesignation[]>([]);
  let selectedBaseWord = $state<string | null>(null);

  // Services
  const labelsService =
    getLOOPLabelsFirebaseRepository() as LOOPLabelsFirebaseRepository | null;

  // Actions
  const actions = {
    selectStep(stepNumber: number, isShiftKey: boolean) {
      // Two-click range selection:
      // - If 0 steps or more than 1 beat selected: start fresh with clicked beat
      // - If exactly 1 beat selected: create range from that beat to clicked beat
      // - Shift+click still works as override for explicit range from lastClickedStep

      if (isShiftKey && lastClickedStep !== null) {
        // Explicit shift+click range selection (legacy behavior)
        const start = Math.min(lastClickedStep, stepNumber);
        const end = Math.max(lastClickedStep, stepNumber);
        const newSelection = new Set<number>();
        for (let i = start; i <= end; i++) {
          newSelection.add(i);
        }
        selectedSteps = newSelection;
      } else if (selectedSteps.size === 1) {
        // Second click: create range from first beat to this beat
        const firstStep = Array.from(selectedSteps)[0]!;
        const start = Math.min(firstStep, stepNumber);
        const end = Math.max(firstStep, stepNumber);
        const newSelection = new Set<number>();
        for (let i = start; i <= end; i++) {
          newSelection.add(i);
        }
        selectedSteps = newSelection;
        lastClickedStep = stepNumber;
      } else {
        // First click (or starting over): select just this beat
        selectedSteps = new Set([stepNumber]);
        lastClickedStep = stepNumber;
      }
    },

    clearBeatSelection() {
      selectedSteps = new Set();
      lastClickedStep = null;
    },

    setShiftHeld(held: boolean) {
      isShiftHeld = held;
    },

    toggleComponent(component: ComponentId) {
      const newSet = new Set(selectedComponents);
      if (newSet.has(component)) {
        newSet.delete(component);
      } else {
        newSet.add(component);
      }
      selectedComponents = newSet;
    },

    setPeriod(size: Period | null) {
      selectedPeriod = size;
    },

    setBaseWord(baseWord: string | null) {
      selectedBaseWord = baseWord;
    },

    async addSection(
      currentWord: string,
      notes: string,
      derivedLoopType: string | null
    ) {
      // Can add section if: steps selected AND (components selected OR base word selected)
      if (selectedSteps.size === 0) {
        console.warn(
          "[SectionModeState] Cannot add section: no steps selected"
        );
        return;
      }
      if (selectedComponents.size === 0 && !selectedBaseWord) {
        console.warn(
          "[SectionModeState] Cannot add section: no components or base word selected"
        );
        return;
      }

      if (!labelsService) {
        console.warn("[SectionModeState] LabelsService not available");
        return;
      }

      const section: SectionDesignation = {
        steps: Array.from(selectedSteps).sort((a, b) => a - b),
        components: Array.from(selectedComponents),
        loopType: derivedLoopType,
        period: selectedComponents.has("rotated") ? selectedPeriod : null,
        baseWord: selectedBaseWord ?? undefined,
      };

      // Add to saved sections
      savedSections = [...savedSections, section];

      // Save to Firebase immediately
      const label: LabeledSequence = {
        word: currentWord,
        designations: [],
        sections: savedSections,
        isFreeform: false,
        labeledAt: new Date().toISOString(),
        notes,
      };

      try {
        await labelsService.saveLabelToFirebase(currentWord, label);
      } catch (error) {
        console.error("[SectionModeState] Failed to save section:", error);
      }

      // Clear selection for next section
      this.clearSelection();
    },

    async removeSection(currentWord: string, index: number, notes: string) {
      if (!labelsService) {
        console.warn("[SectionModeState] LabelsService not available");
        return;
      }

      savedSections = savedSections.filter((_, i) => i !== index);

      // Update Firebase
      if (savedSections.length > 0) {
        const label: LabeledSequence = {
          word: currentWord,
          designations: [],
          sections: savedSections,
          isFreeform: false,
          labeledAt: new Date().toISOString(),
          notes,
        };

        try {
          await labelsService.saveLabelToFirebase(currentWord, label);
        } catch (error) {
          console.error("[SectionModeState] Failed to remove section:", error);
        }
      } else {
        // If no sections left, remove the label entirely
        try {
          await labelsService.deleteLabelFromFirebase(currentWord);
        } catch (error) {
          console.error("[SectionModeState] Failed to delete label:", error);
        }
      }
    },

    clearSelection() {
      selectedComponents = new Set();
      selectedSteps = new Set();
      lastClickedStep = null;
      selectedPeriod = null;
      selectedBaseWord = null;
    },

    loadSavedSections(label: LabeledSequence | null) {
      savedSections = label?.sections ?? [];
    },
  };

  return {
    get selectedSteps() {
      return selectedSteps;
    },
    get lastClickedStep() {
      return lastClickedStep;
    },
    get isShiftHeld() {
      return isShiftHeld;
    },
    get selectedComponents() {
      return selectedComponents;
    },
    get selectedPeriod() {
      return selectedPeriod;
    },
    get savedSections() {
      return savedSections;
    },
    get selectedBaseWord() {
      return selectedBaseWord;
    },
    actions,
  };
}
