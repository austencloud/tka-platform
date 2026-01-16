import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IDiscoverThumbnailProvider } from "../../sequences/display/services/contracts/IDiscoverThumbnailProvider";
import type { ISheetRouter } from "$lib/shared/navigation/services/contracts/ISheetRouter";
import type { IDiscoverLoader } from "../../sequences/display/services/contracts/IDiscoverLoader";
import type { DeleteConfirmationData } from "../services/contracts/IDiscoverEventHandler";
import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
import { sequencePanelManager } from "../state/sequence-panel-state.svelte";
import type { createExploreState } from "../state/discover-state-factory.svelte";
import { openSpotlightViewer } from "../../../../shared/application/state/ui/ui-state.svelte";
import { container } from "$lib/shared/di";

type ExploreState = ReturnType<typeof createExploreState>;

interface ExploreHandlersParams {
  galleryState: ExploreState;
  setSelectedSequence: (sequence: SequenceData | null) => void;
  setDeleteConfirmationData: (data: DeleteConfirmationData | null) => void;
  setError: (error: string | null) => void;
  thumbnailService: IDiscoverThumbnailProvider;
  sheetRouterService?: ISheetRouter | null;
}

export function useDiscoverHandlers({
  galleryState,
  setSelectedSequence,
  setDeleteConfirmationData,
  setError,
  thumbnailService,
  sheetRouterService,
}: ExploreHandlersParams) {
  function handleSequenceSelect(sequence: SequenceData) {
    setSelectedSequence(sequence);
    galleryState.selectSequence(sequence);
  }

  async function handleSequenceAction(
    action: string,
    sequence: SequenceData,
    variations?: SequenceData[]
  ) {
    try {
      switch (action) {
        case "select":
          handleSequenceSelect(sequence);
          break;
        case "view-detail":
          handleViewDetail(sequence, variations);
          break;
        case "delete":
          handleSequenceDelete(sequence);
          break;
        case "favorite":
          await galleryState.toggleFavorite(sequence.id);
          break;
        case "fullscreen":
          handleSpotlightView(sequence);
          break;
        case "animate":
          galleryState.openAnimationModal(sequence);
          break;
        default:
          console.warn("Unknown action:", action);
      }
    } catch (err: unknown) {
      console.error("Action failed:", err);
      setError(
        err instanceof Error ? err.message : `Failed to ${action} sequence`
      );
    }
  }

  function handleViewDetail(
    sequence: SequenceData,
    variations?: SequenceData[]
  ) {
    sequencePanelManager.openDetail(sequence, variations);
  }

  function handleCloseDetailPanel() {
    sequencePanelManager.close();
  }

  async function handleEditSequence(sequence: SequenceData) {
    try {
      // Gallery sequences have empty steps - need to load full sequence data
      let fullSequence = sequence;
      if (!sequence.steps || sequence.steps.length === 0) {
        const loaderService = container.items.discoverLoader;
        if (loaderService) {
          const sequenceName = sequence.word || sequence.id;
          const loaded = await loaderService.loadFullSequenceData(sequenceName);
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
      handleCloseDetailPanel();

      // Navigate to Create module's constructor tab using coordinator
      // (handleModuleChange does both state update AND module switch)
      void handleModuleChange("create", "constructor");
    } catch (err: unknown) {
      console.error("Failed to initiate edit:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to open sequence for editing"
      );
    }
  }

  async function handleDetailPanelAction(
    action: string,
    sequence: SequenceData
  ) {
    // Handle actions from the detail panel
    switch (action) {
      case "play":
      case "animate":
        galleryState.openAnimationModal(sequence);
        break;
      case "fullscreen":
        handleSpotlightView(sequence);
        break;
      case "favorite":
        await galleryState.toggleFavorite(sequence.id);
        break;
      case "edit":
        handleEditSequence(sequence);
        break;
      case "delete":
        handleSequenceDelete(sequence);
        handleCloseDetailPanel(); // Close panel before showing delete dialog
        break;
      default:
        console.warn("Unknown detail panel action:", action);
    }
  }

  function handleSequenceDelete(sequence: SequenceData) {
    setDeleteConfirmationData({
      sequence: sequence,
      relatedSequences: [],
      totalCount: 1,
    });
  }

  function handleSpotlightView(sequence: SequenceData) {
    openSpotlightViewer(sequence, thumbnailService);

    // Also update URL for sharing/bookmarking
    sheetRouterService?.openSpotlight(sequence.id);
  }

  async function handleDeleteConfirm(
    deleteConfirmationData: DeleteConfirmationData | null
  ) {
    if (!deleteConfirmationData?.sequence) return;

    try {
      // TODO: Implement actual delete logic
      setDeleteConfirmationData(null);
      // Refresh the sequence list
      await galleryState.loadAllSequences();
    } catch (err: unknown) {
      console.error("Delete failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to delete sequence"
      );
    }
  }

  function handleDeleteCancel() {
    setDeleteConfirmationData(null);
  }

  function handleErrorDismiss() {
    setError(null);
  }

  function handleRetry() {
    setError(null);
    galleryState.loadAllSequences();
  }

  return {
    handleSequenceSelect,
    handleSequenceAction,
    handleViewDetail,
    handleCloseDetailPanel,
    handleEditSequence,
    handleDetailPanelAction,
    handleSequenceDelete,
    handleSpotlightView,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleErrorDismiss,
    handleRetry,
  };
}
