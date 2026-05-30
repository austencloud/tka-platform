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
