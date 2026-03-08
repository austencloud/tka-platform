<!--
AssemblyToolbar.svelte - Unified bottom toolbar for Assembly mode

Replaces both AssemblyPhaseHeader and AssemblyControls with a single
compact toolbar: progress bar + phase label + action buttons.
-->
<script lang="ts">
  import type { HandPathPhase } from "../state/handpath-assemble-state.svelte";
  import { container } from "$lib/shared/di";

  interface Props {
    phase: HandPathPhase;
    bluePathLength: number;
    redPathLength: number;
    canProceedToRed: boolean;
    canComplete: boolean;
    canUndo: boolean;
    onNextHand: () => void;
    onComplete: () => void;
    onBack: () => void;
    onReset: () => void;
    onUndo: () => void;
  }

  const {
    phase,
    bluePathLength,
    redPathLength,
    canProceedToRed,
    canComplete,
    canUndo,
    onNextHand,
    onComplete,
    onBack,
    onReset,
    onUndo,
  }: Props = $props();

  const hapticService = container.items.hapticFeedback;

  // Phase label text and color
  const phaseLabel = $derived.by(() => {
    switch (phase) {
      case "blue":
        return {
          text: bluePathLength === 0 ? "Tap start position" : "Tap next point",
          color: "var(--semantic-info)",
        };
      case "red": {
        const remaining = bluePathLength - redPathLength;
        return {
          text:
            redPathLength === 0
              ? "Tap start position"
              : `${remaining} more`,
          color: "var(--semantic-error)",
        };
      }
      case "rotation-selection":
        return { text: "Pick rotation", color: "#8b5cf6" };
      case "complete":
        return { text: "Sequence complete", color: "var(--semantic-success)" };
    }
  });

  // Progress bar step (1 = blue, 2 = red, 3 = rotation/complete)
  const progressStep = $derived.by(() => {
    switch (phase) {
      case "blue":
        return 1;
      case "red":
        return 2;
      case "rotation-selection":
      case "complete":
        return 3;
    }
  });

  function handleNextHand() {
    hapticService?.trigger("selection");
    onNextHand();
  }

  function handleComplete() {
    hapticService?.trigger("selection");
    onComplete();
  }

  function handleBack() {
    hapticService?.trigger("selection");
    onBack();
  }

  function handleReset() {
    hapticService?.trigger("selection");
    onReset();
  }

  function handleUndo() {
    hapticService?.trigger("selection");
    onUndo();
  }
</script>

<!-- Segmented progress bar -->
<div class="progress-bar">
  <div
    class="progress-segment"
    class:active={progressStep >= 1}
    class:complete={progressStep > 1}
    style:--segment-color="var(--semantic-info)"
  ></div>
  <div
    class="progress-segment"
    class:active={progressStep >= 2}
    class:complete={progressStep > 2}
    style:--segment-color="var(--semantic-error)"
  ></div>
  <div
    class="progress-segment"
    class:active={progressStep >= 3}
    style:--segment-color="var(--semantic-success)"
  ></div>
</div>

<!-- Toolbar row -->
<div class="toolbar">
  <!-- Phase label (left) -->
  <span class="phase-label" style:color={phaseLabel.color}>
    {phaseLabel.text}
  </span>

  <!-- Spacer -->
  <div class="spacer"></div>

  <!-- Icon buttons -->
  {#if canUndo}
    <button
      class="icon-button undo"
      onclick={handleUndo}
      aria-label="Undo last position"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
  {/if}

  {#if bluePathLength > 0 && (phase === "blue" || phase === "red")}
    <button
      class="icon-button reset"
      onclick={handleReset}
      aria-label="Reset all positions"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 6H5H21"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  {/if}

  <!-- Action buttons -->
  {#if phase === "blue"}
    <button
      class="action-button blue"
      onclick={handleNextHand}
      disabled={!canProceedToRed}
    >
      <span>Next: Red Hand</span>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M8 4L14 10L8 16"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  {:else if phase === "red"}
    <button class="action-button ghost" onclick={handleBack}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M12 16L6 10L12 4"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>Back</span>
    </button>
    <button
      class="action-button red"
      onclick={handleComplete}
      disabled={!canComplete}
    >
      <span>Next: Rotation</span>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M8 4L14 10L8 16"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  {:else if phase === "complete"}
    <button class="action-button green" onclick={handleReset}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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
  {/if}
</div>

<style>
  /* Progress bar */
  .progress-bar {
    display: flex;
    gap: 4px;
    padding: 0 16px 8px;
  }

  .progress-segment {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--theme-stroke);
    transition: all var(--duration-emphasis) ease;
  }

  .progress-segment.active {
    background: var(--segment-color);
    box-shadow: 0 0 8px color-mix(in srgb, var(--segment-color) 50%, transparent);
  }

  .progress-segment.complete {
    background: var(--segment-color);
    opacity: 0.6;
    box-shadow: none;
  }

  /* Toolbar row */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
    background: var(--theme-panel-bg);
    border-top: 1px solid var(--theme-stroke);
  }

  .phase-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    white-space: nowrap;
  }

  .spacer {
    flex: 1;
  }

  /* Icon buttons (undo, reset) */
  .icon-button {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: var(--theme-text);
    transition: all var(--duration-normal) ease;
  }

  .icon-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .icon-button.undo {
    background: linear-gradient(
      135deg,
      var(--theme-accent-strong) 0%,
      color-mix(in srgb, var(--theme-accent-strong) 85%, var(--theme-accent-strong)) 100%
    );
    border: 1px solid color-mix(in srgb, var(--theme-accent-strong) 30%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent-strong) 40%, transparent);
  }

  .icon-button.undo:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px color-mix(in srgb, var(--theme-accent-strong) 60%, transparent);
  }

  .icon-button.undo:active {
    transform: scale(0.95);
    transition: all var(--duration-instant) ease;
  }

  .icon-button.reset {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    opacity: 0.7;
  }

  .icon-button.reset:hover {
    opacity: 1;
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  /* Action buttons */
  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 16px;
    min-height: var(--min-touch-target, 44px);
    border: none;
    border-radius: 12px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    color: white;
    white-space: nowrap;
    transition: all var(--duration-normal) ease;
  }

  .action-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none !important;
  }

  .action-button:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .action-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .action-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .action-button.blue {
    background: linear-gradient(135deg, var(--semantic-info), #2563eb);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .action-button.blue:hover:not(:disabled) {
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
  }

  .action-button.red {
    background: linear-gradient(135deg, var(--semantic-error), var(--semantic-error));
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }

  .action-button.red:hover:not(:disabled) {
    box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
  }

  .action-button.green {
    background: linear-gradient(135deg, var(--semantic-success), #059669);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .action-button.green:hover:not(:disabled) {
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
  }

  .action-button.ghost {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text);
    box-shadow: none;
  }

  .action-button.ghost:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    transform: translateY(-1px);
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .toolbar {
      padding: 6px 12px;
      padding-bottom: max(6px, env(safe-area-inset-bottom, 0px));
      gap: 6px;
    }

    .progress-bar {
      padding: 0 12px 6px;
    }

    .action-button {
      padding: 8px 12px;
      font-size: var(--font-size-sm, 14px);
    }
  }
</style>
