<!--
  BentoPropGrid.svelte - Family-first prop selection grid

  Shows 16 prop families in a sectioned grid. Single-prop families
  select immediately. Multi-variant families open a variant strip
  at the bottom for drilling into specific variants.

  Variants:
  - "panel" (default): has border/background for standalone use (e.g. Settings tab)
  - "inline": no border/background, used inside drawers that already provide a container
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import {
    getBasePropType,
    getAllVariations,
    getPropTypeDisplayInfo,
  } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
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

  // Family definitions: one base prop per family, grouped by section
  const PROP_FAMILIES: { label: string; bases: PropType[] }[] = [
    {
      label: "Staves & Clubs",
      bases: [PropType.STAFF, PropType.CLUB, PropType.FAN],
    },
    {
      label: "Curved Props",
      bases: [
        PropType.BUUGENG,
        PropType.TRIGENG,
        PropType.MINIHOOP,
        PropType.TRIAD,
        PropType.TRIQUETRA,
      ],
    },
    {
      label: "Novelty",
      bases: [
        PropType.CHICKEN,
        PropType.GUITAR,
        PropType.DOUBLESTAR,
        PropType.EIGHTRINGS,
        PropType.CONTACTBALL,
        PropType.TORCH,
      ],
    },
    {
      label: "Singles",
      bases: [PropType.HAND, PropType.SWORD, PropType.QUIAD],
    },
  ];

  let expandedFamily = $state<PropType | null>(null);

  const selectedBase = $derived(getBasePropType(selectedPropType));
  const familyVariants = $derived(
    expandedFamily ? getAllVariations(expandedFamily) : [],
  );

  // No auto-expand on mount. Grid starts fully visible.
  // expandedFamily is driven entirely by user clicks.

  function handleFamilyClick(base: PropType) {
    const variants = getAllVariations(base);
    if (variants.length === 1) {
      // Single-prop family: select immediately, collapse any strip
      onSelect(base);
      expandedFamily = null;
    } else {
      // Multi-variant family: expand strip without selecting yet.
      // Visual highlight comes from expandedFamily check on the button.
      expandedFamily = base;
    }
  }

  function collapseVariants() {
    expandedFamily = null;
  }

  function variantCount(base: PropType): number | undefined {
    const count = getAllVariations(base).length;
    return count > 1 ? count : undefined;
  }
</script>

<div
  class="prop-grid-root"
  class:panel={variant === "panel"}
  class:inline={variant === "inline"}
>
  <!-- Header (panel variant only) -->
  {#if variant === "panel"}
    <header class="grid-header">
      <h4 class="grid-title">{title}</h4>
    </header>
  {/if}

  <!-- Scrollable family grid — clicking the dimmed backdrop collapses variants -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="grid-scroll themed-scrollbar"
    class:dimmed={expandedFamily !== null}
    onclick={(e) => {
      if (expandedFamily !== null && e.target === e.currentTarget) {
        collapseVariants();
      }
    }}
  >
    <div class="grid-content">
      {#each PROP_FAMILIES as section, i}
        <div class="section-label" class:first={i === 0}>{section.label}</div>
        <div class="section-buttons">
          {#each section.bases as base}
            <PropTypeButton
              propType={base}
              selected={expandedFamily !== null ? expandedFamily === base : selectedBase === base}
              badge={variantCount(base)}
              {color}
              onSelect={() => handleFamilyClick(base)}
            />
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <!-- Variant strip (shown when a multi-variant family is expanded) -->
  {#if expandedFamily && familyVariants.length > 1}
    <div class="variant-strip">
      <span class="variant-label"
        >{getPropTypeDisplayInfo(expandedFamily).label} Variants</span
      >
      <div class="variant-buttons">
        {#each familyVariants as variantProp}
          <PropTypeButton
            propType={variantProp}
            selected={selectedPropType === variantProp}
            {color}
            onSelect={() => onSelect(variantProp)}
          />
        {/each}
      </div>
    </div>
  {/if}
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

  /* Panel variant: bordered card for standalone use */
  .prop-grid-root.panel {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  /* Inline variant: no border, transparent -- drawer provides the container */
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
    transition: opacity var(--duration-normal, 200ms) ease;
  }

  /* Dim the grid when variant strip is open to focus attention below */
  .grid-scroll.dimmed {
    opacity: 0.45;
  }

  /* Vertical stack of sections */
  .grid-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* Section label -- lightweight text divider */
  .section-label {
    font-size: var(--font-size-compact, 10px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    opacity: 0.7;
    padding: 8px 4px 2px;
    text-align: center;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  /* First section has no top border */
  .section-label.first {
    border-top: none;
    padding-top: 0;
  }

  /* Flex row of family buttons -- centered with wrapping */
  .section-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    padding: 0 4px;
  }

  /* Family buttons: fixed width so centering works */
  .section-buttons :global(.prop-button) {
    width: 80px;
    flex-shrink: 0;
  }

  /* === Variant strip === */
  .variant-strip {
    flex-shrink: 0;
    padding: 10px 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    animation: variant-strip-enter var(--duration-emphasis, 300ms)
      cubic-bezier(0.36, 0.66, 0.04, 1);
  }

  @keyframes variant-strip-enter {
    0% {
      opacity: 0;
      transform: translateY(100%);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .variant-label {
    font-size: var(--font-size-compact, 10px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .variant-buttons {
    display: flex;
    gap: 8px;
    justify-content: center;
    align-items: flex-start;
  }

  /* Variant buttons: fixed explicit dimensions to guarantee SVG renders */
  .variant-buttons :global(.prop-button) {
    width: 70px;
    height: 80px;
    aspect-ratio: auto;
    flex-shrink: 0;
  }

  /* Container query: widen family buttons on larger containers */
  @container prop-grid (min-width: 400px) {
    .section-buttons :global(.prop-button) {
      width: 90px;
    }
  }

  @container prop-grid (min-width: 550px) {
    .section-buttons :global(.prop-button) {
      width: 100px;
    }

    .variant-buttons :global(.prop-button) {
      width: 80px;
      height: 90px;
    }
  }

  @container prop-grid (min-width: 700px) {
    .section-buttons :global(.prop-button) {
      width: 95px;
    }

    .section-label {
      font-size: var(--font-size-xs, 11px);
    }
  }

  @container prop-grid (min-width: 900px) {
    .section-buttons :global(.prop-button) {
      width: 90px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .grid-scroll {
      scroll-behavior: auto;
      transition: none;
    }

    .variant-strip {
      animation: none;
    }
  }
</style>
