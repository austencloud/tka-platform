/**
 * Section Mode State
 *
 * Reactive state for section-based LOOP labeling.
 * Handles beat selection, section designation, and saved sections.
 */

import { container } from "$lib/shared/di";
import type { ILOOPLabelsFirebaseRepository } from "../services/contracts/ILOOPLabelsFirebaseRepository";
import type { SectionDesignation } from "../domain/models/section-models";
import type { LabeledSequence } from "../domain/models/label-models";
import type { ComponentId } from "../domain/constants/loop-components";
import type { SliceSize } from "$lib/features/create/generate/circular/domain/models/circular-models";

export interface SectionModeState {
  // Beat selection
  selectedBeats: Set<number>;
  lastClickedBeat: number | null;
  isShiftHeld: boolean;

  // Component selection
  selectedComponents: Set<ComponentId>;
  selectedSliceSize: SliceSize | null;

  // Saved sections
  savedSections: SectionDesignation[];

  // Base word selection
  selectedBaseWord: string | null;

  // Actions
  actions: {
    selectBeat(beatNumber: number, isShiftKey: boolean): void;
    clearBeatSelection(): void;
    setShiftHeld(held: boolean): void;
    toggleComponent(component: ComponentId): void;
    setSliceSize(size: SliceSize | null): void;
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
  let selectedBeats = $state(new Set<number>());
  let lastClickedBeat = $state<number | null>(null);
  let isShiftHeld = $state(false);
  let selectedComponents = $state(new Set<ComponentId>());
  let selectedSliceSize = $state<SliceSize | null>(null);
  let savedSections = $state<SectionDesignation[]>([]);
  let selectedBaseWord = $state<string | null>(null);

  // Services
  const labelsService =
    container.items.loopLabelsFirebaseRepository as ILOOPLabelsFirebaseRepository | null;

  // Actions
  const actions = {
    selectBeat(beatNumber: number, isShiftKey: boolean) {
      // Two-click range selection:
      // - If 0 beats or more than 1 beat selected: start fresh with clicked beat
      // - If exactly 1 beat selected: create range from that beat to clicked beat
      // - Shift+click still works as override for explicit range from lastClickedBeat

      if (isShiftKey && lastClickedBeat !== null) {
        // Explicit shift+click range selection (legacy behavior)
        const start = Math.min(lastClickedBeat, beatNumber);
        const end = Math.max(lastClickedBeat, beatNumber);
        const newSelection = new Set<number>();
        for (let i = start; i <= end; i++) {
          newSelection.add(i);
        }
        selectedBeats = newSelection;
      } else if (selectedBeats.size === 1) {
        // Second click: create range from first beat to this beat
        const firstBeat = Array.from(selectedBeats)[0]!;
        const start = Math.min(firstBeat, beatNumber);
        const end = Math.max(firstBeat, beatNumber);
        const newSelection = new Set<number>();
        for (let i = start; i <= end; i++) {
          newSelection.add(i);
        }
        selectedBeats = newSelection;
        lastClickedBeat = beatNumber;
      } else {
        // First click (or starting over): select just this beat
        selectedBeats = new Set([beatNumber]);
        lastClickedBeat = beatNumber;
      }
    },

    clearBeatSelection() {
      selectedBeats = new Set();
      lastClickedBeat = null;
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

    setSliceSize(size: SliceSize | null) {
      selectedSliceSize = size;
    },

    setBaseWord(baseWord: string | null) {
      selectedBaseWord = baseWord;
    },

    async addSection(
      currentWord: string,
      notes: string,
      derivedLoopType: string | null
    ) {
      // Can add section if: beats selected AND (components selected OR base word selected)
      if (selectedBeats.size === 0) {
        console.warn(
          "[SectionModeState] Cannot add section: no beats selected"
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
        beats: Array.from(selectedBeats).sort((a, b) => a - b),
        components: Array.from(selectedComponents),
        loopType: derivedLoopType,
        sliceSize: selectedComponents.has("rotated") ? selectedSliceSize : null,
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
      selectedBeats = new Set();
      lastClickedBeat = null;
      selectedSliceSize = null;
      selectedBaseWord = null;
    },

    loadSavedSections(label: LabeledSequence | null) {
      savedSections = label?.sections ?? [];
    },
  };

  return {
    get selectedBeats() {
      return selectedBeats;
    },
    get lastClickedBeat() {
      return lastClickedBeat;
    },
    get isShiftHeld() {
      return isShiftHeld;
    },
    get selectedComponents() {
      return selectedComponents;
    },
    get selectedSliceSize() {
      return selectedSliceSize;
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
