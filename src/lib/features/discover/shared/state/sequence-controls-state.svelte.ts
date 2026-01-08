/**
 * Sequence Controls State
 *
 * to access the same state/handlers as DiscoverTab without context issues.
 *
 * Using Svelte 5 runes pattern - module-level reactive state
 */

import type { ExploreSortMethod } from "../domain/enums/discover-enums";
import type { ExploreFilterValue } from "../domain/types/discover-types";

type SequenceFilter = { type: string; value: ExploreFilterValue };

export interface SequenceControlsState {
  currentFilter: SequenceFilter;
  currentSortMethod: ExploreSortMethod;
  availableNavigationSections: string[];
  onFilterChange: (filter: SequenceFilter) => void;
  onSortMethodChange: (method: ExploreSortMethod) => void;
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
