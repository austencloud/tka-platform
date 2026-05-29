<!--
	Answer Pictograph Component

	Displays pictograph answer options as clickable cards.
	Handles selection states, feedback, and visual effects.
-->

<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import PictographRenderer from "./QuizPictographRenderer.svelte";

  // Services
  let hapticService: HapticFeedback;

  // Initialize haptic service
  $effect(() => {
    hapticService = getHapticFeedback();
  });

  // Props
  let {
    pictographData,
    isSelected = false,
    isCorrect = false,
    showFeedback = false,
    disabled = false,
    onclick,
  } = $props<{
    pictographData: PictographData;
    isSelected?: boolean;
    isCorrect?: boolean;
    showFeedback?: boolean;
    disabled?: boolean;
    onclick?: () => void;
  }>();

  // Derived state
  let cardClass = $derived(getCardClass());

  // Methods
  function getCardClass(): string {
    let classes = ["answer-pictograph"];

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
      // Trigger selection haptic for answer pictograph
      hapticService?.trigger("selection");
      onclick?.();
    }
  }
</script>

<button class={cardClass} onclick={handleClick} {disabled} type="button" aria-label="Answer: pictograph{pictographData?.letter ? ` for letter ${pictographData.letter}` : ''}">
  <div class="pictograph-container">
    <PictographRenderer {pictographData} size="medium" />
  </div>

  {#if pictographData?.letter}
    <div class="letter-label">
      {pictographData.letter}
    </div>
  {/if}

  {#if showFeedback && isCorrect}
    <div class="feedback-overlay correct">
      <span class="feedback-icon">✓</span>
    </div>
  {:else if showFeedback && isSelected && !isCorrect}
    <div class="feedback-overlay incorrect">
      <span class="feedback-icon">✗</span>
    </div>
  {/if}
</button>

<style>
  .answer-pictograph {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    min-height: 180px;
    padding: 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-radius: 12px;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    transition: all var(--duration-emphasis) ease;
    overflow: hidden;
  }

  .answer-pictograph::before {
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
    z-index: 1;
  }

  .answer-pictograph:hover::before {
    left: 100%;
  }

  .answer-pictograph:hover {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    transform: translateY(-4px);
    box-shadow: 0 12px 30px var(--theme-shadow);
  }

  .answer-pictograph:active {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px var(--theme-shadow);
  }

  .answer-pictograph.selected {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-color: var(--theme-accent);
    box-shadow: 0 0 25px
      color-mix(in srgb, var(--theme-accent) 40%, transparent);
    transform: translateY(-2px);
  }

  .answer-pictograph.correct {
    background: color-mix(in srgb, var(--semantic-success) 30%, transparent);
    border-color: var(--semantic-success);
    box-shadow: 0 0 25px color-mix(in srgb, var(--semantic-success) 40%, transparent);
    animation: correctPulse 0.8s ease-in-out;
  }

  .answer-pictograph.incorrect {
    background: color-mix(in srgb, var(--semantic-error) 30%, transparent);
    border-color: var(--semantic-error);
    box-shadow: 0 0 25px color-mix(in srgb, var(--semantic-error) 40%, transparent);
    animation: incorrectShake 0.8s ease-in-out;
  }

  .answer-pictograph.faded {
    opacity: 0.4;
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke);
  }

  .answer-pictograph.disabled {
    cursor: not-allowed;
    opacity: 0.6;
    pointer-events: none;
  }

  .pictograph-container {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
  }

  .letter-label {
    position: relative;
    z-index: 2;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    text-shadow: 0 2px 4px color-mix(in srgb, var(--theme-panel-bg) 30%, transparent);
    padding: 0.25rem 0.75rem;
    background: color-mix(in srgb, var(--theme-panel-bg) 30%, transparent);
    border-radius: 6px;
  }

  .feedback-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-panel-bg) 70%, transparent);
    z-index: 10;
    border-radius: 10px;
  }

  .feedback-overlay.correct {
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
  }

  .feedback-overlay.incorrect {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
  }

  .feedback-icon {
    font-size: 3rem;
    font-weight: bold;
    text-shadow: 0 0 12px currentColor;
  }

  .feedback-overlay.correct .feedback-icon {
    color: var(--semantic-success);
  }

  .feedback-overlay.incorrect .feedback-icon {
    color: var(--semantic-error);
  }

  @keyframes correctPulse {
    0%,
    100% {
      transform: scale(1) translateY(-2px);
    }
    50% {
      transform: scale(1.05) translateY(-4px);
    }
  }

  @keyframes incorrectShake {
    0%,
    100% {
      transform: translateX(0) translateY(-2px);
    }
    25% {
      transform: translateX(-8px) translateY(-2px);
    }
    75% {
      transform: translateX(8px) translateY(-2px);
    }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .answer-pictograph {
      min-height: 152px;
      padding: 0.75rem;
      gap: 0.5rem;
    }

    .letter-label {
      font-size: 1rem;
    }

    .feedback-icon {
      font-size: 2.5rem;
    }
  }

  @media (max-width: 480px) {
    .answer-pictograph {
      min-height: 120px;
      padding: 0.5rem;
    }

    .letter-label {
      font-size: 0.875rem;
    }

    .feedback-icon {
      font-size: 2rem;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .answer-pictograph {
      border-width: 3px;
    }

    .answer-pictograph.correct {
      background: color-mix(in srgb, var(--semantic-success) 50%, transparent);
    }

    .answer-pictograph.incorrect {
      background: color-mix(in srgb, var(--semantic-error) 50%, transparent);
    }

    .feedback-overlay {
      background: color-mix(in srgb, var(--theme-panel-bg) 90%, transparent);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .answer-pictograph {
      transition: none;
    }

    .answer-pictograph::before {
      transition: none;
    }

    .answer-pictograph.correct,
    .answer-pictograph.incorrect {
      animation: none;
    }
  }

  /* Focus styles for accessibility */
  .answer-pictograph:focus {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .answer-pictograph:focus:not(:focus-visible) {
    outline: none;
  }
</style>
