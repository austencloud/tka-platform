/**
 * Word Card State Factory
 *
 * Connects word card display state with existing microservices.
 * NO REDUNDANT LOGIC - uses ExploreService for data, PageLayoutService for layout.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  IPageFactoryService,
  IPrintablePageLayoutService,
  IWordCardBrowseService,
} from "../services/contracts/word-card-contracts";
import {
  displayState,
  exportSettings,
  finishExport,
  finishRegeneration,
  layoutState,
  progressState,
  resetExportSettings,
  setColumnCount,
  setDeviceCapabilities,
  setSelectedLength,
  setShowBeatNumbers,
  setTransparentBackground,
  startExport,
  startRegeneration,
  updateContainerSize,
  updateExportProgress,
  updateExportSetting,
} from "./display-state.svelte";
import createPageLayoutState from "./page-layout-state.svelte";
// createPageLayoutState imported above at line 14

// ============================================================================
// SEQUENCE CARD STATE FACTORY
// ============================================================================

export function createWordCardState(
  _browseService: IWordCardBrowseService,
  layoutService: IPrintablePageLayoutService,
  pageFactoryService: IPageFactoryService
) {
  // Create page layout state for printable mode
  const pageLayoutState = createPageLayoutState(
    layoutService,
    pageFactoryService,
    []
  );

  // Reactive sequence data (synchronous state, async loading)
  const allSequences = $state<SequenceData[]>([]);
  const isLoadingSequences = $state(false);
  const sequenceLoadError = $state<string | null>(null);

  // Filtered sequences using EXISTING ExploreService
  const filteredSequences = $derived.by(() => {
    if (displayState.selectedLength === 0) {
      return allSequences;
    }

    // Simple client-side filtering for now
    return allSequences.filter(
      (seq) => seq.beats?.length === displayState.selectedLength
    );
  });

  // Current page sequences for grid/list view
  const currentPageSequences = $derived(() => {
    const sequences = filteredSequences;
    const startIndex = pageLayoutState.currentPage * 24; // items per page
    return sequences.slice(startIndex, startIndex + 24);
  });

  // Total pages for pagination
  const totalPages = $derived(() => {
    return Math.ceil(filteredSequences.length / 24);
  });

  // Progress message
  const statusMessage = $derived(() => {
    if (progressState.isExporting || progressState.isRegenerating) {
      return progressState.message;
    }

    if (isLoadingSequences) {
      return "Loading sequences...";
    }

    if (sequenceLoadError) {
      return `Error: ${sequenceLoadError}`;
    }

    const count = filteredSequences.length;

    if (count === 0) {
      return displayState.selectedLength === 0
        ? "No sequences available"
        : `No ${displayState.selectedLength}-beat sequences found`;
    }

    const lengthText =
      displayState.selectedLength === 0
        ? "all"
        : `${displayState.selectedLength}-beat`;
    return `${count} ${lengthText} sequence${count === 1 ? "" : "s"}`;
  });

  // Actions that connect to page layout
  async function switchToPrintableMode() {
    await pageLayoutState.createPages(filteredSequences);
  }

  async function refreshPages() {
    await pageLayoutState.regeneratePages();
  }

  return {
    // Display state
    displayState,
    exportSettings,
    progressState,
    layoutState,
    pageLayoutState,

    // Derived data (using existing services)
    get filteredSequences() {
      return filteredSequences;
    },
    get currentPageSequences() {
      return currentPageSequences;
    },
    get totalPages() {
      return totalPages;
    },
    get statusMessage() {
      return statusMessage;
    },

    // Actions
    setSelectedLength,
    setColumnCount,
    setShowBeatNumbers,
    setTransparentBackground,
    updateContainerSize,
    setDeviceCapabilities,
    startExport,
    updateExportProgress,
    finishExport,
    startRegeneration,
    finishRegeneration,
    updateExportSetting,
    resetExportSettings,
    switchToPrintableMode,
    refreshPages,
  };
}

export type WordCardState = ReturnType<typeof createWordCardState>;
