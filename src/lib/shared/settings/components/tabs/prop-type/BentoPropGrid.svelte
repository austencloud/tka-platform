<!--
  BentoPropGrid.svelte - Family-first prop selection grid

  Shows prop families in a sectioned grid. Single-prop families
  select immediately. Multi-variant families open a floating popover
  for drilling into specific variants.

  Variants:
  - "panel" (default): has border/background for standalone use (e.g. Settings tab)
  - "inline": no border/background, used inside drawers that already provide a container
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import {
    PROP_CATEGORIES,
    getBasePropType,
    getAllVariations,
    getPropTypeDisplayInfo,
    isPropActive,
    getBasePropsByCategory,
  } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { Popover } from "bits-ui";
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";
  import PropTypeButton from "./PropTypeButton.svelte";

  let {
    selectedPropType,
    color = "blue",
    title = "Select Prop",
    onSelect,
    variant = "panel",
  } = $props<{
    selectedPropType: PropType;
    color?: "blue" | "red" | (string & {});
    title?: string;
    onSelect: (propType: PropType) => void;
    variant?: "panel" | "inline";
  }>();

  const basePropsByCategory = $derived(getBasePropsByCategory());

  const sections = $derived(
    PROP_CATEGORIES.map((cat) => ({
      label: cat.label,
      bases: basePropsByCategory.get(cat.id) ?? [],
    })).filter((s) => s.bases.length > 0),
  );

  const selectedBase = $derived(getBasePropType(selectedPropType));

  function variantCount(base: PropType): number | undefined {
    const count = getAllVariations(base).filter(isPropActive).length;
    return count > 1 ? count : undefined;
  }

  function getActiveVariants(base: PropType): PropType[] {
    return getAllVariations(base).filter(isPropActive);
  }

  function isSingleVariant(base: PropType): boolean {
    return getActiveVariants(base).length <= 1;
  }
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

  <div class="grid-scroll themed-scrollbar">
    <div class="grid-content">
      {#each sections as section, i}
        <div class="section-label" class:first={i === 0}>{section.label}</div>
        <div class="section-buttons">
          {#each section.bases as base}
            {#if isSingleVariant(base)}
              <!-- Single-variant: select immediately -->
              <PropTypeButton
                propType={base}
                selected={selectedBase === base}
                {color}
                onSelect={() => onSelect(base)}
              />
            {:else}
              <!-- Multi-variant: open popover -->
              <Popover.Root>
                <Popover.Trigger>
                  {#snippet child({ props })}
                    <div {...props} class="popover-trigger-wrap">
                      <PropTypeButton
                        propType={base}
                        selected={selectedBase === base}
                        badge={variantCount(base)}
                        {color}
                      />
                    </div>
                  {/snippet}
                </Popover.Trigger>
                <Popover.Content
                  side="bottom"
                  sideOffset={6}
                  avoidCollisions={true}
                  collisionPadding={12}
                  forceMount
                >
                  {#snippet child({ open, wrapperProps, props })}
                    <div {...wrapperProps}>
                      {#if open}
                        <div
                          {...props}
                          class="variant-popover"
                          in:scale={{
                            duration: 200,
                            start: 0.92,
                            opacity: 0,
                            easing: backOut,
                          }}
                          out:scale={{
                            duration: 140,
                            start: 0.95,
                            opacity: 0,
                            easing: cubicOut,
                          }}
                        >
                          <span class="variant-popover-label">
                            {getPropTypeDisplayInfo(base).label} Variants
                          </span>
                          <div class="variant-popover-buttons">
                            {#each getActiveVariants(base) as variantProp}
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
                  {/snippet}
                </Popover.Content>
              </Popover.Root>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
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

  .section-buttons :global(.prop-button),
  .popover-trigger-wrap :global(.prop-button) {
    width: 79px;
    flex-shrink: 0;
  }

  .popover-trigger-wrap {
    width: 79px;
    flex-shrink: 0;
  }

  /* === Variant popover === */
  .variant-popover {
    z-index: 50;
    border-radius: 14px;
    background: var(--theme-card-bg, #0c0e16);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }

  .variant-popover-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    opacity: 0.6;
  }

  .variant-popover-buttons {
    display: flex;
    gap: 6px;
    justify-content: center;
  }

  .variant-popover-buttons :global(.prop-button) {
    width: 70px;
    flex-shrink: 0;
  }

  /* Container queries for larger containers */
  @container prop-grid (min-width: 400px) {
    .section-buttons :global(.prop-button),
    .popover-trigger-wrap :global(.prop-button) {
      width: 90px;
    }
    .popover-trigger-wrap {
      width: 90px;
    }
  }

  @container prop-grid (min-width: 550px) {
    .section-buttons :global(.prop-button),
    .popover-trigger-wrap :global(.prop-button) {
      width: 100px;
    }
    .popover-trigger-wrap {
      width: 100px;
    }
    .variant-popover-buttons :global(.prop-button) {
      width: 80px;
    }
  }

  @container prop-grid (min-width: 700px) {
    .section-buttons :global(.prop-button),
    .popover-trigger-wrap :global(.prop-button) {
      width: 95px;
    }
    .popover-trigger-wrap {
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
