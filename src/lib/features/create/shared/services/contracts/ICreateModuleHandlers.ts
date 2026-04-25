/**
 * ICreateModuleHandlers.ts
 *
 * Service interface for CreateModule event handlers.
 * Extracts handler logic from component to improve testability and maintainability.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { CreateModuleState } from "../../state/create-module-state.svelte";
import type { ConstructTabState } from "../../state/construct-tab-state.svelte";
import type { PanelCoordinationState } from "../../state/panel-coordination-state.svelte";

/**
 * Parameters for clear sequence handler
 */
export interface ClearSequenceParams {
  CreateModuleState: CreateModuleState;
  constructTabState: ConstructTabState;
  panelState: PanelCoordinationState;
}

/**
 * Service for handling CreateModule events
 */
export interface ICreateModuleHandlers {
  /**
   * Handle option selection from option viewer
   * @throws Error if operation fails
   */
  handleOptionSelected(option: PictographData): Promise<void>;

  /**
   * Handle video record button click
   */
  handleOpenVideoRecordPanel(panelState: PanelCoordinationState): void;

  /**
   * Handle export panel button click
   */
  handleOpenExportPanel(panelState: PanelCoordinationState): void;

  /**
   * Handle clear sequence button click
   * @throws Error if operation fails
   */
  handleClearSequence(params: ClearSequenceParams): Promise<void>;

  /**
   * Handle remove beat button click
   * @throws Error if operation fails
   */
  handleRemoveStep(
    stepIndex: number,
    CreateModuleState: CreateModuleState | null
  ): void;

  /**
   * Handle open filter panel button click
   */
  handleOpenFilterPanel(panelState: PanelCoordinationState): void;

  /**
   * Handle open sequence actions button click
   */
  handleOpenSequenceActions(panelState: PanelCoordinationState): void;
}
