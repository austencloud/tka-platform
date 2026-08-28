<script lang="ts">
  import { getFlowFestFieldPositioningContext } from "../context/flow-fest-field-positioning-context";

  interface Props {
    captureMode?: boolean;
    surface?: "floating" | "drawer";
  }

  let { captureMode = false, surface = "floating" }: Props = $props();
  const { state } = getFlowFestFieldPositioningContext();
  const snapshot = $derived(state.snapshot);
  const fixLabel = $derived(
    snapshot.fix
      ? `${snapshot.fix.latitude.toFixed(6)}, ${snapshot.fix.longitude.toFixed(6)}`
      : "No device fix"
  );
</script>

<aside
  class="field-panel"
  data-surface={surface}
  data-field-mode={snapshot.mode}
  data-field-status={snapshot.status}
  aria-label="Field positioning"
>
  <div class="field-panel__status">
    <span class:active={snapshot.status === "tracking"}></span>
    <div>
      <small>Field link</small>
      <strong>{snapshot.message}</strong>
    </div>
  </div>

  <div class="field-panel__coordinates">
    <span>{fixLabel}</span>
    {#if snapshot.evaluation}
      <small>
        {snapshot.evaluation.accepted ? "accepted" : "held"} ·
        {snapshot.fix?.accuracyMeters.toFixed(1)} m accuracy
      </small>
    {:else}
      <small>Device coordinates stay in this browser session.</small>
    {/if}
  </div>

  {#if snapshot.mode === "replay"}
    <div class="field-panel__progress" aria-label="Route replay progress">
      <i
        style:width={`${snapshot.replaySamples > 0 ? (snapshot.replayOrdinal / snapshot.replaySamples) * 100 : 0}%`}
      ></i>
    </div>
  {/if}

  <div class="field-panel__actions">
    <button type="button" onclick={() => state.startLive()}
      >Use device GPS</button
    >
    <button type="button" onclick={() => state.startReplay()}
      >Replay checked route</button
    >
    {#if snapshot.mode !== "off"}
      <button type="button" onclick={() => state.stop()}>Stop</button>
    {/if}
  </div>

  {#if captureMode}
    <div class="field-panel__diagnostics">
      <button type="button" onclick={() => state.demonstrateLowAccuracy()}>
        Show poor accuracy
      </button>
      <button type="button" onclick={() => state.demonstrateStaleFix()}>
        Show stale fix
      </button>
    </div>
  {/if}
</aside>

<style>
  .field-panel {
    position: absolute;
    inset-block-start: clamp(6.2rem, 9vw, 8rem);
    inset-inline-end: clamp(0.75rem, 1.4vw, 1.5rem);
    z-index: 34;
    display: grid;
    gap: 0.65rem;
    inline-size: min(22rem, calc(100vw - 1.5rem));
    padding: 0.8rem;
    border: 1px solid var(--sim-stroke);
    border-radius: 1rem;
    color: var(--sim-text);
    background: var(--sim-panel-strong);
    box-shadow: 0 1.4rem 4rem rgba(2, 7, 4, 0.34);
    backdrop-filter: blur(1rem) saturate(1.1);
  }

  .field-panel[data-surface="drawer"] {
    position: static;
    inline-size: auto;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
  }

  .field-panel__status {
    display: grid;
    grid-template-columns: 0.7rem minmax(0, 1fr);
    align-items: center;
    gap: 0.65rem;
  }

  .field-panel__status > span {
    inline-size: 0.62rem;
    block-size: 0.62rem;
    border-radius: 50%;
    background: #e09963;
    box-shadow: 0 0 0.8rem rgba(224, 153, 99, 0.35);
  }

  .field-panel__status > span.active {
    background: var(--sim-mint);
    box-shadow: 0 0 0.9rem rgba(156, 224, 190, 0.65);
  }

  .field-panel__status div,
  .field-panel__coordinates {
    display: grid;
    min-inline-size: 0;
  }

  .field-panel small {
    color: var(--sim-muted);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.35;
  }

  .field-panel__status small {
    color: var(--sim-accent);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .field-panel strong {
    overflow: hidden;
    font-size: 0.84rem;
    line-height: 1.25;
    text-overflow: ellipsis;
  }

  .field-panel__coordinates span {
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 0.8rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .field-panel__progress {
    overflow: hidden;
    block-size: 0.28rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
  }

  .field-panel__progress i {
    display: block;
    block-size: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--sim-accent), var(--sim-mint));
  }

  .field-panel__actions,
  .field-panel__diagnostics {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  button {
    min-block-size: var(--min-touch-target, 2.75rem);
    padding: 0.45rem 0.72rem;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 0.65rem;
    color: var(--sim-text);
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 750;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.075);
  }

  button:hover {
    border-color: rgba(255, 180, 95, 0.5);
    background: rgba(255, 180, 95, 0.12);
  }

  button:focus-visible {
    outline: 2px solid var(--sim-accent);
    outline-offset: 2px;
  }

  .field-panel__diagnostics {
    padding-block-start: 0.55rem;
    border-block-start: 1px solid var(--sim-stroke);
  }

  .field-panel__diagnostics button {
    min-block-size: var(--min-touch-target, 2.75rem);
    color: var(--sim-muted);
    font-size: var(--font-size-compact, 0.75rem);
  }

  @media (max-width: 700px) {
    .field-panel[data-surface="floating"] {
      inset-block-start: 5.65rem;
      inset-inline: 0.55rem;
      inline-size: auto;
      padding: 0.65rem;
    }

    .field-panel__coordinates,
    .field-panel__diagnostics {
      display: none;
    }

    .field-panel__actions {
      flex-wrap: nowrap;
    }

    button {
      flex: 1;
      min-inline-size: 0;
      min-block-size: 2.7rem;
      padding-inline: 0.4rem;
    }
  }

  @media (max-height: 520px) and (min-aspect-ratio: 16 / 9) {
    .field-panel[data-surface="floating"] {
      inset-block-start: 0.55rem;
      inset-inline: auto 0.55rem;
      inline-size: min(22rem, 44vw);
    }

    .field-panel__coordinates,
    .field-panel__diagnostics {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .field-panel__progress i {
      transition: none;
    }
  }
</style>
