<!--
FilterChipRow.svelte - Horizontal scrollable row of filter chips.
Chips stay in original order (never reorder on selection - Baymard research).
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="filter-chip-row" role="toolbar" aria-label="Filter options">
  {@render children()}
</div>

<style>
  .filter-chip-row {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    padding: 0 4px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .filter-chip-row::-webkit-scrollbar {
    display: none;
  }

  /* On narrow panels, allow wrapping to 2 rows */
  @container inline-filter (max-width: 360px) {
    .filter-chip-row {
      flex-wrap: wrap;
    }
  }
</style>
