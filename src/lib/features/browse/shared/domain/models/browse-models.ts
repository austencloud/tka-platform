import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ExploreSortMethod } from "../enums/explore-enums";

/**
 * Essential Browse Models - Keep It Simple!
 *
 * Only the models actually needed for basic browse functionality.
 * No over-engineering, no complex state management.
 */

export interface ExploreSection {
  id: string;
  title: string;
  count: number;
  sequences: SequenceData[];
  isExpanded: boolean;
  sortOrder: number;
}

// Simple delete confirmation data
export interface SequenceDeleteConfirmationData {
  sequence: SequenceData;
  relatedSequences: SequenceData[];
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
  sortMethod: ExploreSortMethod;
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
export interface ExploreDisplayState {
  currentView: "filter_selection" | "sequence_browser";
  selectedSequence: SequenceData | null;
  isSequenceDetailOpen: boolean;
}

export interface ExploreLoadingState {
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string | null;
}

// Factory functions
export function createDefaultDisplayState(): ExploreDisplayState {
  return {
    currentView: "filter_selection",
    selectedSequence: null,
    isSequenceDetailOpen: false,
  };
}

export function createDefaultLoadingState(): ExploreLoadingState {
  return {
    isLoading: false,
    hasError: false,
    errorMessage: null,
  };
}

// Simple state for persistence (if needed)
export interface CompleteExploreState {
  lastUpdated: Date;
  version: number;
}
