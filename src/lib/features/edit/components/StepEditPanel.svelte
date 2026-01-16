<!--
  BeatEditPanel.svelte

  Panel for editing individual beats.
  Provides controls for turns, rotation direction, and motion type.
-->
<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import {
    MotionColor,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  interface Props {
    selectedBeatNumber: number | null;
    selectedBeatData: BeatData | null;
    selectedBeatNumbers: number[];
    sequence: SequenceData | null;
    onBeatUpdate: (beatIndex: number, updates: Partial<BeatData>) => void;
    onStartPositionUpdate: (updates: Partial<PictographData>) => void;
  }

  let {
    selectedBeatNumber,
    selectedBeatData,
    selectedBeatNumbers,
    sequence,
    onBeatUpdate,
    onStartPositionUpdate,
  }: Props = $props();

  // Derived state
  const hasSelection = $derived(
    selectedBeatNumber !== null || selectedBeatNumbers.length > 0
  );
  const isMultiSelect = $derived(selectedBeatNumbers.length > 1);
  const isStartPosition = $derived(selectedBeatNumber === 0);

  // Get current values from motions using MotionColor enum
  const blueMotion = $derived(selectedBeatData?.motions?.[MotionColor.BLUE]);
  const redMotion = $derived(selectedBeatData?.motions?.[MotionColor.RED]);
  // Handle "fl" (float) turns - converts to -0.5 for calculations, otherwise converts to number
  const normalizeTurns = (turns: number | string | undefined): number =>
    turns === "fl" ? -0.5 : Number(turns) || 0;
  // Raw turns values for display (shows "fl" for floats)
  const rawBlueTurns = $derived(blueMotion?.turns);
  const rawRedTurns = $derived(redMotion?.turns);
  // Numeric turns for calculations
  const currentBlueTurns = $derived(normalizeTurns(rawBlueTurns));
  const currentRedTurns = $derived(normalizeTurns(rawRedTurns));
  // Display values - show "fl" for floats, otherwise the number
  const displayBlueTurns = $derived(
    rawBlueTurns === "fl" ? "fl" : currentBlueTurns
  );
  const displayRedTurns = $derived(
    rawRedTurns === "fl" ? "fl" : currentRedTurns
  );
  // Show rotation controls only when turns >= 0 (hide for floats)
  const showBlueRotation = $derived(currentBlueTurns >= 0);
  const showRedRotation = $derived(currentRedTurns >= 0);
  const currentBlueRotation = $derived(
    blueMotion?.rotationDirection ?? RotationDirection.NO_ROTATION
  );
  const currentRedRotation = $derived(
    redMotion?.rotationDirection ?? RotationDirection.NO_ROTATION
  );

  function handleBlueTurnsChange(delta: number) {
    if (selectedBeatNumber === null || !selectedBeatData?.motions) return;

    const blueMotionData = selectedBeatData.motions[MotionColor.BLUE];
    if (!blueMotionData) return;

    // Allow turns to go to -0.5 (float), floor at -0.5
    const newNumericTurns = Math.max(-0.5, currentBlueTurns + delta);
    // Store as "fl" when -0.5, otherwise store the number
    const newTurns: number | "fl" =
      newNumericTurns === -0.5 ? "fl" : newNumericTurns;
    const updatedMotions = {
      ...selectedBeatData.motions,
      [MotionColor.BLUE]: {
        ...blueMotionData,
        turns: newTurns,
      },
    };

    if (isStartPosition) {
      onStartPositionUpdate({ motions: updatedMotions });
    } else {
      onBeatUpdate(selectedBeatNumber - 1, { motions: updatedMotions });
    }
  }

  function handleRedTurnsChange(delta: number) {
    if (selectedBeatNumber === null || !selectedBeatData?.motions) return;

    const redMotionData = selectedBeatData.motions[MotionColor.RED];
    if (!redMotionData) return;

    // Allow turns to go to -0.5 (float), floor at -0.5
    const newNumericTurns = Math.max(-0.5, currentRedTurns + delta);
    // Store as "fl" when -0.5, otherwise store the number
    const newTurns: number | "fl" =
      newNumericTurns === -0.5 ? "fl" : newNumericTurns;
    const updatedMotions = {
      ...selectedBeatData.motions,
      [MotionColor.RED]: {
        ...redMotionData,
        turns: newTurns,
      },
    };

    if (isStartPosition) {
      onStartPositionUpdate({ motions: updatedMotions });
    } else {
      onBeatUpdate(selectedBeatNumber - 1, { motions: updatedMotions });
    }
  }

  function handleBlueRotationChange(direction: RotationDirection) {
    if (selectedBeatNumber === null || !selectedBeatData?.motions) return;

    const blueMotionData = selectedBeatData.motions[MotionColor.BLUE];
    if (!blueMotionData) return;

    const updatedMotions = {
      ...selectedBeatData.motions,
      [MotionColor.BLUE]: {
        ...blueMotionData,
        rotationDirection: direction,
      },
    };

    if (isStartPosition) {
      onStartPositionUpdate({ motions: updatedMotions });
    } else {
      onBeatUpdate(selectedBeatNumber - 1, { motions: updatedMotions });
    }
  }

  function handleRedRotationChange(direction: RotationDirection) {
    if (selectedBeatNumber === null || !selectedBeatData?.motions) return;

    const redMotionData = selectedBeatData.motions[MotionColor.RED];
    if (!redMotionData) return;

    const updatedMotions = {
      ...selectedBeatData.motions,
      [MotionColor.RED]: {
        ...redMotionData,
        rotationDirection: direction,
      },
    };

    if (isStartPosition) {
      onStartPositionUpdate({ motions: updatedMotions });
    } else {
      onBeatUpdate(selectedBeatNumber - 1, { motions: updatedMotions });
    }
  }
</script>

<div class="beat-edit-panel">
  {#if !hasSelection}
    <div class="no-selection">
      <i class="fas fa-hand-pointer" aria-hidden="true"></i>
      <p>Select a beat to edit</p>
    </div>
  {:else if isMultiSelect}
    <div class="multi-select-info">
      <i class="fas fa-layer-group" aria-hidden="true"></i>
      <p>{selectedBeatNumbers.length} beats selected</p>
      <p class="hint">Batch editing coming soon</p>
    </div>
  {:else}
    <div class="edit-controls">
      <h3 class="panel-title">
        {isStartPosition
          ? "Edit Start Position"
          : `Edit Beat ${selectedBeatNumber}`}
      </h3>

      <!-- Blue Prop Section -->
      <div class="prop-section blue">
        <h4 class="section-title">
          <span class="color-indicator blue"></span>
          Blue Prop
        </h4>

        <!-- Blue Turns Control -->
        <div class="control-group">
          <span class="control-label">Turns</span>
          <div class="turns-control">
            <button
              class="control-btn"
              onclick={() => handleBlueTurnsChange(-0.5)}
              aria-label="Decrease turns"
            >
              <i class="fas fa-minus" aria-hidden="true"></i>
            </button>
            <span class="turns-value">{displayBlueTurns}</span>
            <button
              class="control-btn"
              onclick={() => handleBlueTurnsChange(0.5)}
              aria-label="Increase turns"
            >
              <i class="fas fa-plus" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <!-- Blue Rotation Direction Control - disabled for floats -->
        <div class="control-group">
          <span class="control-label">Rotation</span>
          <div class="rotation-control">
            <button
              class="rotation-btn"
              class:active={showBlueRotation &&
                currentBlueRotation === RotationDirection.CLOCKWISE}
              onclick={() =>
                handleBlueRotationChange(RotationDirection.CLOCKWISE)}
              disabled={!showBlueRotation}
              aria-label="Clockwise rotation"
            >
              <i class="fas fa-rotate-right" aria-hidden="true"></i>
            </button>
            <button
              class="rotation-btn"
              class:active={showBlueRotation &&
                currentBlueRotation === RotationDirection.COUNTER_CLOCKWISE}
              onclick={() =>
                handleBlueRotationChange(RotationDirection.COUNTER_CLOCKWISE)}
              disabled={!showBlueRotation}
              aria-label="Counter-clockwise rotation"
            >
              <i class="fas fa-rotate-left" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Red Prop Section -->
      <div class="prop-section red">
        <h4 class="section-title">
          <span class="color-indicator red"></span>
          Red Prop
        </h4>

        <!-- Red Turns Control -->
        <div class="control-group">
          <span class="control-label">Turns</span>
          <div class="turns-control">
            <button
              class="control-btn"
              onclick={() => handleRedTurnsChange(-0.5)}
              aria-label="Decrease turns"
            >
              <i class="fas fa-minus" aria-hidden="true"></i>
            </button>
            <span class="turns-value">{displayRedTurns}</span>
            <button
              class="control-btn"
              onclick={() => handleRedTurnsChange(0.5)}
              aria-label="Increase turns"
            >
              <i class="fas fa-plus" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <!-- Red Rotation Direction Control - disabled for floats -->
        <div class="control-group">
          <span class="control-label">Rotation</span>
          <div class="rotation-control">
            <button
              class="rotation-btn"
              class:active={showRedRotation &&
                currentRedRotation === RotationDirection.CLOCKWISE}
              onclick={() =>
                handleRedRotationChange(RotationDirection.CLOCKWISE)}
              disabled={!showRedRotation}
              aria-label="Clockwise rotation"
            >
              <i class="fas fa-rotate-right" aria-hidden="true"></i>
            </button>
            <button
              class="rotation-btn"
              class:active={showRedRotation &&
                currentRedRotation === RotationDirection.COUNTER_CLOCKWISE}
              onclick={() =>
                handleRedRotationChange(RotationDirection.COUNTER_CLOCKWISE)}
              disabled={!showRedRotation}
              aria-label="Counter-clockwise rotation"
            >
              <i class="fas fa-rotate-left" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .beat-edit-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    overflow-y: auto;
  }

  .no-selection,
  .multi-select-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--theme-text-dim);
  }

  .no-selection i,
  .multi-select-info i {
    font-size: var(--font-size-3xl);
    opacity: 0.5;
  }

  .edit-controls {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .panel-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .prop-section {
    padding: 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
  }

  .prop-section.blue {
    border-left: 3px solid var(--semantic-info);
  }

  .prop-section.red {
    border-left: 3px solid var(--semantic-error);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 12px 0;
  }

  .color-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .color-indicator.blue {
    background: var(--semantic-info);
  }

  .color-indicator.red {
    background: var(--semantic-error);
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .control-group:last-child {
    margin-bottom: 0;
  }

  .control-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--theme-text-dim);
  }

  .turns-control {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--theme-stroke);
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .control-btn:hover:not(:disabled) {
    background: rgba(6, 182, 212, 0.2);
    border-color: #06b6d4;
  }

  .control-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .turns-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text);
    min-width: var(--min-touch-target);
    text-align: center;
  }

  .rotation-control {
    display: flex;
    gap: 8px;
  }

  .rotation-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    border-radius: 8px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .rotation-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .rotation-btn.active {
    background: rgba(6, 182, 212, 0.2);
    border-color: #06b6d4;
    color: #06b6d4;
  }

  .rotation-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .hint {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    font-style: italic;
  }
</style>
