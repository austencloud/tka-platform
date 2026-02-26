<!--
PositionsQuizPage - Quiz page for positions
Uses staggered entrance animations matching the rest of the lesson.
-->
<script lang="ts">
  import PositionIdentificationQuiz from "../PositionIdentificationQuiz.svelte";

  let {
    onComplete,
  }: {
    onComplete: () => void;
  } = $props();
</script>

<div class="page quiz-page">
  <h2 class="anim-item" style="--anim-order: 0">Test Your Knowledge</h2>
  <p class="anim-item" style="--anim-order: 1">Identify the hand position types!</p>

  <div class="anim-item" style="--anim-order: 2">
    <PositionIdentificationQuiz {onComplete} />
  </div>
</div>

<style>
  .quiz-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    max-width: 700px;
    width: 100%;
    flex: 1;
    width: 100%;
  }

  h2 {
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--theme-text);
    margin: 0;
    text-align: center;
    letter-spacing: -0.02em;
  }

  p {
    font-size: 1.25rem;
    line-height: 1.6;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    margin: 0;
    text-align: center;
  }

  @media (max-width: 768px) {
    h2 {
      font-size: 2rem;
    }

    p {
      font-size: 1.1rem;
    }
  }
</style>
