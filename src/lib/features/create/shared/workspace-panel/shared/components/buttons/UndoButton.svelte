<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { UndoOperationType } from "../../../../services/undo-manager";
  import type { createCreateModuleState } from "$lib/features/create/shared/state/create-module-state.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import UndoGlyph from "./UndoGlyph.svelte";

  type CreateModuleState = ReturnType<typeof createCreateModuleState>;

  // Props
  let {
    CreateModuleState,
    onUndo = () => {},
  }: {
    CreateModuleState: CreateModuleState;
    onUndo?: () => void;
  } = $props();

  // Resolve haptic feedback service
  const hapticService = getHapticFeedback();

  const isAssembleTab = $derived(navigationState.activeTab === "assemble");

  // Type descriptions for all operation types
  const typeDescriptions: Record<UndoOperationType, string> = {
    [UndoOperationType.ADD_BEAT]: "Add Beat",
    [UndoOperationType.REMOVE_BEATS]: "Remove Steps",
    [UndoOperationType.CLEAR_SEQUENCE]: "Clear Sequence",
    [UndoOperationType.SELECT_START_POSITION]: "Select Start Position",
    [UndoOperationType.UPDATE_BEAT]: "Update Beat",
    [UndoOperationType.INSERT_BEAT]: "Insert Beat",
    [UndoOperationType.BATCH_EDIT]: "Batch Edit",
    [UndoOperationType.MIRROR_SEQUENCE]: "Mirror",
    [UndoOperationType.FLIP_SEQUENCE]: "Flip",
    [UndoOperationType.ROTATE_SEQUENCE]: "Rotate",
    [UndoOperationType.SWAP_COLORS]: "Swap Colors",
    [UndoOperationType.INVERT_SEQUENCE]: "Invert",
    [UndoOperationType.REWIND_SEQUENCE]: "Rewind",
    [UndoOperationType.SHIFT_START]: "Shift Start",
    [UndoOperationType.APPLY_TURN_PATTERN]: "Turn Pattern",
    [UndoOperationType.APPLY_ROTATION_PATTERN]: "Rotation Pattern",
    [UndoOperationType.APPLY_DURATION_PATTERN]: "Duration Pattern",
    [UndoOperationType.EXTEND_SEQUENCE]: "Extend",
    [UndoOperationType.MODIFY_BEAT_PROPERTIES]: "Edit Beat",
    [UndoOperationType.GENERATE_SEQUENCE]: "Generate Sequence",
    [UndoOperationType.SPELL_GENERATE]: "Spell Generate",
    [UndoOperationType.SPELL_APPLY_LOOP]: "Apply Spell Loop",
  };

  // Derived state for button text/tooltip
  const undoButtonText = $derived(() => {
    if (!CreateModuleState.canUndo) return "Nothing to Undo";

    // Assemble tab uses per-step undo - no history entries to inspect
    if (isAssembleTab) {
      const builder = CreateModuleState.assembleTabState?.assembleBuilderState;
      if (builder?.phase === "placing") return "Undo Placement";
      return "Undo Step";
    }

    const lastEntry =
      CreateModuleState.undoHistory[CreateModuleState.undoHistory.length - 1];
    if (lastEntry?.metadata?.description) {
      return `Undo ${lastEntry.metadata.description}`;
    }

    const lastType = lastEntry?.type as UndoOperationType | undefined;
    return `Undo ${lastType ? typeDescriptions[lastType] : "Last Action"}`;
  });

  const undoTooltip = $derived(() => {
    if (!CreateModuleState.canUndo) return "No actions to undo";

    // Assemble tab: simple tooltip
    if (isAssembleTab) {
      const builder = CreateModuleState.assembleTabState?.assembleBuilderState;
      if (builder?.phase === "placing") return "Undo: Remove placement";
      return "Undo: Remove last step from active hand";
    }

    const lastEntry =
      CreateModuleState.undoHistory[CreateModuleState.undoHistory.length - 1];
    if (lastEntry?.metadata?.description) {
      return `Undo: ${lastEntry.metadata.description}`;
    }

    return `Undo last action (${lastEntry?.type || "Unknown"})`;
  });

  // Simple click handler
  function handleUndo() {
    hapticService?.trigger("selection");
    const success = CreateModuleState.undo();
    if (success) {
      onUndo();
    }
  }
</script>

<!-- Simple tap-to-undo button -->
<button
  class="undo-button"
  class:disabled={!CreateModuleState.canUndo}
  onclick={handleUndo}
  disabled={!CreateModuleState.canUndo}
  title={undoTooltip()}
  aria-label={undoButtonText()}
>
  <UndoGlyph size={20} />
</button>

<style>
  .undo-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--transition-normal, var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1));
    font-size: var(--font-size-lg);
    color: var(--theme-text);

    /* Purple gradient matching SaveToLibraryButton */
    background: linear-gradient(
      135deg,
      var(--theme-accent-strong) 0%,
      color-mix(
          in srgb,
          var(--theme-accent-strong) 85%,
          var(--theme-accent-strong)
        )
        100%
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent-strong) 30%, transparent);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent-strong) 40%, transparent);
  }

  .undo-button:hover:not(:disabled) {
    transform: scale(1.05);
    background: linear-gradient(
      135deg,
      color-mix(
          in srgb,
          var(--theme-accent-strong) 85%,
          var(--theme-accent-strong)
        )
        0%,
      color-mix(
          in srgb,
          var(--theme-accent-strong) 70%,
          var(--theme-accent-strong)
        )
        100%
    );
    box-shadow: 0 6px 16px
      color-mix(in srgb, var(--theme-accent-strong) 60%, transparent);
  }

  .undo-button:active {
    transform: scale(0.95);
    transition: all var(--duration-instant) ease;
  }

  .undo-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .undo-button:disabled,
  .undo-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
</style>
