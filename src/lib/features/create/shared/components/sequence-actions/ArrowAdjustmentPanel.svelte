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
  import type { IKeyboardArrowAdjuster } from "$lib/features/create/shared/services/contracts/IKeyboardArrowAdjuster";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IGridModeDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridModeDeriver";
  import type { ITurnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
  import type { IScreenSpaceAdjustmentTransformer } from "$lib/shared/pictograph/arrow/positioning/calculation/services/contracts/IScreenSpaceAdjustmentTransformer";
  import type { IArrowAdjustmentCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/contracts/IArrowAdjustmentCalculator";
  import type { IArrowLocationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/contracts/IArrowLocationCalculator";
  import { Point } from "fabric";
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
    stepData: StepData;
    onStepDataUpdate: (updatedStepData: StepData) => void;
    onPushUndoSnapshot?: () => void;
  }

  let { stepData, onStepDataUpdate, onPushUndoSnapshot }: Props = $props();

  // Services
  let hapticService: IHapticFeedback | null = null;
  let keyboardAdjustmentService: IKeyboardArrowAdjuster | null = null;
  let keyGenerator: GlobalAdjustmentKeyGenerator | null = null;
  let pictographPreparer: IPictographPreparer | null = null;
  let screenSpaceTransformer: IScreenSpaceAdjustmentTransformer | null = null;
  let arrowAdjustmentCalculator: IArrowAdjustmentCalculator | null = null;
  let arrowLocationCalculator: IArrowLocationCalculator | null = null;
  let gridModeDeriver: IGridModeDeriver | null = null;

  // Auto-save configuration
  const AUTO_SAVE_DELAY_MS = 1500; // 1.5 seconds after last movement
  const SAVED_INDICATOR_DURATION_MS = 2000; // Show "saved" checkmark for 2 seconds

  // State
  let currentIncrement = $state(5);
  let hasUndoSnapshotForSession = $state(false);

  // Auto-save state: 'idle' | 'unsaved' | 'saving' | 'saved'
  type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved';
  let saveState = $state<SaveState>('idle');
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let savedIndicatorTimer: ReturnType<typeof setTimeout> | null = null;

  // Track the pending save key to handle selection changes
  let pendingSaveKey: string | null = null;

  // Local working copy of beat data - updated synchronously to avoid race conditions
  // between rapid keystrokes and Svelte's reactive prop updates
  let workingStepData = $state<StepData | null>(null);

  // Sync working state with prop when prop changes from external sources
  $effect(() => {
    if (stepData !== null) {
      workingStepData = stepData;
    }
  });

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

  // Determine the default layer for saving based on prop types
  // - Both staff: Layer 1 (base)
  // - Same non-staff props: Layer 2 (prop-specific)
  // - Different props: Layer 2 (prop-specific - each hand saves to its own layer 2)
  const defaultSaveLayer = $derived.by((): 1 | 2 | 3 => {
    if (thisPropType === "staff" && otherPropType === "staff") {
      return 1; // Base layer for staff
    }
    return 2; // Prop-specific layer for non-staff
  });

  // Calculate current adjustment values from GLOBAL REPO using cascading lookup
  // This depends on globalAdjustmentVersion to ensure reactivity when adjustments change
  const cascadingResult = $derived.by(() => {
    // Depend on version to trigger re-calculation when adjustments change
    const _ = globalAdjustmentVersion.version;

    if (!selectedArrow || !keyGenerator) return null;
    const repo = getGlobalAdjustmentRepository();
    if (!repo) return null;

    // Generate BASE key (layer 1) for cascading lookup
    const baseKey = keyGenerator.generateKey(
      selectedArrow.motionData,
      selectedArrow.pictographData,
      selectedArrow.color
    );

    // Use cascading lookup to find adjustment at any layer
    return repo.getAdjustmentCascading(baseKey, thisPropType, otherPropType);
  });

  const currentAdjustmentX = $derived(cascadingResult?.adjustment?.x ?? 0);
  const currentAdjustmentY = $derived(cascadingResult?.adjustment?.y ?? 0);
  const currentAdjustmentLayer = $derived(cascadingResult?.layer ?? null);

  // Check if there's an adjustment to reset
  const hasAdjustment = $derived(currentAdjustmentX !== 0 || currentAdjustmentY !== 0);

  // Reset state when selection changes
  $effect(() => {
    // Track selection changes to reset flags and timers
    const _ = selectedArrow;
    hasUndoSnapshotForSession = false;

    // Clear any pending auto-save when selection changes
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    if (savedIndicatorTimer) {
      clearTimeout(savedIndicatorTimer);
      savedIndicatorTimer = null;
    }
    saveState = 'idle';
    pendingSaveKey = null;
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
    if (!selectedArrowState.selectedArrow || !workingStepData || !keyboardAdjustmentService || !keyGenerator) {
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

    // Calculate WASD direction (screen space - what user wants to see)
    const screenSpaceAdjustment = keyboardAdjustmentService.calculateAdjustment(key, currentIncrement);

    // IMPORTANT: Calculate the arrow location properly using the ArrowLocationCalculator
    // The motionData.arrowLocation often defaults to NORTH when not explicitly set,
    // which breaks the transformation for different pictograph variants.
    // We must calculate it fresh based on motion type and start/end locations.
    let arrowLocation = motionData.arrowLocation;
    if (arrowLocationCalculator) {
      arrowLocation = arrowLocationCalculator.calculateLocation(motionData, pictographData);
    }

    // Transform screen-space adjustment to reference value using the INVERSE transformation.
    // This ensures that pressing W (up) on ANY variant moves the arrow UP on that variant's screen.
    // The stored reference value will then produce correct movements for ALL other variants.
    let referenceAdjustment = screenSpaceAdjustment;
    if (screenSpaceTransformer) {
      referenceAdjustment = screenSpaceTransformer.transformToReference(
        new Point(screenSpaceAdjustment.x, screenSpaceAdjustment.y),
        motionData,
        arrowLocation
      );
    }

    // Build key with prop types for the target save layer
    // - Layer 1 (staff): no propType
    // - Layer 2 (prop-specific): include propType
    const keyOptions = defaultSaveLayer === 1
      ? undefined // Layer 1: no prop types
      : { propType: thisPropType }; // Layer 2: include this prop's type

    const targetKey = keyGenerator.generateKey(motionData, pictographData, arrowColor, keyOptions);

    // Get current value - check global repo first, then fall back to special/default placement
    // This ensures we move from the arrow's CURRENT position, not from (0, 0)
    let currentX = 0;
    let currentY = 0;
    let baseSource = "default";

    const currentAdjustmentAtLayer = repo?.getAdjustment(targetKey);
    if (currentAdjustmentAtLayer) {
      // Global adjustment exists at this layer - use it
      currentX = currentAdjustmentAtLayer.x;
      currentY = currentAdjustmentAtLayer.y;
      baseSource = "global";
    } else {
      // No global adjustment - get the SAME base that rendering would use
      // IMPORTANT: Use ArrowAdjustmentCalculator.getBaseAdjustmentPublic() which matches
      // the exact code path rendering uses (special placement lookup with attributeKey + default fallback)
      try {
        // Use cascading lookup first (same as SpecialPlacer does internally)
        const baseKey = keyGenerator.generateKey(motionData, pictographData, arrowColor);
        const cascadingResult = repo?.getAdjustmentCascading(baseKey, thisPropType, otherPropType);

        if (cascadingResult) {
          // Found at a different layer via cascading
          currentX = cascadingResult.adjustment.x;
          currentY = cascadingResult.adjustment.y;
          baseSource = `cascading-layer${cascadingResult.layer}`;
        } else if (arrowAdjustmentCalculator) {
          // No global at any layer - use the SAME lookup path as rendering
          // This includes proper attributeKey generation and default fallback
          const baseAdjustment = await arrowAdjustmentCalculator.getBaseAdjustmentPublic(
            pictographData,
            motionData,
            pictographData.letter || "",
            arrowColor
          );
          currentX = baseAdjustment.x;
          currentY = baseAdjustment.y;
          baseSource = baseAdjustment.x === 0 && baseAdjustment.y === 0 ? "none" : "calculator";
        } else {
          // Fallback if calculator not available
          currentX = 0;
          currentY = 0;
          baseSource = "none";
        }
      } catch (error) {
        logger.warn("Failed to get base adjustment, using (0, 0):", error);
        currentX = 0;
        currentY = 0;
        baseSource = "error";
      }
    }

    // Calculate new total using reference-transformed adjustment
    const newX = currentX + referenceAdjustment.x;
    const newY = currentY + referenceAdjustment.y;

    // Save to global repo locally (NOT to Firestore) - this is the single source of truth
    // All pictographs will read from here via cascading lookup
    if (repo) {
      try {
        const input: GlobalArrowAdjustmentInput = {
          ...targetKey,
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

    // Schedule debounced auto-save
    scheduleAutoSave(targetKey);
  }

  /**
   * Schedule an auto-save after the debounce delay.
   * Clears any existing timer and starts a new one.
   */
  function scheduleAutoSave(targetKey: { gridMode: string; oriKey: string; letter: string; turnsTuple: string; arrowKey: string; propType?: string }) {
    // Clear existing timers
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    if (savedIndicatorTimer) {
      clearTimeout(savedIndicatorTimer);
    }

    // Mark as unsaved and store the key we'll save
    saveState = 'unsaved';
    pendingSaveKey = JSON.stringify(targetKey);

    // Schedule auto-save
    autoSaveTimer = setTimeout(async () => {
      await performAutoSave(targetKey);
    }, AUTO_SAVE_DELAY_MS);
  }

  /**
   * Perform the actual Firestore save.
   */
  async function performAutoSave(targetKey: { gridMode: string; oriKey: string; letter: string; turnsTuple: string; arrowKey: string; propType?: string }) {
    // Safety check: ensure the pending save still matches what we scheduled
    // This prevents saving to wrong key if selection changed during debounce
    const expectedKey = JSON.stringify(targetKey);
    if (pendingSaveKey !== expectedKey) {
      saveState = 'idle';
      return;
    }

    const repo = getGlobalAdjustmentRepository();
    if (!repo) {
      logger.warn("Cannot auto-save: missing repository");
      saveState = 'idle';
      return;
    }

    // Get current adjustment at this layer
    const currentAdjustment = repo.getAdjustment(targetKey);
    const adjustmentX = currentAdjustment?.x ?? 0;
    const adjustmentY = currentAdjustment?.y ?? 0;

    // Don't save if adjustment is (0, 0) - that's the default
    if (adjustmentX === 0 && adjustmentY === 0) {
      saveState = 'idle';
      return;
    }

    try {
      saveState = 'saving';

      const input: GlobalArrowAdjustmentInput = {
        ...targetKey,
        adjustmentX,
        adjustmentY,
      };

      logger.log(`Auto-saving to Firestore: (${adjustmentX}, ${adjustmentY})`);
      await repo.saveAdjustment(input);

      // Show saved indicator
      saveState = 'saved';
      hapticService?.trigger("success");

      // Clear saved indicator after delay
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
    if (!selectedArrowState.selectedArrow || !keyGenerator) {
      return;
    }

    // Push undo snapshot before reset
    if (onPushUndoSnapshot) {
      onPushUndoSnapshot();
    }

    const arrowColor = selectedArrowState.selectedArrow.color;
    logger.log(`Resetting ${arrowColor} arrow to default position`);

    hapticService?.trigger("warning");

    // Clear any pending auto-save
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    saveState = 'idle';

    // Delete from local cache for immediate preview
    deleteFromGlobalLocally();

    // Also delete from Firestore
    const pictographData = selectedArrowState.selectedArrow.pictographData;
    const motionData = selectedArrowState.selectedArrow.motionData;
    const layerToDelete = currentAdjustmentLayer ?? defaultSaveLayer;
    const keyOptions = layerToDelete === 1
      ? undefined
      : { propType: thisPropType };
    const key = keyGenerator.generateKey(motionData, pictographData, arrowColor, keyOptions);

    // Fire-and-forget Firestore delete (don't block UI)
    const repo = getGlobalAdjustmentRepository();
    if (repo) {
      repo.deleteAdjustment(key).catch((error: unknown) => {
        logger.warn("Failed to delete from Firestore:", error);
      });
    }
  }

  /**
   * Delete adjustment from the global repository's in-memory cache.
   * This does NOT persist to Firestore - it's for live preview only.
   * Deletes from the layer the current adjustment was found at.
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
      // Delete from the layer where we found the current adjustment
      // If no adjustment exists, delete from the default save layer
      const layerToDelete = currentAdjustmentLayer ?? defaultSaveLayer;
      const keyOptions = layerToDelete === 1
        ? undefined // Layer 1: no prop types
        : { propType: thisPropType }; // Layer 2: include this prop's type

      const key = keyGenerator.generateKey(motionData, pictographData, arrowColor, keyOptions);

      logger.log(`Deleting from Layer ${layerToDelete} (${thisPropType})`);

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

  function handleClearSelection() {
    selectedArrowState.clearSelection();
    hapticService?.trigger("selection");
  }

  onMount(() => {
    try {
      hapticService = container.items.hapticFeedback;
      keyboardAdjustmentService = container.items.keyboardArrowAdjuster;
      pictographPreparer = container.items.pictographPreparer as IPictographPreparer;
      screenSpaceTransformer = container.items.screenSpaceAdjustmentTransformer as IScreenSpaceAdjustmentTransformer;
      arrowAdjustmentCalculator = container.items.arrowAdjustmentCalculator as IArrowAdjustmentCalculator;
      arrowLocationCalculator = container.items.arrowLocationCalculator as IArrowLocationCalculator;
      gridModeDeriver = container.items.gridModeDeriver as IGridModeDeriver;

      // Initialize key generator with required dependencies
      const turnsTupleGenerator = container.items.turnsTupleGenerator as ITurnsTupleGenerator;
      keyGenerator = new GlobalAdjustmentKeyGenerator(gridModeDeriver, turnsTupleGenerator);
    } catch (error) {
      logger.error("Failed to initialize services:", error);
    }

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);

      // Clean up timers
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
      if (savedIndicatorTimer) {
        clearTimeout(savedIndicatorTimer);
      }
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
    class:layer-1={defaultSaveLayer === 1}
    class:layer-2={defaultSaveLayer === 2}
    title={defaultSaveLayer === 1
      ? "Base layer (staff) - applies to all props"
      : `Prop-specific layer for ${thisPropType}`}
  >
    L{defaultSaveLayer}·{thisPropType}
  </span>

  <!-- Increment indicator -->
  <span class="increment-badge">{currentIncrement}px</span>

  <!-- Save state indicator (auto-save) -->
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

  .layer-badge.layer-1 {
    /* Base layer (staff) - muted gray */
    color: #a3a3a3;
    background: rgba(163, 163, 163, 0.2);
  }

  .layer-badge.layer-2 {
    /* Prop-specific layer - cyan/teal */
    color: #22d3d8;
    background: rgba(34, 211, 216, 0.2);
  }

  .increment-badge {
    font-size: 0.65rem;
    font-weight: 600;
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.2);
    padding: 2px 6px;
    border-radius: 3px;
  }

  /* Save state indicator (auto-save feedback) */
  .save-indicator {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.5rem;
    border-radius: 50%;
    transition: all 0.2s ease;
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

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .unsaved {
      animation: none;
    }
  }
</style>
