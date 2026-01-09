/**
 * Start/End Options State Management
 *
 * Manages start/end position generation constraints:
 * - Start position
 * - End position
 * - Must-contain letters
 * - Must-not-contain letters
 *
 * These are advanced constraints that filter or guide the generation,
 * separate from the main UIGenerationConfig which configures the algorithm.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";

// ===== Persistence =====
const STORAGE_KEY = "tka-start-end-options";

interface SerializedOptions {
  startPositionLetter?: string;
  endPositionLetter?: string;
  mustContainLetters: string[];
  mustNotContainLetters: string[];
  timestamp: number;
}

/**
 * Save options to localStorage
 */
function saveOptions(options: StartEndOptions): void {
  try {
    const serialized: SerializedOptions = {
      startPositionLetter: options.startPosition?.letter || undefined,
      endPositionLetter: options.endPosition?.letter || undefined,
      mustContainLetters: options.mustContainLetters.map((l) => l.toString()),
      mustNotContainLetters: options.mustNotContainLetters.map((l) =>
        l.toString()
      ),
      timestamp: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.warn("⚠️ StartEndOptions: Failed to save options:", error);
  }
}

/**
 * Load options from localStorage
 */
function loadOptions(): StartEndOptions | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored) as SerializedOptions;

    // For now, we only restore the letter arrays
    // Position restoration would require looking up the actual PictographData
    return {
      startPosition: data.startPositionLetter
        ? ({ letter: data.startPositionLetter } as PictographData)
        : null,
      endPosition: data.endPositionLetter
        ? ({ letter: data.endPositionLetter } as PictographData)
        : null,
      mustContainLetters: data.mustContainLetters as Letter[],
      mustNotContainLetters: data.mustNotContainLetters as Letter[],
    };
  } catch (error) {
    console.warn("⚠️ StartEndOptions: Failed to load options:", error);
    return null;
  }
}

/**
 * Clear saved options from localStorage
 */
function clearOptions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("⚠️ StartEndOptions: Failed to clear options:", error);
  }
}

// ===== Default Options =====
const DEFAULT_OPTIONS: StartEndOptions = {
  startPosition: null,
  endPosition: null,
  mustContainLetters: [],
  mustNotContainLetters: [],
};

// ===== State Creator =====

/**
 * Creates reactive state for start/end position options
 * Automatically loads saved settings from localStorage and persists changes
 */
export function createStartEndOptionsState(
  initialOptions?: Partial<StartEndOptions>
) {
  // Load saved options or use defaults
  const savedOptions = loadOptions();

  // Initialize options with priority: initialOptions > savedOptions > DEFAULT_OPTIONS
  let options = $state<StartEndOptions>({
    ...DEFAULT_OPTIONS,
    ...(savedOptions || {}),
    ...initialOptions,
  });

  // Derived values
  const hasAnyConstraints = $derived(
    options.startPosition !== null ||
      options.endPosition !== null ||
      options.mustContainLetters.length > 0 ||
      options.mustNotContainLetters.length > 0
  );

  const constraintsSummary = $derived.by(() => {
    const parts: string[] = [];

    if (options.startPosition) {
      parts.push(`Start: ${options.startPosition.letter || "?"}`);
    }

    if (options.endPosition) {
      parts.push(`End: ${options.endPosition.letter || "?"}`);
    }

    if (options.mustContainLetters.length > 0) {
      parts.push(`+${options.mustContainLetters.length}`);
    }

    if (options.mustNotContainLetters.length > 0) {
      parts.push(`-${options.mustNotContainLetters.length}`);
    }

    return parts.length > 0 ? parts.join(" · ") : "None";
  });

  // Update function with persistence
  function updateOptions(updates: Partial<StartEndOptions>) {
    options = { ...options, ...updates };
    saveOptions(options);
  }

  // Replace entire options (used by sheet onChange callback)
  function setOptions(newOptions: StartEndOptions) {
    options = { ...newOptions };
    saveOptions(options);
  }

  // Clear all constraints
  function resetOptions() {
    options = { ...DEFAULT_OPTIONS };
    clearOptions();
  }

  // Clear only position constraints (when grid mode changes)
  // Returns true if any positions were actually cleared
  function clearPositions(): boolean {
    const hadPositions =
      options.startPosition !== null || options.endPosition !== null;
    if (hadPositions) {
      updateOptions({ startPosition: null, endPosition: null });
    }
    return hadPositions;
  }

  // Individual field setters
  function setStartPosition(position: PictographData | null) {
    updateOptions({ startPosition: position });
  }

  function setEndPosition(position: PictographData | null) {
    updateOptions({ endPosition: position });
  }

  function setMustContainLetters(letters: Letter[]) {
    updateOptions({ mustContainLetters: [...letters] });
  }

  function setMustNotContainLetters(letters: Letter[]) {
    updateOptions({ mustNotContainLetters: [...letters] });
  }

  return {
    // State
    get options() {
      return options;
    },
    get hasAnyConstraints() {
      return hasAnyConstraints;
    },
    get constraintsSummary() {
      return constraintsSummary;
    },

    // Actions
    updateOptions,
    setOptions,
    resetOptions,
    clearPositions,
    clearSavedOptions: clearOptions,

    // Field-level setters
    setStartPosition,
    setEndPosition,
    setMustContainLetters,
    setMustNotContainLetters,
  };
}

export type StartEndOptionsState = ReturnType<typeof createStartEndOptionsState>;

/** @deprecated Use createStartEndOptionsState instead */
export const createCustomizeOptionsState = createStartEndOptionsState;

/** @deprecated Use StartEndOptionsState instead */
export type CustomizeOptionsState = StartEndOptionsState;
