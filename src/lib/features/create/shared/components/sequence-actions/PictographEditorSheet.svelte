<!--
  PictographEditorSheet.svelte

  Admin-only editor for adjusting arrow positions and rotation overrides.
  Combines adjustment features with lookup key display for debugging.

  Features:
  - WASD keyboard controls for arrow movement
  - Rotation override toggle (add/remove from localStorage)
  - Lookup keys display (grid mode, ori key, turns tuple, rotation override keys)
  - Clickable/selectable arrows
-->
<script lang="ts">
  import type { BeatData } from "../../domain/models/BeatData";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { IKeyboardArrowAdjuster } from "$lib/features/create/shared/services/contracts/IKeyboardArrowAdjuster";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { ITurnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
  import type { IGridModeDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridModeDeriver";
  import type { IRotationAngleOverrideKeyGenerator } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/implementations/RotationAngleOverrideKeyGenerator";
  import { SpecialPlacementOriKeyGenerator } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/implementations/SpecialPlacementOriKeyGenerator";
  import { selectedArrowState } from "$lib/features/create/shared/state/selected-arrow-state.svelte";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import RotationOverrideButton from "$lib/features/create/edit/components/RotationOverrideButton.svelte";

  interface Props {
    isOpen: boolean;
    beatData: BeatData | null;
    onClose: () => void;
    onBeatDataUpdate?: (updatedBeatData: BeatData) => void;
  }

  let { isOpen, beatData, onClose, onBeatDataUpdate }: Props = $props();

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
    blueRotationOverrideKey: string | null;
    redRotationOverrideKey: string | null;
  } | null>(null);

  // Derived
  const selectedArrow = $derived(selectedArrowState.selectedArrow);

  // Calculate lookup keys when beatData changes
  $effect(() => {
    if (isOpen && beatData) {
      calculateLookupKeys();
    } else if (!isOpen) {
      lookupKeys = null;
      selectedArrowState.clearSelection();
    }
  });

  function calculateLookupKeys() {
    if (!beatData) return;

    try {
      const tupleGenerator = container.items.turnsTupleGenerator;
      const gridModeDeriver = container.items.gridModeDeriver;
      const rotationKeyGenerator = container.items.rotationAngleOverrideKeyGenerator;
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
        oriKey = oriKeyGenerator.generateOrientationKey(
          blueMotion,
          pictographData
        );
      }

      // Turns tuple
      const turnsTuple = tupleGenerator.generateTurnsTuple(pictographData);

      // Rotation override keys
      let blueRotationOverrideKey: string | null = null;
      let redRotationOverrideKey: string | null = null;

      if (blueMotion) {
        const motionType = blueMotion.motionType?.toLowerCase();
        if (motionType === "static" || motionType === "dash") {
          blueRotationOverrideKey =
            rotationKeyGenerator.generateRotationAngleOverrideKey(
              blueMotion,
              pictographData
            );
        }
      }

      if (redMotion) {
        const motionType = redMotion.motionType?.toLowerCase();
        if (motionType === "static" || motionType === "dash") {
          redRotationOverrideKey =
            rotationKeyGenerator.generateRotationAngleOverrideKey(
              redMotion,
              pictographData
            );
        }
      }

      lookupKeys = {
        gridMode,
        oriKey,
        turnsTuple,
        blueRotationOverrideKey,
        redRotationOverrideKey,
      };
    } catch (err) {
      console.error("Failed to calculate lookup keys:", err);
      lookupKeys = null;
    }
  }

  // Keyboard handler
  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    const key = event.key.toLowerCase();

    // Close on Escape
    if (key === "escape") {
      event.preventDefault();
      handleClose();
      return;
    }

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
  }

  function handleWASDMovement(key: "w" | "a" | "s" | "d") {
    if (
      !selectedArrowState.selectedArrow ||
      !beatData ||
      !keyboardAdjustmentService
    ) {
      return;
    }

    const adjustment = keyboardAdjustmentService.calculateAdjustment(
      key,
      currentIncrement
    );
    lastAdjustment = adjustment;

    const updatedBeatData = keyboardAdjustmentService.handleWASDMovement(
      key,
      currentIncrement,
      selectedArrowState.selectedArrow,
      beatData
    );

    onBeatDataUpdate?.(updatedBeatData);
    hapticService?.trigger("selection");
  }

  function handleClose() {
    selectedArrowState.clearSelection();
    hapticService?.trigger("selection");
    onClose();
  }

  function copyLookupKeys() {
    if (!lookupKeys) return;
    const text = `Grid Mode: ${lookupKeys.gridMode}
Ori Key: ${lookupKeys.oriKey}
Turns Tuple: ${lookupKeys.turnsTuple}
Blue Rot Key: ${lookupKeys.blueRotationOverrideKey ?? "N/A"}
Red Rot Key: ${lookupKeys.redRotationOverrideKey ?? "N/A"}`;
    navigator.clipboard.writeText(text);
  }

  onMount(() => {
    try {
      hapticService = container.items.hapticFeedback;
      keyboardAdjustmentService = container.items.keyboardArrowAdjuster;
    } catch (error) {
      console.error("[PictographEditor] Failed to initialize services:", error);
    }
  });

  // Keyboard listener
  $effect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

<Drawer
  {isOpen}
  labelledBy="editor-sheet-title"
  onclose={handleClose}
  closeOnBackdrop={true}
  showHandle={true}
  placement="bottom"
  class="pictograph-editor-sheet"
>
  <div class="editor-sheet">
    <!-- Header -->
    <header class="sheet-header">
      <div class="header-left">
        <i class="fas fa-pen-ruler" aria-hidden="true"></i>
        <h2 id="editor-sheet-title">Pictograph Editor</h2>
        {#if beatData?.letter}
          <span class="letter-badge">{beatData.letter}</span>
        {/if}
        <span class="admin-badge">Admin</span>
      </div>
      <button class="close-btn" onclick={handleClose} aria-label="Close">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </header>

    <div class="sheet-body">
      <!-- Pictograph Display -->
      <div class="pictograph-section">
        {#if beatData && !beatData.isBlank}
          <PictographContainer
            pictographData={beatData}
            arrowsClickable={true}
            disableTransitions={true}
          />
        {:else}
          <div class="no-pictograph">
            <i class="fas fa-crosshairs" aria-hidden="true"></i>
            <p>No pictograph selected</p>
          </div>
        {/if}
      </div>

      <!-- Controls Panel -->
      <div class="controls-panel">
        <!-- Selected Arrow Info -->
        <div class="control-section">
          <h3>Selected Arrow</h3>
          {#if selectedArrow}
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Color</span>
                <span
                  class="value"
                  class:blue={selectedArrow.color === "blue"}
                  class:red={selectedArrow.color === "red"}
                >
                  {selectedArrow.color}
                </span>
              </div>
              <div class="info-item">
                <span class="label">Type</span>
                <span class="value">{selectedArrow.motionData.motionType}</span>
              </div>
              <div class="info-item">
                <span class="label">Last Move</span>
                <span class="value mono">
                  ({lastAdjustment.x > 0 ? "+" : ""}{lastAdjustment.x}, {lastAdjustment.y >
                  0
                    ? "+"
                    : ""}{lastAdjustment.y})
                </span>
              </div>
            </div>
          {:else}
            <p class="hint">Click an arrow to select it</p>
          {/if}
        </div>

        <!-- Increment Display -->
        <div class="control-section increment-section">
          <h3>Movement</h3>
          <div class="increment-display">
            <span class="increment-value">{currentIncrement}px</span>
            <span class="increment-hint">
              {#if currentIncrement === 5}
                Default
              {:else if currentIncrement === 20}
                <kbd>Shift</kbd>
              {:else}
                <kbd>Shift</kbd>+<kbd>Ctrl</kbd>
              {/if}
            </span>
          </div>
        </div>

        <!-- Rotation Override -->
        {#if beatData && beatData.beatNumber >= 1}
          <div class="control-section">
            <h3>Rotation Override</h3>
            <div class="override-buttons">
              <RotationOverrideButton {beatData} arrowColor="blue" />
              <RotationOverrideButton {beatData} arrowColor="red" />
            </div>
          </div>
        {/if}

        <!-- Lookup Keys -->
        {#if lookupKeys}
          <div class="control-section lookup-section">
            <div class="section-header">
              <h3><i class="fas fa-key" aria-hidden="true"></i> Lookup Keys</h3>
              <button
                class="copy-btn"
                onclick={copyLookupKeys}
                title="Copy keys"
                aria-label="Copy lookup keys"
              >
                <i class="fas fa-copy" aria-hidden="true"></i>
              </button>
            </div>
            <div class="keys-grid">
              <div class="key-item">
                <span class="label">Grid</span>
                <code>{lookupKeys.gridMode}</code>
              </div>
              <div class="key-item">
                <span class="label">Ori</span>
                <code>{lookupKeys.oriKey}</code>
              </div>
              <div class="key-item highlight">
                <span class="label">Tuple</span>
                <code>{lookupKeys.turnsTuple}</code>
              </div>
              {#if lookupKeys.blueRotationOverrideKey}
                <div class="key-item blue">
                  <span class="label">Blue Key</span>
                  <code>{lookupKeys.blueRotationOverrideKey}</code>
                </div>
              {/if}
              {#if lookupKeys.redRotationOverrideKey}
                <div class="key-item red">
                  <span class="label">Red Key</span>
                  <code>{lookupKeys.redRotationOverrideKey}</code>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Keyboard Legend -->
        <div class="control-section keyboard-section">
          <h3>Keyboard</h3>
          <div class="keyboard-grid">
            <div class="key-hint">
              <div class="keys">
                <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
              </div>
              <span>Move arrow</span>
            </div>
            <div class="key-hint">
              <kbd>Shift</kbd>
              <span>20px</span>
            </div>
            <div class="key-hint">
              <kbd>Shift</kbd>+<kbd>Ctrl</kbd>
              <span>200px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</Drawer>

<style>
  :global(.bottom-sheet.pictograph-editor-sheet) {
    --sheet-max-height: 95vh;
    --sheet-bg: var(--sheet-bg-solid, rgba(20, 20, 30, 0.98));
  }

  .editor-sheet {
    display: flex;
    flex-direction: column;
    height: 90vh;
    max-height: 90vh;
  }

  /* Header */
  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-left i {
    color: var(--semantic-warning);
    font-size: 1.1rem;
  }

  .header-left h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: white;
  }

  .letter-badge {
    background: linear-gradient(135deg, #06b6d4, #0891b2);
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 700;
    color: white;
  }

  .admin-badge {
    background: linear-gradient(135deg, var(--semantic-warning), #d97706);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .close-btn {
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  /* Body */
  .sheet-body {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 320px;
    min-height: 0;
    overflow: hidden;
  }

  /* Pictograph Section */
  .pictograph-section {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.2);
    container-type: size;
  }

  .no-pictograph {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .no-pictograph i {
    font-size: 3rem;
    opacity: 0.5;
  }

  /* Controls Panel */
  .controls-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: rgba(0, 0, 0, 0.3);
    border-left: 1px solid var(--theme-stroke);
    overflow-y: auto;
  }

  .control-section {
    padding: 12px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .control-section h3 {
    margin: 0 0 10px 0;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .section-header h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-header h3 i {
    font-size: 0.7rem;
    color: #06b6d4;
  }

  /* Info Grid */
  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }

  .info-item .label {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  .info-item .value {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--theme-text);
  }

  .info-item .value.blue {
    color: var(--semantic-info);
  }

  .info-item .value.red {
    color: var(--semantic-error);
  }

  .info-item .value.mono {
    font-family: "SF Mono", Monaco, monospace;
  }

  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    padding: 12px;
  }

  /* Increment Section */
  .increment-section {
    background: rgba(251, 191, 36, 0.1);
    border-color: rgba(251, 191, 36, 0.2);
  }

  .increment-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .increment-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--semantic-warning);
  }

  .increment-hint {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Override Buttons */
  .override-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Lookup Keys Section */
  .lookup-section {
    background: rgba(6, 182, 212, 0.08);
    border-color: rgba(6, 182, 212, 0.2);
  }

  .copy-btn {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--theme-stroke-strong);
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 0.7rem;
    transition: all 0.15s ease;
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .keys-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .key-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
  }

  .key-item .label {
    font-size: 0.7rem;
    color: var(--theme-text-dim);
    text-transform: uppercase;
  }

  .key-item code {
    font-size: 0.75rem;
    font-family: "SF Mono", Monaco, monospace;
    color: #22d3ee;
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .key-item.highlight {
    background: rgba(6, 182, 212, 0.15);
  }

  .key-item.highlight code {
    color: #67e8f9;
    font-weight: 600;
  }

  .key-item.blue code {
    color: var(--semantic-info);
  }

  .key-item.red code {
    color: var(--semantic-error);
  }

  /* Keyboard Section */
  .keyboard-section {
    background: rgba(255, 255, 255, 0.02);
  }

  .keyboard-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .key-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  .keys {
    display: flex;
    gap: 3px;
  }

  kbd {
    padding: 3px 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--theme-stroke-strong);
    font-family: monospace;
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.8);
  }

  /* Mobile Layout */
  @media (max-width: 768px) {
    .sheet-body {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }

    .pictograph-section {
      min-height: 200px;
    }

    .controls-panel {
      border-left: none;
      border-top: 1px solid var(--theme-stroke);
      max-height: 50vh;
    }
  }
</style>
