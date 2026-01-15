/**
 * Register CREATE Module Shortcuts
 *
 * Registers keyboard shortcuts specific to the CREATE module.
 *
 * Domain: Keyboard Shortcuts - CREATE Module
 */

import type { IKeyboardShortcutManager } from "../services/contracts/IKeyboardShortcutManager";
import type { createKeyboardShortcutState } from "../state/keyboard-shortcut-state.svelte";
import { getCreateModuleRef } from "$lib/features/create/shared/state/create-module-state-ref.svelte";
import { getAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
import { executeClearSequenceWorkflow } from "$lib/features/create/shared/utils/clearSequenceWorkflow";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const debug = createComponentLogger("CreateShortcuts");

export function registerCreateShortcuts(
  service: IKeyboardShortcutManager,
  state: ReturnType<typeof createKeyboardShortcutState>
) {
  // ==================== Animation Control ====================

  // Space - Toggle play/pause on animation, or open animation panel if closed
  service.register({
    id: "create.toggle-animation",
    label: "Play/Pause Animation",
    description: "Toggle animation playback or open animation panel",
    key: "Space", // Normalized key name (not " ")
    modifiers: [],
    context: ["create", "share-hub"], // Works in both contexts
    scope: "animation",
    priority: "high",
    condition: () => {
      if (!state.settings.enableSingleKeyShortcuts) return false;
      // Only enable if there's a sequence to animate
      const ref = getCreateModuleRef();
      if (!ref) return false;
      const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
      return sequenceState?.hasSequence() ?? false;
    },
    action: () => {
      const ref = getCreateModuleRef();
      if (!ref) return;

      const { panelState } = ref;

      // Check if any animation panel is open (Animation Panel OR Share Hub)
      if (panelState.isAnimationPanelOpen || panelState.isShareHubPanelOpen) {
        // Animation is visible - toggle play/pause
        const playbackController = getAnimationPlaybackRef();
        if (playbackController) {
          playbackController.togglePlayback();
        }
      } else {
        // No animation panel open - open the Animation Panel
        panelState.openAnimationPanel();
      }
    },
  });

  // Escape - Close Share Hub panel
  service.register({
    id: "create.close-share-hub",
    label: "Close Share Hub",
    description: "Close the Share Hub panel",
    key: "Escape",
    modifiers: [],
    context: ["create", "share-hub"], // Works in both contexts
    scope: "animation",
    priority: "high",
    condition: () => {
      // Only when Share Hub panel is open
      const ref = getCreateModuleRef();
      return ref?.panelState.isShareHubPanelOpen ?? false;
    },
    action: () => {
      const ref = getCreateModuleRef();
      if (!ref) return;

      ref.panelState.closeShareHubPanel();
    },
  });

  // ==================== Beat Grid Navigation ====================

  // Arrow Up - Move focus up in beat grid
  service.register({
    id: "create.grid-nav-up",
    label: "Navigate Grid Up",
    description: "Move focus up in the beat grid",
    key: "ArrowUp",
    modifiers: [],
    context: "create",
    scope: "workspace",
    priority: "medium",
    condition: () => {
      // Only when edit panel is NOT open
      return state.settings.enableSingleKeyShortcuts;
      // TODO: Add check for edit panel state
      // && !isEditPanelOpen();
    },
    action: () => {
      debug.log("Arrow Up - Grid navigation (not yet implemented)");
      // TODO: Integrate with beat grid navigation
    },
  });

  // Arrow Down - Move focus down in beat grid
  service.register({
    id: "create.grid-nav-down",
    label: "Navigate Grid Down",
    description: "Move focus down in the beat grid",
    key: "ArrowDown",
    modifiers: [],
    context: "create",
    scope: "workspace",
    priority: "medium",
    condition: () => {
      return state.settings.enableSingleKeyShortcuts;
      // TODO: Add check for edit panel state
    },
    action: () => {
      debug.log("Arrow Down - Grid navigation (not yet implemented)");
      // TODO: Integrate with beat grid navigation
    },
  });

  // Arrow Left - Move focus left in beat grid
  service.register({
    id: "create.grid-nav-left",
    label: "Navigate Grid Left",
    description: "Move focus left in the beat grid",
    key: "ArrowLeft",
    modifiers: [],
    context: "create",
    scope: "workspace",
    priority: "medium",
    condition: () => {
      return state.settings.enableSingleKeyShortcuts;
    },
    action: () => {
      debug.log("Arrow Left - Grid navigation (not yet implemented)");
      // TODO: Integrate with beat grid navigation
    },
  });

  // Arrow Right - Move focus right in beat grid
  service.register({
    id: "create.grid-nav-right",
    label: "Navigate Grid Right",
    description: "Move focus right in the beat grid",
    key: "ArrowRight",
    modifiers: [],
    context: "create",
    scope: "workspace",
    priority: "medium",
    condition: () => {
      return state.settings.enableSingleKeyShortcuts;
    },
    action: () => {
      debug.log("Arrow Right - Grid navigation (not yet implemented)");
      // TODO: Integrate with beat grid navigation
    },
  });

  // ==================== Edit Panel Navigation ====================

  // Arrow Left - Navigate to previous beat (when edit panel is open)
  service.register({
    id: "create.edit-nav-left",
    label: "Previous Beat",
    description: "Navigate to previous beat in edit panel",
    key: "ArrowLeft",
    modifiers: [],
    context: ["create", "edit-panel"],
    scope: "editing",
    priority: "high", // Higher priority than grid navigation
    condition: () => {
      // Only when edit panel IS open
      return state.settings.enableSingleKeyShortcuts;
      // TODO: Add check: && isEditPanelOpen();
    },
    action: () => {
      debug.log("Arrow Left - Previous beat (not yet implemented)");
      // TODO: Integrate with edit panel navigation
      // navigateToPreviousBeat();
    },
  });

  // Arrow Right - Navigate to next beat (when edit panel is open)
  service.register({
    id: "create.edit-nav-right",
    label: "Next Beat",
    description: "Navigate to next beat in edit panel",
    key: "ArrowRight",
    modifiers: [],
    context: ["create", "edit-panel"],
    scope: "editing",
    priority: "high", // Higher priority than grid navigation
    condition: () => {
      return state.settings.enableSingleKeyShortcuts;
      // TODO: Add check: && isEditPanelOpen();
    },
    action: () => {
      debug.log("Arrow Right - Next beat (not yet implemented)");
      // TODO: Integrate with edit panel navigation
      // navigateToNextBeat();
    },
  });

  // Enter - Accept changes and close edit panel
  service.register({
    id: "create.edit-accept",
    label: "Accept Changes",
    description: "Accept changes and close edit panel",
    key: "Enter",
    modifiers: [],
    context: ["create", "edit-panel"],
    scope: "editing",
    priority: "high",
    action: () => {
      debug.log("Enter - Accept changes (not yet implemented)");
      // TODO: Integrate with edit panel
      // acceptChangesAndClose();
    },
  });

  // ==================== Sequence Management ====================

  // Ctrl+S - Save sequence
  service.register({
    id: "create.save-sequence",
    label: "Save Sequence",
    description: "Save the current sequence",
    key: "s",
    modifiers: ["ctrl"],
    context: "create",
    scope: "sequence-management",
    priority: "high",
    action: () => {
      debug.log("Ctrl+S - Save sequence (not yet implemented)");
      // TODO: Integrate with sequence save functionality
      // saveCurrentSequence();
    },
  });

  // + (Plus) - Add beat
  // Note: This adds to the sequence, but we need to figure out which prop color
  service.register({
    id: "create.add-beat",
    label: "Add Beat",
    description: "Add a beat to the sequence",
    key: "+",
    modifiers: [],
    context: "create",
    scope: "sequence-management",
    priority: "medium",
    condition: () => {
      return state.settings.enableSingleKeyShortcuts;
    },
    action: () => {
      debug.log("Plus - Add beat (not yet implemented)");
      // TODO: Determine logic for which prop color to add
      // User mentioned needing to figure out non-confusing pattern
    },
  });

  // Ctrl+Z - Undo last action
  service.register({
    id: "create.undo",
    label: "Undo",
    description: "Undo the last action in the current tab",
    key: "z",
    modifiers: ["ctrl"],
    context: "create",
    scope: "sequence-management",
    priority: "high",
    action: () => {
      const ref = getCreateModuleRef();
      if (!ref) {
        debug.log("Undo - Create module reference not available");
        return;
      }

      const { CreateModuleState } = ref;
      const success = CreateModuleState.undo();

      if (!success) {
        debug.log("Ctrl+Z - Nothing to undo");
      }
    },
  });

  // Ctrl+Shift+Z - Redo last undone action
  service.register({
    id: "create.redo",
    label: "Redo",
    description: "Redo the last undone action in the current tab",
    key: "z",
    modifiers: ["ctrl", "shift"],
    context: "create",
    scope: "sequence-management",
    priority: "high",
    action: () => {
      const ref = getCreateModuleRef();
      if (!ref) {
        debug.log("Redo - Create module reference not available");
        return;
      }

      const { CreateModuleState } = ref;
      const success = CreateModuleState.redo();

      if (!success) {
        debug.log("Ctrl+Shift+Z - Nothing to redo");
      }
    },
  });

  // Backspace - Delete selected beat
  service.register({
    id: "create.delete-beat",
    label: "Delete Beat",
    description: "Delete the currently selected beat",
    key: "Backspace",
    modifiers: [],
    context: "create",
    scope: "sequence-management",
    priority: "medium",
    action: async () => {
      debug.log("Backspace key pressed!");

      const ref = getCreateModuleRef();
      debug.log("Create module ref:", ref ? "Available" : "Not available");

      if (!ref) {
        debug.log("Create module reference not available");
        return;
      }

      const { CreateModuleState, constructTabState, panelState } = ref;
      const sequenceState = CreateModuleState.sequenceState;

      // Check if start position (beat 0) is selected
      const selectedBeatData = sequenceState.selectedBeatData;

      if (selectedBeatData?.beatNumber === 0) {
        // Start position is selected - clear entire sequence using the same workflow as clear button
        try {
          await executeClearSequenceWorkflow({
            CreateModuleState,
            constructTabState,
            panelState,
          });

          // Close beat editor panel if it's open
          if (panelState.isBeatEditorPanelOpen) {
            panelState.closeBeatEditorPanel();
          }
        } catch (err) {
          console.error("Failed to clear sequence:", err);
        }
        return;
      }

      const selectedBeatIndex = sequenceState.getSelectedBeatIndex();

      if (selectedBeatIndex === null) {
        debug.log("Backspace - No beat selected");
        return;
      }

      // Remove the beat and all subsequent beats with animation (same as trash can button)
      sequenceState.removeBeatAndSubsequentWithAnimation(
        selectedBeatIndex,
        () => {
          // After animation completes, select appropriate beat
          if (selectedBeatIndex > 0) {
            sequenceState.selectBeat(selectedBeatIndex);
          } else {
            sequenceState.selectStartPositionForEditing();
          }
        }
      );
    },
  });

  // ==================== Sequence Transforms ====================
  // Global hotkeys for sequence transforms - available anytime in CREATE module

  // m - Mirror sequence (flip left/right)
  service.register({
    id: "create.transform-mirror",
    label: "Mirror Sequence",
    description: "Mirror the sequence (flip left and right)",
    key: "m",
    modifiers: [],
    context: "create",
    scope: "sequence-management",
    priority: "medium",
    condition: () => {
      if (!state.settings.enableSingleKeyShortcuts) return false;
      const ref = getCreateModuleRef();
      if (!ref) return false;
      const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
      return sequenceState?.hasSequence() ?? false;
    },
    action: async () => {
      const ref = getCreateModuleRef();
      if (!ref) return;

      const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
      if (!sequenceState?.hasSequence()) return;

      await sequenceState.mirrorSequence();
    },
  });

  // h - Swap hands (swap colors)
  service.register({
    id: "create.transform-swap-hands",
    label: "Swap Hands",
    description: "Swap hand movements (left becomes right, right becomes left)",
    key: "h",
    modifiers: [],
    context: "create",
    scope: "sequence-management",
    priority: "medium",
    condition: () => {
      if (!state.settings.enableSingleKeyShortcuts) return false;
      const ref = getCreateModuleRef();
      if (!ref) return false;
      const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
      return sequenceState?.hasSequence() ?? false;
    },
    action: async () => {
      const ref = getCreateModuleRef();
      if (!ref) return;

      const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
      if (!sequenceState?.hasSequence()) return;

      await sequenceState.swapColors();
    },
  });

  // r - Rotate sequence clockwise (45°)
  service.register({
    id: "create.transform-rotate-cw",
    label: "Rotate Clockwise",
    description: "Rotate the sequence 45° clockwise",
    key: "r",
    modifiers: [],
    context: "create",
    scope: "sequence-management",
    priority: "medium",
    condition: () => {
      if (!state.settings.enableSingleKeyShortcuts) return false;
      const ref = getCreateModuleRef();
      if (!ref) return false;
      const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
      return sequenceState?.hasSequence() ?? false;
    },
    action: async () => {
      const ref = getCreateModuleRef();
      if (!ref) return;

      const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
      if (!sequenceState?.hasSequence()) return;

      await sequenceState.rotateSequence("clockwise");
    },
  });

  // Shift+R - Rotate sequence counter-clockwise (45°)
  service.register({
    id: "create.transform-rotate-ccw",
    label: "Rotate Counter-Clockwise",
    description: "Rotate the sequence 45° counter-clockwise",
    key: "R",
    modifiers: ["shift"],
    context: "create",
    scope: "sequence-management",
    priority: "medium",
    condition: () => {
      const ref = getCreateModuleRef();
      if (!ref) return false;
      const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
      return sequenceState?.hasSequence() ?? false;
    },
    action: async () => {
      const ref = getCreateModuleRef();
      if (!ref) return;

      const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
      if (!sequenceState?.hasSequence()) return;

      await sequenceState.rotateSequence("counterclockwise");
    },
  });

  // w - Rewind/Reverse sequence
  // Note: KeyboardShortcutManager blocks WASD when an arrow is selected for adjustment
  service.register({
    id: "create.transform-rewind",
    label: "Rewind Sequence",
    description: "Reverse the sequence to return to start position",
    key: "w",
    modifiers: [],
    context: "create",
    scope: "sequence-management",
    priority: "medium",
    condition: () => {
      if (!state.settings.enableSingleKeyShortcuts) return false;
      const ref = getCreateModuleRef();
      if (!ref) return false;
      const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
      return sequenceState?.hasSequence() ?? false;
    },
    action: async () => {
      const ref = getCreateModuleRef();
      if (!ref) return;

      const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
      if (!sequenceState?.hasSequence()) return;

      await sequenceState.rewindSequence();
    },
  });

  // ==================== Edit Panel Adjustments ====================

  // [ - Decrease rotation/adjustment value
  service.register({
    id: "create.edit-decrease",
    label: "Decrease Value",
    description: "Decrease rotation or adjustment value in edit panel",
    key: "[",
    modifiers: [],
    context: ["create", "edit-panel"],
    scope: "editing",
    priority: "low",
    condition: () => {
      return state.settings.enableSingleKeyShortcuts;
    },
    action: () => {
      debug.log("[ - Decrease value (not yet implemented)");
      // TODO: Integrate with edit panel controls
      // decreaseCurrentValue();
    },
  });

  // ] - Increase rotation/adjustment value
  service.register({
    id: "create.edit-increase",
    label: "Increase Value",
    description: "Increase rotation or adjustment value in edit panel",
    key: "]",
    modifiers: [],
    context: ["create", "edit-panel"],
    scope: "editing",
    priority: "low",
    condition: () => {
      return state.settings.enableSingleKeyShortcuts;
    },
    action: () => {
      debug.log("] - Increase value (not yet implemented)");
      // TODO: Integrate with edit panel controls
      // increaseCurrentValue();
    },
  });
}
