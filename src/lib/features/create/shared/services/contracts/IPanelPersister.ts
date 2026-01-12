/**
 * Panel Persistence Service Contract
 *
 * Manages saving and restoring panel states across navigation.
 * Handles the complex logic of:
 * - Detecting user-initiated panel closes vs navigation closes
 * - Saving open panel when navigating away
 * - Restoring panels when returning to a tab
 * - Closing all panels on module/tab changes
 */

import type { PanelCoordinationState } from "../../state/panel-coordination-state.svelte";

export type PanelId =
  | "animation"
  | "beatEditor"
  | "videoRecord"
  | "filter"
  | "sequenceActions"
  | "cap"
  | "customize";

export interface IPanelPersister {
  /**
   * Start tracking panel states and navigation changes.
   * Call once when the module mounts.
   * Returns a cleanup function to stop tracking.
   */
  startTracking(params: {
    panelState: PanelCoordinationState;
    canRestorePanels: () => boolean;
  }): () => void;

  /**
   * Get the currently open panel ID from panel state.
   */
  getCurrentOpenPanel(panelState: PanelCoordinationState): PanelId | null;

  /**
   * Close all panels gracefully.
   */
  closeAllPanels(panelState: PanelCoordinationState): void;

  /**
   * Restore a saved panel for the current tab.
   * Some panels (edit, cap) require context and won't be restored.
   */
  restoreSavedPanel(panelState: PanelCoordinationState, panelId: PanelId): void;
}
