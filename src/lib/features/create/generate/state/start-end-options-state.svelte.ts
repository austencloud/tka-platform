/**
 * Start/End Options State Management
 *
 * Manages start/end position generation constraints:
 * - Blocked start positions (synced to Firebase via settings service)
 * - Start position (session-local)
 * - End position (session-local)
 * - Must-contain letters (session-local)
 * - Must-not-contain letters (session-local)
 *
 * blockedStartPositions syncs across devices for logged-in users.
 * Other options are session-specific and stored in localStorage.
 */

import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StartEndOptions } from "$lib/shared/create/state/panel-coordination-state.svelte";
import type { SettingsState } from "$lib/shared/settings/state/settings-state.svelte";

// ===== Session-local Persistence (localStorage) =====
const SESSION_STORAGE_KEY = "tka-start-end-session-options";

interface SerializedSessionOptions {
  startPositionLetter?: string;
  endPositionLetter?: string;
  mustContainLetters: string[];
  mustNotContainLetters: string[];
  timestamp: number;
}

/**
 * Save session-local options to localStorage
 * (excludes blockedStartPositions which syncs via Firebase)
 */
function saveSessionOptions(options: StartEndOptions): void {
  try {
    const serialized: SerializedSessionOptions = {
      startPositionLetter: options.startPosition?.letter || undefined,
      endPositionLetter: options.endPosition?.letter || undefined,
      mustContainLetters: options.mustContainLetters.map((l) => l.toString()),
      mustNotContainLetters: options.mustNotContainLetters.map((l) =>
        l.toString()
      ),
      timestamp: Date.now(),
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.warn("⚠️ StartEndOptions: Failed to save session options:", error);
  }
}

/**
 * Load session-local options from localStorage
 */
function loadSessionOptions(): Partial<StartEndOptions> | null {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored) as SerializedSessionOptions;

    return {
      startPosition: data.startPositionLetter
        ? ({ letter: data.startPositionLetter } as PictographData)
        : null,
      endPosition: data.endPositionLetter
        ? ({ letter: data.endPositionLetter } as PictographData)
        : null,
      mustContainLetters: (data.mustContainLetters || []) as Letter[],
      mustNotContainLetters: (data.mustNotContainLetters || []) as Letter[],
    };
  } catch (error) {
    console.warn("⚠️ StartEndOptions: Failed to load session options:", error);
    return null;
  }
}

/**
 * Clear session options from localStorage
 */
function clearSessionOptions(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("⚠️ StartEndOptions: Failed to clear session options:", error);
  }
}

// ===== Default Options =====
const DEFAULT_OPTIONS: StartEndOptions = {
  blockedStartPositions: [],
  startPosition: null,
  endPosition: null,
  mustContainLetters: [],
  mustNotContainLetters: [],
};

// ===== State Creator =====

/**
 * Creates reactive state for start/end position options
 *
 * blockedStartPositions: Loaded from and saved to Firebase settings (syncs across devices)
 * Other options: Loaded from and saved to localStorage (session-specific)
 */
export function createStartEndOptionsState(
  initialOptions?: Partial<StartEndOptions>
) {
  // Get settings service for Firebase-synced blocked positions
  let settingsState: SettingsState | null = null;
  try {
    settingsState = settingsService;
  } catch {
    console.warn("⚠️ StartEndOptions: Settings service not available");
  }

  // Load blocked positions from Firebase settings
  const savedBlockedPositions =
    (settingsState?.settings?.blockedStartPositions as GridPosition[]) ?? [];

  // Load session-local options from localStorage
  const savedSessionOptions = loadSessionOptions();

  // Initialize options with priority: initialOptions > saved > defaults
  let options = $state<StartEndOptions>({
    ...DEFAULT_OPTIONS,
    blockedStartPositions: savedBlockedPositions,
    ...(savedSessionOptions || {}),
    ...initialOptions,
  });

  // Derived values
  const hasAnyConstraints = $derived(
    options.blockedStartPositions.length > 0 ||
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

  /**
   * Save blockedStartPositions to Firebase settings
   */
  function saveBlockedPositions(blocked: GridPosition[]) {
    if (settingsState) {
      settingsState.updateSetting("blockedStartPositions", blocked);
    }
  }

  // Update function with persistence
  function updateOptions(updates: Partial<StartEndOptions>) {
    options = { ...options, ...updates };

    // If blockedStartPositions changed, save to Firebase
    if (updates.blockedStartPositions !== undefined) {
      saveBlockedPositions(updates.blockedStartPositions);
    }

    // Always save session options to localStorage
    saveSessionOptions(options);
  }

  // Replace entire options (used by sheet onChange callback)
  function setOptions(newOptions: StartEndOptions) {
    const blockedChanged =
      JSON.stringify(options.blockedStartPositions) !==
      JSON.stringify(newOptions.blockedStartPositions);

    options = { ...newOptions };

    // If blocked positions changed, save to Firebase
    if (blockedChanged) {
      saveBlockedPositions(newOptions.blockedStartPositions);
    }

    // Save session options to localStorage
    saveSessionOptions(options);
  }

  // Clear all constraints
  function resetOptions() {
    options = { ...DEFAULT_OPTIONS };
    saveBlockedPositions([]);
    clearSessionOptions();
  }

  // Clear only position constraints (when grid mode changes)
  // Returns true if any positions were actually cleared
  function clearPositions(): boolean {
    const hadPositions =
      options.blockedStartPositions.length > 0 ||
      options.startPosition !== null ||
      options.endPosition !== null;
    if (hadPositions) {
      updateOptions({
        blockedStartPositions: [],
        startPosition: null,
        endPosition: null,
      });
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
    clearSavedOptions: () => {
      saveBlockedPositions([]);
      clearSessionOptions();
    },

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
