import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BrowseEngine } from "$lib/shared/browse/engine/types";

/**
 * Parameters required to initialize the event handler service
 */
export interface BrowseEventHandlerParams {
  engine: BrowseEngine;
  openAnimationModal: (sequence: SequenceData) => void;
  setSelectedSequence: (sequence: SequenceData | null) => void;
  setError: (error: string | null) => void;
}

/**
 * Service for handling browse module events and actions
 */
export interface IBrowseEventHandler {
  /**
   * Initialize the service with required parameters
   * Called by BrowseModule on mount
   */
  initialize(params: BrowseEventHandlerParams): void;

  /**
   * Handle sequence selection
   */
  handleSequenceSelect(sequence: SequenceData): void;

  /**
   * Handle sequence actions (select, view-detail, delete, favorite, fullscreen, animate)
   */
  handleSequenceAction(action: string, sequence: SequenceData, variations?: SequenceData[]): Promise<void>;

  /**
   * Handle viewing sequence details
   */
  handleViewDetail(sequence: SequenceData, variations?: SequenceData[]): void;

  /**
   * Handle closing detail panel
   */
  handleCloseDetailPanel(): void;

  /**
   * Handle editing a sequence
   */
  handleEditSequence(sequence: SequenceData): Promise<void>;

  /**
   * Handle detail panel actions (play, animate, fullscreen, favorite, edit, delete)
   */
  handleDetailPanelAction(
    action: string,
    sequence: SequenceData
  ): Promise<void>;

  /**
   * Handle opening spotlight view
   */
  handleSpotlightView(sequence: SequenceData): void;

  /**
   * Handle error dismissal
   */
  handleErrorDismiss(): void;

  /**
   * Handle retry after error
   */
  handleRetry(): void;
}
