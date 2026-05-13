/**
 * BrowseEventHandler - Handles all browse module events and actions
 *
 * Coordinates sequence actions, detail panel interactions, and navigation
 * following the service-based architecture pattern.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  BrowseEventHandlerParams } from "../contracts/types";
import { sequencePanelManager } from "$lib/shared/browse/state/sequence-panel-state.svelte";
import { browseScrollState } from "$lib/shared/browse/state/BrowseScrollState.svelte";
import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
import { handleModuleChange } from "../../../../../shared/navigation-coordinator/navigation-coordinator.svelte";
import { openSequenceViewer } from "../../../../../shared/sequence-viewer/services/implementations/SequenceViewerNavigator";
import { openVariationPicker } from "../../state/variation-picker-state.svelte";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";

import { getLibraryRepository } from "$lib/shared/library/getLibraryRepository";
export class BrowseEventHandler {
  private params: BrowseEventHandlerParams | null = null;

  constructor(
    private loaderService: PublicSequencesLoader | null
  ) {}

  /**
   * Initialize the service with required parameters
   * Called by BrowseModule on mount
   */
  initialize(params: BrowseEventHandlerParams): void {
    this.params = params;
  }

  private ensureInitialized(): void {
    if (!this.params) {
      throw new Error("BrowseEventHandler not initialized");
    }
  }

  handleSequenceSelect(sequence: SequenceData): void {
    this.ensureInitialized();
    this.params!.setSelectedSequence(sequence);
  }

  async handleSequenceAction(
    action: string,
    sequence: SequenceData,
    variations?: SequenceData[]
  ): Promise<void> {
    this.ensureInitialized();

    try {
      switch (action) {
        case "select":
          this.handleSequenceSelect(sequence);
          break;
        case "view-detail":
          this.handleViewDetail(sequence, variations);
          break;
        case "delete":
          // Deletion is handled by the sequence viewer, not the gallery.
          // This case is kept so the switch doesn't hit the default warn.
          break;
        case "favorite":
          await this.params!.engine.toggleFavorite(sequence.id);
          break;
        case "fullscreen":
          this.handleSpotlightView(sequence);
          break;
        case "animate":
          this.params!.openAnimationModal(sequence);
          break;
        case "publish":
          await this.handlePublish(sequence);
          break;
        case "unpublish":
          await this.handleUnpublish(sequence);
          break;
        default:
          console.warn("Unknown action:", action);
      }
    } catch (err) {
      console.error("Action failed:", err);
      this.params!.setError(
        err instanceof Error ? err.message : `Failed to ${action} sequence`
      );
    }
  }

  handleViewDetail(sequence: SequenceData, variations?: SequenceData[]): void {
    const isHandsMode = this.params?.engine.viewMode.subject === "hands";
    if (variations && variations.length > 1) {
      openVariationPicker(variations);
    } else {
      openSequenceViewer(sequence, {
        returnPath: "/browse/gallery",
        returnLabel: "Browse",
        scrollY: browseScrollState.lastScrollY,
        handPathMode: isHandsMode,
      });
    }
  }

  handleCloseDetailPanel(): void {
    sequencePanelManager.close();
  }

  async handleEditSequence(sequence: SequenceData): Promise<void> {
    this.ensureInitialized();

    if (!authState.isAuthenticated) {
      authDrawerState.show();
      return;
    }

    try {
      // Gallery sequences have empty steps - need to load full sequence data
      let fullSequence = sequence;
      if (!sequence.steps || sequence.steps.length === 0) {
        if (this.loaderService) {
          const sequenceName = sequence.word || sequence.id;
          const loaded =
            await this.loaderService.loadFullSequenceData(sequenceName);
          if (loaded) {
            fullSequence = loaded;
          }
        }
      }

      // Store the full sequence data in localStorage for the Create module to pick up
      localStorage.setItem(
        "tka-pending-edit-sequence",
        JSON.stringify(fullSequence)
      );

      // Close the detail panel if open
      this.handleCloseDetailPanel();

      // Navigate to Create module's construct tab using coordinator
      // (handleModuleChange does both state update AND module switch)
      void handleModuleChange("create", "construct");
    } catch (err) {
      console.error("Failed to initiate edit:", err);
      this.params!.setError(
        err instanceof Error
          ? err.message
          : "Failed to open sequence for editing"
      );
    }
  }

  async handleDetailPanelAction(
    action: string,
    sequence: SequenceData
  ): Promise<void> {
    this.ensureInitialized();

    // Handle actions from the detail panel
    switch (action) {
      case "play":
      case "animate":
        this.params!.openAnimationModal(sequence);
        break;
      case "fullscreen":
        this.handleSpotlightView(sequence);
        break;
      case "favorite":
        await this.params!.engine.toggleFavorite(sequence.id);
        break;
      case "edit":
        this.handleEditSequence(sequence);
        break;
      case "delete":
        // Deletion is handled by the sequence viewer, not the detail panel.
        break;
      case "publish":
        await this.handlePublish(sequence);
        break;
      case "unpublish":
        await this.handleUnpublish(sequence);
        break;
      default:
        console.warn("Unknown detail panel action:", action);
    }
  }

  handleSpotlightView(sequence: SequenceData): void {
    openSequenceViewer(sequence, {
      returnPath: "/browse/gallery",
      returnLabel: "Browse",
      scrollY: browseScrollState.lastScrollY,
    });
  }

  handleErrorDismiss(): void {
    this.ensureInitialized();
    this.params!.setError(null);
  }

  handleRetry(): void {
    this.ensureInitialized();
    this.params!.setError(null);
    void this.params!.engine.refresh();
  }

  private async handlePublish(sequence: SequenceData): Promise<void> {
    this.ensureInitialized();
    try {
      const libraryRepo = getLibraryRepository();
      await libraryRepo.publishSequence(sequence.id);
    } catch (err) {
      console.error("Failed to publish:", err);
      this.params!.setError(
        err instanceof Error ? err.message : "Failed to publish sequence"
      );
    }
  }

  private async handleUnpublish(sequence: SequenceData): Promise<void> {
    this.ensureInitialized();
    try {
      const libraryRepo = getLibraryRepository();
      await libraryRepo.unpublishSequence(sequence.id);
      // Remove from browse gallery cache immediately
      this.loaderService?.removeFromCache?.(sequence.id);
    } catch (err) {
      console.error("Failed to unpublish:", err);
      this.params!.setError(
        err instanceof Error ? err.message : "Failed to unpublish sequence"
      );
    }
  }
}
