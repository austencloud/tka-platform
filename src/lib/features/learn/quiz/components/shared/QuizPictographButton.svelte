<!--
QuizPictographButton - Answer button containing a pictograph
-->
<script lang="ts">
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  let {
    pictograph,
    state,
    disabled,
    onclick,
    showTKA = false,
  }: {
    pictograph: PictographData;
    state: "default" | "correct" | "incorrect" | "dimmed";
    disabled: boolean;
    onclick: () => void;
    showTKA?: boolean;
  } = $props();
</script>

<button
  class="answer-btn"
  class:correct={state === "correct"}
  class:incorrect={state === "incorrect"}
  class:dimmed={state === "dimmed"}
  {onclick}
  {disabled}
  aria-label="Answer: pictograph option"
>
  <div class="pictograph-wrapper">
    <PictographContainer pictographData={pictograph} {showTKA} />
  </div>
  {#if state === "correct"}
    <span class="result-icon correct-icon">✓</span>
  {:else if state === "incorrect"}
    <span class="result-icon incorrect-icon">✗</span>
  {/if}
</button>

<style>
  .answer-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    padding: 0;
    /* Transparent - pictograph has its own dark background */
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    cursor: pointer;
    overflow: hidden;
    transition: all var(--duration-normal) cubic-bezier(0.16, 1, 0.3, 1);
  }

  .answer-btn:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .answer-btn:active:not(:disabled) {
    transform: translateY(-1px) scale(0.98);
  }

  .pictograph-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    /* No background - pictograph fills directly */
    background: transparent;
  }

  .answer-btn.correct {
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 60%, transparent);
    animation: correctPulse 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes correctPulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--semantic-success) 40%, transparent);
    }
    50% {
      transform: scale(1.04);
      box-shadow: 0 0 0 10px transparent;
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 transparent;
    }
  }

  .answer-btn.incorrect {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 60%, transparent);
    animation: incorrectShake var(--duration-dramatic) ease-out;
  }

  @keyframes incorrectShake {
    0%,
    100% {
      transform: translateX(0);
    }
    20%,
    60% {
      transform: translateX(-5px);
    }
    40%,
    80% {
      transform: translateX(5px);
    }
  }

  .answer-btn.dimmed {
    opacity: 0.35;
    cursor: default;
  }

  .answer-btn:disabled {
    cursor: default;
  }

  .result-icon {
    position: absolute;
    top: 6px;
    right: 6px;
    font-size: 0.9rem;
    font-weight: bold;
    animation: iconPop var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes iconPop {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .correct-icon {
    color: var(--semantic-success);
  }

  .incorrect-icon {
    color: var(--semantic-error);
  }

  @media (min-width: 600px) {
    .answer-btn {
      border-radius: 14px;
    }
  }

  @media (min-width: 900px) {
    .answer-btn {
      border-radius: 16px;
    }
  }

  @media (min-width: 1200px) {
    .answer-btn {
      border-radius: 18px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .answer-btn.correct,
    .answer-btn.incorrect,
    .result-icon {
      animation: none;
    }

    .answer-btn {
      transition:
        background 0.15s ease,
        border-color 0.15s ease;
    }
  }
</style>
