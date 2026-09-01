/**
 * Simplified Start Position State
 *
 * Based on the working legacy implementation - simple and effective.
 * No over-engineering, just the core functionality needed.
 */

import { settingsService as settingsServiceSingleton } from "$lib/shared/settings/state/settings-state.svelte";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { SettingsState } from "$lib/shared/settings/state/settings-state.svelte";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { startPositionManager } from "$lib/shared/create/services/start-position-manager";

export function createSimplifiedStartPositionState() {
  let settingsService: SettingsState | null = null;

  function getSettingsServiceSync(): SettingsState {
    if (!settingsService) {
      settingsService = settingsServiceSingleton;
    }
    return settingsService!;
  }

  // Simple reactive state - just what we need
  let positions = $state<PictographData[]>([]);
  let allVariations = $state<PictographData[]>([]);
  let selectedPosition = $state<PictographData | null>(null);
  let currentGridMode = $state<GridMode>(GridMode.DIAMOND); // Default, loaded async
  let leftOri = $state<Orientation>(Orientation.IN);
  let rightOri = $state<Orientation>(Orientation.IN);
  const selectionListeners = new Set<
    (position: PictographData | null, source: "user" | "sync") => void
  >();

  function notifySelectionChange(
    position: PictographData | null,
    source: "user" | "sync" = "user"
  ) {
    selectionListeners.forEach((listener) => {
      try {
        listener(position, source);
      } catch (error) {
        console.error("? start-position-state: listener error", error);
      }
    });
  }

  // Load positions on initialization - always succeeds with hardcoded positions
  async function loadPositions(gridMode: GridMode = currentGridMode) {
    currentGridMode = gridMode;
    positions = await startPositionManager.getStartPositions(gridMode, leftOri, rightOri);

    // Persist grid mode to settings when it changes
    try {
      const settings = getSettingsServiceSync();
      await settings.updateSetting("gridMode", gridMode);
    } catch (error) {
      console.warn("Failed to persist grid mode to settings", error);
    }
  }

  // Set grid mode directly without loading positions
  // Useful when importing a sequence where we just need the mode to match
  function setGridMode(gridMode: GridMode) {
    if (currentGridMode !== gridMode) {
      currentGridMode = gridMode;
    }
  }

  // Load all 16 start position variations for the current grid mode
  async function loadAllVariations(gridMode: GridMode = currentGridMode) {
    currentGridMode = gridMode;
    allVariations = startPositionManager.getAllStartPositionVariations(gridMode, leftOri, rightOri);

    // Persist grid mode to settings when it changes
    try {
      const settings = getSettingsServiceSync();
      await settings.updateSetting("gridMode", gridMode);
    } catch (error) {
      console.warn("Failed to persist grid mode to settings", error);
    }
  }

  // Regenerate all position sets with current orientations
  async function regeneratePositions() {
    positions = await startPositionManager.getStartPositions(currentGridMode, leftOri, rightOri);
    allVariations = startPositionManager.getAllStartPositionVariations(currentGridMode, leftOri, rightOri);
  }

  // Change blue orientation and reload positions
  async function setLeftOrientation(orientation: Orientation) {
    leftOri = orientation;
    await regeneratePositions();
  }

  // Change red orientation and reload positions
  async function setRightOrientation(orientation: Orientation) {
    rightOri = orientation;
    await regeneratePositions();
  }

  // Convenience: set both orientations at once
  async function setOrientation(orientation: Orientation) {
    leftOri = orientation;
    rightOri = orientation;
    await regeneratePositions();
  }

  // Select a position
  async function selectPosition(position: PictographData) {
    startPositionManager.selectStartPosition(position);
    selectedPosition = position;
    notifySelectionChange(position, "user");
  }

  function setSelectedPosition(position: PictographData | null) {
    selectedPosition = position;
    notifySelectionChange(position, "sync");
  }

  function clearSelectedPosition() {
    setSelectedPosition(null);
  }

  function onSelectedPositionChange(
    listener: (position: PictographData | null, source: "user" | "sync") => void
  ) {
    selectionListeners.add(listener);
    return () => {
      selectionListeners.delete(listener);
    };
  }

  // Initialize on creation
  void loadPositions();

  return {
    // State
    get positions() {
      return positions;
    },
    get allVariations() {
      return allVariations;
    },
    get selectedPosition() {
      return selectedPosition;
    },
    get currentGridMode() {
      return currentGridMode;
    },
    get leftOrientation() {
      return leftOri;
    },
    get rightOrientation() {
      return rightOri;
    },

    // Actions
    selectPosition,
    setLeftOrientation,
    setRightOrientation,
    setOrientation,
    setSelectedPosition,
    clearSelectedPosition,
    loadPositions,
    loadAllVariations,
    setGridMode,
    onSelectedPositionChange,
  };
}

export type SimplifiedStartPositionState = ReturnType<
  typeof createSimplifiedStartPositionState
>;
