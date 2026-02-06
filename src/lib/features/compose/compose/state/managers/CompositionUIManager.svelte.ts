/**
 * Composition UI Manager
 *
 * Manages UI state for sheets, drawers, and fullscreen mode.
 * Extracted from composition-state.svelte.ts for single responsibility.
 */

export type CompositionUIManager = ReturnType<
  typeof createCompositionUIManager
>;

export function createCompositionUIManager() {
  // =========================================================================
  // State
  // =========================================================================

  let selectedCellId = $state<string | null>(null);
  let isTemplatesOpen = $state(false);
  let isCellConfigOpen = $state(false);
  let isSettingsOpen = $state(false);
  let isFullscreen = $state(false);

  // =========================================================================
  // Cell Selection
  // =========================================================================

  function selectCell(cellId: string | null) {
    selectedCellId = cellId;
  }

  function clearSelection() {
    selectedCellId = null;
  }

  // =========================================================================
  // Sheet Operations
  // =========================================================================

  function closeAllSheets() {
    isTemplatesOpen = false;
    isCellConfigOpen = false;
    isSettingsOpen = false;
  }

  function openTemplates() {
    closeAllSheets();
    isTemplatesOpen = true;
  }

  function closeTemplates() {
    isTemplatesOpen = false;
  }

  function openCellConfig(cellId: string) {
    closeAllSheets();
    selectedCellId = cellId;
    isCellConfigOpen = true;
  }

  function closeCellConfig() {
    isCellConfigOpen = false;
  }

  function openSettings() {
    closeAllSheets();
    isSettingsOpen = true;
  }

  function closeSettings() {
    isSettingsOpen = false;
  }

  // =========================================================================
  // Fullscreen
  // =========================================================================

  function enterFullscreen() {
    closeAllSheets();
    isFullscreen = true;
  }

  function exitFullscreen() {
    isFullscreen = false;
  }

  function toggleFullscreen() {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }

  // =========================================================================
  // Reset
  // =========================================================================

  function reset() {
    selectedCellId = null;
    closeAllSheets();
    isFullscreen = false;
  }

  // =========================================================================
  // Return API
  // =========================================================================

  return {
    // State getters
    get selectedCellId() {
      return selectedCellId;
    },
    get isTemplatesOpen() {
      return isTemplatesOpen;
    },
    get isCellConfigOpen() {
      return isCellConfigOpen;
    },
    get isSettingsOpen() {
      return isSettingsOpen;
    },
    get isFullscreen() {
      return isFullscreen;
    },

    // Cell selection
    selectCell,
    clearSelection,

    // Sheet operations
    closeAllSheets,
    openTemplates,
    closeTemplates,
    openCellConfig,
    closeCellConfig,
    openSettings,
    closeSettings,

    // Fullscreen
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,

    // Reset
    reset,
  };
}
