<!--
  PropCompositionPreview.svelte

  Renders a paired prop composition (blue + red) using SVG.
  Each prop is positioned according to the composition recipe for its family.

  Used in:
  - PropIndicatorButton (button panel in Create module)
  - PropTypeButton (prop selection drawer)
  - PropButtonLab (visual tuning lab tab)
-->
<script lang="ts">
  import { PropType } from "../domain/enums/PropType";
  import { getPropTypeDisplayInfo, getBasePropType } from "../domain/PropTypeDisplayRegistry";
  import {
    getCompositionRecipe,
    type CompositionRecipe,
  } from "../domain/prop-composition-recipes";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";

  let {
    propType,
    size = 64,
    recipeOverride = undefined,
    darkBackground = false,
    neutral = false,
  }: {
    propType: PropType;
    size?: number;
    /** Override the default recipe (used by lab tab for live tuning) */
    recipeOverride?: CompositionRecipe;
    darkBackground?: boolean;
    /** Render a single white silhouette instead of blue+red pair */
    neutral?: boolean;
  } = $props();

  const displayInfo = $derived(getPropTypeDisplayInfo(propType));

  // Check for persisted overrides from the Prop Button Lab
  const settings = $derived(getSettings());
  const savedOverrides = $derived(settings.compositionRecipeOverrides ?? {});
  const recipe = $derived.by(() => {
    if (recipeOverride) return recipeOverride;
    const base = getBasePropType(propType);
    return savedOverrides[base] ?? savedOverrides[propType] ?? getCompositionRecipe(propType);
  });

  // Build transform strings for each prop
  const blueTransform = $derived(
    `translate(${recipe.blue.x}, ${recipe.blue.y}) ` +
    `rotate(${recipe.blue.rotation}) ` +
    `scale(${recipe.blue.scale * recipe.pairScale})`
  );

  const redTransform = $derived(
    `translate(${recipe.red.x}, ${recipe.red.y}) ` +
    `rotate(${recipe.red.rotation}) ` +
    `scale(${recipe.red.scale * recipe.pairScale})`
  );

  // Image dimensions in viewBox units - props are placed relative to their center
  // Using a square bounding box that gets scaled by the recipe
  const imgSize = 158;
  const imgOffset = -(imgSize / 2);
</script>

{#if neutral}
  <svg
    class="prop-composition-preview neutral"
    class:dark-bg={darkBackground}
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <g transform={blueTransform}>
      <image
        href={displayInfo.image}
        x={imgOffset}
        y={imgOffset}
        width={imgSize}
        height={imgSize}
      />
    </g>
  </svg>
{:else}
  <svg
    class="prop-composition-preview"
    class:dark-bg={darkBackground}
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <g transform={blueTransform}>
      <image
        href={displayInfo.image}
        x={imgOffset}
        y={imgOffset}
        width={imgSize}
        height={imgSize}
      />
    </g>

    <g transform={redTransform}>
      <image
        class="red-prop"
        href={displayInfo.image}
        x={imgOffset}
        y={imgOffset}
        width={imgSize}
        height={imgSize}
      />
    </g>
  </svg>
{/if}

<style>
  .prop-composition-preview {
    display: block;
    pointer-events: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .red-prop {
    filter: hue-rotate(125deg) saturate(1.2);
  }

  .prop-composition-preview.dark-bg {
    filter: brightness(1.8) saturate(1.4);
  }

  .prop-composition-preview.neutral {
    filter: brightness(0) invert(1);
  }
</style>
