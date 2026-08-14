<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";

  let {
    sequence,
    displayedBeatNumber,
    cardRenderOptions = null,
  }: {
    sequence: SequenceData;
    displayedBeatNumber: number;
    cardRenderOptions?: Partial<SequenceExportOptions> | null;
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
    darkMode={cardRenderOptions?.visibilityOverrides?.darkMode ?? true}
    showWord={cardRenderOptions?.addWord ?? true}
    showStepNumbers={cardRenderOptions?.addStepNumbers ?? true}
    showDifficultyLevel={cardRenderOptions?.addDifficultyLevel ?? true}
    includeStartPosition={cardRenderOptions?.includeStartPosition ?? true}
    showNotes={cardRenderOptions?.showNotes ?? false}
    showLoopGlyph={cardRenderOptions?.showLoopGlyph ?? true}
    showQRCode={cardRenderOptions?.visibilityOverrides?.showQRCode ?? false}
    showMandala={cardRenderOptions?.visibilityOverrides?.showMandala ?? false}
    handPathMode={cardRenderOptions?.visibilityOverrides?.handPathMode ?? false}
    columnCount={cardRenderOptions?.columnCount ?? null}
    startPositionLayoutOverride={cardRenderOptions?.startPositionLayout ?? null}
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
