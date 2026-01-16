<!--
  ArrowAdjustmentPanel.svelte

  Compact inline panel for adjusting arrow positions using WASD keys.
  Designed to fit in the BeatEditorPanel header.

  Features:
  - WASD keyboard controls for arrow movement (5/20/200px increments)
  - Z key to reset arrow to default position
  - Compact display of current adjustment values
  - Auto-saves changes to global Firestore on every keystroke
-->
<script lang="ts">
  import type { BeatData } from "../../domain/models/BeatData";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { IKeyboardArrowAdjuster } from "$lib/features/create/shared/services/contracts/IKeyboardArrowAdjuster";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IGridModeDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridModeDeriver";
  import type { ITurnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
  import { selectedArrowState } from "$lib/features/create/shared/state/selected-arrow-state.svelte";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { GlobalAdjustmentKeyGenerator } from "$lib/shared/pictograph/arrow/positioning/global/services/implementations/GlobalAdjustmentKeyGenerator";
  import { getGlobalAdjustmentRepository } from "$lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton";
  import type { GlobalArrowAdjustmentInput } from "$lib/shared/pictograph/arrow/positioning/global/domain/GlobalArrowAdjustment";
  import { createArrowPlacementData } from "$lib/shared/pictograph/arrow/positioning/placement/domain/createArrowPlacementData";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";

  const logger = createComponentLogger("ArrowAdjustmentPanel");

  interface Props {
    beatData: BeatData;
    onBeatDataUpdate: (updatedBeatData: BeatData) => void;
    onPushUndoSnapshot?: () => void;
  }

  let { beatData, onBeatDataUpdate, onPushUndoSnapshot }: Props = $props();

  // Services
  let hapticService: IHapticFeedback | null = null;
  let keyboardAdjustmentService: IKeyboardArrowAdjuster | null = null;
  let keyGenerator: GlobalAdjustmentKeyGenerator | null = null;

  // State
  let currentIncrement = $state(5);
  let isSaving = $state(false);
  let hasUndoSnapshotForSession = $state(false);

  // Local working copy of beat data - updated synchronously to avoid race conditions
  // between rapid keystrokes and Svelte's reactive prop updates
  let workingBeatData = $state<BeatData | null>(null);

  // Sync working state with prop when prop changes from external sources
  // WARNING: This could overwrite local state with stale prop data!
  $effect(() => {
    if (beatData !== null) {
      const color = selectedArrowState.selectedArrow?.color;
      if (color) {
        const propMotion = beatData.motions[color as MotionColor];
        const workingMotion = workingBeatData?.motions?.[color as MotionColor];
        console.log(`%c[EFFECT DEBUG] Prop sync triggered:`, 'color: magenta', {
          propX: propMotion?.arrowPlacementData?.manualAdjustmentX ?? 0,
          propY: propMotion?.arrowPlacementData?.manualAdjustmentY ?? 0,
          workingX: workingMotion?.arrowPlacementData?.manualAdjustmentX ?? 0,
          workingY: workingMotion?.arrowPlacementData?.manualAdjustmentY ?? 0,
        });
      }
      workingBeatData = beatData;
    }
  });

  // Derived
  const selectedArrow = $derived(selectedArrowState.selectedArrow);

  // Calculate current adjustment values from working beat data (for immediate UI feedback)
  const currentAdjustmentX = $derived.by(() => {
    if (!selectedArrow || !workingBeatData?.motions) return 0;
    const motion = workingBeatData.motions[selectedArrow.color as MotionColor];
    return motion?.arrowPlacementData?.manualAdjustmentX ?? 0;
  });

  const currentAdjustmentY = $derived.by(() => {
    if (!selectedArrow || !workingBeatData?.motions) return 0;
    const motion = workingBeatData.motions[selectedArrow.color as MotionColor];
    return motion?.arrowPlacementData?.manualAdjustmentY ?? 0;
  });

  // Check if there's an adjustment to reset
  const hasAdjustment = $derived(currentAdjustmentX !== 0 || currentAdjustmentY !== 0);

  // Reset undo snapshot flag when selection changes
  $effect(() => {
    // Track selection changes to reset the undo snapshot flag
    const _ = selectedArrow;
    hasUndoSnapshotForSession = false;
  });

  // Keyboard handler
  function handleKeydown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();

    // Calculate increment based on modifiers
    if (event.shiftKey && event.ctrlKey) {
      currentIncrement = 200;
    } else if (event.shiftKey) {
      currentIncrement = 20;
    } else {
      currentIncrement = 5;
    }

    // Handle WASD movement
    if (["w", "a", "s", "d"].includes(key)) {
      event.preventDefault();
      handleWASDMovement(key as "w" | "a" | "s" | "d");
    }

    // Z to reset adjustment to default
    if (key === "z" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      handleResetToDefault();
    }

    // Escape to deselect arrow
    if (key === "escape") {
      event.preventDefault();
      selectedArrowState.clearSelection();
    }
  }

  async function handleWASDMovement(key: "w" | "a" | "s" | "d") {
    if (!selectedArrowState.selectedArrow || !workingBeatData || !keyboardAdjustmentService) {
      console.log(`%c[PANEL DEBUG] Early return - missing:`, 'color: orange', {
        selectedArrow: !!selectedArrowState.selectedArrow,
        workingBeatData: !!workingBeatData,
        service: !!keyboardAdjustmentService
      });
      return;
    }

    const color = selectedArrowState.selectedArrow.color;
    const beforeMotion = workingBeatData.motions[color as MotionColor];
    console.log(`%c[PANEL DEBUG] BEFORE service call:`, 'color: cyan', {
      key,
      color,
      workingX: beforeMotion?.arrowPlacementData?.manualAdjustmentX ?? 0,
      workingY: beforeMotion?.arrowPlacementData?.manualAdjustmentY ?? 0
    });

    // Push undo snapshot on first adjustment in this session
    if (!hasUndoSnapshotForSession && onPushUndoSnapshot) {
      onPushUndoSnapshot();
      hasUndoSnapshotForSession = true;
    }

    // Calculate new beat data using the LOCAL working copy (not the prop)
    // This ensures rapid keystrokes don't race with Svelte's reactive prop updates
    const updatedBeatData = keyboardAdjustmentService.handleWASDMovement(
      key,
      currentIncrement,
      selectedArrowState.selectedArrow,
      workingBeatData
    );

    const afterMotion = updatedBeatData.motions[color as MotionColor];
    console.log(`%c[PANEL DEBUG] AFTER service call:`, 'color: lime', {
      returnedX: afterMotion?.arrowPlacementData?.manualAdjustmentX ?? 0,
      returnedY: afterMotion?.arrowPlacementData?.manualAdjustmentY ?? 0
    });

    // Update LOCAL state SYNCHRONOUSLY FIRST - this is the critical fix
    // Subsequent keystrokes will use this updated value immediately
    workingBeatData = updatedBeatData;

    // Then notify parent (which may have async reactive updates)
    onBeatDataUpdate(updatedBeatData);
    hapticService?.trigger("selection");

    // Auto-save to global Firestore
    await saveToGlobal(updatedBeatData);
  }

  async function handleResetToDefault() {
    if (!selectedArrowState.selectedArrow || !workingBeatData) {
      return;
    }

    // Push undo snapshot before reset
    if (onPushUndoSnapshot) {
      onPushUndoSnapshot();
    }

    const arrowColor = selectedArrowState.selectedArrow.color as MotionColor;
    const currentMotion = workingBeatData.motions[arrowColor];
    if (!currentMotion) return;

    logger.log(`Resetting ${arrowColor} arrow to default position`);

    // Create updated arrow placement data with zero adjustments
    const updatedArrowPlacementData = createArrowPlacementData({
      ...currentMotion.arrowPlacementData,
      manualAdjustmentX: 0,
      manualAdjustmentY: 0,
    });

    // Create updated motion data
    const updatedMotion = createMotionData({
      ...currentMotion,
      arrowPlacementData: updatedArrowPlacementData,
    });

    // Create updated beat data
    const updatedBeatData: BeatData = {
      ...workingBeatData,
      motions: {
        ...workingBeatData.motions,
        [arrowColor]: updatedMotion,
      },
    };

    // Update LOCAL state SYNCHRONOUSLY FIRST
    workingBeatData = updatedBeatData;

    // Then notify parent
    onBeatDataUpdate(updatedBeatData);
    hapticService?.trigger("warning");

    // Delete from global Firestore (reset = remove the adjustment)
    await deleteFromGlobal();
  }

  async function saveToGlobal(updatedBeatData: BeatData) {
    const repo = getGlobalAdjustmentRepository();
    if (!repo || !keyGenerator || !selectedArrowState.selectedArrow) {
      logger.warn("Cannot save to global: missing repository or key generator");
      return;
    }

    const pictographData = selectedArrowState.selectedArrow.pictographData;
    const motionData = selectedArrowState.selectedArrow.motionData;
    const arrowColor = selectedArrowState.selectedArrow.color;

    try {
      isSaving = true;

      // Generate the composite key for this arrow
      const key = keyGenerator.generateKey(motionData, pictographData, arrowColor);

      // Get the updated adjustment values
      const updatedMotion = updatedBeatData.motions[arrowColor as MotionColor];
      const adjustmentX = updatedMotion?.arrowPlacementData?.manualAdjustmentX ?? 0;
      const adjustmentY = updatedMotion?.arrowPlacementData?.manualAdjustmentY ?? 0;

      const input: GlobalArrowAdjustmentInput = {
        ...key,
        adjustmentX,
        adjustmentY,
      };

      logger.log(`Saving to global: (${adjustmentX}, ${adjustmentY})`);
      await repo.saveAdjustment(input);
      logger.success("Saved to global Firestore");
    } catch (error) {
      logger.error("Failed to save to global:", error);
    } finally {
      isSaving = false;
    }
  }

  async function deleteFromGlobal() {
    const repo = getGlobalAdjustmentRepository();
    if (!repo || !keyGenerator || !selectedArrowState.selectedArrow) {
      return;
    }

    const pictographData = selectedArrowState.selectedArrow.pictographData;
    const motionData = selectedArrowState.selectedArrow.motionData;
    const arrowColor = selectedArrowState.selectedArrow.color;

    try {
      isSaving = true;

      // Generate the composite key for this arrow
      const key = keyGenerator.generateKey(motionData, pictographData, arrowColor);

      logger.log("Deleting adjustment from global");
      await repo.deleteAdjustment(key);
      logger.success("Deleted from global Firestore");
    } catch (error) {
      logger.error("Failed to delete from global:", error);
    } finally {
      isSaving = false;
    }
  }

  function handleClearSelection() {
    selectedArrowState.clearSelection();
    hapticService?.trigger("selection");
  }

  onMount(() => {
    try {
      hapticService = container.items.hapticFeedback;
      keyboardAdjustmentService = container.items.keyboardArrowAdjuster;

      // Initialize key generator with required dependencies
      const gridModeDeriver = container.items.gridModeDeriver as IGridModeDeriver;
      const turnsTupleGenerator = container.items.turnsTupleGenerator as ITurnsTupleGenerator;
      keyGenerator = new GlobalAdjustmentKeyGenerator(gridModeDeriver, turnsTupleGenerator);
    } catch (error) {
      console.error("[ArrowAdjustmentPanel] Failed to initialize services:", error);
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

<div class="arrow-adjustment">
  <!-- Arrow color indicator -->
  <span
    class="arrow-badge"
    class:blue={selectedArrow?.color === "blue"}
    class:red={selectedArrow?.color === "red"}
  >
    {selectedArrow?.color?.toUpperCase()}
  </span>

  <!-- Current adjustment values -->
  <div class="adjustment-values">
    <span class="coord">
      <span class="label">X</span>
      <span class="value">{currentAdjustmentX}</span>
    </span>
    <span class="coord">
      <span class="label">Y</span>
      <span class="value">{currentAdjustmentY}</span>
    </span>
  </div>

  <!-- Increment indicator -->
  <span class="increment-badge">{currentIncrement}px</span>

  <!-- Reset to default button -->
  {#if hasAdjustment}
    <button
      class="reset-btn"
      onclick={handleResetToDefault}
      title="Reset to default (Z)"
      aria-label="Reset arrow to default position"
      disabled={isSaving}
    >
      <i class="fas fa-undo" aria-hidden="true"></i>
    </button>
  {/if}

  <!-- Clear selection button -->
  <button
    class="clear-btn"
    onclick={handleClearSelection}
    title="Deselect arrow (Esc)"
    aria-label="Deselect arrow"
  >
    <i class="fas fa-times" aria-hidden="true"></i>
  </button>
</div>

<style>
  .arrow-adjustment {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    font-size: 0.75rem;
  }

  .arrow-badge {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .arrow-badge.blue {
    background: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  .arrow-badge.red {
    background: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .adjustment-values {
    display: flex;
    gap: 8px;
  }

  .coord {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .coord .label {
    font-size: 0.65rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-weight: 500;
  }

  .coord .value {
    font-family: "SF Mono", Monaco, monospace;
    font-size: 0.75rem;
    color: white;
    min-width: 32px;
    text-align: right;
  }

  .increment-badge {
    font-size: 0.65rem;
    font-weight: 600;
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.2);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .reset-btn,
  .clear-btn {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    transition: all 0.15s ease;
    padding: 0;
  }

  .reset-btn:hover,
  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .reset-btn {
    border-color: rgba(251, 191, 36, 0.3);
    color: #fbbf24;
  }

  .reset-btn:hover {
    background: rgba(251, 191, 36, 0.2);
    color: #fcd34d;
  }

  .reset-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
