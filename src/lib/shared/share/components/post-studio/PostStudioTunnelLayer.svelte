<script lang="ts">
  import TunnelArtView from "$lib/shared/sequence-viewer/tunnel/TunnelArtView.svelte";
  import { TunnelViewController } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "$lib/shared/sequence-viewer/domain/viewer-prop-groups";

  interface Props {
    sequence: SequenceData;
    playing: boolean;
    bpm: number;
    bluePropType?: string;
    redPropType?: string;
  }

  let { sequence, playing, bpm, bluePropType, redPropType }: Props = $props();

  // TunnelArtView reads exactly one thing off the viewer's playback state — the
  // sequence the transport is showing. Post Studio has no viewer transport, so
  // the slot hands it the sequence directly rather than dragging in the whole
  // viewer playback object for one field.
  const playback = {
    animationState: { sequenceData: sequence },
  } as unknown as ViewerPlaybackState;

  const controller = new TunnelViewController({
    getSequence: () => sequence,
  });
  controller.active = true;
</script>

<div class="tunnel-slot">
  <TunnelArtView
    {sequence}
    {playback}
    {controller}
    {bpm}
    {bluePropType}
    {redPropType}
    {playing}
    onPlayingChange={() => undefined}
    stageFit="cover"
  />
</div>

<style>
  .tunnel-slot {
    position: absolute;
    inset: 0;
    /* The slot is a frame in a composition, not a canvas the user drives — the
       studio's own transport owns play/pause. */
    pointer-events: none;
  }
</style>
