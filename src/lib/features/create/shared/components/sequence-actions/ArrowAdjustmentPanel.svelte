<!--
  ArrowAdjustmentPanel.svelte

  Inline panel for adjusting arrow positions using WASD keys.
  Appears in the BeatEditorPanel when an arrow is selected.

  Features:
  - WASD keyboard controls for arrow movement (5/20/200px increments)
  - Display of lookup keys for debugging
  - Current adjustment values
  - Auto-persists changes on every keystroke
-->
<script lang="ts">
  import type { BeatData } from "../../domain/models/BeatData";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { IKeyboardArrowAdjuster } from "$lib/features/create/shared/services/contracts/IKeyboardArrowAdjuster";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { ITurnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
  import type { IGridModeDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridModeDeriver";
  import { SpecialPlacementOriKeyGenerator } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/implementations/SpecialPlacementOriKeyGenerator";
  import { selectedArrowState } from "$lib/features/create/shared/state/selected-arrow-state.svelte";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  interface Props {
    beatData: BeatData;
    onBeatDataUpdate: (updatedBeatData: BeatData) => void;
  }

  let { beatData, onBeatDataUpdate }: Props = $props();

  // Services
  let hapticService: IHapticFeedback | null = null;
  let keyboardAdjustmentService: IKeyboardArrowAdjuster | null = null;

  // State
  let currentIncrement = $state(5);
  let lastAdjustment = $state({ x: 0, y: 0 });

  // Lookup keys for debugging
  let lookupKeys = $state<{
    gridMode: string;
    oriKey: string;
    turnsTuple: string;
  } | null>(null);

  // Derived
  const selectedArrow = $derived(selectedArrowState.selectedArrow);

  // Calculate current adjustment values from the selected arrow
  const currentAdjustmentX = $derived.by(() => {
    if (!selectedArrow || !beatData?.motions) return 0;
    const motion = beatData.motions[selectedArrow.color as MotionColor];
    return motion?.arrowPlacementData?.manualAdjustmentX ?? 0;
  });

  const currentAdjustmentY = $derived.by(() => {
    if (!selectedArrow || !beatData?.motions) return 0;
    const motion = beatData.motions[selectedArrow.color as MotionColor];
    return motion?.arrowPlacementData?.manualAdjustmentY ?? 0;
  });

  // Calculate lookup keys when beatData changes
  $effect(() => {
    if (beatData) {
      calculateLookupKeys();
    }
  });

  function calculateLookupKeys() {
    if (!beatData) return;

    try {
      const tupleGenerator = container.items.turnsTupleGenerator;
      const gridModeDeriver = container.items.gridModeDeriver;
      const oriKeyGenerator = new SpecialPlacementOriKeyGenerator();

      const pictographData: PictographData = {
        id: beatData.id,
        letter: beatData.letter,
        startPosition: beatData.startPosition,
        endPosition: beatData.endPosition,
        motions: beatData.motions,
      };

      const blueMotion = beatData.motions?.[MotionColor.BLUE];
      const redMotion = beatData.motions?.[MotionColor.RED];

      // Grid mode
      let gridMode = "diamond";
      if (blueMotion && redMotion) {
        gridMode = gridModeDeriver.deriveGridMode(blueMotion, redMotion);
      }

      // Orientation key
      let oriKey = "unknown";
      if (blueMotion) {
        oriKey = oriKeyGenerator.generateOrientationKey(blueMotion, pictographData);
      }

      // Turns tuple
      const turnsTuple = tupleGenerator.generateTurnsTuple(pictographData);

      lookupKeys = {
        gridMode,
        oriKey,
        turnsTuple: turnsTuple.join(","),
      };
    } catch (err) {
      console.error("Failed to calculate lookup keys:", err);
      lookupKeys = null;
    }
  }

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
      console.log("[ArrowAdjustmentPanel] WASD key pressed:", key);
      event.preventDefault();
      handleWASDMovement(key as "w" | "a" | "s" | "d");
    }

    // Escape to deselect arrow
    if (key === "escape") {
      event.preventDefault();
      selectedArrowState.clearSelection();
    }
  }

  function handleWASDMovement(key: "w" | "a" | "s" | "d") {
    console.log("[ArrowAdjustmentPanel] handleWASDMovement called", {
      hasSelectedArrow: !!selectedArrowState.selectedArrow,
      hasBeatData: !!beatData,
      hasService: !!keyboardAdjustmentService,
    });

    if (!selectedArrowState.selectedArrow || !beatData || !keyboardAdjustmentService) {
      console.log("[ArrowAdjustmentPanel] Early return - missing:", {
        selectedArrow: !selectedArrowState.selectedArrow,
        beatData: !beatData,
        service: !keyboardAdjustmentService,
      });
      return;
    }

    const adjustment = keyboardAdjustmentService.calculateAdjustment(key, currentIncrement);
    lastAdjustment = adjustment;
    console.log("[ArrowAdjustmentPanel] Calculated adjustment:", adjustment);

    const updatedBeatData = keyboardAdjustmentService.handleWASDMovement(
      key,
      currentIncrement,
      selectedArrowState.selectedArrow,
      beatData
    );

    console.log("[ArrowAdjustmentPanel] Calling onBeatDataUpdate with updated data");
    onBeatDataUpdate(updatedBeatData);
    hapticService?.trigger("selection");
  }

  function handleClearSelection() {
    selectedArrowState.clearSelection();
    hapticService?.trigger("selection");
  }

  onMount(() => {
    console.log("[ArrowAdjustmentPanel] Mounting...");
    try {
      hapticService = container.items.hapticFeedback;
      keyboardAdjustmentService = container.items.keyboardArrowAdjuster;
      console.log("[ArrowAdjustmentPanel] Services initialized:", {
        haptic: !!hapticService,
        keyboardAdjuster: !!keyboardAdjustmentService,
      });
    } catch (error) {
      console.error("[ArrowAdjustmentPanel] Failed to initialize services:", error);
    }

    // Add keyboard listener
    console.log("[ArrowAdjustmentPanel] Adding keyboard listener");
    window.addEventListener("keydown", handleKeydown);
    return () => {
      console.log("[ArrowAdjustmentPanel] Removing keyboard listener");
      window.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

<div class="adjustment-panel">
  <!-- Header with selected arrow info -->
  <div class="panel-header">
    <div class="arrow-info">
      {#if selectedArrow}
        <span
          class="arrow-color"
          class:blue={selectedArrow.color === "blue"}
          class:red={selectedArrow.color === "red"}
        >
          {selectedArrow.color}
        </span>
        <span class="arrow-type">{selectedArrow.motionData.motionType}</span>
      {/if}
    </div>
    <button
      class="clear-btn"
      onclick={handleClearSelection}
      title="Deselect arrow (Esc)"
      aria-label="Deselect arrow"
    >
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>

  <!-- Current adjustments -->
  <div class="adjustments-row">
    <div class="adjustment-value">
      <span class="label">X</span>
      <span class="value">{currentAdjustmentX}</span>
    </div>
    <div class="adjustment-value">
      <span class="label">Y</span>
      <span class="value">{currentAdjustmentY}</span>
    </div>
    <div class="increment-badge">
      <span class="increment">{currentIncrement}px</span>
    </div>
  </div>

  <!-- Lookup keys (compact) -->
  {#if lookupKeys}
    <div class="keys-row">
      <code class="key">{lookupKeys.gridMode}</code>
      <code class="key">{lookupKeys.oriKey}</code>
      <code class="key highlight">{lookupKeys.turnsTuple}</code>
    </div>
  {/if}

  <!-- Keyboard hint -->
  <div class="keyboard-hint">
    <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
    <span class="hint-text">move</span>
    <kbd>Shift</kbd>
    <span class="hint-text">20px</span>
    <kbd>Ctrl</kbd>
    <span class="hint-text">200px</span>
  </div>
</div>

<style>
  .adjustment-panel {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 15, 25, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 10px 14px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .arrow-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .arrow-color {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .arrow-color.blue {
    background: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  .arrow-color.red {
    background: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .arrow-type {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
    text-transform: lowercase;
  }

  .clear-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
    color: var(--theme-text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .adjustments-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .adjustment-value {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(0, 0, 0, 0.3);
    padding: 4px 8px;
    border-radius: 4px;
  }

  .adjustment-value .label {
    font-size: 0.7rem;
    color: var(--theme-text-dim);
    font-weight: 500;
  }

  .adjustment-value .value {
    font-family: "SF Mono", Monaco, monospace;
    font-size: 0.8rem;
    color: white;
    min-width: 40px;
    text-align: right;
  }

  .increment-badge {
    margin-left: auto;
    background: rgba(251, 191, 36, 0.2);
    border: 1px solid rgba(251, 191, 36, 0.3);
    padding: 2px 8px;
    border-radius: 4px;
  }

  .increment-badge .increment {
    font-size: 0.75rem;
    font-weight: 600;
    color: #fbbf24;
  }

  .keys-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .key {
    font-size: 0.7rem;
    font-family: "SF Mono", Monaco, monospace;
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 3px;
    color: #67e8f9;
  }

  .key.highlight {
    background: rgba(6, 182, 212, 0.15);
    color: #22d3ee;
    font-weight: 600;
  }

  .keyboard-hint {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    opacity: 0.7;
  }

  kbd {
    padding: 2px 5px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-family: monospace;
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .hint-text {
    font-size: 0.65rem;
    color: var(--theme-text-dim);
    margin-right: 6px;
  }
</style>
