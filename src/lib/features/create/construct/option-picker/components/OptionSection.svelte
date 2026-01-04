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
    isFading?: boolean;
    onSelect: (option: PreparedPictographData) => void;
    // Sequence context for reversal detection
    currentSequence?: PictographData[];
  }

  const {
    letterType,
    options,
    cardSize,
    columns,
    gap = "8px",
    showHeader = true,
    isFading = false,
    onSelect,
    currentSequence = [],
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
    {isFading}
    {onSelect}
    {currentSequence}
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
