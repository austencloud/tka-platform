<!--
WordHeader.svelte

Word/sequence name display for animation area.
Displays ABOVE the canvas as a full-width header (matches image export style).

Uses simplifyRepeatedWord to handle repeated words (e.g., "ABAB" → "AB").
Does NOT truncate - allows full word length when needed for uniqueness.
Dark mode: Controlled via prop (for preview isolation) or falls back to :root.dark class.
-->
<script lang="ts">
  import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";

  let {
    word = null,
    visible = true,
    darkMode = false,
  }: {
    word?: string | null;
    visible?: boolean;
    darkMode?: boolean;
  } = $props();

  // Derive display text - simplify repeated patterns (no truncation), then uppercase
  const displayText = $derived(
    word ? simplifyRepeatedWord(word).toUpperCase() : null
  );
</script>

{#if visible && displayText}
  <div class="word-header" class:dark-mode={darkMode}>
    <span class="word-text">{displayText}</span>
  </div>
{/if}

<style>
  /* Full-width header attached to canvas (matches image export style) */
  .word-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 16px;
    box-sizing: border-box;
    flex-shrink: 0;
    /* Light mode: subtle gray background matching image export */
    background: linear-gradient(
      to bottom,
      rgba(248, 248, 248, 0.98),
      rgba(240, 240, 240, 0.98)
    );
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }

  .word-text {
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 700;
    font-size: clamp(16px, 5cqw, 28px);
    letter-spacing: 0.08em;
    text-align: center;
    /* Light mode: dark text, no pill background */
    color: #1f2937;
  }

  /* Dark mode: dark background with light text (via prop) */
  .word-header.dark-mode {
    background: linear-gradient(
      to bottom,
      rgba(15, 15, 20, 0.98),
      rgba(10, 10, 15, 0.98)
    );
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .word-header.dark-mode .word-text {
    color: #ffffff;
  }

  /* Fallback: Also support global .dark class for non-preview usage */
  :global(:root.dark) .word-header:not(.dark-mode) {
    background: linear-gradient(
      to bottom,
      rgba(15, 15, 20, 0.98),
      rgba(10, 10, 15, 0.98)
    );
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  :global(:root.dark) .word-header:not(.dark-mode) .word-text {
    color: #ffffff;
  }
</style>
