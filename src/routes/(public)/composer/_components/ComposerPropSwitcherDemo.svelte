<!--
  ComposerPropSwitcherDemo

  The Props bento cell: the CΨΩX fixture playing in the standalone
  InlineAnimationPlayer with a SegmentedControl that hot-swaps the prop.
  Same lazy pattern as the hero demo; {#key} remounts the player on prop
  change (a clean re-init beats threading live prop mutation through a
  marketing embed).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { DEMO_SEQUENCE } from "../_data/demo-beats";

  let prop = $state("staff");
  let active = $state(false);

  onMount(() => {
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => (active = true), { timeout: 3000 });
    } else {
      setTimeout(() => (active = true), 400);
    }
  });
</script>

<div class="prop-demo">
  <div class="stage">
    {#key prop}
      <LazyMount
        loader={() =>
          import(
            "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
          )}
        {active}
        props={{
          sequence: DEMO_SEQUENCE,
          autoPlay: true,
          chrome: "minimal",
          fill: true,
          bluePropType: prop,
          redPropType: prop,
        }}
      />
    {/key}
  </div>
  <div class="prop-picker">
    <SegmentedControl
      options={[
        { value: "staff", label: "Staff" },
        { value: "club", label: "Club" },
        { value: "fan", label: "Fan" },
        { value: "buugeng", label: "Buugeng" },
        { value: "minihoop", label: "Hoop" },
      ]}
      value={prop}
      onchange={(v) => (prop = v)}
      color="accent"
      size="sm"
    />
  </div>
</div>

<style>
  .prop-demo {
    display: flex;
    flex-direction: column;
  }

  .stage {
    position: relative;
    aspect-ratio: 16 / 10;
    background: oklch(0.12 0.015 270 / 0.6);
  }

  .prop-picker {
    display: flex;
    justify-content: center;
    padding: 0.7rem 0.8rem 0.2rem;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .prop-picker::-webkit-scrollbar {
    display: none;
  }
</style>
