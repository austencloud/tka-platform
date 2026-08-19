<script lang="ts">
  import {
    getBasePropType,
    getAllVariations,
    getPropTypeDisplayInfo,
    isPropActive,
    getBasePropsByCategory,
    PROP_CATEGORIES,
  } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    filterSpinnerPropCategories,
    isSpinnerViewerProp,
  } from "../../domain/prop-motion-discipline";

  interface Props {
    currentProp: PropType;
    accentColor: string;
    onSelect: (propType: PropType) => void;
  }

  let { currentProp, accentColor, onSelect }: Props = $props();

  const propCategories = $derived(
    filterSpinnerPropCategories(getBasePropsByCategory())
  );
  const selectedBase = $derived(getBasePropType(currentProp));
  let openFamily = $state<PropType | null>(null);
  const familyVariants = $derived(
    openFamily
      ? getAllVariations(openFamily).filter(
          (propType) => isPropActive(propType) && isSpinnerViewerProp(propType)
        )
      : []
  );

  function activeVariants(base: PropType): PropType[] {
    return getAllVariations(base).filter(
      (propType) => isPropActive(propType) && isSpinnerViewerProp(propType)
    );
  }

  function chooseFamily(base: PropType): void {
    const variants = activeVariants(base);
    if (variants.length <= 1) {
      onSelect(variants[0] ?? base);
      return;
    }
    openFamily = base;
  }

  function chooseVariant(variant: PropType): void {
    onSelect(variant);
    openFamily = null;
  }
</script>

<div class="prop-picker" style:--prop-accent={accentColor}>
  {#if openFamily && familyVariants.length > 1}
    <div class="drill-header">
      <button
        class="back-button"
        type="button"
        onclick={() => (openFamily = null)}
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>All props</span>
      </button>
      <div class="drill-title">
        <strong>{getPropTypeDisplayInfo(openFamily).label}</strong>
        <span>Choose a variant</span>
      </div>
    </div>

    <div
      class="variant-grid"
      aria-label={`${getPropTypeDisplayInfo(openFamily).label} variants`}
    >
      {#each familyVariants as variant}
        {@const info = getPropTypeDisplayInfo(variant)}
        <button
          class="prop-choice variant-choice"
          class:selected={currentProp === variant}
          type="button"
          aria-pressed={currentProp === variant}
          onclick={() => chooseVariant(variant)}
        >
          <PropCompositionPreview propType={variant} size={42} darkBackground />
          <span>{info.label}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="picker-intro">
      <strong>Choose a prop</strong>
      <span>Families with variants open a focused second page.</span>
    </div>

    <div class="family-grid" role="group" aria-label="Prop families">
      {#each PROP_CATEGORIES as category}
        {@const bases = propCategories.get(category.id) ?? []}
        {#if bases.length > 0}
          <h3 class="category-label" id={`prop-category-${category.id}`}>
            {category.label}
          </h3>
          {#each bases as base}
            {@const info = getPropTypeDisplayInfo(base)}
            {@const variantTotal = activeVariants(base).length}
            <button
              class="prop-choice family-choice"
              class:selected={selectedBase === base}
              type="button"
              aria-pressed={selectedBase === base}
              aria-describedby={`prop-category-${category.id}`}
              onclick={() => chooseFamily(base)}
            >
              {#if variantTotal > 1}
                <span class="variant-count" aria-label={`${variantTotal} variants`}>
                  {variantTotal}
                </span>
              {/if}
              <PropCompositionPreview propType={base} size={42} darkBackground />
              <span>{info.label}</span>
              {#if variantTotal > 1}
                <i class="fas fa-chevron-right" aria-hidden="true"></i>
              {/if}
            </button>
          {/each}
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .prop-picker {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .picker-intro,
  .drill-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .picker-intro strong,
  .drill-title strong {
    color: var(--theme-text);
    font-size: 15px;
    line-height: 1.2;
  }
  .picker-intro span,
  .drill-title span {
    color: var(--theme-text-dim);
    font-size: 14px;
    line-height: 1.35;
  }
  /* Category counts are 5/5/5/3 and each category restarts its rows at the
     full-width label, so column counts must divide 5 cleanly (or leave >1 in
     the remainder) — 3 and 5, never 4/6/8. Re-check if the prop registry
     changes.
     Variant counts are 2 or 4 (Staff is the only 4-variant family), so the
     wide tier pins 4 capped tracks and left-aligns instead of stretching. */
  .family-grid,
  .variant-grid {
    display: grid;
    gap: 8px;
  }
  .family-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .variant-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .category-label {
    grid-column: 1 / -1;
    margin: 6px 0 0;
    color: var(--theme-text-dim);
    font-size: 14px;
    font-weight: 700;
  }
  .family-grid > .category-label:first-child {
    margin-top: 0;
  }
  @container (min-width: 480px) {
    .family-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
    .variant-grid {
      grid-template-columns: repeat(4, minmax(0, 8.75rem));
      justify-content: start;
    }
  }
  .prop-choice {
    position: relative;
    min-width: 0;
    min-height: 82px;
    padding: 8px 6px;
    border: 1.5px solid var(--theme-stroke);
    border-radius: 10px;
    background: var(--surface-inset-deep);
    color: var(--theme-text-dim);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 14px;
    font-weight: 650;
    line-height: 1.15;
    transition:
      background 150ms ease,
      border-color 150ms ease,
      color 150ms ease,
      transform 150ms ease;
  }
  .prop-choice:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateY(-1px);
  }
  .prop-choice.selected {
    background: color-mix(
      in srgb,
      var(--prop-accent) 17%,
      var(--surface-inset-deep)
    );
    border-color: var(--prop-accent);
    color: white;
    box-shadow: 0 0 12px color-mix(in srgb, var(--prop-accent) 20%, transparent);
  }
  .prop-choice > span:not(.variant-count) {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .family-choice > i {
    position: absolute;
    right: 7px;
    bottom: 7px;
    color: var(--theme-text-tertiary);
    font-size: 11px;
  }
  .variant-count {
    position: absolute;
    top: 6px;
    right: 6px;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 10px;
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 800;
  }
  .drill-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .back-button {
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--theme-stroke);
    border-radius: 9px;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
  }
  .back-button:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }
  button:focus-visible {
    outline: 2px solid var(--prop-accent);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .prop-choice {
      transition: none;
    }
  }
</style>
