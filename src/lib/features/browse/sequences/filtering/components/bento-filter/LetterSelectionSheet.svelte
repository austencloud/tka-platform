<!--
LetterSelectionSheet.svelte - Sheet content for selecting a letter filter
Displays A-Z grid with clear option
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
    import { onMount } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  let {
    currentLetter = null,
    onLetterSelect,
    onClear,
  } = $props<{
    currentLetter: string | null;
    onLetterSelect: (letter: string) => void;
    onClear: () => void;
  }>();

  let hapticService: HapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  function handleLetterClick(letter: string) {
    hapticService?.trigger("selection");
    onLetterSelect(letter);
  }

  function handleClear() {
    hapticService?.trigger("selection");
    onClear();
  }
</script>

<div class="letter-selection-sheet">
  <div class="sheet-header">
    <h3 class="sheet-title">{t('browse_select_letter')}</h3>
    {#if currentLetter}
      <button class="clear-btn" onclick={handleClear}> {t('browse_clear')} </button>
    {/if}
  </div>

  <div class="letter-grid">
    {#each letters as letter}
      <button
        class="letter-btn"
        class:selected={currentLetter === letter}
        onclick={() => handleLetterClick(letter)}
        aria-label={t('browse_filter_by_letter', { letter })}
        aria-pressed={currentLetter === letter}
      >
        {letter}
      </button>
    {/each}
  </div>
</div>

<style>
  .letter-selection-sheet {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px 0;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }

  .sheet-title {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
  }

  .clear-btn {
    padding: 8px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: none;
    border-radius: 100px;
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .clear-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.15));
    color: white;
  }

  .clear-btn:active {
    transform: scale(0.97);
  }

  .letter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
    gap: 8px;
  }

  .letter-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    padding: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid transparent;
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.85);
    font-size: var(--font-size-lg);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .letter-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke);
    transform: translateY(-1px);
  }

  .letter-btn.selected {
    background: var(--semantic-success);
    color: white;
    border-color: transparent;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .letter-btn:active {
    transform: scale(0.95);
  }

  @media (prefers-reduced-motion: reduce) {
    .letter-btn,
    .clear-btn {
      transition: none;
    }
  }
</style>
