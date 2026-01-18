/**
 * Funnel State
 *
 * Manages state for the progressive filter wizard that narrows down variations.
 * Each step applies a filter and shows the remaining count.
 */

import type { ScoredVariation } from "./variation-state.svelte";
import { browser } from "$app/environment";

// ============================================================================
// Types
// ============================================================================

/**
 * New wizard phases for preference-first flow:
 * - "preferences": User sets all preferences upfront (word, grid, constraints)
 * - "generating": Constraint-based exploration in progress
 * - "results": Shows matching variations with options to pick best or browse all
 */
export type WizardPhase = "preferences" | "generating" | "results";

export interface FunnelFilters {
  /** Beat count filter - null means "Any" */
  stepCount: number | null;
  /** Motion style preference */
  motionStyle: "dash" | "no-dash" | null;
  /** Maximum reversals allowed - null means "Any", 0 means "None" */
  maxReversals: number | null;
  /** Whether to require high continuity (above median) */
  highContinuity: boolean;
}

export interface FunnelOption {
  label: string;
  value: unknown;
  /** How many variations match this option */
  count: number;
}

export interface FunnelStepDefinition {
  id: string;
  title: string;
  question: string;
  filterKey: keyof FunnelFilters;
}

// ============================================================================
// Constants
// ============================================================================

const FUNNEL_PREFS_KEY = "spell-funnel-preferences";

export const DEFAULT_FUNNEL_FILTERS: FunnelFilters = {
  stepCount: null,
  motionStyle: null,
  maxReversals: null,
  highContinuity: false,
};

export const FUNNEL_STEPS: FunnelStepDefinition[] = [
  {
    id: "length",
    title: "Length",
    question: "How many steps?",
    filterKey: "stepCount",
  },
  {
    id: "motion",
    title: "Motion Style",
    question: "Dash preference?",
    filterKey: "motionStyle",
  },
  {
    id: "reversals",
    title: "Reversals",
    question: "Prop reversals?",
    filterKey: "maxReversals",
  },
  // Note: "Flow" step removed - HandPathDirectionService doesn't exist yet
  // Will be added back after implementing hand path direction analysis
];

// ============================================================================
// State Factory
// ============================================================================

/**
 * Creates funnel wizard state
 */
export function createFunnelState() {
  // ============================================================================
  // Core State
  // ============================================================================

  let currentStepIndex = $state(0);
  let filters = $state<FunnelFilters>({ ...DEFAULT_FUNNEL_FILTERS });
  let allVariations = $state<ScoredVariation[]>([]);

  // ============================================================================
  // Persistence
  // ============================================================================

  function loadPersistedFilters(): FunnelFilters {
    if (!browser) return { ...DEFAULT_FUNNEL_FILTERS };
    try {
      const stored = localStorage.getItem(FUNNEL_PREFS_KEY);
      if (stored) {
        return { ...DEFAULT_FUNNEL_FILTERS, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore parse errors
    }
    return { ...DEFAULT_FUNNEL_FILTERS };
  }

  function persistFilters() {
    if (!browser) return;
    try {
      localStorage.setItem(FUNNEL_PREFS_KEY, JSON.stringify(filters));
    } catch {
      // Ignore storage errors
    }
  }

  // ============================================================================
  // Filter Logic
  // ============================================================================

  /**
   * Apply all filters up to and including the given step index
   */
  function applyFiltersUpToStep(
    variations: ScoredVariation[],
    stepIndex: number
  ): ScoredVariation[] {
    let result = variations;

    for (let i = 0; i <= stepIndex && i < FUNNEL_STEPS.length; i++) {
      const step = FUNNEL_STEPS[i]!;
      result = applyFilter(result, step.filterKey);
    }

    return result;
  }

  /**
   * Apply a single filter
   */
  function applyFilter(
    variations: ScoredVariation[],
    filterKey: keyof FunnelFilters
  ): ScoredVariation[] {
    switch (filterKey) {
      case "stepCount":
        if (filters.stepCount === null) return variations;
        return variations.filter(
          (v) => v.sequence.steps.length === filters.stepCount
        );

      case "motionStyle":
        if (filters.motionStyle === null) return variations;
        if (filters.motionStyle === "dash") {
          // Keep variations with positive motion type score (more dashes)
          return variations.filter((v) => v.score.motionTypeScore > 0);
        } else {
          // Keep variations with negative or zero motion type score (fewer dashes)
          return variations.filter((v) => v.score.motionTypeScore <= 0);
        }

      case "maxReversals":
        if (filters.maxReversals === null) return variations;
        return variations.filter(
          (v) => v.score.reversalCount <= filters.maxReversals!
        );

      case "highContinuity":
        if (!filters.highContinuity) return variations;
        // Calculate median continuity score
        const sortedContinuity = [...variations]
          .map((v) => v.score.continuityScore)
          .sort((a, b) => a - b);
        const median =
          sortedContinuity[Math.floor(sortedContinuity.length / 2)] ?? 0;
        return variations.filter((v) => v.score.continuityScore >= median);

      default:
        return variations;
    }
  }

  /**
   * Count how many variations match a specific filter value
   * Uses a temporary filter object to avoid mutating state during render
   */
  function countForFilterValue(
    filterKey: keyof FunnelFilters,
    value: unknown
  ): number {
    // Get variations after applying all previous steps
    const previousStepIndex =
      FUNNEL_STEPS.findIndex((s) => s.filterKey === filterKey) - 1;
    const baseVariations =
      previousStepIndex >= 0
        ? applyFiltersUpToStep(allVariations, previousStepIndex)
        : allVariations;

    // Create a temporary filter object with the test value (no state mutation)
    const tempFilters: FunnelFilters = { ...filters, [filterKey]: value };
    const count = applyFilterWithFilters(baseVariations, filterKey, tempFilters).length;

    return count;
  }

  /**
   * Apply a single filter using a provided filters object (no state dependency)
   */
  function applyFilterWithFilters(
    variations: ScoredVariation[],
    filterKey: keyof FunnelFilters,
    filterValues: FunnelFilters
  ): ScoredVariation[] {
    switch (filterKey) {
      case "stepCount":
        if (filterValues.stepCount === null) return variations;
        return variations.filter(
          (v) => v.sequence.steps.length === filterValues.stepCount
        );

      case "motionStyle":
        if (filterValues.motionStyle === null) return variations;
        if (filterValues.motionStyle === "dash") {
          return variations.filter((v) => v.score.motionTypeScore > 0);
        } else {
          return variations.filter((v) => v.score.motionTypeScore <= 0);
        }

      case "maxReversals":
        if (filterValues.maxReversals === null) return variations;
        return variations.filter(
          (v) => v.score.reversalCount <= filterValues.maxReversals!
        );

      case "highContinuity":
        if (!filterValues.highContinuity) return variations;
        const sortedContinuity = [...variations]
          .map((v) => v.score.continuityScore)
          .sort((a, b) => a - b);
        const median =
          sortedContinuity[Math.floor(sortedContinuity.length / 2)] ?? 0;
        return variations.filter((v) => v.score.continuityScore >= median);

      default:
        return variations;
    }
  }

  // ============================================================================
  // Option Generators
  // ============================================================================

  /**
   * Get available beat count options with counts
   */
  function getBeatCountOptions(): FunnelOption[] {
    // Find unique beat counts in the data
    const beatCounts = new Set<number>();
    allVariations.forEach((v) => beatCounts.add(v.sequence.steps.length));
    const sortedCounts = Array.from(beatCounts).sort((a, b) => a - b);

    const options: FunnelOption[] = sortedCounts.map((count) => ({
      label: `${count} steps`,
      value: count,
      count: countForFilterValue("stepCount", count),
    }));

    // Add "Any" option
    options.push({
      label: "Any",
      value: null,
      count: countForFilterValue("stepCount", null),
    });

    return options;
  }

  /**
   * Get motion style options with counts
   */
  function getMotionStyleOptions(): FunnelOption[] {
    return [
      {
        label: "Favor Dashes",
        value: "dash",
        count: countForFilterValue("motionStyle", "dash"),
      },
      {
        label: "Avoid Dashes",
        value: "no-dash",
        count: countForFilterValue("motionStyle", "no-dash"),
      },
      {
        label: "Any",
        value: null,
        count: countForFilterValue("motionStyle", null),
      },
    ];
  }

  /**
   * Get reversal options with counts
   */
  function getReversalOptions(): FunnelOption[] {
    return [
      {
        label: "None",
        value: 0,
        count: countForFilterValue("maxReversals", 0),
      },
      {
        label: "Few (1-2)",
        value: 2,
        count: countForFilterValue("maxReversals", 2),
      },
      {
        label: "Any",
        value: null,
        count: countForFilterValue("maxReversals", null),
      },
    ];
  }

  /**
   * Get flow/continuity options with counts
   */
  function getFlowOptions(): FunnelOption[] {
    return [
      {
        label: "High Flow",
        value: true,
        count: countForFilterValue("highContinuity", true),
      },
      {
        label: "Any",
        value: false,
        count: countForFilterValue("highContinuity", false),
      },
    ];
  }

  /**
   * Get options for the current step
   */
  function getOptionsForStep(stepIndex: number): FunnelOption[] {
    const step = FUNNEL_STEPS[stepIndex];
    if (!step) return [];

    switch (step.filterKey) {
      case "stepCount":
        return getBeatCountOptions();
      case "motionStyle":
        return getMotionStyleOptions();
      case "maxReversals":
        return getReversalOptions();
      case "highContinuity":
        return getFlowOptions();
      default:
        return [];
    }
  }

  // ============================================================================
  // Derived State
  // ============================================================================

  /** Variations after applying all filters up to current step */
  const filteredVariations = $derived.by(() => {
    return applyFiltersUpToStep(allVariations, currentStepIndex);
  });

  /** Current step definition */
  const currentStep = $derived(FUNNEL_STEPS[currentStepIndex] ?? null);

  /** Whether we're on the final step */
  const isLastStep = $derived(currentStepIndex >= FUNNEL_STEPS.length - 1);

  /** Whether we're done with all steps (ready for selection) */
  const isComplete = $derived(currentStepIndex >= FUNNEL_STEPS.length);

  /** Count before current filter */
  const countBeforeFilter = $derived.by(() => {
    if (currentStepIndex === 0) return allVariations.length;
    return applyFiltersUpToStep(allVariations, currentStepIndex - 1).length;
  });

  /** Count after current filter */
  const countAfterFilter = $derived(filteredVariations.length);

  /** Best variation by score */
  const bestVariation = $derived.by(() => {
    const final = applyFiltersUpToStep(allVariations, FUNNEL_STEPS.length - 1);
    if (final.length === 0) return null;
    return final.reduce((best, v) =>
      v.score.total > best.score.total ? v : best
    );
  });

  // ============================================================================
  // Public API
  // ============================================================================

  return {
    // Getters
    get currentStepIndex() {
      return currentStepIndex;
    },
    get currentStep() {
      return currentStep;
    },
    get filters() {
      return filters;
    },
    get filteredVariations() {
      return filteredVariations;
    },
    get allVariations() {
      return allVariations;
    },
    get isLastStep() {
      return isLastStep;
    },
    get isComplete() {
      return isComplete;
    },
    get countBeforeFilter() {
      return countBeforeFilter;
    },
    get countAfterFilter() {
      return countAfterFilter;
    },
    get bestVariation() {
      return bestVariation;
    },
    get totalSteps() {
      return FUNNEL_STEPS.length;
    },

    /** Get the final filtered variations (after all steps) */
    getFinalVariations(): ScoredVariation[] {
      return applyFiltersUpToStep(allVariations, FUNNEL_STEPS.length - 1);
    },

    /** Get options for a specific step */
    getOptionsForStep,

    /** Get current step options */
    getCurrentStepOptions(): FunnelOption[] {
      return getOptionsForStep(currentStepIndex);
    },

    /** Set all variations (called after generation completes) */
    setVariations(variations: ScoredVariation[]) {
      allVariations = variations;
      // Load persisted filters after variations are set
      filters = loadPersistedFilters();
    },

    /** Update a specific filter value */
    setFilter<K extends keyof FunnelFilters>(key: K, value: FunnelFilters[K]) {
      filters = { ...filters, [key]: value };
      persistFilters();
    },

    /** Navigate to next step */
    nextStep() {
      if (currentStepIndex < FUNNEL_STEPS.length) {
        currentStepIndex++;
      }
    },

    /** Navigate to previous step */
    previousStep() {
      if (currentStepIndex > 0) {
        currentStepIndex--;
      }
    },

    /** Jump to a specific step */
    goToStep(index: number) {
      if (index >= 0 && index <= FUNNEL_STEPS.length) {
        currentStepIndex = index;
      }
    },

    /** Skip to final selection */
    skipToEnd() {
      currentStepIndex = FUNNEL_STEPS.length;
    },

    /** Reset wizard to beginning */
    reset() {
      currentStepIndex = 0;
      filters = { ...DEFAULT_FUNNEL_FILTERS };
      allVariations = [];
    },

    /** Reset just the step index (keep filters) */
    resetSteps() {
      currentStepIndex = 0;
    },
  };
}

export type FunnelState = ReturnType<typeof createFunnelState>;
