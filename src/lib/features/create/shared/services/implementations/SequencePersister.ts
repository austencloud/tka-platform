/**
 * Sequence Persistence Service Implementation
 *
 * Manages sequence state persistence that survives hot module replacement.
 * Uses the shared persistence service to store and restore sequence state.
 *
 * Each creation mode (Constructor, Generator, Assembler) has its own workspace
 * with independent localStorage persistence.
 */

import { getErrorHandler } from "$lib/shared/application/getErrorHandler";
import type { IPersistenceService } from "$lib/shared/persistence/services/contracts/IPersistenceService";
import type { StartPositionData } from "../../domain/models/StartPositionData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ActiveCreateModule } from "$lib/shared/foundation/ui/UITypes";
import type { ISequencePersister } from "../contracts/ISequencePersister";
import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
import type { IErrorHandler } from "$lib/shared/application/services/contracts/IErrorHandler";

export class SequencePersister implements ISequencePersister {
  constructor(private persistenceService: IPersistenceService) {}

  /**
   * Get the current active mode from navigation state
   * Dynamically imported to avoid circular dependencies
   */
  private async getCurrentMode(): Promise<string> {
    try {
      return navigationState.currentSection || "construct";
    } catch (error) {
      console.warn(
        "⚠️ Failed to get current mode, defaulting to construct:",
        error
      );
      return "construct";
    }
  }

  async initialize(): Promise<void> {
    try {
      // Ensure the persistence service is initialized
      await this.persistenceService.initialize();
    } catch (error) {
      console.error("❌ SequencePersister: Failed to initialize:", error);
      throw error;
    }
  }

  async saveCurrentState(state: {
    currentSequence: SequenceData | null;
    selectedStartPosition: StartPositionData | null;
    hasStartPosition: boolean;
    activeBuildSection: ActiveCreateModule;
  }): Promise<void> {
    try {
      await this.persistenceService.saveCurrentSequenceState(state);
    } catch (error) {
      console.error(
        "❌ SequencePersister: Failed to save current state:",
        error
      );
      const errorHandler = getErrorHandler() as IErrorHandler;
      errorHandler.showUserError({
        message: "Couldn't save your sequence",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "error",
        context: {
          module: "create",
          action: "save-sequence",
        },
      });
      throw error;
    }
  }

  async loadCurrentState(mode?: string): Promise<{
    currentSequence: SequenceData | null;
    selectedStartPosition: StartPositionData | null;
    hasStartPosition: boolean;
    activeBuildSection: ActiveCreateModule;
  } | null> {
    try {
      // Get current mode if not provided
      const targetMode = mode ?? (await this.getCurrentMode());

      const state =
        await this.persistenceService.loadCurrentSequenceState(targetMode);
      if (state) {
        // Type guard for activeBuildSection
        const activeBuildSection = this.isActiveCreateModule(
          state.activeBuildSection
        )
          ? state.activeBuildSection
          : (targetMode as ActiveCreateModule);

        return {
          currentSequence: state.currentSequence,
          selectedStartPosition: state.selectedStartPosition,
          hasStartPosition: state.hasStartPosition,
          activeBuildSection,
        };
      }
      return null;
    } catch (error) {
      console.error(
        "❌ SequencePersister: Failed to load current state:",
        error
      );
      const errorHandler = getErrorHandler() as IErrorHandler;
      errorHandler.showUserError({
        message: "Couldn't load your sequence",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "error",
        context: {
          module: "create",
          action: "load-sequence",
        },
      });
      return null;
    }
  }

  /**
   * Type guard to check if a value is a valid ActiveCreateModule
   */
  private isActiveCreateModule(value: unknown): value is ActiveCreateModule {
    return (
      typeof value === "string" &&
      (value === "construct" ||
        value === "generate" ||
        value === "assemble" ||
        value === "spell")
    );
  }

  async clearCurrentState(mode?: string): Promise<void> {
    try {
      await this.persistenceService.clearCurrentSequenceState(mode);
    } catch (error) {
      console.error(
        "❌ SequencePersister: Failed to clear current state:",
        error
      );
      throw error;
    }
  }

  async hasSavedState(mode?: string): Promise<boolean> {
    try {
      const targetMode = mode ?? (await this.getCurrentMode());
      const state =
        await this.persistenceService.loadCurrentSequenceState(targetMode);
      return state !== null;
    } catch (error) {
      console.error(
        "❌ SequencePersister: Failed to check for saved state:",
        error
      );
      return false;
    }
  }

  async getLastSaveTimestamp(mode?: string): Promise<number | null> {
    try {
      const targetMode = mode ?? (await this.getCurrentMode());
      const state =
        await this.persistenceService.loadCurrentSequenceState(targetMode);
      if (state && "timestamp" in state) {
        const stateWithTimestamp = state as Record<string, unknown>;
        const timestamp = stateWithTimestamp["timestamp"];
        return typeof timestamp === "number" ? timestamp : null;
      }
      return null;
    } catch (error) {
      console.error(
        "❌ SequencePersister: Failed to get last save timestamp:",
        error
      );
      return null;
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { dexiePersistenceService } from "$lib/shared/persistence/services/implementations/DexiePersistenceService";

export const sequencePersister = new SequencePersister(dexiePersistenceService);
