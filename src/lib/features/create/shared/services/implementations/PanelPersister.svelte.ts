/**
 * Panel Persistence Service Implementation
 *
 * Extracted from CreateModule.svelte to handle panel state persistence
 * across navigation changes.
 */

import { injectable } from "inversify";
import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
import type { IPanelPersister, PanelId } from "../contracts/IPanelPersister";
import type { PanelCoordinationState } from "../../state/panel-coordination-state.svelte";

@injectable()
export class PanelPersister implements IPanelPersister {
  getCurrentOpenPanel(panelState: PanelCoordinationState): PanelId | null {
    if (panelState.isAnimationPanelOpen) return "animation";
    if (panelState.isEditPanelOpen) return "edit";
    if (panelState.isVideoRecordPanelOpen) return "videoRecord";
    if (panelState.isFilterPanelOpen) return "filter";
    if (panelState.isSequenceActionsPanelOpen) return "sequenceActions";
    if (panelState.isLOOPPanelOpen) return "cap";
    if (panelState.isCustomizePanelOpen) return "customize";
    return null;
  }

  closeAllPanels(panelState: PanelCoordinationState): void {
    panelState.closeEditPanel();
    panelState.closeAnimationPanel();
    panelState.closeVideoRecordPanel();
    panelState.closeFilterPanel();
    panelState.closeSequenceActionsPanel();
    panelState.closeLOOPPanel();
    panelState.closeCustomizePanel();
  }

  restoreSavedPanel(
    panelState: PanelCoordinationState,
    panelId: PanelId
  ): void {
    switch (panelId) {
      case "animation":
        panelState.openAnimationPanel();
        break;
      case "videoRecord":
        panelState.openVideoRecordPanel();
        break;
      case "filter":
        panelState.openFilterPanel();
        break;
      case "sequenceActions":
        panelState.openSequenceActionsPanel();
        break;
      // edit and cap panels require context (beat data, LOOP type)
      // so we don't restore them - they need user interaction
    }
  }

  startTracking(params: {
    panelState: PanelCoordinationState;
    canRestorePanels: () => boolean;
  }): () => void {
    const { panelState, canRestorePanels } = params;

    let previousModule: string | null = null;
    let previousTab: string | null = null;
    let previousPanelOpen: PanelId | null = null;
    let isTracking = true;

    // Create reactive tracking using $effect.root for service context
    const cleanup = $effect.root(() => {
      // Effect 1: Detect user-initiated panel closes
      $effect(() => {
        if (!isTracking) return;

        const currentModule = navigationState.currentModule;
        if (currentModule !== "create") return;

        const currentPanelOpen = this.getCurrentOpenPanel(panelState);

        // If a panel was open and is now closed (user closed it), clear saved state
        if (previousPanelOpen !== null && currentPanelOpen === null) {
          navigationState.clearPanelForTab();
        }

        previousPanelOpen = currentPanelOpen;
      });

      // Effect 2: Handle navigation changes (module/tab switches)
      $effect(() => {
        if (!isTracking) return;

        const currentModule = navigationState.currentModule;
        const currentTab = navigationState.activeTab;

        const moduleChanged =
          previousModule !== null && currentModule !== previousModule;
        const tabChanged =
          previousTab !== null &&
          currentTab !== previousTab &&
          currentModule === "create";

        if (moduleChanged || tabChanged) {
          // Save which panel was open before closing
          if (
            panelState.isAnyPanelOpen &&
            previousModule === "create" &&
            previousTab
          ) {
            const openPanelId = this.getCurrentOpenPanel(panelState);
            if (openPanelId) {
              navigationState.setLastPanelForTab(
                openPanelId,
                previousModule as "create",
                previousTab
              );
            }
          }

          // Close all panels when navigating away or switching tabs
          if (panelState.isAnyPanelOpen) {
            this.closeAllPanels(panelState);
          }

          // Restore panel for the new tab if conditions are met
          if (
            currentModule === "create" &&
            !panelState.isAnyPanelOpen &&
            canRestorePanels()
          ) {
            const savedPanel = navigationState.getLastPanelForTab(
              "create",
              currentTab
            );
            if (savedPanel) {
              // Delay to allow close animation to complete
              setTimeout(() => {
                if (isTracking) {
                  this.restoreSavedPanel(panelState, savedPanel as PanelId);
                }
              }, 100);
            }
          }
        }

        previousModule = currentModule;
        previousTab = currentTab;
      });
    });

    // Return cleanup function
    return () => {
      isTracking = false;
      cleanup();
    };
  }
}
