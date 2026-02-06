<!--
WordLetterLabel - Displays the current letter name and description
-->
<script lang="ts">
  import type { LetterDefinition } from "../../../../domain/constants/word-visualizer-data";

  let {
    letter,
    compact = false,
  }: {
    letter: LetterDefinition;
    compact?: boolean;
  } = $props();
</script>

<div class="letter-label">
  <span class="letter-name" class:compact>{letter.letter}</span>
  {#if letter.description}
    <span class="letter-desc">{letter.description}</span>
  {/if}
</div>

<style>
  .letter-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .letter-name {
    font-size: 1.75rem;
    font-weight: 800;
    color: white;
    line-height: 1;
  }

  .letter-name.compact {
    font-size: 1.25rem;
  }

  .letter-desc {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }
</style>
