/**
 * Generation Actions State - Reactive wrapper for generation orchestration
 *
 * Delegates complex generation logic to IGenerationOrchestrator.
 * Manages reactive state and workbench animation updates.
 */

import type { SequenceState } from "$lib/features/create/shared/state/SequenceStateOrchestrator.svelte";
import { setPendingGenerationAnimation } from "$lib/features/create/shared/workspace-panel/sequence-display/state/step-grid-display-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { container } from "$lib/shared/di";
import type { GenerationOptions } from "../shared/domain/models/generate-models";
import type { IGenerationOrchestrator } from "../shared/services/contracts/IGenerationOrchestrator";
import type { IErrorHandler } from "$lib/shared/application/services/contracts/IErrorHandler";

export function createGenerationActionsState(
  getSequenceState?: () => SequenceState | undefined,
  getIsSequential?: () => boolean
) {
  let isGenerating = $state(false);
  let lastGeneratedSequence = $state<SequenceData | null>(null);
  let generationError = $state<string | null>(null);
  let orchestrationService: IGenerationOrchestrator | null = null;

  async function onGenerateClicked(options: GenerationOptions) {
    if (isGenerating) return;

    isGenerating = true;
    generationError = null;

    try {
      if (!orchestrationService) {
        orchestrationService = container.items.generationOrchestrator;
      }

      const generatedSequence =
        await orchestrationService.generateSequence(options);
      lastGeneratedSequence = generatedSequence;
      await updateWorkbenchWithSequence(generatedSequence);
    } catch (error) {
      generationError =
        error instanceof Error ? error.message : "Unknown generation error";

      // Show user-facing error with bug report option
      const errorService = container.items.errorHandler;
      if (errorService) {
        errorService.showUserError({
          message: "Sequence generation failed",
          technicalDetails: generationError,
          error: error instanceof Error ? error : new Error(generationError),
          severity: "error",
          context: {
            module: "create",
            tab: "generate",
            action: "generateSequence",
            additionalData: {
              mode: options.mode,
              length: options.length,
              gridMode: options.gridMode,
              loopType: options.loopType,
            },
          },
        });
      }

      console.error("Generation failed:", error);
    } finally {
      isGenerating = false;
    }
  }

  async function updateWorkbenchWithSequence(sequence: SequenceData) {
    try {
      const sequenceState = getSequenceState?.();
      if (!sequenceState) return;

      const hasExistingSequence = sequenceState.getCurrentBeats().length > 0;

      if (hasExistingSequence) {
        window.dispatchEvent(new CustomEvent("clear-sequence-animation"));
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const isSequential = getIsSequential?.() ?? false;

      // Set global flag BEFORE dispatching event - this flag persists even if StepGrid
      // isn't mounted yet (e.g., workspace is transitioning from empty to visible)
      setPendingGenerationAnimation(true);

      // Dispatch BEFORE updating sequence to prepare StepGrid for animation
      window.dispatchEvent(
        new CustomEvent("prepare-sequence-animation", {
          detail: {
            isSequential,
            stepCount: sequence.steps.length,
          },
        })
      );

      // Small delay to ensure the prepare event is processed before updating sequence
      // This allows the StepGrid to set up animation state before receiving new steps
      await new Promise((resolve) => setTimeout(resolve, 10));

      sequenceState.setCurrentSequence(sequence);
    } catch (error) {
      throw new Error(
        `Workbench update failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  function clearError() {
    generationError = null;
  }

  function getGenerationSummary() {
    return {
      isGenerating,
      hasLastGenerated: lastGeneratedSequence !== null,
      lastGeneratedName: lastGeneratedSequence?.name || null,
      lastGeneratedBeats: lastGeneratedSequence?.steps.length || 0,
      hasError: generationError !== null,
      errorMessage: generationError,
    };
  }

  return {
    get isGenerating() {
      return isGenerating;
    },
    get lastGeneratedSequence() {
      return lastGeneratedSequence;
    },
    get generationError() {
      return generationError;
    },
    onGenerateClicked,
    clearError,
    getGenerationSummary,
  };
}
