<script lang="ts">
  import ExportTakeover from "$lib/shared/video-export/components/ExportTakeover.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import type { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";

  interface Props {
    ctrl: MandalaViewerController;
    sequence: any;
    bluePropType?: string;
    redPropType?: string;
    size: number;
  }
  let { ctrl, sequence, bluePropType, redPropType, size }: Props = $props();

  const phaseLabel = $derived(
    ctrl.exportPhase === "capturing" ? "Rendering"
    : ctrl.exportPhase === "encoding" ? "Encoding…"
    : ctrl.exportPhase === "complete" ? "Done"
    : "",
  );
</script>

<ExportTakeover
  phase={ctrl.exportPhase}
  progress={ctrl.exportProgress}
  {phaseLabel}
  error={ctrl.exportError}
  onCancel={() => ctrl.cancelExport()}
  onRetry={() => ctrl.startExport()}
  opaque
>
  {#snippet centerpiece()}
    <SequenceMandala
      {sequence}
      animate={!ctrl.paused}
      animateMin={0}
      animateMax={ctrl.rangeMax}
      animatePeriod={ctrl.period}
      animateEasing="breathe"
      animateRotation={ctrl.rotation}
      pathShape={ctrl.pathShape}
      {size}
      {bluePropType}
      {redPropType}
      mode="card-back"
      style="stroke"
      show="both"
      palette={ctrl.palette}
      strokeWidth={ctrl.lineWeight}
      gradient={ctrl.gradientColors}
    />
  {/snippet}
</ExportTakeover>
