/**
 * Command Palette State
 *
 * State management for the command palette using Svelte 5 runes.
 *
 * Domain: Keyboard Shortcuts - Command Palette State
 */

import type { CommandPaletteItem } from "../domain/types/keyboard-types";

/**
 * Create command palette state
 */
export function createCommandPaletteState() {
  // Search query
  let query = $state("");

  // Search results
  let results = $state<CommandPaletteItem[]>([]);

  // Selected index
  let selectedIndex = $state(0);

  // Loading state
  let isLoading = $state(false);

  // Whether palette is open
  let isOpen = $state(false);

  return {
    // Query
    get query() {
      return query;
    },
    setQuery(value: string) {
      query = value;
      selectedIndex = 0; // Reset selection when query changes
    },
    clearQuery() {
      query = "";
      selectedIndex = 0;
    },

    // Results
    get results() {
      return results;
    },
    setResults(items: CommandPaletteItem[]) {
      results = items;
      selectedIndex = 0; // Reset selection when results change
    },
    clearResults() {
      results = [];
      selectedIndex = 0;
    },

    // Selection
    get selectedIndex() {
      return selectedIndex;
    },
    get selectedItem() {
      return results[selectedIndex] ?? null;
    },
    selectNext() {
      if (results.length === 0) return;
      selectedIndex = (selectedIndex + 1) % results.length;
    },
    selectPrevious() {
      if (results.length === 0) return;
      selectedIndex =
        selectedIndex === 0 ? results.length - 1 : selectedIndex - 1;
    },
    selectByIndex(index: number) {
      if (index >= 0 && index < results.length) {
        selectedIndex = index;
      }
    },

    // Loading
    get isLoading() {
      return isLoading;
    },
    setLoading(loading: boolean) {
      isLoading = loading;
    },

    // Open state
    get isOpen() {
      return isOpen;
    },
    open() {
      isOpen = true;
    },
    close() {
      isOpen = false;
      query = "";
      results = [];
      selectedIndex = 0;
    },
    toggle() {
      if (isOpen) {
        this.close();
      } else {
        this.open();
      }
    },

    // Reset all state
    reset() {
      query = "";
      results = [];
      selectedIndex = 0;
      isLoading = false;
    },
  };
}

/**
 * Global command palette state instance
 */
export const commandPaletteState = createCommandPaletteState();
