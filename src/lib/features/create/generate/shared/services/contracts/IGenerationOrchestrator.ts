import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { GenerationOptions } from "../../domain/models/generate-models";

/**
 * Service responsible for orchestrating the entire sequence generation process
 *
 * Extracted from generate-actions.svelte.ts to separate orchestration logic
 * from state management, following Single Responsibility Principle.
 *
 * This service:
 * - Routes between freeform and circular generation modes
 * - Composes multiple focused generation services
 * - Handles the complete sequence building pipeline
 * - Returns fully constructed SequenceData ready for display
 *
 * Does NOT:
 * - Manage UI state (that's the state file's job)
 * - Handle animations (that's the caller's responsibility)
 * - Update the workbench directly (returns data instead)
 */
export interface IGenerationOrchestrator {
  /**
   * Generate a complete sequence based on provided options
   *
   * Orchestrates the entire generation pipeline:
   * 1. Routes to appropriate generation mode (freeform vs circular)
   * 2. Composes necessary services for that mode
   * 3. Executes generation steps in correct order
   * 4. Returns fully constructed SequenceData
   *
   * @param options - Generation configuration (mode, length, difficulty, etc.)
   * @returns Promise resolving to complete SequenceData ready for workbench
   * @throws Error if generation fails at any step
   */
  generateSequence(options: GenerationOptions): Promise<SequenceData>;
}
