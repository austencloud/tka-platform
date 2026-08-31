<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { DURATION } from "$lib/shared/transitions/transitions";

  let { propType, size = 24 }: { propType: PropType; size?: number } = $props();
</script>

<!-- The slot never changes size. A prop swap changes its meaning, not the rail's geometry. -->
<span
  class="rail-prop-glyph"
  style:--rail-prop-glyph-size={`${size}px`}
  aria-hidden="true"
>
  <Crossfade key={propType} duration={DURATION.fast} fill>
    <PropCompositionPreview {propType} {size} />
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

  .rail-prop-glyph :global(.prop-composition-preview) {
    width: 100%;
    height: 100%;
  }
</style>
