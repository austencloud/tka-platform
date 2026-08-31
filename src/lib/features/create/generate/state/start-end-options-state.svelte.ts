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
import {
  GridMode,
  type GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { StartEndOptions } from "$lib/shared/create/state/panel-coordination-state.svelte";
import type { SettingsState } from "$lib/shared/settings/state/settings-state.svelte";
import { clampStartOrientationToLevel } from "../domain/level-orientation-policy";
import {
  detectPresetFromBlocked,
  getBlockedPositionsForGrid,
  getBlockedPositionsForPreset,
  StartPositionPreset,
} from "../shared/domain/start-position-presets";

// ===== Session-local Persistence (localStorage) =====
const SESSION_STORAGE_KEY = "tka-start-end-session-options";

type BlockedStartPositionsByGridMode = Partial<
  Record<GridMode, GridPosition[]>
>;

interface SerializedSessionOptions {
  startPositionLetter?: string;
  /**
   * @deprecated Letter alone is ambiguous — "Γ" covers 8 gamma variants — so a
   * restored session could never rebuild the position the user picked. Read
   * for backwards compatibility, never written. Superseded by endPositions.
   */
  endPositionLetter?: string;
  /** Grid position names, e.g. ["gamma11", "alpha3"]. */
  endPositions?: string[];
  mustContainLetters: string[];
  mustNotContainLetters: string[];
  leftStartOrientation?: string;
  rightStartOrientation?: string;
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
      endPositions: options.endPositions.map(String),
      mustContainLetters: options.mustContainLetters.map((l) => l.toString()),
      mustNotContainLetters: options.mustNotContainLetters.map((l) =>
        l.toString()
      ),
      leftStartOrientation: options.leftStartOrientation,
      rightStartOrientation: options.rightStartOrientation,
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
      // The legacy endPositionLetter is deliberately NOT migrated: a letter
      // cannot name which of its variants was chosen, and the constraint never
      // reached the engine anyway, so there is no working selection to keep.
      endPosition: null,
      endPositions: (data.endPositions || []) as GridPosition[],
      mustContainLetters: (data.mustContainLetters || []) as Letter[],
      mustNotContainLetters: (data.mustNotContainLetters || []) as Letter[],
      leftStartOrientation:
        (data.leftStartOrientation as Orientation) ?? Orientation.IN,
      rightStartOrientation:
        (data.rightStartOrientation as Orientation) ?? Orientation.IN,
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

const DEFAULT_OPTIONS: StartEndOptions = {
  blockedStartPositions: [],
  startPosition: null,
  endPosition: null,
  endPositions: [],
  mustContainLetters: [],
  mustNotContainLetters: [],
  leftStartOrientation: Orientation.IN,
  rightStartOrientation: Orientation.IN,
};


/**
 * Creates reactive state for start/end position options
 *
 * blockedStartPositions: Loaded from and saved to Firebase settings (syncs across devices)
 * Other options: Loaded from and saved to localStorage (session-specific)
 */
export function createStartEndOptionsState(
  initialOptions?: Partial<StartEndOptions>,
  initialGridMode: GridMode = GridMode.DIAMOND
) {
  // Get settings service for Firebase-synced blocked positions
  let settingsState: SettingsState | null = null;
  try {
    settingsState = settingsService;
  } catch {
    console.warn("⚠️ StartEndOptions: Settings service not available");
  }

  // The legacy array remains the active-grid value consumed by generation.
  // The keyed setting distinguishes an untouched grid from one explicitly set
  // to All, which an empty array alone cannot represent.
  const legacyBlockedPositions =
    (settingsState?.settings?.blockedStartPositions as GridPosition[]) ?? [];
  let blockedStartPositionsByGridMode: BlockedStartPositionsByGridMode = {
    ...(settingsState?.settings?.blockedStartPositionsByGridMode ?? {}),
  };
  for (const gridMode of [GridMode.DIAMOND, GridMode.BOX]) {
    if (blockedStartPositionsByGridMode[gridMode] !== undefined) continue;
    const legacyForGrid = getBlockedPositionsForGrid(
      legacyBlockedPositions,
      gridMode
    );
    if (legacyForGrid.length > 0) {
      blockedStartPositionsByGridMode[gridMode] = legacyForGrid;
    }
  }
  let currentGridMode = initialGridMode;
  const savedForInitialGrid =
    blockedStartPositionsByGridMode[initialGridMode] ?? [];
  const initialBlockedPositions =
    initialOptions?.blockedStartPositions ?? savedForInitialGrid;
  blockedStartPositionsByGridMode = {
    ...blockedStartPositionsByGridMode,
    [initialGridMode]: [...initialBlockedPositions],
  };

  // Load session-local options from localStorage
  const savedSessionOptions = loadSessionOptions();

  // Initialize options with priority: initialOptions > saved > defaults
  let options = $state<StartEndOptions>({
    ...DEFAULT_OPTIONS,
    blockedStartPositions: initialBlockedPositions,
    ...(savedSessionOptions || {}),
    ...initialOptions,
  });

  // Derived values
  const hasAnyConstraints = $derived(
    options.blockedStartPositions.length > 0 ||
      options.startPosition !== null ||
      options.endPosition !== null ||
      options.endPositions.length > 0 ||
      options.mustContainLetters.length > 0 ||
      options.mustNotContainLetters.length > 0
  );

  const constraintsSummary = $derived.by(() => {
    const parts: string[] = [];

    if (options.startPosition) {
      parts.push(`Start: ${options.startPosition.letter || "?"}`);
    }

    if (options.endPositions.length === 1) {
      parts.push(`End: ${options.endPositions[0]}`);
    } else if (options.endPositions.length > 1) {
      parts.push(`End: ${options.endPositions.length} positions`);
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
    blockedStartPositionsByGridMode = {
      ...blockedStartPositionsByGridMode,
      [currentGridMode]: [...blocked],
    };
    if (settingsState) {
      void settingsState.updateSettings({
        blockedStartPositions: blocked,
        blockedStartPositionsByGridMode,
      });
    }
  }

  /**
   * Restore the target grid's selection. A grid visited for the first time
   * inherits Classic 3 when that named preset is active; after that, even an
   * explicit All selection is stored and restored independently.
   */
  function setGridMode(gridMode: GridMode): boolean {
    if (gridMode === currentGridMode) return false;

    blockedStartPositionsByGridMode = {
      ...blockedStartPositionsByGridMode,
      [currentGridMode]: [...options.blockedStartPositions],
    };
    const savedForNextGrid = blockedStartPositionsByGridMode[gridMode];
    const currentPreset = detectPresetFromBlocked(
      options.blockedStartPositions,
      currentGridMode
    );
    const nextBlockedPositions =
      savedForNextGrid !== undefined
        ? [...savedForNextGrid]
        : currentPreset === StartPositionPreset.CLASSIC
          ? getBlockedPositionsForPreset(StartPositionPreset.CLASSIC, gridMode)
          : [];
    // Grid mode changes the position vocabulary (diamond vs box names), so any
    // exact position held from the other mode is meaningless here.
    const clearedExactPositions =
      options.startPosition !== null ||
      options.endPosition !== null ||
      options.endPositions.length > 0;

    currentGridMode = gridMode;
    options = {
      ...options,
      blockedStartPositions: nextBlockedPositions,
      startPosition: null,
      endPosition: null,
      endPositions: [],
    };
    saveBlockedPositions(nextBlockedPositions);
    saveSessionOptions(options);

    return clearedExactPositions;
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
  function resetOptions(gridMode: GridMode = GridMode.DIAMOND) {
    currentGridMode = gridMode;
    blockedStartPositionsByGridMode = {
      [GridMode.DIAMOND]: [],
      [GridMode.BOX]: [],
    };
    options = { ...DEFAULT_OPTIONS };
    saveBlockedPositions([]);
    clearSessionOptions();
  }

  /**
   * Keep persisted start orientations inside the vocabulary selected by Level.
   * Returns whether either prop had to be normalized.
   */
  function normalizeOrientationsForLevel(level: number): boolean {
    const leftStartOrientation = clampStartOrientationToLevel(
      options.leftStartOrientation,
      level
    );
    const rightStartOrientation = clampStartOrientationToLevel(
      options.rightStartOrientation,
      level
    );
    const changed =
      leftStartOrientation !== options.leftStartOrientation ||
      rightStartOrientation !== options.rightStartOrientation;

    if (changed) {
      updateOptions({ leftStartOrientation, rightStartOrientation });
    }

    return changed;
  }

  // Individual field setters
  function setStartPosition(position: PictographData | null) {
    updateOptions({ startPosition: position });
  }

  function setEndPosition(position: PictographData | null) {
    updateOptions({ endPosition: position });
  }

  function setEndPositions(positions: GridPosition[]) {
    updateOptions({ endPositions: [...positions] });
  }

  /**
   * LOOPs determine their own endpoint, so a manually selected endpoint cannot
   * remain active once LOOP generation is enabled. Clear both representations
   * together so an older saved session cannot keep an invisible constraint.
   */
  function reconcileLoopEnabled(loopEnabled: boolean): boolean {
    if (
      !loopEnabled ||
      (options.endPosition === null && options.endPositions.length === 0)
    ) {
      return false;
    }

    updateOptions({ endPosition: null, endPositions: [] });
    return true;
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
    setGridMode,
    resetOptions,
    normalizeOrientationsForLevel,
    clearSavedOptions: () => {
      blockedStartPositionsByGridMode = {};
      if (settingsState) {
        void settingsState.updateSettings({
          blockedStartPositions: [],
          blockedStartPositionsByGridMode: {},
        });
      }
      clearSessionOptions();
    },

    // Field-level setters
    setStartPosition,
    setEndPosition,
    setEndPositions,
    reconcileLoopEnabled,
    setMustContainLetters,
    setMustNotContainLetters,
  };
}

export type StartEndOptionsState = ReturnType<
  typeof createStartEndOptionsState
>;

/** @deprecated Use createStartEndOptionsState instead */
export const createCustomizeOptionsState = createStartEndOptionsState;

/** @deprecated Use StartEndOptionsState instead */
export type CustomizeOptionsState = StartEndOptionsState;
