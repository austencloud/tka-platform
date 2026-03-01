<!--
OptionSection.svelte - A section of options (header + grid)

Single responsibility: Combine header and grid for a letter type section.
-->
<script lang="ts">
  import type { PreparedPictographData } from "$lib/shared/pictograph/option/PreparedPictographData";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import OptionSectionHeader from "./OptionSectionHeader.svelte";
  import OptionGrid from "./OptionGrid.svelte";

  interface Props {
    letterType: string;
    options: PictographData[];
    cardSize: number;
    columns: number;
    gap?: string;
    showHeader?: boolean;
    onSelect: (option: PreparedPictographData) => void;
    // Sequence context for reversal detection
    currentSequence?: PictographData[];
    // Enable FLIP animation for filtering (desktop only)
    enableFlip?: boolean;
    // Thread slot tracking
    onSlotClicked?: (typeSection: string, slotIndex: number) => void;
    continuationIndex?: number | null;
  }

  const {
    letterType,
    options,
    cardSize,
    columns,
    gap = "8px",
    showHeader = true,
    onSelect,
    currentSequence = [],
    enableFlip = false,
    onSlotClicked,
    continuationIndex = null,
  }: Props = $props();
</script>

<div class="option-section" data-letter-type={letterType}>
  {#if showHeader}
    <OptionSectionHeader {letterType} />
  {/if}

  <OptionGrid
    {options}
    {cardSize}
    {columns}
    {gap}
    {onSelect}
    {currentSequence}
    {enableFlip}
    typeSectionTitle={letterType}
    {onSlotClicked}
    {continuationIndex}
  />
</div>

<style>
  .option-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }
</style>
