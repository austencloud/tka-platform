<!--
  ArrowAdjustmentPanel.svelte

  Compact inline panel for adjusting arrow positions using WASD keys.
  Designed to fit in the StepEditorPanel header.

  Features:
  - WASD keyboard controls for arrow movement (5/20/200px increments)
  - Z key to reset arrow to default position
  - Compact display of current adjustment values
  - Debounced auto-save: automatically persists to Firestore 1.5s after last movement
  - Visual save state indicator (unsaved → saving → saved)
  - 3-layer prop-specific adjustment system:
    - Layer 1 (Base): Staff adjustments, fallback for all props
    - Layer 2 (Prop-Specific): Adjustments for specific prop types (fan, club, etc.)
    - Layer 3 (Combination Override): Edge cases where blue+red prop combo needs special handling
-->
<script lang="ts">
  import type { StepData } from "../../domain/models/StepData";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IArrowAdjustmentOrchestrator, AdjustmentTargetKey } from "$lib/features/create/shared/services/contracts/IArrowAdjustmentOrchestrator";
  import { selectedArrowState } from "$lib/features/create/shared/state/selected-arrow-state.svelte";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { getGlobalAdjustmentRepository } from "$lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton";
  import { globalAdjustmentVersion } from "$lib/shared/pictograph/arrow/positioning/global/state/global-adjustment-version.svelte";
  import { arrowAdjustmentUndoStack } from "$lib/shared/pictograph/arrow/positioning/global/state/ArrowAdjustmentUndoStack";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";

  const logger = createComponentLogger("ArrowAdjustmentPanel");

  interface Props {
    stepData: StepData;
    onStepDataUpdate: (updatedStepData: StepData) => void;
    onPushUndoSnapshot?: () => void;
  }

  let { stepData, onStepDataUpdate, onPushUndoSnapshot }: Props = $props();

  // Services
  let hapticService: IHapticFeedback | null = null;
  let adjustmentOrchestrator: IArrowAdjustmentOrchestrator | null = null;

  // Auto-save configuration
  const AUTO_SAVE_DELAY_MS = 1500;
  const SAVED_INDICATOR_DURATION_MS = 2000;

  // State
  let currentIncrement = $state(5);
  let hasUndoSnapshotForSession = $state(false);

  // Auto-save state
  type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved';
  let saveState = $state<SaveState>('idle');
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let savedIndicatorTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingSaveKey: string | null = null;

  // Derived
  const selectedArrow = $derived(selectedArrowState.selectedArrow);

  // Get prop types from selected arrow's motion data
  const thisPropType = $derived(
    selectedArrow?.motionData?.propType?.toLowerCase() || "staff"
  );
  const otherPropType = $derived.by(() => {
    if (!selectedArrow) return "staff";
    const otherColor = selectedArrow.color === "blue" ? "red" : "blue";
    const otherMotion = selectedArrow.pictographData?.motions?.[otherColor];
    return otherMotion?.propType?.toLowerCase() || "staff";
  });

  // Get default save layer from orchestrator
  const defaultSaveLayer = $derived.by((): 1 | 2 | 3 => {
    if (!adjustmentOrchestrator) return 1;
    return adjustmentOrchestrator.getDefaultSaveLayer(thisPropType, otherPropType);
  });

  // Get current adjustment via orchestrator's cascading lookup
  const cascadingResult = $derived.by(() => {
    const _ = globalAdjustmentVersion.version; // Trigger on version change
    if (!selectedArrow || !adjustmentOrchestrator) return null;
    return adjustmentOrchestrator.getCurrentAdjustment(selectedArrow, thisPropType, otherPropType);
  });

  const currentAdjustmentX = $derived(cascadingResult?.adjustment?.x ?? 0);
  const currentAdjustmentY = $derived(cascadingResult?.adjustment?.y ?? 0);
  const currentAdjustmentLayer = $derived(cascadingResult?.layer ?? null);
  const hasAdjustment = $derived(currentAdjustmentX !== 0 || currentAdjustmentY !== 0);

  // Reset state when selection changes
  $effect(() => {
    const _ = selectedArrow;
    hasUndoSnapshotForSession = false;
    clearTimers();
    saveState = 'idle';
    pendingSaveKey = null;
  });

  function clearTimers() {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    if (savedIndicatorTimer) {
      clearTimeout(savedIndicatorTimer);
      savedIndicatorTimer = null;
    }
  }

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

    if (["w", "a", "s", "d"].includes(key)) {
      event.preventDefault();
      handleWASDMovement(key as "w" | "a" | "s" | "d");
    }

    // Ctrl+Z: undo last adjustment (must be before plain Z check)
    if (key === "z" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleUndo();
      return;
    }

    if (key === "z" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      handleResetToDefault();
    }

    if (key === "escape") {
      event.preventDefault();
      selectedArrowState.clearSelection();
    }
  }

  async function handleWASDMovement(key: "w" | "a" | "s" | "d") {
    if (!selectedArrow || !adjustmentOrchestrator) return;

    // Push undo snapshot on first adjustment
    if (!hasUndoSnapshotForSession && onPushUndoSnapshot) {
      onPushUndoSnapshot();
      hasUndoSnapshotForSession = true;
    }

    const result = await adjustmentOrchestrator.applyWASDMovement(
      key,
      currentIncrement,
      selectedArrow,
      thisPropType,
      otherPropType
    );

    if (result.success) {
      hapticService?.trigger("selection");
      scheduleAutoSave(result.targetKey);
    }
  }

  function scheduleAutoSave(targetKey: AdjustmentTargetKey) {
    clearTimers();
    saveState = 'unsaved';
    pendingSaveKey = JSON.stringify(targetKey);

    autoSaveTimer = setTimeout(async () => {
      await performAutoSave(targetKey);
    }, AUTO_SAVE_DELAY_MS);
  }

  async function performAutoSave(targetKey: AdjustmentTargetKey) {
    const expectedKey = JSON.stringify(targetKey);
    if (pendingSaveKey !== expectedKey) {
      saveState = 'idle';
      return;
    }

    const repo = getGlobalAdjustmentRepository();
    if (!repo) {
      saveState = 'idle';
      return;
    }

    const currentAdjustment = repo.getAdjustment(targetKey);
    const adjustmentX = currentAdjustment?.x ?? 0;
    const adjustmentY = currentAdjustment?.y ?? 0;

    if (adjustmentX === 0 && adjustmentY === 0) {
      saveState = 'idle';
      return;
    }

    try {
      saveState = 'saving';
      logger.log(`Auto-saving to Firestore: (${adjustmentX}, ${adjustmentY})`);

      await repo.saveAdjustment({
        ...targetKey,
        adjustmentX,
        adjustmentY,
      });

      saveState = 'saved';
      hapticService?.trigger("success");

      savedIndicatorTimer = setTimeout(() => {
        if (saveState === 'saved') {
          saveState = 'idle';
        }
      }, SAVED_INDICATOR_DURATION_MS);
    } catch (error) {
      logger.error("Auto-save failed:", error);
      saveState = 'idle';
      hapticService?.trigger("error");
    }
  }

  async function handleResetToDefault() {
    if (!selectedArrow || !adjustmentOrchestrator) return;

    if (onPushUndoSnapshot) {
      onPushUndoSnapshot();
    }

    hapticService?.trigger("warning");
    clearTimers();
    saveState = 'idle';

    const layerToDelete = currentAdjustmentLayer ?? defaultSaveLayer;
    const deletedKey = adjustmentOrchestrator.resetToDefault(
      selectedArrow,
      thisPropType,
      layerToDelete,
      otherPropType
    );

    // Fire-and-forget Firestore delete
    if (deletedKey) {
      const repo = getGlobalAdjustmentRepository();
      repo?.deleteAdjustment(deletedKey).catch((error: unknown) => {
        logger.warn("Failed to delete from Firestore:", error);
      });
    }
  }

  async function handleUndo() {
    const entry = arrowAdjustmentUndoStack.pop();
    if (!entry) return;

    const repo = getGlobalAdjustmentRepository();
    if (!repo) return;

    hapticService?.trigger("selection");

    // Restore previous value locally
    if (entry.previousX === 0 && entry.previousY === 0) {
      repo.deleteAdjustmentLocal(entry.targetKey);
    } else {
      repo.saveAdjustmentLocal({
        ...entry.targetKey,
        adjustmentX: entry.previousX,
        adjustmentY: entry.previousY,
      });
    }

    // Clear pictograph cache and trigger re-render
    pictographPreparer.clearCache();
    globalAdjustmentVersion.increment();

    // Persist to Firestore (fire-and-forget)
    try {
      if (entry.previousX === 0 && entry.previousY === 0) {
        await repo.deleteAdjustment(entry.targetKey);
      } else {
        await repo.saveAdjustment({
          ...entry.targetKey,
          adjustmentX: entry.previousX,
          adjustmentY: entry.previousY,
        });
      }
    } catch (error) {
      logger.warn("Failed to persist undo to Firestore:", error);
    }

    // Clear any pending auto-save since we just manually reverted
    clearTimers();
    saveState = 'idle';
  }

  function handleClearSelection() {
    selectedArrowState.clearSelection();
    hapticService?.trigger("selection");
  }

  onMount(() => {
    try {
      hapticService = container.items.hapticFeedback;
      adjustmentOrchestrator = container.items.arrowAdjustmentOrchestrator;
    } catch (error) {
      logger.error("Failed to initialize services:", error);
    }

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
      clearTimers();
    };
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

  <!-- Layer and prop indicator -->
  <span
    class="layer-badge"
    class:layer-2={defaultSaveLayer === 2}
    class:layer-3={defaultSaveLayer === 3}
    title={defaultSaveLayer === 3
      ? `Combo-specific adjustment for ${thisPropType}+${otherPropType}`
      : `Prop-specific adjustment for ${thisPropType}`}
  >
    L{defaultSaveLayer}·{thisPropType}{#if defaultSaveLayer === 3}+{otherPropType}{/if}
  </span>

  <!-- Increment indicator -->
  <span class="increment-badge">{currentIncrement}px</span>

  <!-- Save state indicator -->
  {#if saveState !== 'idle'}
    <span
      class="save-indicator"
      class:unsaved={saveState === 'unsaved'}
      class:saving={saveState === 'saving'}
      class:saved={saveState === 'saved'}
      title={saveState === 'unsaved' ? 'Unsaved - will auto-save shortly' :
             saveState === 'saving' ? 'Saving...' :
             'Saved to Firestore'}
    >
      {#if saveState === 'unsaved'}
        <i class="fas fa-circle" aria-hidden="true"></i>
      {:else if saveState === 'saving'}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      {:else}
        <i class="fas fa-check" aria-hidden="true"></i>
      {/if}
    </span>
  {/if}

  <!-- Undo button (Ctrl+Z) -->
  {#if arrowAdjustmentUndoStack.size > 0}
    <button
      class="undo-btn"
      onclick={handleUndo}
      title="Undo last adjustment (Ctrl+Z) — {arrowAdjustmentUndoStack.size} in stack"
      aria-label="Undo last arrow adjustment"
    >
      <i class="fas fa-undo-alt" aria-hidden="true"></i>
      <span class="undo-count">{arrowAdjustmentUndoStack.size}</span>
    </button>
  {/if}

  <!-- Reset to default button -->
  {#if hasAdjustment}
    <button
      class="reset-btn"
      onclick={handleResetToDefault}
      title="Reset to default (Z)"
      aria-label="Reset arrow to default position"
      disabled={saveState === 'saving'}
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

  .layer-badge {
    font-size: 0.6rem;
    font-weight: 500;
    padding: 2px 5px;
    border-radius: 3px;
    text-transform: lowercase;
  }

  .layer-badge.layer-2 {
    color: #22d3d8;
    background: rgba(34, 211, 216, 0.2);
  }

  .layer-badge.layer-3 {
    color: #c084fc;
    background: rgba(192, 132, 252, 0.2);
  }

  .increment-badge {
    font-size: 0.65rem;
    font-weight: 600;
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.2);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .save-indicator {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.5rem;
    border-radius: 50%;
    transition: all var(--duration-normal) ease;
  }

  .save-indicator.unsaved {
    color: #fbbf24;
    animation: pulse 1s ease-in-out infinite;
  }

  .save-indicator.saving {
    color: #60a5fa;
  }

  .save-indicator.saved {
    color: #22c55e;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .undo-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 20px;
    border-radius: 10px;
    border: 1px solid rgba(96, 165, 250, 0.3);
    background: rgba(96, 165, 250, 0.1);
    color: #60a5fa;
    cursor: pointer;
    font-size: 0.6rem;
    padding: 0 6px;
    transition: all var(--duration-fast) ease;
  }

  .undo-btn:hover {
    background: rgba(96, 165, 250, 0.2);
    color: #93bbfd;
  }

  .undo-count {
    font-family: "SF Mono", Monaco, monospace;
    font-size: 0.6rem;
    font-weight: 600;
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
    transition: all var(--duration-fast) ease;
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

  @media (prefers-reduced-motion: reduce) {
    .unsaved {
      animation: none;
    }
  }
</style>
