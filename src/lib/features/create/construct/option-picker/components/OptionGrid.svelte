<!--
OptionGrid.svelte - Renders a grid of option cards

Single responsibility: Layout option cards in a responsive grid.
Index-keyed slots so pictographs update in place via CSS transitions.
Computes reversal indicators for options based on current sequence.
-->
<script lang="ts">
  import type { PreparedPictographData } from "$lib/shared/pictograph/option/PreparedPictographData";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type {
    IReversalDetector,
    PictographWithReversals,
  } from "$lib/features/create/shared/services/contracts/IReversalDetector";
  import { container } from "$lib/shared/di";
  import OptionCard from "./OptionCard.svelte";

  interface Props {
    options: PictographData[];
    cardSize: number;
    columns: number;
    gap?: string;
    onSelect: (option: PreparedPictographData) => void;
    // Sequence context for reversal detection
    currentSequence?: PictographData[];
    // Enable FLIP animation for filtering (desktop only)
    enableFlip?: boolean;
  }

  const {
    options,
    cardSize,
    columns,
    gap = "8px",
    onSelect,
    currentSequence = [],
    enableFlip = false,
  }: Props = $props();

  // Cap columns to actual item count to prevent empty columns causing left-alignment
  const effectiveColumns = $derived(Math.min(columns, options.length) || 1);

  // Get reversal detection service
  const ReversalDetector = container.items.reversalDetector as IReversalDetector;

  // Compute reversals for all options based on current sequence
  const optionsWithReversals = $derived(() => {
    return ReversalDetector.detectReversalsForOptions(currentSequence, options);
  });
</script>

<div
  class="option-grid"
  class:flip-enabled={enableFlip}
  style:gap
  style:grid-template-columns="repeat({effectiveColumns}, {cardSize}px)"
>
  {#if enableFlip}
    <!-- Desktop: Index-keyed slots so pictographs update in place with CSS transitions -->
    {#each optionsWithReversals() as option, index (index)}
      <div class="option-card-wrapper">
        <OptionCard
          pictograph={option as PreparedPictographData}
          size={cardSize}
          blueReversal={option.blueReversal || false}
          redReversal={option.redReversal || false}
          onSelect={(p) => onSelect(p)}
        />
      </div>
    {/each}
  {:else}
    <!-- Mobile: Index-keyed slots for in-place transitions -->
    {#each optionsWithReversals() as option, index (index)}
      <OptionCard
        pictograph={option as PreparedPictographData}
        size={cardSize}
        blueReversal={option.blueReversal || false}
        redReversal={option.redReversal || false}
        onSelect={(p) => onSelect(p)}
      />
    {/each}
  {/if}
</div>

<style>
  .option-grid {
    display: grid;
    justify-content: center;
    width: fit-content;
    margin: 0 auto;
  }

  /* Wrapper that doesn't affect layout */
  .option-card-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
