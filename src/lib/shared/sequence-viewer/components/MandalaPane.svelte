<script lang="ts">
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import MandalaControlDock from "./MandalaControlDock.svelte";
  import MandalaExportTakeover from "./MandalaExportTakeover.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";

  interface Props {
    sequence: SequenceData;
    bluePropType?: string;
    redPropType?: string;
  }

  let { sequence, bluePropType, redPropType }: Props = $props();

  let stageEl: HTMLDivElement | undefined = $state();
  let containerSize: number = $state(400);
  let dockHeight = $state(76);

  const ctrl = new MandalaViewerController({
    getSequence: () => sequence,
    getBluePropType: () => bluePropType,
    getRedPropType: () => redPropType,
  });

  const takeoverSize = $derived(Math.max(160, containerSize - 32));

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
  <div class="mandala-stage" bind:this={stageEl} style:padding-bottom="{dockHeight + 14}px">
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

  <MandalaControlDock {ctrl} onHeightChange={(px) => (dockHeight = px)} />
  <MandalaExportTakeover {ctrl} {sequence} {bluePropType} {redPropType} size={takeoverSize} />
</div>

<style>
  .mandala-pane {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .mandala-stage {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    transition: padding-bottom 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .mandala-stage :global(svg) {
    width: 100%;
    height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .mandala-stage { transition: none; }
  }
</style>
