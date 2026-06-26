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

  // Diagnostics (logic preserved verbatim from the prior overlay; rendered via the diag snippet).
  const d = $derived(ctrl.lastExportDiag);
  const mp = $derived(d ? +((d.resolution * d.resolution) / 1_000_000).toFixed(1) : 0);
  const hwLabel = $derived(
    !d ? "" : d.encoder === "wasm" ? "WASM (software)" : d.hwSupported ? "HW H.264" : "SW H.264",
  );
  const etaSec = $derived(
    d && d.encodeFps > 0 ? Math.ceil((d.totalFrames - d.encodedFrames) / d.encodeFps) : 0,
  );
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  function copyDiag() {
    if (!d) return;
    const lines = [
      `mandala export diag`,
      `res ${d.resolution}² (${mp}MP) · fps ${d.fps} · frames ${d.encodedFrames}/${d.totalFrames}`,
      `encoder ${hwLabel} · codec ${d.codec}`,
      `encode ${d.encodeFps}fps${etaSec ? ` · ~${etaSec}s left` : ""}`,
      `render ${d.renderMs}ms · wait ${d.encodeWaitMs}ms · vframe ${d.vfMs}ms · mux ${d.muxMs}ms`,
    ].join("\n");
    navigator.clipboard?.writeText(lines).then(() => {
      copied = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1600);
    });
  }
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

  {#snippet diag()}
    {#if d}
      <div class="diag">
        <div class="diag-row big">
          <span class="diag-fps">{d.encodeFps}<small>fps</small></span>
          {#if etaSec}<span class="diag-eta">~{etaSec}s left</span>{/if}
        </div>
        <div class="diag-grid">
          <span class="k">res</span><span class="v">{d.resolution}² · {mp}MP</span>
          <span class="k">encoder</span><span class="v" class:warn={d.encoder === "wasm" || !d.hwSupported}>{hwLabel}</span>
          <span class="k">frames</span><span class="v">{d.encodedFrames}/{d.totalFrames}</span>
          <span class="k">render</span><span class="v">{d.renderMs}ms</span>
          <span class="k">enc&nbsp;wait</span><span class="v">{d.encodeWaitMs}ms</span>
          <span class="k">vframe</span><span class="v">{d.vfMs}ms</span>
          <span class="k">mux</span><span class="v">{d.muxMs}ms</span>
          <span class="k">codec</span><span class="v small">{d.codec}</span>
        </div>
        {#if d.encoder === "wasm" || !d.hwSupported}
          <p class="diag-note">No hardware H.264, encoding in software. Lower the resolution for a big speedup.</p>
        {/if}
        <button class="takeover-btn ghost diag-copy" onclick={copyDiag}>
          {copied ? "Copied ✓" : "Copy diagnostics"}
        </button>
      </div>
    {/if}
  {/snippet}
</ExportTakeover>

<style>
  /* Diagnostics card styling — moved verbatim from the old overlay. */
  .diag {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    font-variant-numeric: tabular-nums;
  }
  .diag-row.big { display: flex; align-items: baseline; justify-content: center; gap: 12px; }
  .diag-fps { font-size: 30px; font-weight: 800; color: var(--theme-text, #fff); line-height: 1; }
  .diag-fps small { font-size: 13px; font-weight: 600; opacity: 0.6; margin-left: 2px; }
  .diag-eta { font-size: 13px; color: var(--theme-text-dim, rgba(255, 255, 255, 0.6)); }
  .diag-grid { display: grid; grid-template-columns: auto 1fr; gap: 3px 14px; font-size: 12.5px; text-align: left; }
  .diag-grid .k { color: var(--theme-text-dim, rgba(255, 255, 255, 0.45)); white-space: nowrap; }
  .diag-grid .v { color: var(--theme-text, rgba(255, 255, 255, 0.92)); text-align: right; }
  .diag-grid .v.small { font-size: 10.5px; word-break: break-all; }
  .diag-grid .v.warn { color: #fbbf24; font-weight: 700; }
  .diag-note { margin: 0; font-size: 11.5px; line-height: 1.35; color: #fbbf24; text-align: left; }
  .diag-copy { width: 100%; min-height: 40px; padding: 6px 16px; font-size: 13px; border-radius: 12px; border: 1px solid var(--theme-stroke, rgba(255,255,255,0.18)); background: transparent; color: var(--theme-text-dim, rgba(255,255,255,0.7)); font-weight: 600; cursor: pointer; }
</style>
