<!--
Type1LetterDisplay - Shows the current letter being quizzed
-->
<script lang="ts">
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";

  let { letter }: { letter: Letter } = $props();
</script>

<div class="letter-display">
  <span class="quiz-letter">{letter}</span>
</div>

<style>
  .letter-display {
    padding: 0.75rem 2rem;
    background: rgba(34, 211, 238, 0.1);
    border: 1px solid rgba(34, 211, 238, 0.3);
    border-radius: 12px;
  }

  .quiz-letter {
    font-size: 2.5rem;
    font-weight: 800;
    color: #22d3ee;
  }

  @media (max-width: 500px) {
    .quiz-letter {
      font-size: 2rem;
    }
  }
</style>
