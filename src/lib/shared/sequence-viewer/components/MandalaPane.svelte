<script lang="ts">
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import MandalaViewerControls from "./MandalaViewerControls.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";

  interface Props {
    sequence: SequenceData;
    bluePropType?: string;
    redPropType?: string;
  }

  let { sequence, bluePropType, redPropType }: Props = $props();

  let stageEl: HTMLDivElement | undefined = $state();
  let containerSize: number = $state(400);

  const ctrl = new MandalaViewerController({
    getSequence: () => sequence,
    getBluePropType: () => bluePropType,
    getRedPropType: () => redPropType,
  });

  $effect(() => {
    if (!stageEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      containerSize = Math.floor(Math.min(width, height));
    });
    observer.observe(stageEl);
    return () => observer.disconnect();
  });
</script>

<div class="mandala-pane" style:background={ctrl.bgColor}>
  <div class="mandala-stage" bind:this={stageEl}>
    <SequenceMandala
      {sequence}
      animate={!ctrl.paused}
      animateMin={0}
      animateMax={ctrl.rangeMax}
      animatePeriod={ctrl.period}
      animateEasing="breathe"
      animateRotation={ctrl.rotation}
      pathShape={ctrl.pathShape}
      size={containerSize}
      {bluePropType}
      {redPropType}
      mode="card-back"
      style="stroke"
      show="both"
      palette={ctrl.palette}
      strokeWidth={ctrl.lineWeight}
      gradient={ctrl.gradientColors}
    />
  </div>

  <aside class="controls-rail">
    <MandalaViewerControls
      paused={ctrl.paused}
      pathShape={ctrl.pathShape}
      rotation={ctrl.rotation}
      speed={ctrl.speed}
      depth={ctrl.depth}
      colorMode={ctrl.colorMode}
      preset={ctrl.preset}
      customBlue={ctrl.customBlue}
      customRed={ctrl.customRed}
      strokeWidth={ctrl.lineWeight}
      onPausedChange={(v) => { ctrl.paused = v; }}
      onPathShapeChange={(v) => { ctrl.pathShape = v; }}
      onRotationChange={(v) => { ctrl.rotation = v; }}
      onSpeedChange={(v) => { ctrl.speed = v; }}
      onDepthChange={(v) => { ctrl.depth = v; }}
      onColorModeChange={(v) => { ctrl.colorMode = v; }}
      onPresetChange={(v) => { ctrl.preset = v; }}
      onCustomBlueChange={(v) => { ctrl.customBlue = v; }}
      onCustomRedChange={(v) => { ctrl.customRed = v; }}
      onStrokeWidthChange={(v) => { ctrl.lineWeight = v; }}
      onDownload={ctrl.exporting ? undefined : () => ctrl.handleDownload()}
    />
  </aside>
</div>

<style>
  .mandala-pane {
    width: 100%;
    height: 100%;
    display: flex;
    overflow: hidden;
  }

  .mandala-stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    position: relative;
  }

  .controls-rail {
    flex-shrink: 0;
    width: fit-content;
    height: 100%;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    backdrop-filter: blur(12px);
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
</style>
