import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { BrowseSortMethod } from "$lib/shared/browse/domain/enums/browse-enums";

/**
 * Essential Browse Models - Keep It Simple!
 *
 * Only the models actually needed for basic browse functionality.
 * No over-engineering, no complex state management.
 */

export interface BrowseSection {
  id: string;
  title: string;
  count: number;
  sequences: SequenceData[];
  isExpanded: boolean;
  sortOrder: number;
}

// Essential types that are still needed by other modules
export interface SectionConfig {
  groupBy:
    | keyof SequenceData
    | "letter"
    | "length"
    | "difficulty"
    | "date"
    | "none";
  sortMethod: BrowseSortMethod;
  showEmptySections: boolean;
  expandedSections?: Set<string>;
  sortOrder?: "asc" | "desc";
  showCounts?: boolean;
}

export interface SequenceSection {
  id: string;
  title: string;
  count: number;
  sequences: SequenceData[];
  isExpanded: boolean;
  sortOrder: number;
}

// Simple display state for components that need it
export interface BrowseDisplayState {
  currentView: "filter_selection" | "sequence_browser";
  selectedSequence: SequenceData | null;
  isSequenceDetailOpen: boolean;
}

export interface BrowseLoadingState {
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string | null;
}

// Factory functions
export function createDefaultDisplayState(): BrowseDisplayState {
  return {
    currentView: "filter_selection",
    selectedSequence: null,
    isSequenceDetailOpen: false,
  };
}

export function createDefaultLoadingState(): BrowseLoadingState {
  return {
    isLoading: false,
    hasError: false,
    errorMessage: null,
  };
}

// Simple state for persistence (if needed)
export interface CompleteBrowseState {
  lastUpdated: Date;
  version: number;
}
