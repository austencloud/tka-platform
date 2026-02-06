<script lang="ts">
  /**
   * PositionPairSelector - Start → End grid position pair
   * Uses --theme-* CSS variables for consistent theming.
   */

  import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import GridPointSelector from "./GridPointSelector.svelte";

  interface Props {
    /** Start position */
    startValue: GridLocation;
    /** End position */
    endValue: GridLocation;
    /** Prop color for accent */
    color?: "blue" | "red";
    /** Start position change handler */
    onStartChange: (loc: GridLocation) => void;
    /** End position change handler */
    onEndChange: (loc: GridLocation) => void;
  }

  let {
    startValue,
    endValue,
    color = "blue",
    onStartChange,
    onEndChange,
  }: Props = $props();
</script>

<div class="position-pair">
  <GridPointSelector
    label="Start"
    value={startValue}
    onchange={onStartChange}
    {color}
  />
  <div class="arrow">→</div>
  <GridPointSelector
    label="End"
    value={endValue}
    onchange={onEndChange}
    {color}
  />
</div>

<style>
  .position-pair {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .arrow {
    font-size: var(--font-size-xl, 1.25rem);
    color: var(--theme-text-dim);
    margin-top: 1rem;
    flex-shrink: 0;
  }
</style>
