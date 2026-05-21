<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import {
    getBasePropType,
    getAllVariations,
    getPropTypeDisplayInfo,
    isPropActive,
    getBasePropsByCategory,
    PROP_CATEGORIES,
  } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import { getPerformerColor } from "../../constants/performer-colors";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import CascadeBadge from "./CascadeBadge.svelte";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);

  const selected = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });

  const isAllMode = $derived(selectedIndex === null);

  const currentProp = $derived(
    isAllMode
      ? viewer.defaultSettings.prop
      : (selected?.effectiveProp ?? viewer.defaultSettings.prop)
  );

  const isOverridden = $derived(!isAllMode && (selected?.hasOverride.prop ?? false));
  const overrideCount = $derived(isAllMode ? viewer.overrideCountForCategory("prop") : 0);

  const performerColor = $derived(isAllMode ? "#4a9eff" : getPerformerColor(selectedIndex ?? 0));

  const propCategories = $derived(getBasePropsByCategory());
  const selectedBase = $derived(getBasePropType(currentProp));
  let expandedFamily = $state<PropType | null>(null);

  const familyVariants = $derived(
    expandedFamily ? getAllVariations(expandedFamily).filter(isPropActive) : [],
  );

  function variantCount(base: PropType): number | undefined {
    const count = getAllVariations(base).filter(isPropActive).length;
    return count > 1 ? count : undefined;
  }

  function handleFamilyClick(base: PropType) {
    const activeVariants = getAllVariations(base).filter(isPropActive);
    if (activeVariants.length <= 1) {
      if (isAllMode) {
        viewer.setDefaultProp(base);
      } else if (selected) {
        selected.setProp(base);
      }
      expandedFamily = null;
    } else {
      expandedFamily = base;
    }
  }

  function handleVariantClick(variant: PropType) {
    if (isAllMode) {
      viewer.setDefaultProp(variant);
    } else if (selected) {
      selected.setProp(variant);
    }
  }
</script>

<div class="prop-content" style:--pop-accent={performerColor}>
  {#if isAllMode && overrideCount > 0}
    <CascadeBadge mode="overrides" {overrideCount} categoryLabel="prop" onReset={() => viewer.resetAllPerformersProp()} />
  {:else if !isAllMode && isOverridden}
    <CascadeBadge mode="custom" onReset={() => selected?.resetProp()} />
  {:else if !isAllMode}
    <CascadeBadge mode="default" />
  {/if}
  {#each PROP_CATEGORIES as cat, ci}
    {@const bases = propCategories.get(cat.id) ?? []}
    {#if bases.length > 0}
      {#if ci > 0}
        <div class="divider"></div>
      {/if}
      <div class="tile-row">
        {#each bases as base}
          {@const info = getPropTypeDisplayInfo(base)}
          {@const isSelected = expandedFamily !== null ? expandedFamily === base : selectedBase === base}
          {@const badge = variantCount(base)}
          <button
            class="tile"
            class:selected={isSelected}
            aria-pressed={isSelected}
            aria-label={info.label}
            title={info.label}
            onclick={() => handleFamilyClick(base)}
          >
            {#if badge}
              <span class="badge">{badge}</span>
            {/if}
            <div class="tile-icon">
              <PropCompositionPreview propType={base} size={40} darkBackground />
            </div>
          </button>
        {/each}
      </div>
    {/if}
  {/each}
</div>

{#if expandedFamily && familyVariants.length > 1}
  <div class="variant-strip" transition:slide={{ duration: 180, easing: cubicOut }}>
    <span class="variant-label">{getPropTypeDisplayInfo(expandedFamily).label} Variants</span>
    <div class="variant-row">
      {#each familyVariants as variant}
        {@const vInfo = getPropTypeDisplayInfo(variant)}
        <button
          class="variant-chip"
          class:active={currentProp === variant}
          onclick={() => handleVariantClick(variant)}
        >
          <div class="variant-icon">
            <PropCompositionPreview propType={variant} size={32} darkBackground />
          </div>
          <span class="variant-name">{vInfo.label}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .prop-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 0 4px;
  }
  .tile-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tile {
    width: 56px;
    height: 56px;
    background: #000;
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    cursor: pointer;
    transition: all 160ms cubic-bezier(0.2, 0, 0.13, 1.5);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 0;
  }
  .tile:hover {
    background: #0a0c14;
    border-color: rgba(255, 255, 255, 0.35);
    transform: scale(1.05);
  }
  .tile.selected {
    border-color: var(--pop-accent);
    border-width: 2px;
    background: color-mix(in srgb, var(--pop-accent) 15%, #000);
    box-shadow: 0 0 16px color-mix(in srgb, var(--pop-accent) 35%, transparent);
  }
  .tile-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
  }
  .badge {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 15px;
    height: 15px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.14);
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.6);
    pointer-events: none;
  }
  .tile.selected .badge {
    background: color-mix(in srgb, var(--pop-accent) 40%, transparent);
    color: var(--pop-accent);
  }
  .variant-strip {
    background: #08090f;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0 -14px -14px;
  }
  .variant-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.45);
    padding: 0 2px;
  }
  .variant-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .variant-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px 5px 5px;
    background: #000;
    border: 1.5px solid rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms;
    color: rgba(255, 255, 255, 0.8);
  }
  .variant-chip:hover {
    background: #0a0c14;
    border-color: rgba(255, 255, 255, 0.35);
    color: white;
  }
  .variant-chip.active {
    border-color: var(--pop-accent);
    border-width: 2px;
    background: color-mix(in srgb, var(--pop-accent) 15%, #000);
    color: white;
    box-shadow: 0 0 12px color-mix(in srgb, var(--pop-accent) 30%, transparent);
  }
  .variant-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .variant-name {
    font-size: 12px;
    font-weight: 600;
  }
</style>
