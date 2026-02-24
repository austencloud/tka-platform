<!--
  BentoPropGrid.svelte - Flat sectioned prop selection grid

  Shows ALL prop types in a continuous grid, grouped into logical sections
  with lightweight text dividers. No bordered boxes — props flow freely.

  Variants:
  - "panel" (default): has border/background for standalone use (e.g. Settings tab)
  - "inline": no border/background, used inside drawers that already provide a container
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import PropTypeButton from "./PropTypeButton.svelte";

  let {
    selectedPropType,
    color = "blue",
    title = "Select Prop",
    onSelect,
    variant = "panel",
  } = $props<{
    selectedPropType: PropType;
    color?: "blue" | "red";
    title?: string;
    onSelect: (propType: PropType) => void;
    /** "panel" = bordered card (desktop settings), "inline" = no border (drawer) */
    variant?: "panel" | "inline";
  }>();

  // Sections group related prop families into a continuous flow
  const PROP_SECTIONS: { label: string; props: PropType[] }[] = [
    {
      label: "Staves & Clubs",
      props: [
        PropType.STAFF, PropType.SIMPLESTAFF, PropType.BIGSTAFF, PropType.STAFF2,
        PropType.CLUB, PropType.BIGCLUB,
        PropType.FAN, PropType.BIGFAN,
      ],
    },
    {
      label: "Curved Props",
      props: [
        PropType.BUUGENG, PropType.BIGBUUGENG, PropType.TRIGENG,
        PropType.MINIHOOP, PropType.BIGHOOP,
        PropType.TRIAD, PropType.BIGTRIAD,
        PropType.TRIQUETRA, PropType.TRIQUETRA2,
      ],
    },
    {
      label: "Novelty",
      props: [
        PropType.CHICKEN, PropType.BIGCHICKEN,
        PropType.GUITAR, PropType.UKULELE,
        PropType.DOUBLESTAR, PropType.BIGDOUBLESTAR,
        PropType.EIGHTRINGS, PropType.BIGEIGHTRINGS,
        PropType.TORCH, PropType.BIGTORCH,
      ],
    },
    {
      label: "Singles",
      props: [PropType.HAND, PropType.SWORD, PropType.QUIAD],
    },
  ];

  function handlePropSelect(propType: PropType) {
    onSelect(propType);
  }
</script>

<div class="prop-grid-root" class:panel={variant === "panel"} class:inline={variant === "inline"}>
  <!-- Header -->
  {#if variant === "panel"}
    <header class="grid-header">
      <h4 class="grid-title">{title}</h4>
    </header>
  {/if}

  <!-- Scrollable content -->
  <div class="grid-scroll themed-scrollbar">
    <div class="grid-content">
      {#each PROP_SECTIONS as section, i}
        <div class="section-label" class:first={i === 0}>{section.label}</div>
        {#each section.props as propType}
          <PropTypeButton
            {propType}
            selected={selectedPropType === propType}
            {color}
            onSelect={handlePropSelect}
          />
        {/each}
      {/each}
    </div>
  </div>
</div>

<style>
  .prop-grid-root {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    height: 100%;
    min-height: 0;
    flex: 1;
    container-type: inline-size;
    container-name: prop-grid;
  }

  /* Panel variant: bordered card for standalone use */
  .prop-grid-root.panel {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  /* Inline variant: no border, transparent — drawer provides the container */
  .prop-grid-root.inline {
    background: transparent;
    border: none;
    border-radius: 0;
  }

  /* Header (panel variant only) */
  .grid-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 0;
    flex-shrink: 0;
  }

  .grid-title {
    margin: 0;
    font-size: var(--font-size-xs, 11px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Scrollable area */
  .grid-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px;
    scrollbar-width: thin;
  }

  /* Continuous grid — props flow in a single grid with section labels spanning full width */
  .grid-content {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    align-content: start;
    justify-items: center;
  }

  /* Section label — lightweight text divider spanning the full grid width */
  .section-label {
    grid-column: 1 / -1;
    font-size: var(--font-size-compact, 10px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    opacity: 0.7;
    padding: 8px 4px 2px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  /* First section has no top border */
  .section-label.first {
    border-top: none;
    padding-top: 0;
  }

  /* Prop buttons fill their grid cell */
  .grid-content :global(.prop-button) {
    width: 100%;
    max-width: 100px;
  }

  /* Container query breakpoints for column count */
  @container prop-grid (min-width: 400px) {
    .grid-content {
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
    }
  }

  @container prop-grid (min-width: 550px) {
    .grid-content {
      grid-template-columns: repeat(6, 1fr);
    }

    .grid-content :global(.prop-button) {
      max-width: 110px;
    }
  }

  @container prop-grid (min-width: 700px) {
    .grid-content {
      grid-template-columns: repeat(8, 1fr);
      gap: 10px;
    }

    .grid-content :global(.prop-button) {
      max-width: 100px;
    }
  }

  @container prop-grid (min-width: 900px) {
    .grid-content {
      grid-template-columns: repeat(10, 1fr);
    }

    .grid-content :global(.prop-button) {
      max-width: 90px;
    }

    .section-label {
      font-size: var(--font-size-xs, 11px);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .grid-scroll {
      scroll-behavior: auto;
    }
  }
</style>
