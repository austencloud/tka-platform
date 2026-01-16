<!--
  InlinePropGrid.svelte - Desktop inline prop selection grid

  Shows all prop types in a responsive grid using container queries.
  Maximizes button sizes to fill available space.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import {
    getAllPropTypes,
    VARIANT_PROP_TYPES,
    getBasePropType,
    hasVariations,
    getVariationLabel,
    getAllVariations,
    getVariationIndex,
    getNextVariation,
  } from "./PropTypeRegistry";
  import PropTypeButton from "./PropTypeButton.svelte";

  let {
    selectedPropType,
    color = "blue",
    title = "Select Prop",
    onSelect,
  } = $props<{
    selectedPropType: PropType;
    color?: "blue" | "red";
    title?: string;
    onSelect: (propType: PropType) => void;
  }>();

  // Get base prop types (excluding variants)
  const propTypes = getAllPropTypes().filter(
    (pt) => !VARIANT_PROP_TYPES.includes(pt)
  );

  // Track image dimensions for rotation
  let imageDimensions = $state(
    new Map<PropType, { width: number; height: number }>()
  );

  function shouldRotate(propType: PropType): boolean {
    const dimensions = imageDimensions.get(propType);
    if (!dimensions) return false;
    return dimensions.width / dimensions.height > 1.5;
  }

  function handleImageLoad(
    propType: PropType,
    width: number,
    height: number
  ) {
    imageDimensions.set(propType, { width, height });
    imageDimensions = new Map(imageDimensions);
  }

  function handlePropSelect(propType: PropType) {
    onSelect(propType);
  }

  function toggleVariation() {
    if (!hasVariations(selectedPropType)) return;
    const newProp = getNextVariation(selectedPropType);
    if (newProp) {
      onSelect(newProp);
    }
  }

  // Variation state
  const hasVariation = $derived(hasVariations(selectedPropType));
  const variationLabel = $derived(getVariationLabel(selectedPropType));
  const variations = $derived(getAllVariations(selectedPropType));
  const variationIndex = $derived(getVariationIndex(selectedPropType));
</script>

<div class="inline-prop-grid">
  <!-- Header -->
  <header class="grid-header">
    <h4 class="grid-title">{title}</h4>
    {#if hasVariation}
      <button class="variation-toggle" onclick={toggleVariation}>
        <span class="variation-dots">
          {#each variations as _, i}
            <span class="dot" class:active={i === variationIndex}></span>
          {/each}
        </span>
        <span class="variation-text">{variationLabel}</span>
        <i class="fas fa-sync-alt" aria-hidden="true"></i>
      </button>
    {/if}
  </header>

  <!-- Prop Grid -->
  <div class="prop-grid">
    {#each propTypes as propType}
      {@const isSelected = getBasePropType(selectedPropType) === propType}
      <PropTypeButton
        {propType}
        selected={isSelected}
        shouldRotate={shouldRotate(propType)}
        {color}
        onSelect={handlePropSelect}
        onImageLoad={handleImageLoad}
      />
    {/each}
  </div>
</div>

<style>
  .inline-prop-grid {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2cqi, 16px);
    padding: clamp(12px, 3cqi, 20px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
    width: 100%;
    height: 100%;
    min-height: 0;
    flex: 1;
    container-type: inline-size;
    container-name: prop-grid-container;
  }

  /* Header */
  .grid-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-shrink: 0;
  }

  .grid-title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Prop Grid - responsive columns based on container width */
  .prop-grid {
    display: grid;
    /* Dynamic columns: minimum 100px, scale with container */
    grid-template-columns: repeat(auto-fill, minmax(clamp(80px, 12cqi, 150px), 1fr));
    grid-auto-rows: 1fr;
    gap: clamp(8px, 2cqi, 16px);
    flex: 1;
    min-height: 0;
    align-content: start;
    padding: 4px;
    overflow-y: auto;
  }

  /* Style prop buttons - fill their cells with aspect ratio */
  .prop-grid :global(.prop-button) {
    width: 100%;
    aspect-ratio: 1;
    min-height: 0;
  }

  /* On larger containers, allow taller buttons */
  @container prop-grid-container (min-width: 600px) {
    .prop-grid {
      grid-template-columns: repeat(auto-fill, minmax(clamp(100px, 14cqi, 180px), 1fr));
    }
  }

  @container prop-grid-container (min-width: 900px) {
    .prop-grid {
      grid-template-columns: repeat(auto-fill, minmax(clamp(120px, 15cqi, 200px), 1fr));
    }
  }

  /* Variation Toggle */
  .variation-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .variation-toggle:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .variation-dots {
    display: flex;
    gap: 4px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--theme-text-dim);
    transition: all 0.15s ease;
  }

  .dot.active {
    background: var(--theme-accent);
  }

  .variation-text {
    white-space: nowrap;
  }

  .variation-toggle i {
    font-size: 11px;
    opacity: 0.7;
  }

  /* Focus states */
  .variation-toggle:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .variation-toggle,
    .dot {
      transition: none;
    }
  }
</style>
