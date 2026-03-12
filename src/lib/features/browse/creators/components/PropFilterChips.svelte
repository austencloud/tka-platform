<!--
  PropFilterChips.svelte

  Horizontally scrollable prop filter chips for the creators list.
  Tap a chip to filter creators by that prop. Multi-select supported.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

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
  {#each FILTER_PROPS as prop}
    {@const info = getPropTypeDisplayInfo(prop)}
    {@const isSelected = selectedProps.includes(prop)}
    <button
      type="button"
      class="prop-chip"
      class:selected={isSelected}
      onclick={() => onToggle(prop)}
      aria-pressed={isSelected}
      aria-label="{info.label} filter"
    >
      <img src={info.image} alt="" class="chip-icon" aria-hidden="true" />
      <span class="chip-label">{info.label}</span>
    </button>
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

  .prop-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .prop-chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .prop-chip.selected {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    color: var(--theme-accent, #6366f1);
  }

  .prop-chip:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .chip-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .chip-label {
    font-weight: 600;
  }

  @media (prefers-reduced-motion: reduce) {
    .prop-chip {
      transition: none;
    }
  }
</style>
