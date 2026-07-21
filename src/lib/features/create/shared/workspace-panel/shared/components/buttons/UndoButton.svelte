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
    direction = "undo",
    onAction = () => {},
  }: {
    CreateModuleState: CreateModuleState;
    direction?: "undo" | "redo";
    onAction?: () => void;
  } = $props();

  // Resolve haptic feedback service
  const hapticService = getHapticFeedback();

  const isAssembleTab = $derived(navigationState.activeTab === "assemble");

  // Type descriptions for all operation types
  const typeDescriptions: Record<UndoOperationType, string> = {
    [UndoOperationType.ADD_BEAT]: "Add Step",
    [UndoOperationType.REMOVE_BEATS]: "Remove Steps",
    [UndoOperationType.CLEAR_SEQUENCE]: "Clear Sequence",
    [UndoOperationType.SELECT_START_POSITION]: "Select Start Position",
    [UndoOperationType.UPDATE_BEAT]: "Update Step",
    [UndoOperationType.INSERT_BEAT]: "Insert Step",
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
    [UndoOperationType.MODIFY_BEAT_PROPERTIES]: "Edit Step",
    [UndoOperationType.GENERATE_SEQUENCE]: "Generate Sequence",
    [UndoOperationType.SPELL_GENERATE]: "Spell Generate",
    [UndoOperationType.SPELL_APPLY_LOOP]: "Apply Spell Loop",
  };

  // Derived state for button text/tooltip
  const canAct = $derived(
    direction === "undo" ? CreateModuleState.canUndo : CreateModuleState.canRedo
  );

  const historyButtonText = $derived(() => {
    if (!canAct)
      return direction === "undo" ? "Nothing to Undo" : "Nothing to Redo";

    if (isAssembleTab) {
      const builder = CreateModuleState.assembleTabState?.assembleBuilderState;
      const label =
        direction === "undo" ? builder?.undoLabel : builder?.redoLabel;
      return `${direction === "undo" ? "Undo" : "Redo"} ${label ?? "Last Action"}`;
    }

    if (direction === "redo") return "Redo Last Action";

    const lastEntry =
      CreateModuleState.undoHistory[CreateModuleState.undoHistory.length - 1];
    if (lastEntry?.metadata?.description) {
      return `Undo ${lastEntry.metadata.description}`;
    }

    const lastType = lastEntry?.type as UndoOperationType | undefined;
    return `Undo ${lastType ? typeDescriptions[lastType] : "Last Action"}`;
  });

  const historyTooltip = $derived(() => {
    if (!canAct) {
      return direction === "undo" ? "No actions to undo" : "No actions to redo";
    }

    if (isAssembleTab) {
      const builder = CreateModuleState.assembleTabState?.assembleBuilderState;
      const label =
        direction === "undo" ? builder?.undoLabel : builder?.redoLabel;
      return `${direction === "undo" ? "Undo" : "Redo"}: ${label ?? "last action"}`;
    }

    if (direction === "redo") return "Redo last action";

    const lastEntry =
      CreateModuleState.undoHistory[CreateModuleState.undoHistory.length - 1];
    if (lastEntry?.metadata?.description) {
      return `Undo: ${lastEntry.metadata.description}`;
    }

    return `Undo last action (${lastEntry?.type || "Unknown"})`;
  });

  // Simple click handler
  function handleAction() {
    hapticService?.trigger("selection");
    const success =
      direction === "undo"
        ? CreateModuleState.undo()
        : CreateModuleState.redo();
    if (success) {
      onAction();
    }
  }
</script>

<button
  class="undo-button"
  class:disabled={!canAct}
  onclick={handleAction}
  disabled={!canAct}
  title={historyTooltip()}
  aria-label={historyButtonText()}
>
  <UndoGlyph size={20} {direction} />
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
