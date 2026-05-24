<script lang="ts">
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import MandalaViewerControls from "./MandalaViewerControls.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { UndulationEasing, MandalaPathShape } from "$lib/shared/mandala/components/SequenceMandala.svelte";

  interface Props {
    sequence: SequenceData;
    bluePropType?: string;
    redPropType?: string;
  }

  let { sequence, bluePropType, redPropType }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let containerSize: number = $state(400);

  let paused: boolean = $state(false);
  let pathShape: MandalaPathShape = $state("arc");
  let easing: UndulationEasing = $state("breathe");
  let rotation: number = $state(90);
  let period: number = $state(5);
  let rangeMin: number = $state(0);
  let rangeMax: number = $state(250);

  const CONTROLS_WIDTH = 300;

  $effect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const availableWidth = width - CONTROLS_WIDTH;
      containerSize = Math.floor(Math.min(availableWidth, height) - 32);
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });
</script>

<div class="mandala-pane" bind:this={containerEl}>
  <div class="mandala-stage">
    <SequenceMandala
      {sequence}
      animate={!paused}
      animateMin={rangeMin}
      animateMax={rangeMax}
      animatePeriod={period}
      animateEasing={easing}
      animateRotation={rotation}
      {pathShape}
      size={containerSize}
      {bluePropType}
      {redPropType}
      mode="gallery"
      style="stroke"
      show="both"
    />
  </div>

  <aside class="controls-rail">
    <MandalaViewerControls
      {paused}
      {pathShape}
      {easing}
      {rotation}
      {period}
      {rangeMin}
      {rangeMax}
      onPausedChange={(v) => { paused = v; }}
      onPathShapeChange={(v) => { pathShape = v; }}
      onEasingChange={(v) => { easing = v; }}
      onRotationChange={(v) => { rotation = v; }}
      onPeriodChange={(v) => { period = v; }}
      onRangeMinChange={(v) => { rangeMin = v; }}
      onRangeMaxChange={(v) => { rangeMax = v; }}
    />
  </aside>
</div>

<style>
  .mandala-pane {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a1a;
    overflow: hidden;
  }

  .mandala-stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .controls-rail {
    flex-shrink: 0;
    width: 300px;
    height: 100%;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    backdrop-filter: blur(12px);
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
</style>
