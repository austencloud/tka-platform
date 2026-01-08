/**
 * Gallery Controls State
 *
 * to access the same state/handlers as DiscoverTab without context issues.
 *
 * Using Svelte 5 runes pattern - module-level reactive state
 */

import type { ExploreSortMethod } from "../domain/enums/discover-enums";
import type { ExploreFilterValue } from "../domain/types/discover-types";

type GalleryFilter = { type: string; value: ExploreFilterValue };

export interface GalleryControlsState {
  currentFilter: GalleryFilter;
  currentSortMethod: ExploreSortMethod;
  availableNavigationSections: string[];
  onFilterChange: (filter: GalleryFilter) => void;
  onSortMethodChange: (method: ExploreSortMethod) => void;
  scrollToSection: (sectionId: string) => void;
  openFilterModal: () => void;
}

// Module-level reactive state using Svelte 5 $state rune
// Create a state object that can be mutated and will trigger reactivity
class GalleryControlsManager {
  state = $state<GalleryControlsState | null>(null);

  set(newState: GalleryControlsState | null) {
    this.state = newState;
  }

  get current() {
    return this.state;
  }

  clear() {
    this.state = null;
  }
}

export const galleryControlsManager = new GalleryControlsManager();
