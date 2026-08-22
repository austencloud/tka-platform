<script lang="ts">
  import InlineAnimationPlayer from "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";

  let { sequence }: { sequence: SequenceData } = $props();
</script>

<div class="sequence-pair">
  <div class="motion-pane">
    <InlineAnimationPlayer
      {sequence}
      autoPlay
      chrome="minimal"
      fill
      showWordHeader
      showPositionGlyph
      scrubbable
      beatIndicators={false}
      bluePropType="staff"
      redPropType="staff"
      disableContextMenu
      hoverHint="badge"
    />
  </div>

  <div class="card-pane">
    <ChoreoCard
      {sequence}
      showWord
      showStepNumbers
      showDifficultyLevel={false}
      includeStartPosition
      showNotes={false}
      showLoopGlyph={false}
      showQRCode={false}
      darkMode
      forceContain
      bluePropType={PropType.STAFF}
      redPropType={PropType.STAFF}
    />
  </div>
</div>

<style>
  .sequence-pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    width: 100%;
    height: clamp(30rem, 66dvh, 48rem);
    min-width: 0;
    overflow: hidden;
    background: var(--theme-card-bg);
  }

  .motion-pane,
  .card-pane {
    min-width: 0;
    min-height: 0;
  }

  .motion-pane {
    background: var(--theme-card-bg);
  }

  .card-pane {
    padding: clamp(0.35rem, 0.8cqw, 0.9rem);
    border-left: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
  }

  @container (max-width: 760px) {
    .sequence-pair {
      grid-template-columns: 1fr;
      grid-template-rows: 21rem 29rem;
      height: auto;
    }

    .card-pane {
      border-top: 1px solid var(--theme-stroke);
      border-left: 0;
    }
  }

  @container (min-width: 1680px) {
    .sequence-pair {
      height: clamp(40rem, 66dvh, 58rem);
    }
  }

  @container (min-width: 2600px) {
    .sequence-pair {
      height: clamp(50rem, 68dvh, 70rem);
    }
  }

  @media (max-height: 620px) and (min-width: 761px) {
    .sequence-pair {
      height: calc(100dvh - 10rem);
      min-height: 20rem;
    }
  }
</style>
