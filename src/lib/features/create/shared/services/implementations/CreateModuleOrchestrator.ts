/**
 * Create Module Service Implementation
 *
 * Orchestrates complex business workflows for the Create module.
 * Coordinates multiple microservices and manages cross-cutting concerns.
 *
 * This service handles the business logic that was previously scattered
 * across components, providing a clean separation of concerns.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
// import type { IStartPositionManager } from "../../tool-panel/construct/start-position-picker/services/contracts";
import type { ICreateModuleOrchestrator } from "../contracts/ICreateModuleOrchestrator";
// IStartPositionSelectionService removed - using unified service
import { constructTabEventService } from "./CreateModuleEventHandler";

export class CreateModuleOrchestrator implements ICreateModuleOrchestrator {
  private currentTab: string = "constructor"; // Default tab
  private tabStates: Map<string, unknown> = new Map();

  constructor() {} // Start position selection now handled by unified service // private readonly StartPositionManager: IStartPositionManager // @inject(TYPES.IStartPositionManager)

  /**
   * Orchestrates the complete start position selection workflow
   */
  selectStartPosition(_position: PictographData): void {
    try {
      // Business logic: Convert PictographData to BeatData for the service
      // await this.StartPositionManager.setStartPosition(beatData);
    } catch (error) {
      console.error(
        "❌ CreateModuleOrchestrator: Error selecting start position:",
        error
      );
      throw error; // Re-throw to let caller handle UI error states
    }
  }

  /**
   * Orchestrates the complete option selection workflow
   */
  async selectOption(option: PictographData): Promise<void> {
    try {
      // Business logic: Use the construct tab event service to handle option selection
      const eventService = constructTabEventService();
      await eventService.handleOptionSelected(option);
    } catch (error) {
      console.error(
        "❌ CreateModuleOrchestrator: Error selecting option:",
        error
      );
      throw error; // Re-throw to let caller handle UI error states
    }
  }

  /**
   * Initializes the Create module and sets up component coordination
   */
  initialize(): void {
    try {
      // Setup component coordination
      const eventService = constructTabEventService();
      eventService.setupComponentCoordination(); // Not async, no await needed
    } catch (error) {
      console.error(
        "❌ CreateModuleOrchestrator: Error initializing Create module:",
        error
      );
      throw error; // Re-throw to let caller handle UI error states
    }
  }

  /**
   * Get the current active tab
   */
  getCurrentTab(): string {
    return this.currentTab;
  }

  /**
   * Switch to a different tab
   */
  switchToTab(tabId: string): void {
    try {
      this.currentTab = tabId;
    } catch (error) {
      console.error(
        `❌ CreateModuleOrchestrator: Error switching to tab ${tabId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get the state for a specific tab
   */
  getTabState(tabId: string): unknown {
    return this.tabStates.get(tabId) || null;
  }

  /**
   * Update the state for a specific tab
   */
  updateTabState(tabId: string, state: unknown): void {
    this.tabStates.set(tabId, state);
  }
}
