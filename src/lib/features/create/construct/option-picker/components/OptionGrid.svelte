<!--
OptionGrid.svelte - Renders a grid of option cards

Single responsibility: Layout option cards in a responsive grid.
Letter-keyed slots with FLIP animation for smooth filter transitions.
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
  import { scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import OptionCard from "./OptionCard.svelte";

  interface Props {
    options: PictographData[];
    cardSize: number;
    columns: number;
    gap?: string;
    onSelect: (option: PreparedPictographData) => void;
    currentSequence?: PictographData[];
    typeSectionTitle?: string;
    onSlotClicked?: (typeSection: string, slotIndex: number) => void;
    continuationIndex?: number | null;
  }

  const {
    options,
    cardSize,
    columns,
    gap = "8px",
    onSelect,
    currentSequence = [],
    typeSectionTitle = "",
    onSlotClicked,
    continuationIndex = null,
  }: Props = $props();

  // Cap columns to actual item count to prevent empty columns causing left-alignment
  const effectiveColumns = $derived(Math.min(columns, options.length) || 1);

  // Get reversal detection service
  const ReversalDetector = container.items.reversalDetector;

  // Compute reversals for all options based on current sequence
  const optionsWithReversals = $derived(() => {
    return ReversalDetector.detectReversalsForOptions(currentSequence, options);
  });

  // Respect reduced motion preference
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const FLIP_DURATION = reducedMotion ? 0 : 300;
  const SCALE_DURATION = reducedMotion ? 0 : 250;
</script>

<div
  class="option-grid"
  style:gap
  style:grid-template-columns="repeat({effectiveColumns}, {cardSize}px)"
>
  {#each optionsWithReversals() as option, index (option.id)}
    <div
      class="option-card-wrapper"
      animate:flip={{ duration: FLIP_DURATION, easing: cubicOut }}
      transition:scale={{ duration: SCALE_DURATION, start: 0.85, opacity: 0, easing: cubicOut }}
    >
      <OptionCard
        pictograph={option as PreparedPictographData}
        size={cardSize}
        blueReversal={option.blueReversal || false}
        redReversal={option.redReversal || false}
        isContinuation={continuationIndex === index}
        onSelect={(p) => {
          onSlotClicked?.(typeSectionTitle, index);
          onSelect(p);
        }}
      />
    </div>
  {/each}
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
