<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getCompositionRecipe } from "$lib/shared/pictograph/prop/domain/prop-composition-recipes";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { getRailPropOpticalScale } from "./rail-prop-optical-fit";

  let { propType, size = 24 }: { propType: PropType; size?: number } = $props();

  const propImage = $derived(getPropTypeDisplayInfo(propType).image);
  const propRotation = $derived(getCompositionRecipe(propType).left.rotation);
  const propScale = $derived(getRailPropOpticalScale(propType));
</script>

<!-- The slot never changes size. A prop swap changes its meaning, not the rail's geometry. -->
<span
  class="rail-prop-glyph"
  style:--rail-prop-glyph-size={`${size}px`}
  aria-hidden="true"
>
  <Crossfade key={propType} duration={DURATION.fast} fill>
    <span
      class="rail-prop-art"
      style:--rail-prop-image={`url("${propImage}")`}
      style:transform={`rotate(${propRotation}deg) scale(${propScale})`}
    ></span>
  </Crossfade>
</span>

<style>
  .rail-prop-glyph {
    position: relative;
    display: block;
    width: var(--rail-prop-glyph-size);
    height: var(--rail-prop-glyph-size);
    flex: 0 0 auto;
  }

  .rail-prop-glyph :global(.layer) {
    display: grid;
    place-items: center;
  }

  .rail-prop-art {
    display: block;
    width: 100%;
    height: 100%;
    background: currentColor;
    -webkit-mask: var(--rail-prop-image) center / contain no-repeat;
    mask: var(--rail-prop-image) center / contain no-repeat;
    opacity: 0.96;
    transform-origin: center;
  }
</style>
