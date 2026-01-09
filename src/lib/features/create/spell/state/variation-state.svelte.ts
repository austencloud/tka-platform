/**
 * Variation State
 *
 * Manages the state for sequence variation exploration, scoring, and selection.
 * Handles the async exploration process and provides reactive state for the UI.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { VariationScore } from "../services/contracts/IVariationScorer";

/**
 * A scored variation ready for display
 */
export interface ScoredVariation {
  /** The sequence data */
  sequence: SequenceData;
  /** Score breakdown */
  score: VariationScore;
  /** Branch path for debugging (which options were chosen at each decision point) */
  branchPath: number[];
  /** Unique identifier for this variation */
  id: string;
}

/**
 * Sort options for the variation grid
 */
export type VariationSortOption =
  | "score"
  | "reversals"
  | "continuity"
  | "motionType";

/**
 * Filter options for the variation grid
 */
export interface VariationFilters {
  /** Only show variations with zero reversals */
  noReversals: boolean;
  /** Only show variations with high continuity (above median) */
  highContinuity: boolean;
  /** Only show variations that favor the selected motion type */
  matchesMotionPreference: boolean;
}

/**
 * Exploration progress information
 */
export interface ExplorationProgress {
  /** Whether exploration is currently running */
  isExploring: boolean;
  /** Number of variations explored (including duplicates) */
  totalExplored: number;
  /** Number of unique variations found (after deduplication) */
  uniqueFound: number;
  /** Estimated total variations (for progress bar) */
  estimatedTotal: number;
  /** Whether exploration was cancelled */
  wasCancelled: boolean;
  /** Error message if exploration failed */
  error: string | null;
}

/**
 * Creates and returns the variation state object
 */
export function createVariationState() {
  // Core state
  let variations = $state<ScoredVariation[]>([]);
  let progress = $state<ExplorationProgress>({
    isExploring: false,
    totalExplored: 0,
    uniqueFound: 0,
    estimatedTotal: 0,
    wasCancelled: false,
    error: null,
  });

  // Sorting and filtering
  let sortBy = $state<VariationSortOption>("score");
  let sortDescending = $state(true);
  let filters = $state<VariationFilters>({
    noReversals: false,
    highContinuity: false,
    matchesMotionPreference: false,
  });

  // Selection
  let selectedVariationId = $state<string | null>(null);

  // Abort controller for cancellation
  let abortController: AbortController | null = null;

  // Derived: filtered variations
  const filteredVariations = $derived.by(() => {
    let result = [...variations];

    if (filters.noReversals) {
      result = result.filter((v) => v.score.reversalCount === 0);
    }

    if (filters.highContinuity) {
      // Find median continuity score
      const sortedContinuity = [...variations]
        .map((v) => v.score.continuityScore)
        .sort((a, b) => a - b);
      const median =
        sortedContinuity[Math.floor(sortedContinuity.length / 2)] ?? 0;
      result = result.filter((v) => v.score.continuityScore >= median);
    }

    if (filters.matchesMotionPreference) {
      result = result.filter((v) => v.score.motionTypeScore > 0);
    }

    return result;
  });

  // Derived: sorted variations
  const sortedVariations = $derived.by(() => {
    const result = [...filteredVariations];

    result.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "score":
          comparison = a.score.total - b.score.total;
          break;
        case "reversals":
          comparison = a.score.reversalCount - b.score.reversalCount;
          break;
        case "continuity":
          comparison = a.score.continuityScore - b.score.continuityScore;
          break;
        case "motionType":
          comparison = a.score.motionTypeScore - b.score.motionTypeScore;
          break;
      }

      return sortDescending ? -comparison : comparison;
    });

    return result;
  });

  // Derived: selected variation
  const selectedVariation = $derived(
    selectedVariationId
      ? (variations.find((v) => v.id === selectedVariationId) ?? null)
      : null
  );

  // Derived: statistics
  const stats = $derived({
    totalUnique: variations.length,
    totalFiltered: filteredVariations.length,
    bestScore:
      variations.length > 0
        ? Math.max(...variations.map((v) => v.score.total))
        : 0,
    zeroReversalCount: variations.filter((v) => v.score.reversalCount === 0)
      .length,
  });

  return {
    // State getters
    get variations() {
      return sortedVariations;
    },
    get allVariations() {
      return variations;
    },
    get progress() {
      return progress;
    },
    get sortBy() {
      return sortBy;
    },
    get sortDescending() {
      return sortDescending;
    },
    get filters() {
      return filters;
    },
    get selectedVariation() {
      return selectedVariation;
    },
    get selectedVariationId() {
      return selectedVariationId;
    },
    get stats() {
      return stats;
    },

    /**
     * Start exploration - resets state and returns the abort controller's signal
     */
    startExploration(estimatedTotal: number): AbortSignal {
      // Cancel any existing exploration
      if (abortController) {
        abortController.abort();
      }

      abortController = new AbortController();

      variations = [];
      progress = {
        isExploring: true,
        totalExplored: 0,
        uniqueFound: 0,
        estimatedTotal,
        wasCancelled: false,
        error: null,
      };
      selectedVariationId = null;

      return abortController.signal;
    },

    /**
     * Add a scored variation to the list
     */
    addVariation(variation: ScoredVariation): void {
      variations = [...variations, variation];
      progress = {
        ...progress,
        uniqueFound: variations.length,
      };
    },

    /**
     * Update exploration progress (total explored count)
     */
    updateProgress(totalExplored: number): void {
      progress = {
        ...progress,
        totalExplored,
      };
    },

    /**
     * Complete exploration
     */
    completeExploration(): void {
      progress = {
        ...progress,
        isExploring: false,
      };
      abortController = null;
    },

    /**
     * Cancel exploration
     */
    cancelExploration(): void {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      progress = {
        ...progress,
        isExploring: false,
        wasCancelled: true,
      };
    },

    /**
     * Set exploration error
     */
    setError(error: string): void {
      progress = {
        ...progress,
        isExploring: false,
        error,
      };
      abortController = null;
    },

    /**
     * Set sort option
     */
    setSortBy(option: VariationSortOption): void {
      if (sortBy === option) {
        // Toggle direction if same option
        sortDescending = !sortDescending;
      } else {
        sortBy = option;
        sortDescending = true;
      }
    },

    /**
     * Toggle a filter
     */
    toggleFilter(filterKey: keyof VariationFilters): void {
      filters = {
        ...filters,
        [filterKey]: !filters[filterKey],
      };
    },

    /**
     * Clear all filters
     */
    clearFilters(): void {
      filters = {
        noReversals: false,
        highContinuity: false,
        matchesMotionPreference: false,
      };
    },

    /**
     * Select a variation by ID
     */
    selectVariation(id: string | null): void {
      selectedVariationId = id;
    },

    /**
     * Reset all state
     */
    reset(): void {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      variations = [];
      progress = {
        isExploring: false,
        totalExplored: 0,
        uniqueFound: 0,
        estimatedTotal: 0,
        wasCancelled: false,
        error: null,
      };
      selectedVariationId = null;
      sortBy = "score";
      sortDescending = true;
      filters = {
        noReversals: false,
        highContinuity: false,
        matchesMotionPreference: false,
      };
    },
  };
}

/** Singleton instance of variation state */
let variationStateInstance: ReturnType<typeof createVariationState> | null =
  null;

/**
 * Get the global variation state instance
 */
export function getVariationState() {
  if (!variationStateInstance) {
    variationStateInstance = createVariationState();
  }
  return variationStateInstance;
}

/**
 * Reset the global variation state instance.
 * Call this when the Spell tab mounts to ensure clean state.
 */
export function resetVariationState() {
  if (variationStateInstance) {
    variationStateInstance.reset();
  }
}
