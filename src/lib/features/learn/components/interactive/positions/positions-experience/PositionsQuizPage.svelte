<!--
PositionsQuizPage - Quiz page for positions
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
  <h2>Test Your Knowledge</h2>
  <p>Identify the hand position types!</p>

  <PositionIdentificationQuiz {onComplete} />
</div>

<style>
  .quiz-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 700px;
    margin: 0 auto;
    width: 100%;
    animation: slideInUp var(--duration-dramatic) cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  h2 {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 0;
    text-align: center;
    background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  p {
    font-size: 1.125rem;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.85);
    margin: 0;
    text-align: center;
  }

  @media (max-width: 600px) {
    h2 {
      font-size: 1.5rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .quiz-page {
      animation: none;
    }
  }
</style>
