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
      leftPropType="staff"
      rightPropType="staff"
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
      leftPropType={PropType.STAFF}
      rightPropType={PropType.STAFF}
    />
  </div>
</div>

<style>
  .sequence-pair {
    container: word-pair / size;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    width: 100%;
    height: clamp(28rem, 51dvh, 44rem);
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
    padding: clamp(0.35rem, 0.8cqw, 0.85rem);
    border-left: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
  }

  /* Portrait tablets and phones: stack the animation over the card. A split
     at these widths squeezes the card into a cramped two-column layout while
     the tall viewport goes unused. */
  @media (max-width: 900px) {
    .sequence-pair {
      grid-template-columns: 1fr;
      grid-template-rows: 18rem 24rem;
      height: 42rem;
    }

    .card-pane {
      border-top: 1px solid var(--theme-stroke);
      border-left: 0;
    }
  }

  @media (max-height: 620px) and (min-width: 901px) {
    .sequence-pair {
      height: 26rem;
    }
  }

  /* Same big-screen seams as the lesson shell (4k-native-layout.md):
     1680 for 4K@200% / 1440p, 2600 for 4K@100% and TVs. */
  @media (min-width: 1680px) {
    .sequence-pair {
      height: clamp(32rem, 52dvh, 48rem);
    }
  }

  @media (min-width: 2600px) {
    .sequence-pair {
      height: clamp(40rem, 56dvh, 60rem);
    }
  }
</style>
