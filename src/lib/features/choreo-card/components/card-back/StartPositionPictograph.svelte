<!--
  Miniature pictograph showing the starting position with actual props rendered.
  Used on the card back so users can see what prop type the card uses
  and visually compare start positions when chaining cards together.

  Renders with a transparent background so the grid dots and props
  float directly on the card back's gradient - no box/container.

  Uses PictographPreparer + PictographRenderer directly (no PictographContainer)
  so it works both in live Svelte rendering and offscreen DOM capture.
-->
<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { PreparedPictographData } from "$lib/shared/pictograph/shared/domain/models/PreparedPictographData";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
  import PictographRenderer from "$lib/shared/pictograph/shared/components/PictographRenderer.svelte";

  interface Props {
    /** Start position data (extends PictographData) - has motions with prop info */
    pictographData: PictographData;
  }

  let { pictographData }: Props = $props();

  let prepared: PreparedPictographData | null = $state(null);

  $effect(() => {
    const data = pictographData;
    if (!data) { prepared = null; return; }

    (async () => {
      try {
        const result = await pictographPreparer.prepareSingle(data, {
          themeMode: "dark",
        });
        prepared = result;
      } catch (err) {
        console.warn("[StartPositionPictograph] Preparation failed:", err);
        prepared = data as PreparedPictographData;
      }
    })();
  });
</script>

<div class="start-pos-picto">
  {#if prepared}
    <PictographRenderer
      pictograph={prepared}
      transparentBackground={true}
      showGrid={true}
      showTKA={false}
      showReversals={false}
      showVTG={false}
      showElemental={false}
      showPositions={false}
      showNonRadialPoints={false}
      handPointVisibility="all"
      darkMode={true}
      showStepNumber={false}
    />
  {/if}
</div>

<style>
  .start-pos-picto {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
