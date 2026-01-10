<!--
	Lesson Controls Component

	Provides lesson navigation and control buttons including
	pause/resume and restart functionality with desktop-matching styling.
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  // Props
  let {
    currentView = "",
    showPauseButton = false,
    showRestartButton = false,
    isPaused = false,
    isDisabled = false,
    onPauseClicked,
    onResumeClicked,
    onRestartClicked,
    onReturnToSelector,
  } = $props<{
    currentView?: string;
    showPauseButton?: boolean;
    showRestartButton?: boolean;
    isPaused?: boolean;
    isDisabled?: boolean;
    onPauseClicked?: () => void;
    onResumeClicked?: () => void;
    onRestartClicked?: () => void;
    onReturnToSelector?: () => void;
  }>();

  // Services
  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Methods
  function handlePauseClick() {
    // Trigger selection haptic feedback for pause/resume
    hapticService?.trigger("selection");

    if (isPaused) {
      onResumeClicked?.();
    } else {
      onPauseClicked?.();
    }
  }

  function handleRestartClick() {
    // Trigger warning haptic feedback for restart (destructive action)
    hapticService?.trigger("warning");

    onRestartClicked?.();
  }

  function handleReturnToSelector() {
    // Trigger navigation haptic feedback for return to selector
    hapticService?.trigger("selection");

    onReturnToSelector?.();
  }
</script>

<div class="lesson-controls">
  {#if showPauseButton}
    <button
      class="control-button pause-button"
      class:paused={isPaused}
      disabled={isDisabled}
      onclick={handlePauseClick}
    >
      {isPaused ? "▶ Resume" : "⏸ Pause"}
    </button>
  {/if}

  {#if showRestartButton}
    <button
      class="control-button restart-button"
      disabled={isDisabled}
      onclick={handleRestartClick}
    >
      ↻ Restart
    </button>
  {/if}
</div>

<style>
  .lesson-controls {
    display: flex;
    align-items: center;
    gap: var(--desktop-spacing-md);
  }

  .control-button {
    font-family: var(--desktop-font-family);
    font-weight: 600;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke-strong);
    background: var(--theme-card-bg);
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--min-touch-target);
    padding: clamp(0.5rem, 1.5cqi, 0.75rem) clamp(1rem, 3cqi, 1.5rem);
    font-size: clamp(0.875rem, 2cqi, 1rem);
    min-width: clamp(80px, 15cqi, 120px);
    gap: 0.5rem;
    color: var(--theme-text);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .control-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .control-button:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 2px 6px
      color-mix(in srgb, var(--theme-accent) 15%, transparent);
  }

  .control-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  /* Pause/Resume button */
  .pause-button {
    background: linear-gradient(
      135deg,
      rgba(251, 146, 60, 0.2),
      rgba(249, 115, 22, 0.2)
    );
    border-color: rgba(251, 146, 60, 0.4);
  }

  .pause-button:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      rgba(251, 146, 60, 0.3),
      rgba(249, 115, 22, 0.3)
    );
    border-color: rgba(251, 146, 60, 0.6);
  }

  /* Resume state styling */
  .pause-button.paused {
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.2),
      rgba(22, 163, 74, 0.2)
    );
    border-color: rgba(34, 197, 94, 0.4);
  }

  .pause-button.paused:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.3),
      rgba(22, 163, 74, 0.3)
    );
    border-color: rgba(34, 197, 94, 0.6);
  }

  /* Restart button */
  .restart-button {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 20%, transparent),
      color-mix(in srgb, var(--theme-accent) 20%, transparent)
    );
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .restart-button:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 30%, transparent),
      color-mix(in srgb, var(--theme-accent) 30%, transparent)
    );
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
  }
</style>
