<!--
QuizPrompt - Subtle prompt text for quizzes
-->
<script lang="ts">
  let { text }: { text: string } = $props();
</script>

<p class="quiz-prompt">{text}</p>

<style>
  .quiz-prompt {
    margin: 0 0 0.75rem 0;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--theme-text-dim);
    letter-spacing: 0.02em;
    text-align: center;
    padding: 0 4rem;
    width: 100%;
    box-sizing: border-box;
  }

  @media (min-width: 600px) {
    .quiz-prompt {
      font-size: 1rem;
      margin-bottom: 1rem;
    }
  }

  @media (min-width: 900px) {
    .quiz-prompt {
      font-size: 1.125rem;
      margin-bottom: 1.5rem;
      color: var(--theme-text-muted, rgba(255, 255, 255, 0.75));
    }
  }

  @media (min-width: 1440px) {
    .quiz-prompt {
      font-size: 1.25rem;
      margin-bottom: 2rem;
    }
  }

  @media (min-width: 1920px) {
    .quiz-prompt {
      font-size: 1.5rem;
    }
  }
</style>
