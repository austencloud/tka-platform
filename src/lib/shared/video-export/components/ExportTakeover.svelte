<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Snippet } from "svelte";

  export type ExportPhase = "idle" | "capturing" | "encoding" | "complete" | "error";

  interface Props {
    phase: ExportPhase;
    /** 0..1 */
    progress: number;
    phaseLabel: string;
    error?: string | null;
    onCancel?: () => void;
    onRetry?: () => void;
    /** Opaque background (Mandala) vs dim scrim over the live canvas (animation). */
    opaque?: boolean;
    /** Optional hero behind the panel (Mandala passes its SequenceMandala). */
    centerpiece?: Snippet;
    /** Optional floating diagnostics card. */
    diag?: Snippet;
  }

  let {
    phase,
    progress,
    phaseLabel,
    error = null,
    onCancel,
    onRetry,
    opaque = false,
    centerpiece,
    diag,
  }: Props = $props();

  let reduceMotion = $state(false);
  $effect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const onChange = () => (reduceMotion = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
  const dur = (ms: number) => (reduceMotion ? 0 : ms);

  const pct = $derived(Math.round(Math.max(0, Math.min(1, progress)) * 100));

  // beforeunload guard — block accidental navigation while exporting.
  $effect(() => {
    if (phase === "idle" || phase === "complete") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  });

  // Brand prop-trail colors for the conic sweep (blue → red motion colors).
  const RING_FROM = "#3575E2";
  const RING_TO = "#ED1C24";
  const ringStyle = $derived(
    `background: conic-gradient(from -90deg, ${RING_FROM} 0%, ${RING_TO} ${pct}%, var(--theme-stroke, rgba(255,255,255,0.12)) ${pct}%);`,
  );
</script>

{#if phase !== "idle"}
  <div class="export-takeover" class:opaque transition:fade={{ duration: dur(280) }}>
    {#if centerpiece}
      <div class="takeover-stage">{@render centerpiece()}</div>
    {/if}

    <div class="takeover-panel" transition:fly={{ y: 28, duration: dur(340), easing: cubicOut }}>
      {#if phase === "error"}
        <p class="takeover-msg error"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> Export failed</p>
        <p class="takeover-sub">{error}</p>
        <div class="takeover-actions">
          {#if onCancel}<button class="takeover-btn ghost" onclick={onCancel}>Close</button>{/if}
          {#if onRetry}<button class="takeover-btn primary" onclick={onRetry}>Retry</button>{/if}
        </div>
      {:else}
        <div
          class="ring"
          style={ringStyle}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Export progress"
        >
          <div class="ring-hole">
            <span class="ring-pct">{pct}<small>%</small></span>
          </div>
        </div>
        <p class="takeover-phase">{phaseLabel}</p>
        <p class="takeover-msg">Please don't navigate away.</p>
        {#if phase !== "complete" && onCancel}
          <button class="takeover-btn ghost" onclick={onCancel}>Cancel</button>
        {/if}
      {/if}
    </div>

    {#if diag && phase !== "error"}
      <div class="diag-overlay">{@render diag()}</div>
    {/if}
  </div>
{/if}

<style>
  .export-takeover {
    position: absolute;
    inset: 0;
    z-index: var(--z-overlay, 500);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 24px;
    /* Dim scrim by default — the live canvas keeps playing underneath. */
    background: rgba(7, 7, 15, 0.78);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .export-takeover.opaque {
    background: #07070f;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .takeover-stage { display: flex; align-items: center; justify-content: center; }
  .takeover-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: 100%;
    max-width: 320px;
    text-align: center;
    padding: 24px;
    border-radius: var(--modal-border-radius, 20px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.14));
    box-shadow:
      0 25px 80px rgba(0, 0, 0, 0.5),
      0 10px 30px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 var(--theme-stroke-strong, rgba(255, 255, 255, 0.1)),
      0 0 48px var(--theme-accent-glow, color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent));
  }
  .ring {
    width: 104px;
    height: 104px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    transition: background 180ms ease;
  }
  .ring-hole {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    display: grid;
    place-items: center;
  }
  .ring-pct {
    font-size: 26px;
    font-weight: 800;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .ring-pct small { font-size: 13px; font-weight: 600; opacity: 0.6; margin-left: 1px; }
  .takeover-phase {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
    /* Reserve width for the widest phase so the box never reflows neighbors. */
    min-width: 11ch;
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
  .diag-overlay {
    position: absolute;
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 40;
    width: min(340px, calc(100% - 24px));
    max-height: min(70vh, calc(100% - 32px));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  @media (hover: hover) {
    .takeover-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 6px 18px color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent); }
    .takeover-btn.ghost:hover { border-color: var(--theme-text-dim, rgba(255, 255, 255, 0.4)); color: var(--theme-text, #fff); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ring { transition: none; }
    .takeover-btn:active { transform: none; }
  }
</style>
