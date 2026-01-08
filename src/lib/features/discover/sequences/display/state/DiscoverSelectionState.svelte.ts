/**
 * Browse Selection State Service
 *
 * Focused microservice for managing sequence selection state.
 * Handles current selection without business logic.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface IDiscoverSelectionState {
  // Reactive state getters
  readonly selectedSequence: SequenceData | null;
  readonly hasSelection: boolean;

  // Actions
  selectSequence(sequence: SequenceData): void;
  clearSelection(): void;
}

/**
 * Factory function to create gallery selection state
 * Uses Svelte 5 runes for reactivity
 */
export function createGallerySelectionState(): IDiscoverSelectionState {
  // Private reactive state using Svelte 5 runes
  let selectedSequence = $state<SequenceData | null>(null);

  return {
    // Reactive getters
    get selectedSequence() {
      return selectedSequence;
    },

    get hasSelection() {
      return selectedSequence !== null;
    },

    // Actions
    selectSequence(sequence: SequenceData): void {
      selectedSequence = sequence;
    },

    clearSelection(): void {
      selectedSequence = null;
    },
  };
}

// For backward compatibility, export a class-like interface
export class DiscoverSelectionState implements IDiscoverSelectionState {
  private state = createGallerySelectionState();

  get selectedSequence() {
    return this.state.selectedSequence;
  }
  get hasSelection() {
    return this.state.hasSelection;
  }

  selectSequence(sequence: SequenceData): void {
    this.state.selectSequence(sequence);
  }

  clearSelection(): void {
    this.state.clearSelection();
  }
}
