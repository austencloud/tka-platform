<!--
  PracticeBar.svelte

  Docked cockpit bar for focused practice mode. Centered, prominent controls in
  one full-width strip at the bottom of the viewer. Every control shares one
  height (--ctrl-h) so the row reads as a single clean strip:

    Exit | play/pause | [− Level]  [BPM + fine spinner]  [+ Level] | progress

  One tempo concept: the big −/+ step a whole level (by the configured speed
  step), the BPM pill is the readout with a small ±1 fine spinner built in, and
  the + carries the level-up role (pulses green in Manual once a level
  completes) — no separate Level Up button to duplicate it. Level is derived
  from BPM in the orchestrator, so nothing here can desync the "Lv N" readout.
-->
<script lang="ts">
  import type { TempoPracticeProgress } from "../services/tempo-practice-orchestrator";

  interface Props {
    progress: TempoPracticeProgress;
    bpm: number;
    isPlaying: boolean;
    onBpmChange: (bpm: number) => void;
    onPlayPause: () => void;
    /** Step the tempo by the speed step: +1 up, -1 down. */
    onStepLevel: (dir: 1 | -1) => void;
    /** Freeze/resume the auto-climb at the current speed. */
    onToggleHold: () => void;
    onStop: () => void;
  }

  let { progress, bpm, isPlaying, onBpmChange, onStepLevel, onToggleHold, onPlayPause, onStop }: Props =
    $props();

  let bpmColor = $derived.by(() => {
    if (bpm <= 30) return "var(--semantic-success, #22c55e)";
    if (bpm <= 75) return "var(--theme-accent, #8b5cf6)";
    if (bpm <= 120) return "var(--semantic-warning, #f59e0b)";
    return "var(--semantic-error, #ef4444)";
  });

  // Floor/ceiling shared by both the level buttons and the fine spinner.
  let atFloor = $derived(bpm <= progress.startBpm);
  let atCeiling = $derived(bpm >= progress.maxBpm);

  function fine(dir: 1 | -1) {
    const next = Math.max(progress.startBpm, Math.min(progress.maxBpm, bpm + dir));
    if (next !== bpm) onBpmChange(next);
  }

  let isSmooth = $derived(progress.progressionMode === "smooth");
  let isManual = $derived(progress.progressionMode === "manual");

  // The + glows when Manual has parked at a completed level awaiting a tap.
  let upReady = $derived(isManual && progress.readyToAdvance);

  let caption = $derived.by(() => {
    if (progress.held) return `Holding at ${bpm} BPM`;
    if (isSmooth) return `Climbing +${progress.smoothStep} BPM each loop`;
    const n = progress.loopsRemaining;
    const loops = `${n} ${n === 1 ? "loop" : "loops"}`;
    if (isManual) {
      return progress.readyToAdvance ? "Ready — tap Faster" : `${loops} to go, then Faster`;
    }
    return `Speeds up in ${loops}`;
  });
</script>

<div class="practice-bar" role="region" aria-label="Practice controls">
  <div class="pb-group">
    <button class="pb-btn pb-exit" type="button" onclick={onStop} aria-label="Exit practice mode">
      <i class="fas fa-xmark" aria-hidden="true"></i>
      <span>Exit</span>
    </button>

    <span class="pb-divider" aria-hidden="true"></span>

    <button
      class="pb-btn pb-play"
      type="button"
      onclick={onPlayPause}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
    </button>

    <div class="pb-tempo" style="--bpm-color: {bpmColor}">
      <button
        class="pb-btn pb-level down"
        type="button"
        onclick={() => onStepLevel(-1)}
        disabled={atFloor}
        aria-label="Slower"
      >
        <i class="fas fa-minus" aria-hidden="true"></i>
        <span class="pb-level-label">Slower</span>
      </button>

      <div class="pb-readout" role="group" aria-label="Fine tune tempo by 1 BPM">
        <button
          class="pb-fine-btn"
          type="button"
          onclick={() => fine(-1)}
          disabled={atFloor}
          aria-label="Slower by 1 BPM"
        >
          <i class="fas fa-minus" aria-hidden="true"></i>
        </button>
        <span class="pb-bpm" aria-live="polite">
          <span class="pb-bpm-value">{bpm}</span>
          <span class="pb-bpm-unit">BPM</span>
        </span>
        <button
          class="pb-fine-btn"
          type="button"
          onclick={() => fine(1)}
          disabled={atCeiling}
          aria-label="Faster by 1 BPM"
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
        </button>
      </div>

      <button
        class="pb-btn pb-level up"
        class:ready={upReady}
        type="button"
        onclick={() => onStepLevel(1)}
        disabled={atCeiling}
        aria-label="Faster"
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
        <span class="pb-level-label">Faster</span>
      </button>
    </div>

    <button
      class="pb-btn pb-hold"
      class:held={progress.held}
      type="button"
      onclick={onToggleHold}
      aria-label={progress.held ? "Resume speeding up" : "Hold this speed"}
      aria-pressed={progress.held}
    >
      <i class="fas fa-snowflake" aria-hidden="true"></i>
      <span>{progress.held ? "Held" : "Hold"}</span>
    </button>

    <span class="pb-divider" aria-hidden="true"></span>

    <div class="pb-progress">
      {#if !isSmooth}
        <div class="pb-dots" aria-hidden="true">
          {#each Array(progress.roundsPerLevel), i}
            <span class="pb-dot" class:filled={i < progress.loopsCompleted}></span>
          {/each}
        </div>
      {/if}
      <span class="pb-caption" class:ready={progress.readyToAdvance}>{caption}</span>
    </div>
  </div>
</div>

<style>
  .practice-bar {
    --ctrl-h: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 14px 16px;
    padding-bottom: calc(14px + env(safe-area-inset-bottom));
    background: var(--theme-panel-bg, rgba(12, 14, 22, 0.98));
    border-top: 2px solid color-mix(in srgb, var(--theme-accent, #8b5cf6) 45%, transparent);
    box-shadow: 0 -6px 28px rgba(0, 0, 0, 0.45);
    flex-shrink: 0;
    container-type: inline-size;
    container-name: practice-bar;
  }

  /* Centered control cluster. */
  .pb-group {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .pb-divider {
    width: 1px;
    height: var(--ctrl-h);
    background: var(--theme-stroke, rgba(255, 255, 255, 0.14));
    flex-shrink: 0;
  }

  /* Every interactive control in the strip shares one height. */
  .pb-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--ctrl-h);
    border-radius: 14px;
    border: 2px solid transparent;
    font-weight: 700;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }
  .pb-btn:active:not(:disabled) { transform: scale(0.95); }
  .pb-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .pb-btn:focus-visible,
  .pb-fine-btn:focus-visible { outline: 3px solid var(--theme-accent, #6366f1); outline-offset: 2px; }

  /* Exit — filled red, unmistakable */
  .pb-exit {
    gap: 8px;
    padding: 0 20px;
    min-width: 96px;
    font-size: var(--font-size-min, 14px);
    background: var(--semantic-error, #ef4444);
    color: #fff;
  }
  .pb-exit i { font-size: 16px; }
  @media (hover: hover) and (pointer: fine) {
    .pb-exit:hover { background: color-mix(in srgb, var(--semantic-error, #ef4444) 85%, white); }
  }

  /* Hold — toggle that freezes the climb; lights up when active */
  .pb-hold {
    flex-direction: column;
    gap: 1px;
    width: 62px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.14));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .pb-hold i { font-size: 16px; }
  @media (hover: hover) and (pointer: fine) {
    .pb-hold:hover { background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12)); color: var(--theme-text, #fff); }
  }
  .pb-hold.held {
    background: color-mix(in srgb, var(--theme-accent, #38bdf8) 26%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #38bdf8) 55%, transparent);
    color: color-mix(in srgb, var(--theme-accent, #7dd3fc) 75%, white);
  }

  /* Play/pause — neutral square */
  .pb-play {
    width: var(--ctrl-h);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, #fff);
  }
  .pb-play i { font-size: 18px; }
  @media (hover: hover) and (pointer: fine) {
    .pb-play:hover { background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1)); }
  }

  /* Tempo cluster: [− level]  readout  [+ level] — all share --ctrl-h */
  .pb-tempo {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  /* Big level buttons — the primary tempo control */
  .pb-level {
    flex-direction: column;
    gap: 1px;
    width: 62px;
  }
  .pb-level i { font-size: 18px; }
  .pb-level-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    opacity: 0.85;
  }
  .pb-level.down {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.14));
    color: var(--theme-text, #fff);
  }
  .pb-level.up {
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 22%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 45%, transparent);
    color: color-mix(in srgb, var(--semantic-success, #22c55e) 70%, white);
  }
  @media (hover: hover) and (pointer: fine) {
    .pb-level.down:hover:not(:disabled) { background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12)); }
    .pb-level.up:hover:not(:disabled) {
      background: color-mix(in srgb, var(--semantic-success, #22c55e) 32%, transparent);
      color: #fff;
    }
  }
  .pb-level.up.ready {
    background: var(--semantic-success, #22c55e);
    color: #fff;
    border-color: var(--semantic-success, #22c55e);
    animation: pb-up-pulse 1.5s ease-in-out infinite;
  }
  @keyframes pb-up-pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent); }
    50% { box-shadow: 0 0 18px 3px color-mix(in srgb, var(--semantic-success, #22c55e) 50%, transparent); }
  }

  /* BPM readout pill — same height; small ±1 fine steppers flank the number */
  .pb-readout {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--ctrl-h);
    padding: 0 8px;
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }
  .pb-bpm {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
    min-width: 50px;
  }
  .pb-bpm-value {
    font-size: 1.7rem;
    font-weight: 800;
    color: var(--bpm-color);
    font-variant-numeric: tabular-nums;
  }
  .pb-bpm-unit {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin-top: 3px;
  }

  .pb-fine-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 9px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    font-size: 0.7rem;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    .pb-fine-btn:hover:not(:disabled) {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
      color: var(--theme-text, white);
    }
  }
  .pb-fine-btn:active:not(:disabled) { transform: scale(0.9); }
  .pb-fine-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  /* Progress / status. Fixed width reserved for the longest caption so toggling
     Hold (or any caption change) never resizes this block — which would recenter
     the whole bar and snap every control sideways. No shift = nothing to animate. */
  .pb-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 15rem;
  }
  .pb-dots { display: flex; gap: 7px; }
  .pb-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.14));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.22));
    transition: background var(--duration-normal, 200ms) ease;
  }
  .pb-dot.filled {
    background: var(--theme-accent, #8b5cf6);
    border-color: var(--theme-accent, #8b5cf6);
  }
  .pb-caption {
    max-width: 100%;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }
  .pb-caption.ready { color: color-mix(in srgb, var(--semantic-success, #22c55e) 60%, white); }

  /* Narrow: tighten gaps, drop dividers, let progress wrap to its own line. */
  @container practice-bar (max-width: 600px) {
    .pb-group { gap: 12px; }
    .pb-divider { display: none; }
    .pb-progress { order: 5; flex-basis: 100%; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pb-btn, .pb-fine-btn, .pb-dot { transition: none; }
    .pb-level.up.ready { animation: none; }
    .pb-btn:active, .pb-fine-btn:active { transform: none; }
  }
</style>
