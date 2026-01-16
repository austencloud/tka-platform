<!--
  ArrowAdjustmentPanel.svelte

  Compact inline panel for adjusting arrow positions using WASD keys.
  Designed to fit in the BeatEditorPanel header.

  Features:
  - WASD keyboard controls for arrow movement (5/20/200px increments)
  - Z key to reset arrow to default position
  - Compact display of current adjustment values
  - "Save Global" button to persist adjustment to Firestore (applies to all matching pictographs)
-->
<script lang="ts">
  import type { BeatData } from "../../domain/models/BeatData";
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
  import { globalAdjustmentVersion } from "$lib/shared/pictograph/arrow/positioning/global/state/global-adjustment-version.svelte";
  import type { GlobalArrowAdjustmentInput } from "$lib/shared/pictograph/arrow/positioning/global/domain/GlobalArrowAdjustment";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import type { IPictographPreparer } from "$lib/shared/pictograph/shared/services/contracts/IPictographPreparer";

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
  let pictographPreparer: IPictographPreparer | null = null;

  // State
  let currentIncrement = $state(5);
  let isSaving = $state(false);
  let hasUndoSnapshotForSession = $state(false);

  // Local working copy of beat data - updated synchronously to avoid race conditions
  // between rapid keystrokes and Svelte's reactive prop updates
  let workingBeatData = $state<BeatData | null>(null);

  // Sync working state with prop when prop changes from external sources
  $effect(() => {
    if (beatData !== null) {
      workingBeatData = beatData;
    }
  });

  // Derived
  const selectedArrow = $derived(selectedArrowState.selectedArrow);

  // Calculate current adjustment values from GLOBAL REPO (single source of truth)
  // This depends on globalAdjustmentVersion to ensure reactivity when adjustments change
  const currentAdjustmentX = $derived.by(() => {
    // Depend on version to trigger re-calculation when adjustments change
    const _ = globalAdjustmentVersion.version;

    if (!selectedArrow || !keyGenerator) return 0;
    const repo = getGlobalAdjustmentRepository();
    if (!repo) return 0;

    const globalKey = keyGenerator.generateKey(
      selectedArrow.motionData,
      selectedArrow.pictographData,
      selectedArrow.color
    );
    const adjustment = repo.getAdjustment(globalKey);
    return adjustment?.x ?? 0;
  });

  const currentAdjustmentY = $derived.by(() => {
    // Depend on version to trigger re-calculation when adjustments change
    const _ = globalAdjustmentVersion.version;

    if (!selectedArrow || !keyGenerator) return 0;
    const repo = getGlobalAdjustmentRepository();
    if (!repo) return 0;

    const globalKey = keyGenerator.generateKey(
      selectedArrow.motionData,
      selectedArrow.pictographData,
      selectedArrow.color
    );
    const adjustment = repo.getAdjustment(globalKey);
    return adjustment?.y ?? 0;
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
    if (!selectedArrowState.selectedArrow || !workingBeatData || !keyboardAdjustmentService || !keyGenerator) {
      return;
    }

    // Push undo snapshot on first adjustment in this session
    if (!hasUndoSnapshotForSession && onPushUndoSnapshot) {
      onPushUndoSnapshot();
      hasUndoSnapshotForSession = true;
    }

    const repo = getGlobalAdjustmentRepository();
    const pictographData = selectedArrowState.selectedArrow.pictographData;
    const motionData = selectedArrowState.selectedArrow.motionData;
    const arrowColor = selectedArrowState.selectedArrow.color as MotionColor;

    // Calculate WASD direction
    const adjustment = keyboardAdjustmentService.calculateAdjustment(key, currentIncrement);

    // Get current total from GLOBAL REPO (not from beat's manualAdjustmentX/Y)
    // This ensures all pictographs share the same source of truth
    const globalKey = keyGenerator.generateKey(motionData, pictographData, arrowColor);
    const currentGlobalAdjustment = repo?.getAdjustment(globalKey);
    const currentX = currentGlobalAdjustment?.x ?? 0;
    const currentY = currentGlobalAdjustment?.y ?? 0;

    // Calculate new total
    const newX = currentX + adjustment.x;
    const newY = currentY + adjustment.y;

    logger.log(`WASD ${key}: (${currentX}, ${currentY}) + (${adjustment.x}, ${adjustment.y}) = (${newX}, ${newY})`);

    // Save to global repo locally (NOT to Firestore) - this is the single source of truth
    // All pictographs will read from here, including the selected beat
    if (repo) {
      try {
        const input: GlobalArrowAdjustmentInput = {
          ...globalKey,
          adjustmentX: newX,
          adjustmentY: newY,
        };
        repo.saveAdjustmentLocal(input);

        // Clear the pictograph preparation cache so ALL pictographs re-calculate
        pictographPreparer?.clearCache();

        // Increment version to trigger reactive re-renders
        globalAdjustmentVersion.increment();
      } catch (error) {
        logger.warn("Failed to save local adjustment:", error);
      }
    }

    hapticService?.trigger("selection");

    // Note: We do NOT update manualAdjustmentX/Y on the beat data anymore.
    // All pictographs (including the selected one) get their adjustment from the global repo.
    // This prevents double-application.
  }

  async function handleResetToDefault() {
    if (!selectedArrowState.selectedArrow) {
      return;
    }

    // Push undo snapshot before reset
    if (onPushUndoSnapshot) {
      onPushUndoSnapshot();
    }

    const arrowColor = selectedArrowState.selectedArrow.color;
    logger.log(`Resetting ${arrowColor} arrow to default position`);

    hapticService?.trigger("warning");

    // Delete from local cache (not Firestore) for live preview
    // All pictographs will reset immediately
    deleteFromGlobalLocally();
  }

  /**
   * Delete adjustment from the global repository's in-memory cache.
   * This does NOT persist to Firestore - it's for live preview only.
   */
  function deleteFromGlobalLocally() {
    const repo = getGlobalAdjustmentRepository();
    if (!repo || !keyGenerator || !selectedArrowState.selectedArrow) {
      return;
    }

    const pictographData = selectedArrowState.selectedArrow.pictographData;
    const motionData = selectedArrowState.selectedArrow.motionData;
    const arrowColor = selectedArrowState.selectedArrow.color;

    try {
      // Generate the composite key for this arrow
      const key = keyGenerator.generateKey(motionData, pictographData, arrowColor);

      // Delete from local cache only (not Firestore)
      repo.deleteAdjustmentLocal(key);

      // Clear the pictograph preparation cache so all matching pictographs re-calculate
      pictographPreparer?.clearCache();

      // Increment version to trigger reactive re-renders in all pictographs
      globalAdjustmentVersion.increment();
    } catch (error) {
      logger.warn("Failed to delete local adjustment:", error);
    }
  }

  /**
   * Save current adjustment to global Firestore.
   * This persists the adjustment so it survives HMR/page refresh.
   */
  async function handleSaveToGlobal() {
    if (!selectedArrowState.selectedArrow || !keyGenerator) {
      return;
    }

    const repo = getGlobalAdjustmentRepository();
    if (!repo) {
      logger.warn("Cannot save to global: missing repository");
      return;
    }

    const pictographData = selectedArrowState.selectedArrow.pictographData;
    const motionData = selectedArrowState.selectedArrow.motionData;
    const arrowColor = selectedArrowState.selectedArrow.color;

    // Generate the composite key for this arrow
    const key = keyGenerator.generateKey(motionData, pictographData, arrowColor);

    // Get current adjustment from global repo (single source of truth)
    const currentAdjustment = repo.getAdjustment(key);
    const adjustmentX = currentAdjustment?.x ?? 0;
    const adjustmentY = currentAdjustment?.y ?? 0;

    if (adjustmentX === 0 && adjustmentY === 0) {
      logger.warn("No adjustment to save");
      return;
    }

    try {
      isSaving = true;

      const input: GlobalArrowAdjustmentInput = {
        ...key,
        adjustmentX,
        adjustmentY,
      };

      logger.log(`Saving to Firestore: (${adjustmentX}, ${adjustmentY})`);
      await repo.saveAdjustment(input);
      logger.success("Saved to Firestore - adjustment will persist across page reloads");

      hapticService?.trigger("success");
    } catch (error) {
      logger.error("Failed to save to Firestore:", error);
      hapticService?.trigger("error");
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

      // Clear cache and increment version so all pictographs re-render with default positions
      pictographPreparer?.clearCache();
      globalAdjustmentVersion.increment();
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
      pictographPreparer = container.items.pictographPreparer as IPictographPreparer;

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

  <!-- Save to Global button -->
  {#if hasAdjustment}
    <button
      class="save-global-btn"
      onclick={handleSaveToGlobal}
      title="Save to global (applies to all matching pictographs)"
      aria-label="Save adjustment globally"
      disabled={isSaving}
    >
      {#if isSaving}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      {:else}
        <i class="fas fa-globe" aria-hidden="true"></i>
      {/if}
    </button>
  {/if}

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

  .save-global-btn,
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

  .save-global-btn:hover,
  .reset-btn:hover,
  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .save-global-btn {
    border-color: rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .save-global-btn:hover {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
  }

  .save-global-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
