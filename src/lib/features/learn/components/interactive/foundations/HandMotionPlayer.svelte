<script lang="ts">
  import InlineAnimationPlayer from "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte";
  import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let {
    sequence,
    ariaLabel,
  }: {
    sequence: SequenceData;
    ariaLabel: string;
  } = $props();

  const visibility = new AnimationVisibilityStateManager({ ephemeral: true });
  $effect(() => {
    visibility.updateSettings({
      elementalGlyph: false,
      tkaGlyph: false,
      stepNumbers: false,
      wordHeader: false,
      progressBar: true,
      darkMode: true,
    });
  });
</script>

<div class="motion-player" role="img" aria-label={ariaLabel}>
  <InlineAnimationPlayer
    {sequence}
    autoPlay
    chrome="minimal"
    fill
    showWordHeader={false}
    showPositionGlyph={false}
    scrubbable
    beatIndicators={false}
    hideTkaGlyph
    hideStepNumbers
    leftPropType="hand"
    rightPropType="hand"
    visibilityManagerOverride={visibility}
    hoverHint="badge"
    glyphFrame="stage"
    backgroundAlpha={0}
  />
</div>

<style>
  .motion-player {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-card-bg);
  }

  .motion-player :global(.inline-animation-player),
  .motion-player :global(.canvas-container) {
    height: 100%;
  }
</style>
