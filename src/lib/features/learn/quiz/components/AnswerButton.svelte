<!--
	Answer Button Component

	Displays letter answer options as clickable buttons.
	Handles selection states, feedback, and visual effects.
-->

<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
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
  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
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

<button class={buttonClass} onclick={handleClick} {disabled} type="button">
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
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: #ffffff;
    font-size: 2rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
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
      rgba(255, 255, 255, 0.1),
      transparent
    );
    transition: left 0.5s ease;
  }

  .answer-button:hover::before {
    left: 100%;
  }

  .answer-button:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
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
    background: rgba(74, 222, 128, 0.3);
    border-color: #4ade80;
    box-shadow: 0 0 20px rgba(74, 222, 128, 0.4);
    animation: correctPulse 0.6s ease-in-out;
  }

  .answer-button.incorrect {
    background: rgba(248, 113, 113, 0.3);
    border-color: var(--semantic-error);
    box-shadow: 0 0 20px rgba(248, 113, 113, 0.4);
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
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
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
    color: #4ade80;
    text-shadow: 0 0 8px rgba(74, 222, 128, 0.8);
  }

  .incorrect-icon {
    color: var(--semantic-error);
    text-shadow: 0 0 8px rgba(248, 113, 113, 0.8);
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
      background: rgba(74, 222, 128, 0.5);
    }

    .answer-button.incorrect {
      background: rgba(248, 113, 113, 0.5);
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
