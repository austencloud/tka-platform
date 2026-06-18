<!--
  BentoPropGrid.svelte - Flat prop selection grid

  Every prop renders as its own button under one of three section headers
  (Standard / Big / Novelty). No variant popover, no count badges — the
  sections come from PROP_PICKER_SECTIONS.

  Variants:
  - "panel" (default): has border/background for standalone use (e.g. Settings tab)
  - "inline": no border/background, used inside drawers that already provide a container
  - flat: drop the section labels and pack every prop into one dense auto-fill
    grid. For tight contexts (the mobile dock) where maximizing visible count
    beats grouping.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    PROP_PICKER_SECTIONS,
    isPropActive,
  } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import PropTypeButton from "./PropTypeButton.svelte";

  let {
    selectedPropType,
    color = "blue",
    title = "Select Prop",
    onSelect,
    variant = "panel",
    flat = false,
  } = $props<{
    selectedPropType: PropType;
    color?: "blue" | "red" | (string & {});
    title?: string;
    onSelect: (propType: PropType) => void;
    variant?: "panel" | "inline";
    /**
     * Flat mode: drop the section labels and pack every prop into one dense
     * auto-fill grid. For tight contexts (the mobile dock) where maximizing
     * visible count beats grouping.
     */
    flat?: boolean;
  }>();

  // Active props grouped into the three flat picker sections. Each prop renders
  // as its own button — no variant drill-down.
  const sections = $derived(
    PROP_PICKER_SECTIONS.map((s) => ({
      label: s.label,
      props: s.props.filter(isPropActive),
    })).filter((s) => s.props.length > 0),
  );

  const allProps = $derived(sections.flatMap((s) => s.props));
</script>

<div
  class="prop-grid-root"
  class:panel={variant === "panel"}
  class:inline={variant === "inline"}
>
  {#if variant === "panel"}
    <header class="grid-header">
      <h4 class="grid-title">{title}</h4>
    </header>
  {/if}

  {#snippet tile(prop: PropType)}
    <PropTypeButton
      propType={prop}
      selected={selectedPropType === prop}
      {color}
      onSelect={() => onSelect(prop)}
    />
  {/snippet}

  <div class="grid-scroll themed-scrollbar">
    {#if flat}
      <div class="flat-grid">
        {#each allProps as prop (prop)}
          {@render tile(prop)}
        {/each}
      </div>
    {:else}
      <div class="grid-content">
        {#each sections as section, i}
          <div class="section-label" class:first={i === 0}>{section.label}</div>
          <div class="section-buttons">
            {#each section.props as prop (prop)}
              {@render tile(prop)}
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .prop-grid-root {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    flex: 1;
    container-type: inline-size;
    container-name: prop-grid;
  }

  .prop-grid-root.panel {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  .prop-grid-root.inline {
    background: transparent;
    border: none;
    border-radius: 0;
  }

  .grid-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 0;
    flex-shrink: 0;
  }

  .grid-title {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .grid-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px;
    scrollbar-width: thin;
  }

  .grid-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* Flat mode: one dense grid, no sections — maximize visible prop count. */
  .flat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 6px;
    padding: 0 2px;
  }
  .flat-grid :global(.prop-button) {
    width: 100%;
  }

  .section-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    opacity: 0.5;
    padding: 8px 4px 2px;
    text-align: center;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .section-label.first {
    border-top: none;
    padding-top: 0;
  }

  .section-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    padding: 0 4px;
  }

  .section-buttons :global(.prop-button) {
    width: 79px;
    flex-shrink: 0;
  }

  /* Container queries for larger containers */
  @container prop-grid (min-width: 400px) {
    .section-buttons :global(.prop-button) {
      width: 90px;
    }
  }

  @container prop-grid (min-width: 550px) {
    .section-buttons :global(.prop-button) {
      width: 100px;
    }
  }

  @container prop-grid (min-width: 700px) {
    .section-buttons :global(.prop-button) {
      width: 95px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .grid-scroll {
      scroll-behavior: auto;
    }
  }
</style>
