<!--
  PracticeBar.svelte

  Docked cockpit bar for focused practice mode. Centered, prominent controls:
  transport + tempo + level progress + level-up + a clear exit, in one
  full-width strip at the bottom of the viewer.

  Auto mode: the "N to next" countdown drives the ramp (amps at 0); Level Up
  jumps early. Manual mode: holds each level; Level Up glows once ready.
-->
<script lang="ts">
  import type { TempoPracticeProgress } from "../services/tempo-practice-orchestrator";

  interface Props {
    progress: TempoPracticeProgress;
    bpm: number;
    isPlaying: boolean;
    onBpmChange: (bpm: number) => void;
    onPlayPause: () => void;
    onAdvance: () => void;
    onStop: () => void;
  }

  let { progress, bpm, isPlaying, onBpmChange, onAdvance, onPlayPause, onStop }: Props = $props();

  const BPM_MIN = 5;
  const BPM_MAX = 300;
  const STEP = 5;

  let bpmColor = $derived.by(() => {
    if (bpm <= 30) return "var(--semantic-success, #22c55e)";
    if (bpm <= 75) return "var(--theme-accent, #8b5cf6)";
    if (bpm <= 120) return "var(--semantic-warning, #f59e0b)";
    return "var(--semantic-error, #ef4444)";
  });

  function nudge(dir: 1 | -1) {
    const next = Math.max(BPM_MIN, Math.min(BPM_MAX, bpm + dir * STEP));
    if (next !== bpm) onBpmChange(next);
  }

  let levelLabel = $derived(`Lv ${progress.currentLevel + 1}`);

  let countdownLabel = $derived.by(() => {
    if (progress.readyToAdvance) return "Ready to speed up";
    const n = progress.loopsRemaining;
    return `${n} ${n === 1 ? "loop" : "loops"} to next`;
  });
</script>

<div class="practice-bar" role="region" aria-label="Practice controls">
  <div class="pb-group">
    <button class="pb-exit" type="button" onclick={onStop} aria-label="Exit practice mode">
      <i class="fas fa-xmark" aria-hidden="true"></i>
      <span>Exit</span>
    </button>

    <span class="pb-divider" aria-hidden="true"></span>

    <button
      class="pb-play"
      type="button"
      onclick={onPlayPause}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
    </button>

    <div class="pb-tempo" style="--bpm-color: {bpmColor}">
      <button class="pb-step" type="button" onclick={() => nudge(-1)} disabled={bpm <= BPM_MIN} aria-label="Slower">
        <i class="fas fa-minus" aria-hidden="true"></i>
      </button>
      <span class="pb-bpm">
        <span class="pb-bpm-value">{bpm}</span>
        <span class="pb-bpm-unit">BPM</span>
      </span>
      <button class="pb-step" type="button" onclick={() => nudge(1)} disabled={bpm >= BPM_MAX} aria-label="Faster">
        <i class="fas fa-plus" aria-hidden="true"></i>
      </button>
    </div>

    <div class="pb-progress">
      <div class="pb-dots" aria-hidden="true">
        {#each Array(progress.roundsPerLevel) as _, i}
          <span class="pb-dot" class:filled={i < progress.loopsCompleted}></span>
        {/each}
      </div>
      <span class="pb-countdown" class:ready={progress.readyToAdvance}>{levelLabel} · {countdownLabel}</span>
    </div>

    <button
      class="pb-levelup"
      class:ready={progress.readyToAdvance}
      type="button"
      onclick={onAdvance}
      aria-label="Level up to a faster tempo now"
    >
      <i class="fas fa-forward" aria-hidden="true"></i>
      <span>Level Up</span>
    </button>
  </div>
</div>

<style>
  .practice-bar {
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
    gap: 18px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .pb-divider {
    width: 1px;
    height: 36px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.14));
    flex-shrink: 0;
  }

  /* Shared button base */
  .pb-exit,
  .pb-levelup,
  .pb-play {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 52px;
    padding: 0 20px;
    border-radius: 14px;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    border: 2px solid transparent;
    flex-shrink: 0;
  }

  .pb-exit i,
  .pb-levelup i { font-size: 16px; }

  .pb-exit:active,
  .pb-levelup:active,
  .pb-play:active { transform: scale(0.95); }

  .pb-exit:focus-visible,
  .pb-levelup:focus-visible,
  .pb-play:focus-visible,
  .pb-step:focus-visible { outline: 3px solid var(--theme-accent, #6366f1); outline-offset: 2px; }

  /* Exit — filled red, unmistakable */
  .pb-exit {
    background: var(--semantic-error, #ef4444);
    color: #fff;
    min-width: 96px;
  }
  @media (hover: hover) and (pointer: fine) {
    .pb-exit:hover { background: color-mix(in srgb, var(--semantic-error, #ef4444) 85%, white); }
  }

  /* Play/pause — neutral square */
  .pb-play {
    width: 52px;
    padding: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, #fff);
  }
  .pb-play i { font-size: 18px; }
  @media (hover: hover) and (pointer: fine) {
    .pb-play:hover { background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1)); }
  }

  /* Level Up — filled green, prominent */
  .pb-levelup {
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 22%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 45%, transparent);
    color: color-mix(in srgb, var(--semantic-success, #22c55e) 55%, white);
    min-width: 120px;
  }
  @media (hover: hover) and (pointer: fine) {
    .pb-levelup:hover {
      background: color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent);
      color: #fff;
    }
  }
  .pb-levelup.ready {
    background: var(--semantic-success, #22c55e);
    color: #fff;
    border-color: var(--semantic-success, #22c55e);
    animation: pb-levelup-pulse 1.5s ease-in-out infinite;
  }
  @keyframes pb-levelup-pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent); }
    50% { box-shadow: 0 0 18px 3px color-mix(in srgb, var(--semantic-success, #22c55e) 50%, transparent); }
  }

  /* Tempo */
  .pb-tempo {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .pb-step {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 50%;
    color: var(--theme-text, #fff);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    .pb-step:hover:not(:disabled) { background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12)); }
  }
  .pb-step:active:not(:disabled) { transform: scale(0.9); }
  .pb-step:disabled { opacity: 0.3; cursor: not-allowed; }

  .pb-bpm {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
    min-width: 60px;
  }
  .pb-bpm-value {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--bpm-color);
    font-variant-numeric: tabular-nums;
  }
  .pb-bpm-unit {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin-top: 3px;
  }

  /* Progress */
  .pb-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-width: 120px;
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
  .pb-countdown {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .pb-countdown.ready { color: color-mix(in srgb, var(--semantic-success, #22c55e) 55%, white); }

  /* Narrow: keep labels (obvious) but tighten gaps; let the cluster wrap. */
  @container practice-bar (max-width: 560px) {
    .pb-group { gap: 12px; }
    .pb-divider { display: none; }
    .pb-progress { order: 5; flex-basis: 100%; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pb-exit, .pb-levelup, .pb-play, .pb-step, .pb-dot { transition: none; }
    .pb-levelup.ready { animation: none; }
    .pb-exit:active, .pb-levelup:active, .pb-play:active, .pb-step:active { transform: none; }
  }
</style>
