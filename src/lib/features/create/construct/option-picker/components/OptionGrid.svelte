<!--
OptionGrid.svelte - Renders a grid of option cards

Single responsibility: Layout option cards in a responsive grid.
Handles FLIP animations for filtering on desktop, simple fade on mobile.
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
  import { flip } from "svelte/animate";
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import OptionCard from "./OptionCard.svelte";

  interface Props {
    options: PictographData[];
    cardSize: number;
    columns: number;
    gap?: string;
    isFading?: boolean;
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
    isFading = false,
    onSelect,
    currentSequence = [],
    enableFlip = false,
  }: Props = $props();

  // Animation durations
  const FLIP_DURATION = 300;
  const FADE_DURATION = 200;

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
  style:opacity={isFading ? 0 : 1}
  style:grid-template-columns="repeat({effectiveColumns}, {cardSize}px)"
>
  {#if enableFlip}
    <!-- Desktop: FLIP animation with staggered scale in/out -->
    {#each optionsWithReversals() as option, index (option.id || `${option.letter}-${option.startPosition}-${option.endPosition}`)}
      <div
        class="option-card-wrapper"
        animate:flip={{ duration: FLIP_DURATION, easing: cubicOut }}
        in:scale={{ duration: FADE_DURATION, start: 0.85, easing: cubicOut, delay: Math.min(index * 15, 150) }}
        out:scale={{ duration: FADE_DURATION, start: 0.85, easing: cubicOut }}
      >
        <OptionCard
          pictograph={option as PreparedPictographData}
          size={cardSize}
          disabled={isFading}
          blueReversal={option.blueReversal || false}
          redReversal={option.redReversal || false}
          onSelect={(p) => onSelect(p)}
        />
      </div>
    {/each}
  {:else}
    <!-- Mobile: No individual animations, grid-level opacity fade -->
    {#each optionsWithReversals() as option (option.id || `${option.letter}-${option.startPosition}-${option.endPosition}`)}
      <OptionCard
        pictograph={option as PreparedPictographData}
        size={cardSize}
        disabled={isFading}
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
    transition: opacity var(--duration-normal) ease-out;
  }

  /* Wrapper for FLIP animation - thin wrapper that doesn't affect layout */
  .option-card-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .option-grid.flip-enabled :global(*) {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
