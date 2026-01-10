<!--
  PropSelectionSheet.svelte
  Drawer for selecting props - right on desktop, bottom on mobile
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import { onMount } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import {
    getAllPropTypes,
    VARIANT_PROP_TYPES,
    hasVariations,
    getNextVariation,
    getBasePropType,
    getVariationLabel,
    getAllVariations,
    getVariationIndex,
  } from "./PropTypeRegistry";
  import PropTypeButton from "./PropTypeButton.svelte";

  let {
    isOpen = $bindable(false),
    selectedPropType,
    color = "blue",
    title = "Select Prop",
    onSelect,
    onImageLoad,
  } = $props<{
    isOpen?: boolean;
    selectedPropType: PropType;
    color?: "blue" | "red";
    title?: string;
    onSelect: (propType: PropType) => void;
    onImageLoad?: (propType: PropType, width: number, height: number) => void;
  }>();

  // Services
  let hapticService: IHapticFeedback;
  let deviceDetector: IDeviceDetector | null = null;

  // Drawer placement based on device
  let placement = $state<"bottom" | "right">("right");

  onMount(() => {
    deviceDetector = container.items.deviceDetector as IDeviceDetector;
    updatePlacement();

    const cleanup = deviceDetector?.onCapabilitiesChanged(() => {
      updatePlacement();
    });

    return () => cleanup?.();
  });

  function updatePlacement() {
    if (!deviceDetector) return;
    const navigationLayout = deviceDetector.getNavigationLayoutImmediate();
    // Bottom navigation = bottom drawer, Top/Left navigation = right drawer
    placement = navigationLayout === "bottom" ? "bottom" : "right";
  }

  // Get all prop types (excluding variants)
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
    const imageAspectRatio = dimensions.width / dimensions.height;
    return imageAspectRatio > 1.5;
  }

  function handleImageLoadInternal(
    propType: PropType,
    width: number,
    height: number
  ) {
    imageDimensions.set(propType, { width, height });
    imageDimensions = new Map(imageDimensions);
    onImageLoad?.(propType, width, height);
  }

  function handlePropSelect(propType: PropType) {
    hapticService = container.items.hapticFeedback as IHapticFeedback;
    hapticService?.trigger("selection");
    onSelect(propType);
    isOpen = false;
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

<Drawer
  {isOpen}
  {placement}
  closeOnBackdrop={true}
  closeOnEscape={true}
  dismissible={true}
  showHandle={true}
  ariaLabel={title}
  class="prop-selection-drawer"
  onOpenChange={(open) => {
    if (!open) isOpen = false;
  }}
>
  <!-- Header -->
  <header class="sheet-header">
    <h2>{title}</h2>
    {#if hasVariation}
      <button class="variation-toggle" onclick={toggleVariation}>
        <span class="variation-indicator">
          {#each variations as _, i}
            <span class="variation-dot" class:active={i === variationIndex}
            ></span>
          {/each}
        </span>
        <span class="variation-text">{variationLabel}</span>
        <i class="fas fa-sync-alt" aria-hidden="true"></i>
      </button>
    {/if}
  </header>

  <!-- Prop Grid -->
  <div class="sheet-content">
    <div class="prop-grid-wrapper">
      <div class="prop-grid">
      {#each propTypes as propType}
        {@const isSelected = getBasePropType(selectedPropType) === propType}
        <PropTypeButton
          {propType}
          selected={isSelected}
          shouldRotate={shouldRotate(propType)}
          {color}
          onSelect={handlePropSelect}
          onImageLoad={handleImageLoadInternal}
        />
      {/each}
      </div>
    </div>
  </div>
</Drawer>

<style>
  /* Bottom sheet constraint - only cover prop controls area, not beat grid */
  :global(.prop-selection-drawer[data-placement="bottom"]) {
    max-height: 55vh; /* Covers prop controls, leaves beat grid visible */
    height: auto;
  }

  /* Right drawer - full height is fine */
  :global(.prop-selection-drawer[data-placement="right"]) {
    width: min(400px, 85vw);
  }

  /* Header */
  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .sheet-header h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }

  /* Content - uses container queries for responsive grid */
  .sheet-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px;
    container-type: size;
    container-name: prop-sheet;
    /* Center grid vertically when there's extra space */
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  /* Wrapper - let grid fill available space */
  .prop-grid-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  /* Prop Grid - Default for wide containers (bottom sheet) */
  .prop-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
    width: 100%;
  }

  /* TALL containers: aspect-ratio < 1 means height > width */
  /* Use 3 columns for 5 rows - fills vertical space */
  @container prop-sheet (aspect-ratio < 1) {
    .prop-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: clamp(12px, 2cqh, 20px);
    }
  }

  /* VERY TALL containers (like right drawer) */
  @container prop-sheet (aspect-ratio < 0.7) {
    .prop-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: clamp(14px, 2.5cqh, 24px);
    }
  }

  /* WIDE containers: aspect-ratio > 1 means width > height */
  @container prop-sheet (aspect-ratio > 1) {
    .prop-grid {
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
    }
  }

  /* Narrow width fallback */
  @container prop-sheet (max-width: 280px) {
    .prop-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* Variation Toggle */
  .variation-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text, var(--theme-text));
    font-size: var(--font-size-compact);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .variation-toggle:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .variation-indicator {
    display: flex;
    gap: 4px;
  }

  .variation-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--theme-text-dim);
    transition: all 0.2s ease;
  }

  .variation-dot.active {
    background: var(--theme-accent);
    box-shadow: 0 0 6px
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 50%,
        transparent
      );
  }

  .variation-text {
    white-space: nowrap;
  }

  .variation-toggle i {
    font-size: var(--font-size-compact);
    opacity: 0.7;
  }
</style>
