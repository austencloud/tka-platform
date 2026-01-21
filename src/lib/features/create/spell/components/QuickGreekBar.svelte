<!--
QuickGreekBar.svelte - Always-visible compact row of common Greek letters

Displays the most frequently used Greek letters for quick insertion.
"More" button expands to show full palette.
-->
<script lang="ts">
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { GREEK_LETTER_DISPLAY } from "../domain/constants/spell-constants";
  import { slide } from "svelte/transition";
  import LetterPalette from "./LetterPalette.svelte";

  /**
   * QuickGreekBar - Compact row of common Greek letters
   *
   * Features:
   * - Always visible (not focus-dependent)
   * - Horizontal scrollable row
   * - Compact 40px buttons
   * - "More" button expands full palette
   */

  interface Props {
    onSelect: (letter: string) => void;
  }

  let { onSelect }: Props = $props();

  // Most common Greek letters for quick access
  const QUICK_LETTERS: Letter[] = [
    Letter.SIGMA,
    Letter.DELTA,
    Letter.THETA,
    Letter.OMEGA,
    Letter.PHI,
    Letter.PSI,
    Letter.ALPHA,
    Letter.BETA,
  ];

  let showFullPalette = $state(false);

  function getDisplayLabel(letter: Letter): string {
    return GREEK_LETTER_DISPLAY[letter] || letter;
  }

  function handleLetterClick(letter: Letter) {
    onSelect(letter);
  }

  function toggleFullPalette() {
    showFullPalette = !showFullPalette;
  }
</script>

<div class="quick-greek-bar">
  <div class="bar-row">
    <div class="quick-buttons" role="group" aria-label="Quick Greek letters">
      {#each QUICK_LETTERS as letter}
        <button
          class="quick-button"
          onclick={() => handleLetterClick(letter)}
          title={letter}
          aria-label="Insert letter {letter}"
        >
          {getDisplayLabel(letter)}
        </button>
      {/each}
    </div>

    <button
      class="more-button"
      onclick={toggleFullPalette}
      aria-expanded={showFullPalette}
      aria-label={showFullPalette ? "Hide more Greek letters" : "Show more Greek letters"}
    >
      {#if showFullPalette}
        <i class="fas fa-chevron-up" aria-hidden="true"></i>
      {:else}
        More
        <i class="fas fa-chevron-down" aria-hidden="true"></i>
      {/if}
    </button>
  </div>

  {#if showFullPalette}
    <div class="full-palette-wrapper" transition:slide={{ duration: 200 }}>
      <LetterPalette {onSelect} />
    </div>
  {/if}
</div>

<style>
  .quick-greek-bar {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
  }

  .bar-row {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
  }

  .quick-buttons {
    display: flex;
    gap: var(--settings-spacing-xs, 4px);
    overflow-x: auto;
    flex: 1;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .quick-buttons::-webkit-scrollbar {
    display: none;
  }

  .quick-button {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 48px;
    width: 48px;
    height: 48px;
    padding: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-md, 16px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    flex-shrink: 0;
  }

  .quick-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #6366f1);
  }

  .quick-button:active {
    transform: scale(0.95);
  }

  .quick-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .more-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    min-height: var(--min-touch-target, 48px); /* WCAG AAA touch target */
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .more-button:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .more-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .more-button i {
    font-size: var(--font-size-xs, 10px);
  }

  .full-palette-wrapper {
    padding: var(--settings-spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
  }

  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .quick-button,
    .more-button {
      transition: none;
    }

    .quick-button:active {
      transform: none;
    }
  }
</style>
