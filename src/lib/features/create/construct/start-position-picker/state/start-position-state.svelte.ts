/**
 * Simplified Start Position State
 *
 * Based on the working legacy implementation - simple and effective.
 * No over-engineering, just the core functionality needed.
 */

import { container } from "$lib/shared/di";
import { GridMode } from "../../../../../shared/pictograph/grid/domain/enums/grid-enums";
import type { PictographData } from "../../../../../shared/pictograph/shared/domain/models/PictographData";
import type { ISettingsState } from "../../../../../shared/settings/services/contracts/ISettingsState";
import { startPositionManager } from "../services/implementations/StartPositionManager";

export function createSimplifiedStartPositionState() {
  let settingsService: ISettingsState | null = null;

  function getSettingsServiceSync(): ISettingsState {
    if (!settingsService) {
      settingsService = container.items.settingsState;
    }
    return settingsService!;
  }

  // Simple reactive state - just what we need
  let positions = $state<PictographData[]>([]);
  let allVariations = $state<PictographData[]>([]);
  let selectedPosition = $state<PictographData | null>(null);
  let currentGridMode = $state<GridMode>(GridMode.DIAMOND); // Default, loaded async
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
    positions = await startPositionManager.getStartPositions(gridMode);

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
    allVariations = await startPositionManager.getAllStartPositionVariations(gridMode);

    // Persist grid mode to settings when it changes
    try {
      const settings = getSettingsServiceSync();
      await settings.updateSetting("gridMode", gridMode);
    } catch (error) {
      console.warn("Failed to persist grid mode to settings", error);
    }
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

    // Actions
    selectPosition,
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
