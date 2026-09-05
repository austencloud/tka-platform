<script lang="ts">
  import InlineAnimationPlayer from "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte";
  import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { RenderActivityGate } from "$lib/shared/render-gating/render-activity-gate";

  let {
    sequence,
    ariaLabel,
    showElementalGlyph = false,
    interactive = true,
    playbackAllowed = true,
    externalPlaying = null,
    externalStep = null,
    onExternalSeek = undefined,
    playbackGate = undefined,
    onExternalPlayingChange = undefined,
    onStepChange = undefined,
    onSeekRef = undefined,
    framed = true,
    onCanvasInitialized,
    onLoadError,
  }: {
    sequence: SequenceData;
    ariaLabel: string;
    showElementalGlyph?: boolean;
    interactive?: boolean;
    playbackAllowed?: boolean;
    externalPlaying?: boolean | null;
    externalStep?: number | null;
    onExternalSeek?: (step: number) => void;
    playbackGate?: RenderActivityGate;
    onExternalPlayingChange?: (playing: boolean) => void;
    onStepChange?: (currentStep: number, sequenceId: string | null) => void;
    onSeekRef?: (seek: ((step: number) => void) | null) => void;
    framed?: boolean;
    onCanvasInitialized?: () => void;
    onLoadError?: (message: string) => void;
  } = $props();

  const visibility = new AnimationVisibilityStateManager({ ephemeral: true });
  $effect(() => {
    visibility.updateSettings({
      elementalGlyph: showElementalGlyph,
      tkaGlyph: false,
      stepNumbers: false,
      wordHeader: false,
      progressBar: true,
      darkMode: true,
    });
  });
</script>

<div
  class="motion-player"
  class:framed
  role={interactive ? "group" : "img"}
  aria-label={ariaLabel}
>
  <InlineAnimationPlayer
    {sequence}
    autoPlay
    chrome="minimal"
    fill
    showWordHeader={false}
    showPositionGlyph={false}
    scrubbable={interactive}
    beatIndicators={false}
    hideTkaGlyph
    hideStepNumbers
    leftPropType="hand"
    rightPropType="hand"
    visibilityManagerOverride={visibility}
    hoverHint={interactive ? "badge" : "none"}
    glyphFrame="stage"
    backgroundAlpha={0}
    {interactive}
    {playbackAllowed}
    resumeWhenPlaybackAllowed
    {externalPlaying}
    {externalStep}
    {onExternalSeek}
    {playbackGate}
    {onExternalPlayingChange}
    {onStepChange}
    {onSeekRef}
    {onCanvasInitialized}
    {onLoadError}
  />
</div>

<style>
  .motion-player {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: transparent;
  }

  .motion-player.framed {
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-card-bg);
  }

  .motion-player :global(.inline-animation-player),
  .motion-player :global(.canvas-container) {
    height: 100%;
  }
</style>
