<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";

  let {
    sequence,
    displayedBeatNumber,
  }: {
    sequence: SequenceData;
    displayedBeatNumber: number;
  } = $props();

  const highlightedStepIndex = $derived(
    displayedBeatNumber < 1 ? -1 : displayedBeatNumber - 1
  );
</script>

<div class="choreo-layer">
  <ChoreoCard
    {sequence}
    {highlightedStepIndex}
    showHighlight
    darkMode
    showNotes={false}
    showQRCode={false}
    forceContain
    fitWidth
  />
</div>

<style>
  .choreo-layer {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #08080c;
  }
</style>
