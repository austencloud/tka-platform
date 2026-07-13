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
    /* `safe center`: centers when content fits, but degrades to start-aligned
       when it overflows — plain `center` overflows BOTH edges and makes the
       top half unreachable even with scrolling. Paired with overflow-y so a
       question taller than the stage (small/foldable screens, 6-card answer
       grids) scrolls instead of clipping. */
    justify-content: safe center;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
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
