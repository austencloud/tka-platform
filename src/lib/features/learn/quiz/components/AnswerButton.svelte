<!--
	Answer Button Component

	Displays letter answer options as clickable buttons.
	Handles selection states, feedback, and visual effects.
-->

<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";

  // Props
  let {
    content,
    isSelected = false,
    isCorrect = false,
    showFeedback = false,
    disabled = false,
    onclick,
  } = $props<{
    content: string;
    isSelected?: boolean;
    isCorrect?: boolean;
    showFeedback?: boolean;
    disabled?: boolean;
    onclick?: () => void;
  }>();

  // Services
  let hapticService: HapticFeedback;

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Derived state
  let buttonClass = $derived(getButtonClass());

  // Methods
  function getButtonClass(): string {
    let classes = ["answer-button"];

    if (disabled) {
      classes.push("disabled");
    }

    if (isSelected) {
      classes.push("selected");
    }

    if (showFeedback) {
      if (isCorrect) {
        classes.push("correct");
      } else if (isSelected && !isCorrect) {
        classes.push("incorrect");
      } else {
        classes.push("faded");
      }
    }

    return classes.join(" ");
  }

  function handleClick() {
    if (!disabled) {
      // Trigger selection haptic feedback for answer selection
      hapticService?.trigger("selection");

      onclick?.();
    }
  }
</script>

<button class={buttonClass} onclick={handleClick} {disabled} type="button" aria-label="Answer: {content}">
  <span class="button-content">
    {content}
  </span>

  {#if showFeedback && isCorrect}
    <span class="feedback-icon correct-icon">✓</span>
  {:else if showFeedback && isSelected && !isCorrect}
    <span class="feedback-icon incorrect-icon">✗</span>
  {/if}
</button>

<style>
  .answer-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 80px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-radius: 12px;
    color: var(--theme-text, #ffffff);
    font-size: 2rem;
    font-weight: bold;
    cursor: pointer;
    transition: all var(--duration-emphasis) ease;
    overflow: hidden;
  }

  .answer-button::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--theme-text) 10%, transparent),
      transparent
    );
    transition: left 0.5s ease;
  }

  .answer-button:hover::before {
    left: 100%;
  }

  .answer-button:hover {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    transform: translateY(-2px);
    box-shadow: 0 8px 25px var(--theme-shadow);
  }

  .answer-button:active {
    transform: translateY(0);
    box-shadow: 0 4px 15px var(--theme-shadow);
  }

  .answer-button.selected {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-color: var(--theme-accent);
    box-shadow: 0 0 20px
      color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .answer-button.correct {
    background: color-mix(in srgb, var(--semantic-success) 30%, transparent);
    border-color: var(--semantic-success);
    box-shadow: 0 0 20px color-mix(in srgb, var(--semantic-success) 40%, transparent);
    animation: correctPulse 0.6s ease-in-out;
  }

  .answer-button.incorrect {
    background: color-mix(in srgb, var(--semantic-error) 30%, transparent);
    border-color: var(--semantic-error);
    box-shadow: 0 0 20px color-mix(in srgb, var(--semantic-error) 40%, transparent);
    animation: incorrectShake 0.6s ease-in-out;
  }

  .answer-button.faded {
    opacity: 0.4;
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke);
  }

  .answer-button.disabled {
    cursor: not-allowed;
    opacity: 0.6;
    pointer-events: none;
  }

  .button-content {
    position: relative;
    z-index: 2;
    text-shadow: 0 2px 4px color-mix(in srgb, var(--theme-panel-bg) 70%, transparent);
  }

  .feedback-icon {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 1.5rem;
    font-weight: bold;
    z-index: 3;
  }

  .correct-icon {
    color: var(--semantic-success);
    text-shadow: 0 0 8px color-mix(in srgb, var(--semantic-success) 80%, transparent);
  }

  .incorrect-icon {
    color: var(--semantic-error);
    text-shadow: 0 0 8px color-mix(in srgb, var(--semantic-error) 80%, transparent);
  }

  @keyframes correctPulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  @keyframes incorrectShake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-8px);
    }
    75% {
      transform: translateX(8px);
    }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .answer-button {
      height: 60px;
      font-size: 1.5rem;
    }

    .feedback-icon {
      font-size: 1.25rem;
      top: 6px;
      right: 6px;
    }
  }

  @media (max-width: 480px) {
    .answer-button {
      height: var(--min-touch-target);
      font-size: 1.25rem;
    }

    .feedback-icon {
      font-size: 1rem;
      top: 4px;
      right: 4px;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .answer-button {
      border-width: 3px;
    }

    .answer-button.correct {
      background: color-mix(in srgb, var(--semantic-success) 50%, transparent);
    }

    .answer-button.incorrect {
      background: color-mix(in srgb, var(--semantic-error) 50%, transparent);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .answer-button {
      transition: none;
    }

    .answer-button::before {
      transition: none;
    }

    .answer-button.correct,
    .answer-button.incorrect {
      animation: none;
    }
  }

  /* Focus styles for accessibility */
  .answer-button:focus {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .answer-button:focus:not(:focus-visible) {
    outline: none;
  }
</style>
