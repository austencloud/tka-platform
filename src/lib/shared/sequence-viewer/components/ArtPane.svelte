<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import MandalaPane from "./MandalaPane.svelte";
  import TunnelArtView from "../tunnel/TunnelArtView.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "../domain/viewer-prop-groups";

  const {
    sequence,
    playback,
    bluePropType,
    redPropType,
  }: {
    sequence: SequenceData;
    playback: ViewerPlaybackState;
    bluePropType?: string;
    redPropType?: string;
  } = $props();

  // "Art" is the umbrella mode for generative outputs of the sequence. Mandala
  // is the static tip-path bloom; Tunnel is the live kaleidoscope. New art types
  // drop in here without touching the viewer's mode system.
  type ArtType = "mandala" | "tunnel";
  let artType = $state<ArtType>("mandala");

  const options = [
    { value: "mandala" as const, label: "Mandala", icon: "fa-dharmachakra" },
    { value: "tunnel" as const, label: "Tunnel", icon: "fa-fan" },
  ];
</script>

<div class="art-pane">
  <div class="art-picker">
    <SegmentedControl
      {options}
      value={artType}
      onchange={(v) => (artType = v)}
      color="accent"
      size="sm"
    />
  </div>

  <div class="art-body">
    {#if artType === "mandala"}
      <MandalaPane {sequence} {bluePropType} {redPropType} />
    {:else}
      <TunnelArtView {sequence} {playback} {bluePropType} {redPropType} />
    {/if}
  </div>
</div>

<style>
  .art-pane {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
  }
  .art-picker {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 4;
  }
  .art-body {
    position: absolute;
    inset: 0;
  }
</style>
