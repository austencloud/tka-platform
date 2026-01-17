<!--
AssemblyControls.svelte - Action buttons for Assembly mode

Shows contextual action buttons based on current phase:
- Blue phase: Undo, Next Hand (when ready)
- Red phase: Undo, Complete (when ready)
- Rotation: handled by RotationSelector
- Complete: Build Another
-->
<script lang="ts">
  import type { HandPathPhase } from "../state/handpath-assemble-state.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";

  const {
    phase,
    bluePathLength,
    redPathLength = 0,
    canProceedToRed,
    canComplete,
    canUndo = false,
    onNextHand,
    onComplete,
    onReset,
    onUndo,
  } = $props<{
    phase: HandPathPhase;
    bluePathLength: number;
    redPathLength?: number;
    canProceedToRed: boolean;
    canComplete: boolean;
    canUndo?: boolean;
    onNextHand: () => void;
    onComplete: () => void;
    onReset: () => void;
    onUndo?: () => void;
  }>();

  // Calculate remaining positions needed in red phase
  const remainingPositions = $derived(
    phase === "red" ? bluePathLength - redPathLength : 0
  );

  // Access haptic feedback service from ITI container
  const hapticService = container.items.hapticFeedback as IHapticFeedback;

  function handleNextHand() {
    hapticService?.trigger("selection");
    onNextHand();
  }

  function handleComplete() {
    hapticService?.trigger("selection");
    onComplete();
  }

  function handleReset() {
    hapticService?.trigger("selection");
    onReset();
  }

  function handleUndo() {
    hapticService?.trigger("selection");
    onUndo?.();
  }
</script>

<div class="assembly-controls">
  {#if phase === "blue"}
    <!-- Blue hand phase controls -->
    <div class="controls-row">
      <button
        class="undo-button"
        onclick={handleUndo}
        disabled={!canUndo}
        aria-label="Undo"
      >
        <svg
          class="undo-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 14L4 9L9 4"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M4 9H15A6 6 0 0 1 15 21H13"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        class="control-button primary blue"
        onclick={handleNextHand}
        disabled={!canProceedToRed}
      >
        {#if bluePathLength < 2}
          <span class="progress-hint">{2 - bluePathLength} more → Red Hand</span>
        {:else}
          <span>Red Hand</span>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M8 4L14 10L8 16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {/if}
      </button>
    </div>
  {:else if phase === "red"}
    <!-- Red hand phase controls -->
    <div class="controls-row">
      <button
        class="undo-button"
        onclick={handleUndo}
        disabled={!canUndo}
        aria-label="Undo"
      >
        <svg
          class="undo-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 14L4 9L9 4"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M4 9H15A6 6 0 0 1 15 21H13"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        class="control-button primary red"
        onclick={handleComplete}
        disabled={!canComplete}
      >
        {#if remainingPositions > 0}
          <span class="progress-hint">{remainingPositions} more → Rotation</span>
        {:else}
          <span>Choose Rotation</span>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M8 4L14 10L8 16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {/if}
      </button>
    </div>
  {:else if phase === "complete"}
    <!-- Completion phase controls -->
    <div class="controls-row centered">
      <button class="control-button primary green" onclick={handleReset}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M4 10C4 6.68629 6.68629 4 10 4C12.2208 4 14.1599 5.21171 15.1973 7M16 10C16 13.3137 13.3137 16 10 16C7.77915 16 5.84008 14.7883 4.80269 13M15 4V7H12M5 16V13H8"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>Build Another</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .assembly-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: linear-gradient(to top, var(--theme-panel-bg), transparent);
  }

  .controls-row {
    display: flex;
    gap: 12px;
    width: 100%;
    max-width: 400px;
  }

  .controls-row.centered {
    justify-content: center;
  }

  .control-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    border: none;
    border-radius: 12px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    white-space: nowrap;
  }

  .control-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none !important;
  }

  /* Primary button variants */
  .control-button.primary {
    flex: 1;
    color: white;
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .control-button.primary:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .control-button.primary:active:not(:disabled) {
    transform: translateY(0);
  }

  .control-button.primary.blue {
    background: linear-gradient(135deg, var(--semantic-info), #2563eb);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .control-button.primary.blue:hover:not(:disabled) {
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
  }

  .control-button.primary.red {
    background: linear-gradient(
      135deg,
      var(--semantic-error),
      var(--semantic-error)
    );
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }

  .control-button.primary.red:hover:not(:disabled) {
    box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
  }

  .control-button.primary.green {
    background: linear-gradient(135deg, var(--semantic-success), #059669);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .control-button.primary.green:hover:not(:disabled) {
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
  }

  /* Progress hint inside disabled button */
  .progress-hint {
    opacity: 0.9;
    font-weight: 500;
  }

  /* Undo button - matches standard UndoButton styling */
  .undo-button {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    color: var(--theme-text);

    /* Purple gradient matching standard UndoButton */
    background: linear-gradient(
      135deg,
      var(--theme-accent-strong) 0%,
      color-mix(in srgb, var(--theme-accent-strong) 85%, var(--theme-accent-strong)) 100%
    );
    border: 1px solid color-mix(in srgb, var(--theme-accent-strong) 30%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent-strong) 40%, transparent);
  }

  .undo-button:hover:not(:disabled) {
    transform: scale(1.05);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent-strong) 85%, var(--theme-accent-strong)) 0%,
      color-mix(in srgb, var(--theme-accent-strong) 70%, var(--theme-accent-strong)) 100%
    );
    box-shadow: 0 6px 16px color-mix(in srgb, var(--theme-accent-strong) 60%, transparent);
  }

  .undo-button:active:not(:disabled) {
    transform: scale(0.95);
    transition: all var(--duration-instant) ease;
  }

  .undo-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .undo-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .undo-icon {
    flex-shrink: 0;
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .assembly-controls {
      padding: 12px;
    }

    .control-button {
      padding: 12px 16px;
      font-size: var(--font-size-sm);
    }

    .controls-row {
      gap: 8px;
    }
  }
</style>
