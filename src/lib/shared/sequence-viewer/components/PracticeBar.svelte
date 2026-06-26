<!--
  PracticeBar.svelte

  Docked cockpit bar for focused practice mode. Replaces the floating progress
  pill while practice is active: transport + tempo + level progress + level-up,
  all in one full-width strip at the bottom of the viewer.

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

  // Level the user is on (currentLevel counts *completed* levels).
  let levelLabel = $derived(`Lv ${progress.currentLevel + 1}`);

  let countdownLabel = $derived.by(() => {
    if (progress.readyToAdvance) return "Ready to speed up";
    const n = progress.loopsRemaining;
    return `${n} ${n === 1 ? "loop" : "loops"} to next`;
  });
</script>

<div class="practice-bar" role="region" aria-label="Practice controls">
  <button class="pb-btn exit" type="button" onclick={onStop} aria-label="Exit practice">
    <i class="fas fa-xmark" aria-hidden="true"></i>
    <span class="pb-label">Exit</span>
  </button>

  <button
    class="pb-btn"
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
    class="pb-btn levelup"
    class:ready={progress.readyToAdvance}
    type="button"
    onclick={onAdvance}
    aria-label="Level up to a faster tempo now"
  >
    <i class="fas fa-forward" aria-hidden="true"></i>
    <span class="pb-label">Level Up</span>
  </button>
</div>

<style>
  .practice-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    padding-bottom: calc(8px + env(safe-area-inset-bottom));
    background: var(--theme-panel-bg, rgba(12, 14, 22, 0.96));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.35);
    flex-shrink: 0;
    container-type: inline-size;
    container-name: practice-bar;
  }

  .pb-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    padding: 4px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .pb-btn i {
    font-size: 15px;
  }

  @media (hover: hover) and (pointer: fine) {
    .pb-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      color: var(--theme-text, white);
    }
  }

  .pb-btn:active { transform: scale(0.95); }
  .pb-btn:focus-visible { outline: 2px solid var(--theme-accent, #6366f1); outline-offset: 2px; }

  .pb-btn.exit {
    color: var(--semantic-error, #f87171);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
  }

  .pb-btn.levelup {
    margin-left: auto;
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 12%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent);
    color: color-mix(in srgb, var(--semantic-success, #22c55e) 65%, white);
  }

  .pb-btn.levelup.ready {
    animation: pb-levelup-pulse 1.6s ease-in-out infinite;
    border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 55%, transparent);
  }

  @keyframes pb-levelup-pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent); }
    50% { box-shadow: 0 0 14px 2px color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent); }
  }

  /* Tempo group */
  .pb-tempo {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .pb-step {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.7rem;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    .pb-step:hover:not(:disabled) {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      color: var(--theme-text, white);
    }
  }

  .pb-step:active:not(:disabled) { transform: scale(0.92); }
  .pb-step:disabled { opacity: 0.3; cursor: not-allowed; }
  .pb-step:focus-visible { outline: 2px solid var(--theme-accent, #6366f1); outline-offset: 2px; }

  .pb-bpm {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
    min-width: 52px;
  }

  .pb-bpm-value {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--bpm-color);
    font-variant-numeric: tabular-nums;
  }

  .pb-bpm-unit {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    margin-top: 2px;
  }

  /* Progress group — flexes to absorb width changes so siblings don't shift */
  .pb-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .pb-dots {
    display: flex;
    gap: 5px;
  }

  .pb-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.12));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.18));
    transition: background var(--duration-normal, 200ms) ease;
  }

  .pb-dot.filled {
    background: var(--theme-accent, #8b5cf6);
    border-color: var(--theme-accent, #8b5cf6);
  }

  .pb-countdown {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .pb-countdown.ready {
    color: color-mix(in srgb, var(--semantic-success, #22c55e) 55%, white);
  }

  /* Condense on narrow bars: drop button text labels, keep icons. */
  @container practice-bar (max-width: 520px) {
    .pb-label { display: none; }
    .pb-btn { padding: 4px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pb-btn, .pb-step, .pb-dot { transition: none; }
    .pb-btn.levelup.ready { animation: none; }
    .pb-btn:active, .pb-step:active { transform: none; }
  }
</style>
