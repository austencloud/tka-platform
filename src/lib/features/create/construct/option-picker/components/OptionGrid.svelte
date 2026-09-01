<!--
OptionGrid.svelte - Renders a grid of option cards

Single responsibility: Layout option cards in a responsive grid.
Index-keyed slots so components stay mounted and arrows/props
transition in place via their own CSS transforms when data changes.
Computes reversal indicators for options based on current sequence.
-->
<script lang="ts">
  import type { PreparedPictographData } from "$lib/shared/pictograph/option/prepared-pictograph-data";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import {
    reversalDetector,
    type ReversalDetector,
  } from "$lib/shared/create/services/reversal-detector";
  import type { PictographWithReversals } from "$lib/shared/create/services/reversal-detector";
  import OptionCard from "./OptionCard.svelte";
  import DoubleFloatOptionRows from "./DoubleFloatOptionRows.svelte";
  import { buildDoubleFloatOptionRows } from "../services/double-float-option-groups";

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
  const ReversalDetector = reversalDetector;

  // Compute reversals for all options based on current sequence
  const optionsWithReversals = $derived(() => {
    return ReversalDetector.detectReversalsForOptions(currentSequence, options);
  });

  const doubleFloatRows = $derived(() =>
    buildDoubleFloatOptionRows(optionsWithReversals())
  );
</script>

{#if doubleFloatRows()}
  <DoubleFloatOptionRows
    rows={doubleFloatRows()!}
    previewSize={cardSize}
    {continuationIndex}
    onSelect={(option, originalIndex) => {
      onSlotClicked?.(typeSectionTitle, originalIndex);
      onSelect(option as PreparedPictographData);
    }}
  />
{:else}
  <div
    class="option-grid"
    style:gap
    style:grid-template-columns="repeat({effectiveColumns}, {cardSize}px)"
  >
    {#each optionsWithReversals() as option, index (index)}
      <div class="option-card-wrapper">
        <OptionCard
          pictograph={option as PreparedPictographData}
          size={cardSize}
          leftReversal={option.leftReversal || false}
          rightReversal={option.rightReversal || false}
          isContinuation={continuationIndex === index}
          onSelect={(p) => {
            onSlotClicked?.(typeSectionTitle, index);
            onSelect(p);
          }}
        />
      </div>
    {/each}
  </div>
{/if}

<style>
  .option-grid {
    display: grid;
    justify-content: center;
    width: fit-content;
    margin: 0 auto;
  }

  .option-card-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
