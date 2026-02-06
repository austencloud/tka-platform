<!--
QuizContainer - Shared container layout for quizzes
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<div class="quiz-container">
  {@render children()}
</div>

<style>
  .quiz-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 1rem;
    box-sizing: border-box;
    padding-bottom: 2rem;
  }

  @media (min-width: 600px) {
    .quiz-container {
      padding: 1.5rem;
      padding-bottom: 3rem;
    }
  }

  @media (min-width: 900px) {
    .quiz-container {
      padding: 2rem;
      padding-bottom: 4rem;
    }
  }
</style>
