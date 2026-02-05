/**
 * Create Module Service Interface
 *
 * Interface for orchestrating complex business workflows for the Create module.
 * Coordinates multiple microservices and manages cross-cutting concerns.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export interface ICreateModuleOrchestrator {
  /**
   * Orchestrates the complete start position selection workflow
   */
  selectStartPosition(position: PictographData): void;

  /**
   * Orchestrates the complete option selection workflow
   */
  selectOption(option: PictographData): Promise<void>;

  /**
   * Initializes the Create module and sets up component coordination
   */
  initialize(): void;

  /**
   * Get the current active tab
   */
  getCurrentTab(): string;

  /**
   * Switch to a different tab
   */
  switchToTab(tabId: string): void;

  /**
   * Get the state for a specific tab
   */
  getTabState(tabId: string): unknown;

  /**
   * Update the state for a specific tab
   */
  updateTabState(tabId: string, state: unknown): void;
}
