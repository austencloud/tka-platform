/**
 * CreateModuleHandlers.ts
 *
 * Service implementation for CreateModule event handlers.
 * Extracts handler logic from component to improve testability and maintainability.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "$lib/shared/inversify/types";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { CreateModuleState } from "../../state/create-module-state.svelte";
import type { PanelCoordinationState } from "../../state/panel-coordination-state.svelte";
import type {
  ICreateModuleHandlers,
  ClearSequenceParams,
} from "../contracts/ICreateModuleHandlers";
import type { ICreateModuleOrchestrator } from "../contracts/ICreateModuleOrchestrator";
import type { IBeatOperator } from "../contracts/IBeatOperator";
import { executeClearSequenceWorkflow } from "../../utils/clearSequenceWorkflow";

@injectable()
export class CreateModuleHandlers implements ICreateModuleHandlers {
  constructor(
    @inject(TYPES.ICreateModuleOrchestrator)
    private CreateModuleOrchestrator: ICreateModuleOrchestrator,
    @inject(TYPES.IBeatOperator)
    private BeatOperator: IBeatOperator
  ) {}

  /**
   * Handle option selection from option viewer
   */
  async handleOptionSelected(option: PictographData): Promise<void> {
    try {
      await this.CreateModuleOrchestrator.selectOption(option);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to select option";
      console.error(
        "❌ CreateModuleHandlers: Error handling option selection:",
        err
      );
      throw new Error(errorMessage);
    }
  }

  /**
   * Handle video record button click
   */
  handleOpenVideoRecordPanel(panelState: PanelCoordinationState): void {
    panelState.openVideoRecordPanel();
  }

  /**
   * Handle share hub button click
   */
  handleOpenShareHubPanel(panelState: PanelCoordinationState): void {
    panelState.openShareHubPanel();
  }

  /**
   * Handle clear sequence button click
   */
  async handleClearSequence(params: ClearSequenceParams): Promise<void> {
    try {
      await executeClearSequenceWorkflow(params);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to clear sequence";
      console.error(
        "❌ CreateModuleHandlers: Failed to clear sequence completely",
        err
      );
      throw new Error(errorMessage);
    }
  }

  /**
   * Handle remove beat button click
   */
  handleRemoveBeat(
    beatIndex: number,
    CreateModuleState: CreateModuleState | null
  ): void {
    if (!CreateModuleState) {
      console.warn(
        "⚠️ CreateModuleHandlers: Cannot remove beat - CreateModuleState not initialized"
      );
      throw new Error("CreateModuleState not initialized");
    }

    try {
      this.BeatOperator.removeBeat(beatIndex, CreateModuleState);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove beat";
      console.error("❌ CreateModuleHandlers: Failed to remove beat", err);
      throw new Error(errorMessage);
    }
  }

  /**
   * Handle open filter panel button click
   */
  handleOpenFilterPanel(panelState: PanelCoordinationState): void {
    panelState.openFilterPanel();
  }

  /**
   * Handle open sequence actions button click
   */
  handleOpenSequenceActions(panelState: PanelCoordinationState): void {
    panelState.openSequenceActionsPanel();
  }
}
