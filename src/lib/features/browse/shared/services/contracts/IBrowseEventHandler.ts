import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { createExploreState } from "../../state/explore-state-factory.svelte";

type ExploreState = ReturnType<typeof createExploreState>;

/**
 * Data for delete confirmation dialog
 */
export interface DeleteConfirmationData {
  sequence: SequenceData;
  relatedSequences: SequenceData[];
  totalCount: number;
}

/**
 * Parameters required to initialize the event handler service
 */
export interface ExploreEventHandlerParams {
  galleryState: ExploreState;
  setSelectedSequence: (sequence: SequenceData | null) => void;
  setDeleteConfirmationData: (data: DeleteConfirmationData | null) => void;
  setError: (error: string | null) => void;
}

/**
 * Service for handling explore module events and actions
 */
export interface IExploreEventHandler {
  /**
   * Initialize the service with required parameters
   * Called by ExploreModule on mount
   */
  initialize(params: ExploreEventHandlerParams): void;

  /**
   * Handle sequence selection
   */
  handleSequenceSelect(sequence: SequenceData): void;

  /**
   * Handle sequence actions (select, view-detail, delete, favorite, fullscreen, animate)
   */
  handleSequenceAction(action: string, sequence: SequenceData): Promise<void>;

  /**
   * Handle viewing sequence details
   */
  handleViewDetail(sequence: SequenceData): void;

  /**
   * Handle closing detail panel
   */
  handleCloseDetailPanel(): void;

  /**
   * Handle editing a sequence
   */
  handleEditSequence(sequence: SequenceData): void;

  /**
   * Handle detail panel actions (play, animate, fullscreen, favorite, edit, delete)
   */
  handleDetailPanelAction(
    action: string,
    sequence: SequenceData
  ): Promise<void>;

  /**
   * Handle sequence deletion
   */
  handleSequenceDelete(sequence: SequenceData): void;

  /**
   * Handle opening spotlight view
   */
  handleSpotlightView(sequence: SequenceData): void;

  /**
   * Handle delete confirmation
   */
  handleDeleteConfirm(
    deleteConfirmationData: DeleteConfirmationData | null
  ): Promise<void>;

  /**
   * Handle delete cancellation
   */
  handleDeleteCancel(): void;

  /**
   * Handle error dismissal
   */
  handleErrorDismiss(): void;

  /**
   * Handle retry after error
   */
  handleRetry(): void;
}
