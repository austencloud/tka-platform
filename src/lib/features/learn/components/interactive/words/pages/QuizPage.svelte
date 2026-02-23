<script lang="ts">
  import WordBuildingQuiz from "../WordBuildingQuiz.svelte";

  let { onComplete } = $props<{
    onComplete: () => void;
  }>();
</script>

<div class="page quiz-page">
  <h2>Test Your Knowledge</h2>
  <p class="page-intro">Let's see what you've learned about TKA words!</p>

  <WordBuildingQuiz {onComplete} />
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
    animation: slideInUp var(--duration-dramatic) cubic-bezier(0.4, 0, 0.2, 1);
    padding-bottom: 3rem;
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
    color: white;
    margin: 0;
    text-align: center;
    background: linear-gradient(135deg, var(--semantic-success, #50c878) 0%, var(--semantic-success, #3cb371) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  p {
    font-size: 1rem;
    line-height: 1.6;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    margin: 0;
  }

  .page-intro {
    text-align: center;
    font-size: 1.0625rem;
  }

  .quiz-page {
    max-width: 700px;
  }

  @media (max-width: 600px) {
    h2 {
      font-size: 1.5rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .page {
      animation: none;
    }
  }
</style>
