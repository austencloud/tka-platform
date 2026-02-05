<script lang="ts">
  /**
   * PanelGrid - Auto-fill grid for cards
   *
   * Provides responsive grid layout for panel content.
   */

  import type { Snippet } from "svelte";

  interface Props {
    /** Content to render */
    children: Snippet;
    /** Minimum card width for auto-fill (default: 280px) */
    minCardWidth?: string;
    /** Maximum card width for auto-fill (default: 1fr - fills available space) */
    maxCardWidth?: string;
    /** Gap between items (default: 16px) */
    gap?: string;
    /** Number of columns (overrides auto-fill if set) */
    columns?: number;
    /** Center items in grid when they don't fill full width */
    centered?: boolean;
  }

  let {
    children,
    minCardWidth = "280px",
    maxCardWidth = "1fr",
    gap = "16px",
    columns,
    centered = false,
  }: Props = $props();

  const gridTemplateColumns = $derived(
    columns
      ? `repeat(${columns}, 1fr)`
      : `repeat(auto-fill, minmax(${minCardWidth}, ${maxCardWidth}))`
  );
</script>

<div
  class="panel-grid"
  class:centered
  style:grid-template-columns={gridTemplateColumns}
  style:gap
>
  {@render children()}
</div>

<style>
  .panel-grid {
    display: grid;
    padding: 4px;
  }

  .panel-grid.centered {
    justify-content: center;
  }

  @media (max-width: 640px) {
    .panel-grid {
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 12px !important;
    }
  }
</style>
