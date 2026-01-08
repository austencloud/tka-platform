<!--
LengthFilterCard.svelte - Card that displays current length filter and opens sheet for selection
Click to open length selection sheet
-->
<script lang="ts">
  import FilterBaseCard from "./FilterBaseCard.svelte";

  let {
    currentLength = null,
    onOpenSheet,
    gridColumnSpan = 2,
    cardIndex = 0,
  } = $props<{
    currentLength: number | null;
    onOpenSheet: () => void;
    gridColumnSpan?: number;
    cardIndex?: number;
  }>();

  const displayValue = $derived(
    currentLength ? `${currentLength} beats` : "Any"
  );
</script>

<FilterBaseCard
  title="Length"
  currentValue={displayValue}
  color="linear-gradient(135deg, var(--semantic-warning), #d97706)"
  shadowColor="38deg 92% 50%"
  {gridColumnSpan}
  {cardIndex}
  onClick={onOpenSheet}
>
  {#snippet children()}
    <div class="length-preview">
      {#if currentLength}
        <div class="beat-dots">
          {#each Array(Math.min(currentLength, 8)) as _, i}
            <span class="dot" style="--dot-index: {i}"></span>
          {/each}
          {#if currentLength > 8}
            <span class="more">+{currentLength - 8}</span>
          {/if}
        </div>
      {:else}
        <span class="length-hint">2-16</span>
      {/if}
    </div>
  {/snippet}
</FilterBaseCard>

<style>
  .length-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 4px;
  }

  .beat-dots {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .dot {
    width: 6px;
    height: 6px;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 50%;
    animation: dotPulse 0.3s ease;
    animation-delay: calc(var(--dot-index) * 30ms);
    animation-fill-mode: backwards;
  }

  @keyframes dotPulse {
    from {
      opacity: 0;
      transform: scale(0);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .more {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    margin-left: 2px;
  }

  .length-hint {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
  }
</style>
