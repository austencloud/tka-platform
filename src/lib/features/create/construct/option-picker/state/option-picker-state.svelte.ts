/**
 * Option Picker State
 *
 * Factory function for creating option picker reactive state.
 * Follows the same pattern as the simplified start position picker.
 */

import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type {
  OptionPickerState,
  SortMethod,
} from "../domain/option-picker-types";
import type { OptionPickerLayout } from "../domain/option-viewer-models";
import type { IOptionFilter } from "../services/contracts/IOptionFilter";
import type { IOptionLoader } from "../services/contracts/IOptionLoader";
import type { IOptionSorter } from "../services/contracts/IOptionSorter";

export interface OptionPickerStateConfig {
  optionLoader: IOptionLoader;
  filterService: IOptionFilter;
  optionSorter: IOptionSorter;
}

export function createOptionPickerState(config: OptionPickerStateConfig) {
  const { optionLoader, filterService, optionSorter } = config;

  // Core reactive state
  let state = $state<OptionPickerState>("ready");
  let options = $state<PictographData[]>([]);
  let error = $state<string | null>(null);
  let sortMethod = $state<SortMethod>("type");
  let lastSequenceId = $state<string | null>(null); // Track last loaded sequence
  let currentSequence = $state<PictographData[]>([]); // Track current sequence for reversal context

  // Continuation reordering state - tracks where the user last clicked
  // so the continuation option can be placed at the same grid slot
  let lastClickedSlot = $state<{
    typeSection: string;
    slotIndex: number;
  } | null>(null);

  const layout = $state<OptionPickerLayout>({
    optionsPerRow: 4,
    optionSize: 100,
    gridGap: "8px",
    gridColumns: "repeat(4, 1fr)",
    containerWidth: 800,
    containerHeight: 600,
  });

  /**
   * Creates a sequence ID that captures position and orientation changes.
   * This ensures the option picker refreshes when:
   * - Steps are added/removed (length changes)
   * - Sequence is rotated (endPosition changes)
   * - Sequence is mirrored/flipped (endPosition and orientations change)
   * - Grid mode changes
   */
  function createSequenceId(
    sequence: PictographData[],
    gridMode: GridMode
  ): string {
    if (sequence.length === 0) {
      return `empty-${gridMode}`;
    }

    const lastStep = sequence[sequence.length - 1];
    const endPos = lastStep?.endPosition ?? "none";
    const blueEndOri = lastStep?.motions?.blue?.endOrientation ?? "none";
    const redEndOri = lastStep?.motions?.red?.endOrientation ?? "none";

    return `${sequence.length}-${lastStep?.id || "empty"}-${endPos}-${blueEndOri}-${redEndOri}-${gridMode}`;
  }

  // Simplified filter state - just continuous vs all
  let isContinuousOnly = $state(false);

  // Computed state
  const isLoading = $derived(() => state === "loading");
  const hasError = $derived(() => state === "error");
  const hasOptions = $derived(() => options.length > 0);

  const filteredOptions = $derived(() => {
    if (!hasOptions()) {
      return [];
    }

    let filteredResults = [...options];

    // Apply continuity filter if enabled
    // Only apply when we have at least 2 steps (start position + 1 actual beat)
    // With just a start position, there's no rotation context to compare against
    if (isContinuousOnly && currentSequence.length >= 2) {
      const continuousFilter = {
        continuous: true,
        "1-reversal": false,
        "2-reversals": false,
      };
      filteredResults = filterService.applyReversalFiltering(
        filteredResults,
        continuousFilter,
        currentSequence
      );
    }

    // Apply sorting
    if (sortMethod) {
      filteredResults = optionSorter.applySorting(filteredResults, sortMethod);
    }

    return filteredResults;
  });

  // Actions
  async function loadOptions(sequence: PictographData[], gridMode: GridMode) {
    if (state === "loading") {
      return; // Prevent concurrent loads
    }

    // Create a sequence ID that includes end position and orientations
    // This ensures the option picker refreshes when transforms change positions
    const sequenceId = createSequenceId(sequence, gridMode);

    if (lastSequenceId === sequenceId) {
      // Even if skipped, update currentSequence in case it changed
      // This can happen when steps are added but sequenceId happens to match
      if (sequence.length !== currentSequence.length) {
        currentSequence = sequence;
      }
      return; // Skip reload for same sequence
    }

    state = "loading";
    error = null;
    lastSequenceId = sequenceId;
    currentSequence = sequence; // Store sequence for reversal filtering context

    try {
      const newOptions = await optionLoader.loadOptions(sequence, gridMode);
      options = newOptions;
      state = "ready";
    } catch (err) {
      console.error("Failed to load options:", err);
      error = err instanceof Error ? err.message : "Failed to load options";
      state = "error";
      options = [];
    }
  }

  function setSortMethod(method: SortMethod) {
    sortMethod = method;
  }

  function recordClickSlot(typeSection: string, slotIndex: number) {
    lastClickedSlot = { typeSection, slotIndex };
  }

  function setContinuousOnly(value: boolean) {
    // Force state update to trigger derived recomputation
    isContinuousOnly = value;
    if (!value) {
      lastClickedSlot = null;
    }
  }

  // Get filtered options - called as a function to ensure fresh computation
  function getFilteredOptions(): PictographData[] {
    if (options.length === 0) {
      return [];
    }

    let filteredResults = [...options];

    // Apply continuity filter if enabled (requires at least 2 steps for rotation context)
    if (isContinuousOnly && currentSequence.length >= 2) {
      const continuousFilter = {
        continuous: true,
        "1-reversal": false,
        "2-reversals": false,
      };
      filteredResults = filterService.applyReversalFiltering(
        filteredResults,
        continuousFilter,
        currentSequence
      );
    }

    // Apply sorting
    if (sortMethod) {
      filteredResults = optionSorter.applySorting(filteredResults, sortMethod);
    }

    return filteredResults;
  }

  function selectOption(_option: PictographData) {
    try {
      // Basic selection handling - can be extended as needed
      // Currently this is a no-op, reserved for future functionality
    } catch (err) {
      console.error("Failed to select option:", err);
      error = err instanceof Error ? err.message : "Failed to select option";
    }
  }

  function clearError() {
    error = null;
    if (state === "error") {
      state = "ready";
    }
  }

  function reset() {
    state = "ready";
    options = [];
    error = null;
    sortMethod = "type";
    lastSequenceId = null;
    // Do NOT reset isContinuousOnly - it's a persisted user preference
    currentSequence = [];
    lastClickedSlot = null;
  }

  /**
   * Get debug info for troubleshooting empty options
   */
  function getDebugInfo() {
    // Extract motion data for debugging - this is critical for diagnosing option loading issues
    const getMotionDebugData = (p: PictographData) => ({
      hasBlueMotion: !!p.motions?.blue,
      hasRedMotion: !!p.motions?.red,
      blueMotion: p.motions?.blue
        ? {
            startLocation: p.motions.blue.startLocation,
            endLocation: p.motions.blue.endLocation,
            startOrientation: p.motions.blue.startOrientation,
            endOrientation: p.motions.blue.endOrientation,
            motionType: p.motions.blue.motionType,
          }
        : null,
      redMotion: p.motions?.red
        ? {
            startLocation: p.motions.red.startLocation,
            endLocation: p.motions.red.endLocation,
            startOrientation: p.motions.red.startOrientation,
            endOrientation: p.motions.red.endOrientation,
            motionType: p.motions.red.motionType,
          }
        : null,
    });

    // Get last beat's motion data separately for quick diagnosis
    const lastStep =
      currentSequence.length > 0
        ? currentSequence[currentSequence.length - 1]
        : null;
    const lastStepMotionData = lastStep ? getMotionDebugData(lastStep) : null;

    return {
      timestamp: new Date().toISOString(),
      state,
      optionsCount: options.length,
      filteredOptionsCount: filteredOptions().length,
      lastSequenceId,
      currentSequenceLength: currentSequence.length,
      // Quick diagnosis: last beat motion status
      lastStepHasMotions: lastStepMotionData
        ? lastStepMotionData.hasBlueMotion && lastStepMotionData.hasRedMotion
        : false,
      lastStepMotionData,
      // Full sequence with motion data
      currentSequence: currentSequence.map((p, i) => ({
        index: i,
        id: p.id,
        letter: p.letter,
        startPosition: p.startPosition,
        endPosition: p.endPosition,
        ...getMotionDebugData(p),
      })),
      isContinuousOnly,
      sortMethod,
      error,
    };
  }

  // Return the state interface
  return {
    // State getters
    get state() {
      return state;
    },
    get options() {
      return options;
    },
    get error() {
      return error;
    },
    get sortMethod() {
      return sortMethod;
    },
    get isContinuousOnly() {
      return isContinuousOnly;
    },
    get layout() {
      return layout;
    },
    get currentSequence() {
      return currentSequence;
    },
    get lastSequenceId() {
      return lastSequenceId;
    },
    get lastClickedSlot() {
      return lastClickedSlot;
    },

    // Computed getters
    get isLoading() {
      return isLoading();
    },
    get hasError() {
      return hasError();
    },
    get hasOptions() {
      return hasOptions();
    },
    get filteredOptions() {
      return filteredOptions();
    },

    // Actions
    loadOptions,
    setSortMethod,
    setContinuousOnly,
    recordClickSlot,
    selectOption,
    clearError,
    reset,
    getFilteredOptions,
    getDebugInfo,
  };
}
