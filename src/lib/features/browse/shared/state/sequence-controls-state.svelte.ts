/**
 * Sequence Controls State
 *
 * to access the same state/handlers as BrowseTab without context issues.
 *
 * Using Svelte 5 runes pattern - module-level reactive state
 */

import type { BrowseSortMethod } from "../domain/enums/browse-enums";
import type { BrowseFilterValue } from "../domain/types/browse-types";

/**
 * Filter type covers BrowseFilterType enum values, UI-facing variants, and the "all" sentinel.
 * Some components use camelCase names (startingLetter, startingPosition) while the enum
 * uses snake_case (starting_letter). Both are valid at this layer; the factory casts
 * to BrowseFilterType before passing to the filter service.
 */
export type SequenceFilterType =
  | "all"
  | "starting_letter"
  | "contains_letters"
  | "length"
  | "difficulty"
  | "author"
  | "gridMode"
  | "startPosition"
  | "endPosition"
  | "recent"
  | "favorites"
  | "all_sequences"
  | "cap_type"
  | "startingLetter"
  | "startingPosition"
  // FilterPreset values used by ViewPresetsSheet
  | "practice"
  | "easy"
  | "medium"
  | "hard";

export type SequenceFilter = { type: SequenceFilterType; value: BrowseFilterValue };

export interface SequenceControlsState {
  currentFilter: SequenceFilter;
  currentSortMethod: BrowseSortMethod;
  availableNavigationSections: string[];
  onFilterChange: (filter: SequenceFilter) => void;
  onSortMethodChange: (method: BrowseSortMethod) => void;
  scrollToSection: (sectionId: string) => void;
  openFilterModal: () => void;
}

// Module-level reactive state using Svelte 5 $state rune
// Create a state object that can be mutated and will trigger reactivity
class SequenceControlsManager {
  state = $state<SequenceControlsState | null>(null);

  set(newState: SequenceControlsState | null) {
    this.state = newState;
  }

  get current() {
    return this.state;
  }

  clear() {
    this.state = null;
  }
}

export const sequenceControlsManager = new SequenceControlsManager();
