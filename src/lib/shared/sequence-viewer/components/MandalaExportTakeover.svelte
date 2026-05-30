<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import type { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";

  interface Props {
    ctrl: MandalaViewerController;
    sequence: any;
    bluePropType?: string;
    redPropType?: string;
    /** Mandala render size (px) for the fullscreen stage. */
    size: number;
  }
  let { ctrl, sequence, bluePropType, redPropType, size }: Props = $props();

  let reduceMotion = $state(false);
  $effect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const onChange = () => (reduceMotion = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
  const dur = (ms: number) => (reduceMotion ? 0 : ms);

  const pct = $derived(Math.round(ctrl.exportProgress * 100));
  const phaseLabel = $derived(
    ctrl.exportPhase === "capturing"
      ? `Rendering ${pct}%`
      : ctrl.exportPhase === "encoding"
        ? "Encoding…"
        : ctrl.exportPhase === "complete"
          ? "Done"
          : "",
  );

  // ── Live export diagnostics (readable off-device, copyable to paste back) ──
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

{#if ctrl.exportPhase !== "idle"}
  <div class="export-takeover" transition:fade={{ duration: dur(280) }}>
    <div class="takeover-stage">
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
    </div>
    <div class="takeover-panel" transition:fly={{ y: 28, duration: dur(340), easing: cubicOut }}>
      {#if ctrl.exportPhase === "error"}
        <p class="takeover-msg error"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> Export failed</p>
        <p class="takeover-sub">{ctrl.exportError}</p>
        <div class="takeover-actions">
          <button class="takeover-btn ghost" onclick={() => ctrl.cancelExport()}>Close</button>
          <button class="takeover-btn primary" onclick={() => ctrl.startExport()}>Retry</button>
        </div>
      {:else}
        <div class="takeover-bar"><div class="takeover-bar-fill" style:width="{pct}%"></div></div>
        <p class="takeover-phase">{phaseLabel}</p>
        <p class="takeover-msg">Please don't navigate away.</p>
        {#if ctrl.exportPhase !== "complete"}
          <button class="takeover-btn ghost" onclick={() => ctrl.cancelExport()}>Cancel</button>
        {/if}
      {/if}
    </div>

    {#if d && ctrl.exportPhase !== "error"}
      <!-- Floating diag card: pinned top-center, above the bottom bar, its own
           scroll so the Copy button stays reachable on short/folded screens. -->
      <div class="diag-overlay">
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
            <p class="diag-note">No hardware H.264 — encoding in software. Lower the resolution for a big speedup.</p>
          {/if}
          <button class="takeover-btn ghost diag-copy" onclick={copyDiag}>
            {copied ? "Copied ✓" : "Copy diagnostics"}
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .export-takeover {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 24px;
    /* Opaque so only the centered takeover mandala shows — no stage mandala
       bleeding through behind it. */
    background: #07070f;
  }
  .takeover-stage { display: flex; align-items: center; justify-content: center; }
  .takeover-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 320px;
    text-align: center;
  }
  .takeover-bar {
    width: 100%;
    height: 8px;
    border-radius: 4px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.12));
    overflow: hidden;
  }
  .takeover-bar-fill {
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--theme-accent, #6366f1), color-mix(in srgb, var(--theme-accent, #6366f1) 50%, #fff));
    transition: width 180ms ease;
  }
  .takeover-phase {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
  }
  .takeover-msg {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  /* ── Live diagnostics readout (floating, top-pinned, scrollable) ── */
  .diag-overlay {
    position: absolute;
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 40; /* above the viewer bottom bar */
    width: min(340px, calc(100% - 24px));
    max-height: min(70vh, calc(100% - 32px));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    pointer-events: auto;
  }
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
  .diag-row.big {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 12px;
  }
  .diag-fps {
    font-size: 30px;
    font-weight: 800;
    color: var(--theme-text, #fff);
    line-height: 1;
  }
  .diag-fps small { font-size: 13px; font-weight: 600; opacity: 0.6; margin-left: 2px; }
  .diag-eta { font-size: 13px; color: var(--theme-text-dim, rgba(255, 255, 255, 0.6)); }
  .diag-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 14px;
    font-size: 12.5px;
    text-align: left;
  }
  .diag-grid .k { color: var(--theme-text-dim, rgba(255, 255, 255, 0.45)); white-space: nowrap; }
  .diag-grid .v { color: var(--theme-text, rgba(255, 255, 255, 0.92)); text-align: right; }
  .diag-grid .v.small { font-size: 10.5px; word-break: break-all; }
  .diag-grid .v.warn { color: #fbbf24; font-weight: 700; }
  .diag-note {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.35;
    color: #fbbf24;
    text-align: left;
  }
  .diag-copy { width: 100%; min-height: 40px; padding: 6px 16px; font-size: 13px; }
  .takeover-msg.error { color: #fca5a5; font-weight: 600; font-size: 15px; }
  .takeover-sub {
    margin: 0;
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    word-break: break-word;
  }
  .takeover-actions { display: flex; gap: 10px; }
  .takeover-btn {
    min-height: 44px;
    padding: 8px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1), background 200ms ease, border-color 200ms ease;
  }
  .takeover-btn:active { transform: scale(0.95); }
  .takeover-btn.ghost {
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.18));
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }
  .takeover-btn.primary {
    border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 70%, transparent);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    color: white;
  }

  @media (hover: hover) {
    .takeover-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 6px 18px color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent); }
    .takeover-btn.ghost:hover { border-color: var(--theme-text-dim, rgba(255, 255, 255, 0.4)); color: var(--theme-text, #fff); }
  }
  @media (prefers-reduced-motion: reduce) {
    .takeover-bar-fill { transition: none; }
    .takeover-btn:active { transform: none; }
  }
</style>
