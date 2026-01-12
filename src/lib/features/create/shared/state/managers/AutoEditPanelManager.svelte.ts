/**
 * Auto Edit Panel Manager
 *
 * Handles automatic opening of edit panel when multiple beats are selected.
 * Consolidates multi-select edit panel logic from CreateModule.svelte.
 *
 * Domain: Create module - Edit Panel Automation
 */

import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import type { BeatData } from "../../domain/models/BeatData";
import type { PanelCoordinationState } from "../panel-coordination-state.svelte";
import type { createCreateModuleState as CreateModuleStateType } from "../create-module-state.svelte";

type CreateModuleState = ReturnType<typeof CreateModuleStateType>;

// Lazy logger initialization to avoid circular dependency issues
let logger: ReturnType<typeof createComponentLogger> | null = null;
const getLogger = () => {
  if (!logger) {
    logger = createComponentLogger("AutoEditPanelManager");
  }
  return logger;
};

const START_POSITION_BEAT_NUMBER = 0;

export interface AutoEditPanelConfig {
  CreateModuleState: CreateModuleState;
  panelState: PanelCoordinationState;
}

/**
 * Creates auto-open edit panel effect for multi-select
 * @returns Cleanup function
 */
export function createAutoEditPanelEffect(
  config: AutoEditPanelConfig
): () => void {
  const { CreateModuleState, panelState } = config;

  return $effect.root(() => {
    $effect(() => {
      const selectedBeatNumbers =
        CreateModuleState.sequenceState.selectedBeatNumbers;
      const selectedCount = selectedBeatNumbers.size ?? 0;

      if (selectedCount > 1 && !panelState.isBeatEditorPanelOpen) {
        // Map beat numbers to beat data
        const beatNumbersArray = Array.from(selectedBeatNumbers).sort(
          (a, b) => a - b
        );
        const beatsData = beatNumbersArray
          .map((beatNumber) => {
            if (beatNumber === START_POSITION_BEAT_NUMBER) {
              // Beat 0 is the start position
              return CreateModuleState.sequenceState.selectedStartPosition;
            } else {
              // Beats are numbered 1, 2, 3... but stored in array at indices 0, 1, 2...
              const beatIndex = beatNumber - 1;
              return CreateModuleState.sequenceState.currentSequence?.beats[
                beatIndex
              ];
            }
          })
          .filter(
            (beat): beat is BeatData => beat !== null && beat !== undefined
          ); // Remove any null/undefined values

        getLogger().log(
          `Auto-opening batch edit panel: ${selectedCount} beats selected`
        );
        panelState.openBatchEditPanel(beatsData);
      }
    });
  });
}

/**
 * Creates auto-open effect for Beat Editor panel on beat selection
 *
 * IMPORTANT: This only AUTO-OPENS the panel when a beat is selected.
 * It does NOT auto-close when selection is cleared - this prevents
 * the panel from flickering during beat operations (delete, transforms)
 * that temporarily clear selection.
 *
 * The panel is closed when:
 * - User explicitly closes it (close button, swipe, etc.)
 *
 * @returns Cleanup function
 */
export function createAutoBeatEditorEffect(
  config: AutoEditPanelConfig
): () => void {
  const { CreateModuleState, panelState } = config;

  let lastSelectedBeat: number | null = null;

  return $effect.root(() => {
    $effect(() => {
      const selectedBeatNumber =
        CreateModuleState.sequenceState.selectedBeatNumber;

      // Only act when selection CHANGES (prevents fight with manual close)
      if (selectedBeatNumber !== lastSelectedBeat) {
        if (selectedBeatNumber !== null) {
          // New beat selected → auto-open Beat Editor panel
          panelState.openBeatEditorPanel();
          getLogger().log(
            `Auto-opening Beat Editor panel for beat ${selectedBeatNumber}`
          );
        }
        // NOTE: We deliberately do NOT auto-close the panel when selection becomes null.
        // This prevents panel flickering during beat operations that temporarily clear selection.
        // The panel will be closed when the user explicitly closes it.
        lastSelectedBeat = selectedBeatNumber;
      }
    });
  });
}

/**
 * @deprecated Use createAutoBeatEditorEffect instead
 * Kept for backward compatibility during migration
 */
export function createAutoSequenceActionsEffect(
  config: AutoEditPanelConfig
): () => void {
  getLogger().warn(
    "createAutoSequenceActionsEffect is deprecated. Use createAutoBeatEditorEffect instead."
  );
  return createAutoBeatEditorEffect(config);
}

/**
 * Deprecated: Use createAutoSequenceActionsEffect instead
 * Kept for backward compatibility during migration
 * @deprecated
 */
export function createSingleBeatEditEffect(
  config: AutoEditPanelConfig
): () => void {
  getLogger().warn(
    "createSingleBeatEditEffect is deprecated. Use createAutoSequenceActionsEffect instead."
  );
  return createAutoSequenceActionsEffect(config);
}
