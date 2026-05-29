/**
 * ConstructTab Event Service
 *
 * Centralized event handling for the ConstructTab component.
 * This service handles all the event coordination between different child components
 * that was previously scattered throughout the massive ConstructTab component.
 */

import { getErrorHandler } from "$lib/shared/application/get-error-handler";
import { reversalDetector } from "$lib/shared/create/services/reversal-detector";
import type { ErrorHandler } from '$lib/shared/application/services/error-handler'
import type { SequenceData } from "../../../../../shared/foundation/domain/models/SequenceData";

import type { ConstructCoordinator } from "./ConstructCoordinator";
import type { PictographData } from "../../../../../shared/pictograph/shared/domain/models/PictographData";
import type { OrientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import type { ReversalDetector } from "$lib/shared/create/services/reversal-detector";
import { orientationCalculator as orientationCalculatorDirect } from "../../../../../shared/pictograph/prop/services/implementations/OrientationCalculator";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import { createStepData } from "$lib/shared/create/factories/createStepData";

import { getConstructCoordinator } from "$lib/features/create/shared/getConstructCoordinator";

export class CreateModuleEventHandler {
  private constructCoordinator: ConstructCoordinator | null = null;
  private OrientationCalculator: OrientationCalculator | null = null;
  private ReversalDetector: ReversalDetector | null = null;
  private initialized = false;

  // Callback to access current sequence from component state
  private getCurrentSequenceCallback: (() => SequenceData | null) | null = null;
  private updateSequenceCallback: ((sequence: SequenceData) => void) | null =
    null;

  // Callback to add option to history
  private addOptionToHistoryCallback:
    | ((stepIndex: number, stepData: StepData) => void)
    | null = null;

  // Callback to push undo snapshot
  private pushUndoSnapshotCallback:
    | ((type: "ADD_BEAT", metadata?: unknown) => void)
    | null = null;

  constructor() {
    // Don't initialize services in constructor - wait for lazy initialization
  }

  private initializeServices() {
    if (this.initialized) {
      return; // Already initialized
    }

    // Resolve services via ITI container - services may be undefined if not registered
    try {
      this.constructCoordinator = getConstructCoordinator() as unknown as ConstructCoordinator | undefined ?? null;
    } catch {
      this.constructCoordinator = null;
    }

    // Use direct import instead of container for HMR performance
    this.OrientationCalculator = orientationCalculatorDirect;

    this.ReversalDetector = reversalDetector;

    // Only mark as initialized if at least one service resolved
    if (
      this.constructCoordinator ||
      this.OrientationCalculator ||
      this.ReversalDetector
    ) {
      this.initialized = true;
    }
  }

  /**
   * Set callbacks to access sequence state from component
   */
  setSequenceStateCallbacks(
    getCurrentSequence: () => SequenceData | null,
    updateSequence: (sequence: SequenceData) => void
  ): void {
    this.getCurrentSequenceCallback = getCurrentSequence;
    this.updateSequenceCallback = updateSequence;
  }

  /**
   * Set callback to add option to history
   */
  setAddOptionToHistoryCallback(
    addOptionToHistory: (stepIndex: number, stepData: StepData) => void
  ): void {
    this.addOptionToHistoryCallback = addOptionToHistory;
  }

  /**
   * Set callback to push undo snapshot
   */
  setPushUndoSnapshotCallback(
    pushUndoSnapshot: (type: "ADD_BEAT", metadata?: unknown) => void
  ): void {
    this.pushUndoSnapshotCallback = pushUndoSnapshot;
  }

  private ensureInitialized() {
    if (!this.initialized) {
      this.initializeServices();
    }
  }

  /**
   * Handle option selection in the Create module
   * OPTIMIZED: Add to sequence immediately for responsive UX, then process in background
   */
  async handleOptionSelected(option: PictographData): Promise<void> {
    try {
      performance.mark("event-service-start");
      this.ensureInitialized();

      // Get current sequence from component state
      const currentSequence = this.getCurrentSequenceCallback?.();
      if (!currentSequence) {
        throw new Error("No current sequence available");
      }

      performance.mark("initialization-complete");

      // Calculate correct beat number based on current sequence length
      const nextStepNumber = currentSequence.steps.length + 1;

      // 📸 PUSH UNDO SNAPSHOT: Save state BEFORE adding beat (now deferred via queueMicrotask)
      this.pushUndoSnapshotCallback?.("ADD_BEAT", {
        stepNumber: nextStepNumber,
        description: `Add beat ${nextStepNumber}`,
      });

      // 🔄 REVERSAL DETECTION: Calculate reversals for the new beat based on current sequence
      let reversalInfo = { blueReversal: false, redReversal: false };
      if (this.ReversalDetector && currentSequence.steps.length > 0) {
        try {
          reversalInfo = this.ReversalDetector.detectReversalForOption(
            [...currentSequence.steps], // Spread to mutable array for interface compatibility
            option
          );
        } catch (reversalError) {
          console.warn(
            `⚠️ CreateModuleEventHandler: Failed to detect reversals for beat ${nextStepNumber}:`,
            reversalError
          );
          // Continue without reversal data rather than failing
        }
      }

      // Create initial step data from option with correct beat number and reversals
      let stepData = createStepData({
        ...option, // Spread PictographData properties since StepData extends PictographData
        stepNumber: nextStepNumber,
        isBlank: false, // This is a real beat with pictograph data
        blueReversal: reversalInfo.blueReversal,
        redReversal: reversalInfo.redReversal,
      });

      performance.mark("beat-data-created");

      // 🔄 OPTIMIZATION: Calculate orientations BEFORE UI update to batch into single update
      if (currentSequence.steps.length > 0 && this.OrientationCalculator) {
        const lastStep =
          currentSequence.steps[currentSequence.steps.length - 1];

        // Only apply orientation calculations if both steps have motion data
        if (lastStep && !lastStep.isBlank && !stepData.isBlank) {
          try {
            // Update start orientations from the last beat's end orientations
            stepData = this.OrientationCalculator.updateStartOrientations(
              stepData,
              lastStep
            );
            performance.mark("start-orientations-complete");

            // Update end orientations based on the motion calculations
            stepData =
              this.OrientationCalculator.updateEndOrientations(stepData);
            performance.mark("end-orientations-complete");
          } catch (orientationError) {
            console.warn(
              `⚠️ CreateModuleEventHandler: Failed to calculate orientations for beat ${nextStepNumber}:`,
              orientationError
            );
            // Continue without orientation updates rather than failing completely
          }
        }
      }
      performance.mark("orientation-processing-complete");

      // 🚀 SINGLE UI UPDATE: Add beat with orientations already calculated
      const finalSequence = {
        ...currentSequence,
        steps: [...currentSequence.steps, stepData],
      };
      performance.mark("sequence-updated");

      this.updateSequenceCallback?.(finalSequence);
      performance.mark("ui-callback-complete");

      // 📝 ADD TO HISTORY: Track this option addition for undo functionality
      this.addOptionToHistoryCallback?.(nextStepNumber - 1, stepData); // stepIndex is 0-based
      performance.mark("history-updated");

      // 📡 COORDINATION: Notify other components (async, non-blocking)
      performance.mark("coordination-start");
      if (this.constructCoordinator) {
        this.constructCoordinator.handleBeatAdded(stepData).catch((error) => {
          console.warn(
            "⚠️ CreateModuleEventHandler: Coordination service error:",
            error
          );
        });
      }
      performance.mark("coordination-complete");
    } catch (error) {
      console.error("❌ Error handling option selection:", error);
      const errorHandler = getErrorHandler() as ErrorHandler;
      errorHandler.showUserError({
        message: "Something went wrong adding that beat",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "error",
        context: {
          module: "create",
          action: "add-beat",
        },
      });
      throw error;
    }
  }

  /**
   * Handle beat modification from the Graph Editor
   */
  handleBeatModified(_stepNumber: number, _beatData: StepData): void {
    // stepIndex and stepData parameters are not used but kept for interface compatibility
    // Handle beat modifications from graph editor
    // Note: The coordination service doesn't have handleBeatModified,
    // so we'll handle this locally or extend the interface if needed
  }

  /**
   * Handle arrow selection from the Graph Editor
   */
  handleArrowSelected(_arrowData: unknown): void {
    // arrowData parameter is not used but kept for interface compatibility
    // Handle arrow selection events from graph editor
    // This could be used for highlighting or additional UI feedback
  }

  /**
   * Handle graph editor visibility changes
   */
  handleGraphEditorVisibilityChanged(_isVisible: boolean): void {
    // isVisible parameter is not used but kept for interface compatibility
    // Handle graph editor visibility changes if needed
  }

  /**
   * Handle export setting changes from the Export Panel
   */
  handleExportSettingChanged(_event: CustomEvent): void {
    // event parameter is not used but kept for interface compatibility
    // Handle export setting changes - could save to settings service
  }

  /**
   * Handle preview update requests from the Export Panel
   */
  handlePreviewUpdateRequested(_event: CustomEvent): void {
    // event parameter is not used but kept for interface compatibility
    // Handle preview update requests
  }

  /**
   * Handle export requests from the Export Panel
   */
  handleExportRequested(event: CustomEvent): void {
    const { type, config } = event.detail;

    // Handle export requests
    if (type === "current") {
      // TODO: Implement actual export service call
      alert(
        `Exporting sequence "${config.sequence?.name || "Untitled"}" with ${config.sequence?.steps?.length || 0} steps`
      );
    } else if (type === "all") {
      // TODO: Implement actual export all service call
      alert("Exporting all sequences in library");
    }
  }

  /**
   * Setup component coordination
   */
  setupComponentCoordination(): void {
    // Ensure services are initialized
    this.ensureInitialized();

    // Register this service with the coordination service
    if (this.constructCoordinator) {
      this.constructCoordinator.setupComponentCoordination({
        constructTab: {
          handleEvent: (eventType: string, _data: unknown) => {
            switch (eventType) {
              case "ui_transition":
                // Handle legacy transition events if needed
                break;
              default:
                // Handle other events if needed
                break;
            }
          },
        },
      });
    }
  }

  // ============================================================================
  // INTERFACE IMPLEMENTATION
  // ============================================================================

  /**
   * Handle tab switch events
   */
  handleTabSwitch(_tabId: string): void {
    // tabId parameter is not used but kept for interface compatibility
    // Implementation for tab switching logic
  }

  /**
   * Handle workbench update events
   */
  handleWorkbenchUpdate(_data: unknown): void {
    // data parameter is not used but kept for interface compatibility
    // Implementation for workbench update logic
  }

  /**
   * Handle option selection events
   */
  handleOptionSelection(_option: unknown): void {
    // option parameter is not used but kept for interface compatibility
    // Implementation for option selection logic
  }
}

// Lazy singleton instance
let _CreateModuleEventHandler: CreateModuleEventHandler | null = null;

/**
 * Get the singleton instance of ConstructTabEventService
 * Creates the instance only when first accessed, ensuring DI container is ready
 */
export function getCreateModuleEventHandler(): CreateModuleEventHandler {
  if (!_CreateModuleEventHandler) {
    _CreateModuleEventHandler = new CreateModuleEventHandler();
  }
  return _CreateModuleEventHandler;
}

// Export the getter function directly for backward compatibility
export const constructTabEventService = getCreateModuleEventHandler;
