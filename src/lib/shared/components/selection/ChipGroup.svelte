<script lang="ts">
  /**
   * ChipGroup - Container for multiple ChipToggle components
   *
   * Provides consistent spacing and layout for groups of toggle chips.
   *
   * @example
   * // Wrapping grid (default)
   * <ChipGroup label="Layers">
   *   <ChipToggle label="Stars" active={showStars} onclick={() => toggle('stars')} />
   *   <ChipToggle label="Moon" active={showMoon} onclick={() => toggle('moon')} />
   * </ChipGroup>
   *
   * // Fixed 4-column grid (for quick commands)
   * <ChipGroup columns={4}>
   *   <ChipToggle icon="fa-sync" label="Regen" onclick={regen} />
   *   <ChipToggle icon="fa-plus" label="Fish" onclick={addFish} />
   * </ChipGroup>
   */

  import type { Snippet } from "svelte";

  interface Props {
    label?: string;
    variant?: "row" | "grid";
    columns?: 2 | 3 | 4;
    children: Snippet;
  }

  let { label, variant = "grid", columns, children }: Props = $props();

  // If columns is specified, use CSS grid instead of flexbox
  const useFixedGrid = columns !== undefined;
</script>

<div class="chip-group">
  {#if label}
    <span class="chip-group-label">{label}</span>
  {/if}
  <div
    class="chip-group-content {variant}"
    class:fixed-grid={useFixedGrid}
    style={useFixedGrid ? `--columns: ${columns}` : undefined}
  >
    {@render children()}
  </div>
</div>

<style>
  .chip-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .chip-group-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .chip-group-content {
    display: flex;
    gap: 8px;
  }

  .chip-group-content.row {
    flex-wrap: nowrap;
  }

  .chip-group-content.grid {
    flex-wrap: wrap;
  }

  /* Fixed column grid (overrides flex layout) */
  .chip-group-content.fixed-grid {
    display: grid;
    grid-template-columns: repeat(var(--columns, 4), 1fr);
  }
</style>
