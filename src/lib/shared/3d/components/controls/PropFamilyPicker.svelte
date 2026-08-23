<script lang="ts">
  import {
    getBasePropType,
    getAllVariations,
    getPropTypeDisplayInfo,
    PROP_CATEGORIES,
  } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    isScenePhysicalProp,
    SCENE_PROP_REPRESENTATIVES,
  } from "../../domain/scene-prop-catalog";

  interface Props {
    currentProp: PropType | null;
    accentColor: string;
    onSelect: (propType: PropType) => void;
  }

  let { currentProp, accentColor, onSelect }: Props = $props();

  const propCategories = $derived.by(() => {
    return new Map(
      PROP_CATEGORIES.map((category) => [
        category.id,
        SCENE_PROP_REPRESENTATIVES.filter(
          (prop) => getPropTypeDisplayInfo(prop).category === category.id
        ),
      ])
    );
  });
  const selectedBase = $derived(
    currentProp === null ? null : getBasePropType(currentProp)
  );
  let openFamily = $state<PropType | null>(null);
  const familyVariants = $derived(
    openFamily
      ? getAllVariations(openFamily).filter((propType) =>
          isScenePhysicalProp(propType)
        )
      : []
  );

  function activeVariants(base: PropType): PropType[] {
    return getAllVariations(base).filter((propType) =>
      isScenePhysicalProp(propType)
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
      <span>The same physical catalog used by the 3D Prop Studio.</span>
    </div>

    <button
      class="bare-hands-choice"
      class:selected={currentProp === PropType.HAND}
      type="button"
      aria-pressed={currentProp === PropType.HAND}
      onclick={() => onSelect(PropType.HAND)}
    >
      <span class="bare-hands-icon" aria-hidden="true">
        <i class="fas fa-hand"></i>
      </span>
      <span class="bare-hands-copy">
        <strong>Bare hands</strong>
        <small>No visible 3D prop</small>
      </span>
    </button>

    <div class="category-list" aria-label="Physical 3D props">
      {#each PROP_CATEGORIES as category}
        {@const bases = propCategories.get(category.id) ?? []}
        {#if bases.length > 0}
          <section class="category-section">
            <h3 class="category-label" id={`prop-category-${category.id}`}>
              {category.label}
            </h3>
            <div
              class="family-grid"
              data-count={bases.length}
              style:--family-columns={Math.min(bases.length, 5)}
              role="group"
              aria-labelledby={`prop-category-${category.id}`}
            >
              {#each bases as base}
                {@const info = getPropTypeDisplayInfo(base)}
                {@const variantTotal = activeVariants(base).length}
                <button
                  class="prop-choice family-choice"
                  class:selected={selectedBase === base}
                  type="button"
                  aria-pressed={selectedBase === base}
                  onclick={() => chooseFamily(base)}
                >
                  {#if variantTotal > 1}
                    <span
                      class="variant-count"
                      aria-label={`${variantTotal} variants`}
                    >
                      {variantTotal}
                    </span>
                  {/if}
                  <PropCompositionPreview
                    propType={base}
                    size={42}
                    darkBackground
                  />
                  <span>{info.label}</span>
                  {#if variantTotal > 1}
                    <i class="fas fa-chevron-right" aria-hidden="true"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </section>
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
  .category-list {
    display: grid;
    gap: 14px;
  }
  .category-section {
    display: grid;
    gap: 8px;
  }
  .family-grid,
  .variant-grid {
    display: grid;
    gap: 8px;
  }
  .family-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .family-grid[data-count="3"],
  .family-grid[data-count="5"] {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .variant-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .category-label {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: 14px;
    font-weight: 700;
  }
  @container (min-width: 480px) {
    .family-grid {
      grid-template-columns: repeat(var(--family-columns), minmax(0, 8.75rem));
      justify-content: start;
    }
    .variant-grid {
      grid-template-columns: repeat(4, minmax(0, 8.75rem));
      justify-content: start;
    }
  }
  .bare-hands-choice {
    display: grid;
    grid-template-columns: 2.75rem minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    width: min(100%, 18rem);
    min-height: 56px;
    padding: 7px 12px;
    border: 1.5px solid var(--theme-stroke);
    border-radius: 10px;
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    text-align: left;
  }
  .bare-hands-choice:hover,
  .bare-hands-choice:focus-visible {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }
  .bare-hands-choice.selected {
    border-color: var(--prop-accent);
    background: color-mix(
      in srgb,
      var(--prop-accent) 14%,
      var(--theme-card-bg)
    );
    color: white;
  }
  .bare-hands-icon {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border-radius: 9px;
    background: color-mix(in srgb, currentColor 10%, transparent);
  }
  .bare-hands-copy {
    display: grid;
    gap: 2px;
  }
  .bare-hands-copy strong {
    font-size: 14px;
  }
  .bare-hands-copy small {
    color: var(--theme-text-dim);
    font-size: 12px;
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
  @container (max-width: 300px) {
    .prop-choice > span:not(.variant-count) {
      overflow: visible;
      text-align: center;
      text-overflow: clip;
      white-space: normal;
    }
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
