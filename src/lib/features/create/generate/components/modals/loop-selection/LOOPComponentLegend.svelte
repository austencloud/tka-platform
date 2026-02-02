<!--
LOOPComponentLegend.svelte - Interactive legend for LOOP component selection

Displays all 6 LOOP components as clickable legend items. Each item shows a
Font Awesome icon and label, with visual feedback for active/hover states.

Used alongside LOOPIconStrip to provide the primary way to toggle components.
-->
<script lang="ts">
  import { LOOPComponent } from "../../../shared/domain/models/generate-models";
  import { LOOP_COMPONENTS } from "../../../shared/domain/constants/loop-constants";

  interface Props {
    selectedComponents: Set<LOOPComponent>;
    onToggle: (component: LOOPComponent) => void;
    compact?: boolean;
    layout?: 'list' | 'grid';
  }

  let { selectedComponents, onToggle, compact = false, layout = 'list' }: Props = $props();
</script>

<div class="pie-legend" class:compact class:grid={layout === 'grid'}>
  {#each LOOP_COMPONENTS as componentInfo}
    <button
      class="legend-item"
      class:active={selectedComponents.has(componentInfo.component)}
      onclick={() => onToggle(componentInfo.component)}
      style="--component-color: {componentInfo.color}"
      aria-pressed={selectedComponents.has(componentInfo.component)}
      aria-label="{componentInfo.label}: {selectedComponents.has(componentInfo.component)
        ? 'selected'
        : 'not selected'}"
    >
      <i
        class="fas fa-{componentInfo.icon} legend-icon"
        class:filled={selectedComponents.has(componentInfo.component)}
        aria-hidden="true"
      ></i>
      <span class="legend-label">{componentInfo.label}</span>
    </button>
  {/each}
</div>

<style>
  .pie-legend {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pie-legend.compact {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-width: 120px;
    min-height: 36px;
  }

  .pie-legend.compact .legend-item {
    min-width: auto;
  }

  .legend-item:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-color: var(--component-color);
  }

  .legend-item.active {
    background: color-mix(in srgb, var(--component-color) 15%, transparent);
    border-color: var(--component-color);
  }

  .legend-item:focus-visible {
    outline: 2px solid var(--component-color);
    outline-offset: 2px;
  }

  .legend-icon {
    font-size: 14px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    transition: color var(--duration-normal) ease;
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }

  .legend-icon.filled {
    color: var(--component-color);
  }

  .legend-label {
    font-size: var(--font-size-sm);
    color: var(--theme-text, white);
    font-weight: 500;
  }

  /* Grid layout: 3x2 chip grid */
  .pie-legend.grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .pie-legend.grid .legend-item {
    flex-direction: column;
    align-items: center;
    text-align: center;
    min-height: 48px;
    min-width: 0;
    padding: 8px 4px;
    gap: 4px;
  }

  .pie-legend.grid .legend-icon {
    font-size: 18px;
    width: auto;
  }

  .pie-legend.grid .legend-label {
    font-size: var(--font-size-compact, 12px);
  }

  /* Mobile: stack vertically on small screens */
  @media (max-width: 360px) {
    .pie-legend:not(.compact):not(.grid) {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }

    .legend-item {
      min-width: auto;
    }
  }
</style>
