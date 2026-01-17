<!--
Type1Feedback - Shows feedback after answer
-->
<script lang="ts">
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { PatternInfo } from "../../../../../domain/constants/type1-letter-questions";

  let {
    answerState,
    letter,
    correctInfo,
  }: {
    answerState: "correct" | "incorrect";
    letter: Letter;
    correctInfo: PatternInfo;
  } = $props();
</script>

<div
  class="feedback"
  class:correct={answerState === "correct"}
  class:incorrect={answerState === "incorrect"}
>
  {#if answerState === "correct"}
    <span>
      Correct! <strong>{letter}</strong> is
      <strong style="color: {correctInfo.color}">{correctInfo.label}</strong>
    </span>
  {:else}
    <span>
      Not quite! <strong>{letter}</strong> is
      <strong style="color: {correctInfo.color}">{correctInfo.label}</strong>
    </span>
  {/if}
</div>

<style>
  .feedback {
    padding: 0.875rem 1.25rem;
    border-radius: 10px;
    font-size: 0.9375rem;
    text-align: center;
    animation: slideUp var(--duration-emphasis) ease;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .feedback.correct {
    background: rgba(34, 211, 238, 0.15);
    border: 1px solid rgba(34, 211, 238, 0.3);
    color: #22d3ee;
  }

  .feedback.incorrect {
    background: rgba(255, 158, 74, 0.15);
    border: 1px solid rgba(255, 158, 74, 0.3);
    color: #ff9e4a;
  }

  @media (prefers-reduced-motion: reduce) {
    .feedback {
      animation: none;
    }
  }
</style>
