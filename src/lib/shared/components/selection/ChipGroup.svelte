<script lang="ts">
  /**
   * ChipGroup - Container for multiple ChipToggle components
   *
   * Provides consistent spacing and layout for groups of toggle chips.
   *
   * @example
   * <ChipGroup label="Layers">
   *   <ChipToggle label="Stars" active={showStars} onclick={() => toggle('stars')} />
   *   <ChipToggle label="Moon" active={showMoon} onclick={() => toggle('moon')} />
   * </ChipGroup>
   */

  import type { Snippet } from "svelte";

  interface Props {
    label?: string;
    variant?: "row" | "grid";
    children: Snippet;
  }

  let { label, variant = "grid", children }: Props = $props();
</script>

<div class="chip-group">
  {#if label}
    <span class="chip-group-label">{label}</span>
  {/if}
  <div class="chip-group-content {variant}">
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
</style>
