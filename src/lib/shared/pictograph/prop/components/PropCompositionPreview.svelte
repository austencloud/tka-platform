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
  import { PropType } from "../domain/enums/prop-type";
  import {
    getPropTypeDisplayInfo,
    getBasePropType,
  } from "../domain/prop-type-display-registry";
  import {
    getCompositionRecipe,
    type CompositionRecipe,
  } from "../domain/prop-composition-recipes";
  import { propTileArtwork } from "../domain/prop-look";
  import { onMount } from "svelte";

  let {
    propType,
    size = 64,
    recipeOverride = undefined,
    darkBackground = false,
    neutral = false,
    useSavedOverrides = true,
  }: {
    propType: PropType;
    size?: number;
    /** Override the default recipe (used by lab tab for live tuning) */
    recipeOverride?: CompositionRecipe;
    darkBackground?: boolean;
    /** Render a single white silhouette instead of blue+red pair */
    neutral?: boolean;
    /** Standalone review surfaces can use the canonical recipe without loading
     *  the authenticated app settings graph. */
    useSavedOverrides?: boolean;
  } = $props();

  type GetSettings =
    (typeof import("$lib/shared/application/state/app-state.svelte"))["getSettings"];
  let getSettings = $state<GetSettings | null>(null);

  onMount(() => {
    if (!useSavedOverrides) return;
    let mounted = true;
    void import("$lib/shared/application/state/app-state.svelte").then(
      (module) => {
        if (mounted) getSettings = module.getSettings;
      }
    );
    return () => {
      mounted = false;
    };
  });

  const displayInfo = $derived(getPropTypeDisplayInfo(propType));

  // The tile shows the prop the way the user has chosen to see it: the fan
  // build, the 3D model capture, or the notation glyph. Settings load lazily,
  // so until they arrive the default look (model) applies.
  const lookAppearance = $derived({
    propLook: getSettings?.().propLook ?? null,
    fanAppearance: getSettings?.().fanAppearance ?? null,
  });
  const leftArt = $derived(
    propTileArtwork(propType, "left", lookAppearance, displayInfo.image)
  );
  const rightArt = $derived(
    propTileArtwork(propType, "right", lookAppearance, displayInfo.image)
  );

  // Check for persisted overrides from the Prop Button Lab
  const savedOverrides = $derived(
    getSettings?.().compositionRecipeOverrides ?? {}
  );
  const recipe = $derived.by(() => {
    if (recipeOverride) return recipeOverride;
    const base = getBasePropType(propType);
    return (
      savedOverrides[base] ??
      savedOverrides[propType] ??
      getCompositionRecipe(propType)
    );
  });

  // Build transform strings for each prop
  const leftTransform = $derived(
    `translate(${recipe.left.x}, ${recipe.left.y}) ` +
      `rotate(${recipe.left.rotation}) ` +
      `scale(${recipe.left.scale * recipe.pairScale})`
  );

  const rightTransform = $derived(
    `translate(${recipe.right.x}, ${recipe.right.y}) ` +
      `rotate(${recipe.right.rotation}) ` +
      `scale(${recipe.right.scale * recipe.pairScale})`
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
    class:styled={leftArt.styled}
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {#if leftArt.fill}
      {@const crop = leftArt.fill}
      <svg
        x="4"
        y="4"
        width="92"
        height="92"
        viewBox="{crop.x} {crop.y} {crop.width} {crop.height}"
        preserveAspectRatio="xMidYMid meet"
      >
        <image
          class="fill-photo"
          href={leftArt.href}
          x="0"
          y="0"
          width={crop.imageWidth}
          height={crop.imageHeight}
        />
      </svg>
    {:else}
      <g transform={leftTransform}>
        <image
          href={leftArt.href}
          x={imgOffset}
          y={imgOffset}
          width={imgSize}
          height={imgSize}
        />
      </g>
    {/if}
  </svg>
{:else}
  <svg
    class="prop-composition-preview"
    class:dark-bg={darkBackground}
    class:styled={leftArt.styled}
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {#if leftArt.fill}
      {@const crop = leftArt.fill}
      <svg
        x="4"
        y="4"
        width="92"
        height="92"
        viewBox="{crop.x} {crop.y} {crop.width} {crop.height}"
        preserveAspectRatio="xMidYMid meet"
      >
        <image
          class="fill-photo"
          href={leftArt.href}
          x="0"
          y="0"
          width={crop.imageWidth}
          height={crop.imageHeight}
        />
      </svg>
    {:else}
      <g transform={leftTransform}>
        <image
          href={leftArt.href}
          x={imgOffset}
          y={imgOffset}
          width={imgSize}
          height={imgSize}
        />
      </g>

      <g transform={rightTransform}>
        <image
          class="red-prop"
          class:prelit={rightArt.prelit}
          href={rightArt.href}
          x={imgOffset}
          y={imgOffset}
          width={imgSize}
          height={imgSize}
        />
      </g>
    {/if}
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

  /* Rendered previews sit on a near-black ground; screening them onto the
     tile makes that ground vanish without a cutout. */
  .fill-photo {
    mix-blend-mode: screen;
  }

  /* Model captures are already lit red; a hue shift would ruin them. */
  .red-prop.prelit {
    filter: none;
  }

  .prop-composition-preview.dark-bg {
    filter: brightness(1.8) saturate(1.4);
  }

  .prop-composition-preview.neutral {
    filter: brightness(0) invert(1);
  }

  /* A chosen look is shown as itself, never flattened to a silhouette. */
  .prop-composition-preview.neutral.styled,
  .prop-composition-preview.dark-bg.styled {
    filter: none;
  }
</style>
