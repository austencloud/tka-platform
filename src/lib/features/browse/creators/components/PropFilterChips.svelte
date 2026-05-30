<!--
  PropFilterChips.svelte

  Horizontally scrollable prop filter chips for the creators list.
  Tap a chip to filter creators by that prop. Multi-select supported.
  Built on the shared FilterChipBase (toggle mode, sm size); the prop image
  rides in via the iconSnippet slot since the prop glyphs are bitmaps, not
  FontAwesome classes.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";

  interface Props {
    selectedProps: PropType[];
    onToggle: (prop: PropType) => void;
  }

  let { selectedProps, onToggle }: Props = $props();

  const FILTER_PROPS: PropType[] = [
    PropType.STAFF,
    PropType.FAN,
    PropType.CLUB,
    PropType.BUUGENG,
    PropType.MINIHOOP,
    PropType.TRIAD,
    PropType.POI,
    PropType.SWORD,
  ];
</script>

<div class="prop-filter-row" role="group" aria-label="Filter creators by prop">
  {#each FILTER_PROPS as prop (prop)}
    {@const info = getPropTypeDisplayInfo(prop)}
    {#snippet propIcon()}
      <img src={info.image} alt="" class="chip-icon" aria-hidden="true" />
    {/snippet}
    <FilterChipBase
      mode="toggle"
      size="sm"
      label={info.label}
      iconSnippet={propIcon}
      active={selectedProps.includes(prop)}
      onclick={() => onToggle(prop)}
    />
  {/each}
</div>

<style>
  .prop-filter-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 4px 0;
    scrollbar-width: none;
  }

  .prop-filter-row::-webkit-scrollbar {
    display: none;
  }

  .chip-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }
</style>
