<!--
LengthSelectionSheet.svelte - Sheet content for selecting a length filter
Displays available lengths as pill buttons with clear option
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";

  let {
    currentLength = null,
    availableLengths = [2, 4, 6, 8, 10, 12, 16],
    onLengthSelect,
    onClear,
  } = $props<{
    currentLength: number | null;
    availableLengths?: number[];
    onLengthSelect: (length: number) => void;
    onClear: () => void;
  }>();

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = tryResolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  function handleLengthClick(length: number) {
    hapticService?.trigger("selection");
    onLengthSelect(length);
  }

  function handleClear() {
    hapticService?.trigger("selection");
    onClear();
  }
</script>

<div class="length-selection-sheet">
  <div class="sheet-header">
    <h3 class="sheet-title">Select Length</h3>
    {#if currentLength}
      <button class="clear-btn" onclick={handleClear}> Clear </button>
    {/if}
  </div>

  <div class="length-options">
    {#each availableLengths as length}
      <button
        class="length-btn"
        class:selected={currentLength === length}
        onclick={() => handleLengthClick(length)}
        aria-label="Filter by {length} beats"
        aria-pressed={currentLength === length}
      >
        <span class="length-value">{length}</span>
        <span class="length-label">beats</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .length-selection-sheet {
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
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 100px;
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .clear-btn:active {
    transform: scale(0.97);
  }

  .length-options {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .length-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 64px;
    min-width: 72px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid transparent;
    border-radius: 16px;
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    transition: all 0.15s ease;
    gap: 4px;
  }

  .length-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--theme-stroke);
    transform: translateY(-2px);
  }

  .length-btn.selected {
    background: var(--semantic-warning);
    color: white;
    border-color: transparent;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  }

  .length-btn:active {
    transform: scale(0.95);
  }

  .length-value {
    font-size: var(--font-size-xl);
    font-weight: 700;
    line-height: 1;
  }

  .length-label {
    font-size: var(--font-size-compact);
    font-weight: 500;
    opacity: 0.8;
  }

  @media (prefers-reduced-motion: reduce) {
    .length-btn,
    .clear-btn {
      transition: none;
    }
  }
</style>
