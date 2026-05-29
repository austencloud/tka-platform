<!--
QuizModeToggle - Modern segmented control for quiz mode selection

A smooth pill-style segmented control with icons for selecting between
Fixed Questions mode (set number) and Countdown mode (timed challenge).
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";
  import { QuizMode } from "../domain/enums/quiz-enums";

  // Props
  let {
    selectedMode = $bindable(QuizMode.FIXED_QUESTION),
    disabled = false,
    onModeChanged,
  } = $props<{
    selectedMode?: QuizMode;
    disabled?: boolean;
    onModeChanged?: (mode: QuizMode) => void;
  }>();

  // Services
  let hapticService: HapticFeedback;

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Calculate slider position based on selected mode
  let sliderPosition = $derived(
    selectedMode === QuizMode.FIXED_QUESTION ? 0 : 1
  );

  // Handle mode selection
  function selectMode(mode: QuizMode) {
    if (disabled) return;

    // Trigger selection haptic feedback for quiz mode selection
    hapticService?.trigger("selection");

    selectedMode = mode;
    onModeChanged?.(mode);
  }
</script>

<div class="mode-toggle-container">
  <div class="segmented-control" class:disabled>
    <!-- Animated sliding background -->
    <div class="slider-track" style="--slider-position: {sliderPosition}"></div>

    <!-- Fixed Questions Option -->
    <button
      class="segment"
      class:active={selectedMode === QuizMode.FIXED_QUESTION}
      class:disabled
      onclick={() => selectMode(QuizMode.FIXED_QUESTION)}
      {disabled}
      aria-pressed={selectedMode === QuizMode.FIXED_QUESTION}
      aria-label="20 Questions mode"
    >
      <span class="segment-icon">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      </span>
      <span class="segment-label">20 Questions</span>
    </button>

    <!-- Countdown Option -->
    <button
      class="segment"
      class:active={selectedMode === QuizMode.COUNTDOWN}
      class:disabled
      onclick={() => selectMode(QuizMode.COUNTDOWN)}
      {disabled}
      aria-pressed={selectedMode === QuizMode.COUNTDOWN}
      aria-label="2 minute timer mode"
    >
      <span class="segment-icon">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </span>
      <span class="segment-label">2 Min Timer</span>
    </button>
  </div>
</div>

<style>
  .mode-toggle-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 0 var(--spacing-md);
  }

  .segmented-control {
    position: relative;
    display: flex;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 16px;
    padding: 4px;
    box-shadow:
      0 4px 16px color-mix(in srgb, var(--theme-panel-bg) 60%, transparent),
      inset 0 1px 0 color-mix(in srgb, var(--theme-text) 5%, transparent);
  }

  .segmented-control.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  /* Animated sliding background */
  .slider-track {
    position: absolute;
    top: 4px;
    left: 4px;
    width: calc(50% - 4px);
    height: calc(100% - 8px);
    background: var(--theme-accent);
    border-radius: 12px;
    transform: translateX(calc(var(--slider-position) * 100%));
    transition: transform var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 2px 8px color-mix(in srgb, var(--theme-accent) 40%, transparent),
      0 0 20px color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .segment {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex: 1;
    padding: 12px 20px;
    background: transparent;
    border: none;
    border-radius: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.65));
    font-family: var(
      --font-sans,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif
    );
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: color var(--duration-normal) ease;
    white-space: nowrap;
  }

  .segment:hover:not(.disabled):not(.active) {
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
  }

  .segment.active {
    color: white;
    font-weight: 600;
  }

  .segment:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 80%, transparent);
    outline-offset: 2px;
  }

  .segment-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .segment-icon svg {
    transition: transform var(--duration-normal) ease;
  }

  .segment.active .segment-icon svg {
    transform: scale(1.1);
  }

  .segment-label {
    line-height: 1.2;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .segmented-control {
      border-radius: 14px;
      padding: 3px;
    }

    .slider-track {
      top: 3px;
      left: 3px;
      width: calc(50% - 3px);
      height: calc(100% - 6px);
      border-radius: 11px;
    }

    .segment {
      padding: 14px 16px;
      font-size: 0.875rem;
      min-height: var(--min-touch-target);
      gap: 6px;
    }

    .segment-icon svg {
      width: 16px;
      height: 16px;
    }
  }

  @media (max-width: 480px) {
    .mode-toggle-container {
      padding: 0 var(--spacing-sm);
    }

    .segmented-control {
      width: 100%;
      max-width: 340px;
    }

    .segment {
      padding: 16px 12px;
      font-size: 0.8125rem;
      min-height: var(--min-touch-target);
      flex-direction: column;
      gap: 4px;
    }

    .segment-icon svg {
      width: 20px;
      height: 20px;
    }
  }

  @media (max-width: 360px) {
    .segment {
      padding: 14px 8px;
      font-size: 0.75rem;
    }

    .segment-label {
      font-size: var(--font-size-compact, 12px);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .slider-track {
      transition: none;
    }

    .segment-icon svg {
      transition: none;
    }
  }
</style>
