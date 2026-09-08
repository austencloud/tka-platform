<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import InlineAnimationPlayer from "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte";
  import StepStrip from "$lib/shared/timeline/StepStrip.svelte";

  let {
    sequence,
    active,
    onready,
  }: {
    sequence: SequenceData;
    active: boolean;
    onready: () => void;
  } = $props();

  let currentStep = $state(0);
  let seek: ((step: number) => void) | null = null;
</script>

<div class="workspace-playback" data-testid="workspace-playback">
  <div class="playback-layout">
    <div class="animation-stage">
      <div class="square-stage">
        <InlineAnimationPlayer
          {sequence}
          chrome="minimal"
          fill
          autoPlay={active}
          autoPlayDelay={0}
          playbackAllowed={active}
          onCanvasInitialized={onready}
          onLoadError={onready}
          onStepChange={(step) => (currentStep = step)}
          onSeekRef={(callback) => (seek = callback)}
        />
      </div>
    </div>
    <div class="notation-rail" role="group" aria-label="Sequence pictographs">
      <StepStrip
        {sequence}
        {currentStep}
        bpm={60}
        density="compact"
        fillHeight
        onCellClick={(step) => seek?.(step)}
      />
    </div>
  </div>
</div>

<style>
  .workspace-playback {
    position: relative;
    width: 100%;
    height: 100%;
    container-type: size;
  }

  .playback-layout {
    position: absolute;
    inset: 60px 12px 8px;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
  }

  .animation-stage {
    container-type: size;
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .square-stage {
    width: min(100cqw, 100cqh);
    height: min(100cqw, 100cqh);
  }

  .notation-rail {
    display: none;
    min-width: 0;
    overflow: hidden;
  }

  @container (min-width: 520px) and (min-height: 440px) {
    .playback-layout {
      grid-template-rows: minmax(0, 1fr) clamp(96px, 20cqh, 160px);
      gap: 12px;
    }

    .notation-rail {
      display: block;
    }
  }
</style>
