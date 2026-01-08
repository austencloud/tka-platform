<!--
LetterFilterCard.svelte - Card that displays current letter filter and opens sheet for selection
Click to open letter selection sheet
-->
<script lang="ts">
  import FilterBaseCard from "./FilterBaseCard.svelte";

  let {
    currentLetter = null,
    onOpenSheet,
    gridColumnSpan = 2,
    cardIndex = 0,
  } = $props<{
    currentLetter: string | null;
    onOpenSheet: () => void;
    gridColumnSpan?: number;
    cardIndex?: number;
  }>();

  const displayValue = $derived(currentLetter ?? "All");
</script>

<FilterBaseCard
  title="Letter"
  currentValue={displayValue}
  color="linear-gradient(135deg, var(--semantic-success), #059669)"
  shadowColor="160deg 84% 39%"
  {gridColumnSpan}
  {cardIndex}
  onClick={onOpenSheet}
>
  {#snippet children()}
    <div class="letter-preview">
      {#if currentLetter}
        <span class="selected-letter">{currentLetter}</span>
      {:else}
        <span class="letter-hint">A-Z</span>
      {/if}
    </div>
  {/snippet}
</FilterBaseCard>

<style>
  .letter-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 4px;
  }

  .selected-letter {
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
    background: rgba(255, 255, 255, 0.15);
    padding: 2px 8px;
    border-radius: 4px;
  }

  .letter-hint {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }
</style>
