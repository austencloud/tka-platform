<!--
  PracticeBar.svelte

  Docked cockpit bar for focused practice mode. Centered, prominent controls in
  one full-width strip at the bottom of the viewer. Every control shares one
  height (--ctrl-h) so the row reads as a single clean strip:

    play/pause | [Slower]  [− BPM +]  [Faster] | ❄ Hold | caption + fill

  One tempo concept: the big Slower/Faster step the tempo by the speed step; the
  BPM pill is the readout with small ±1 fine steppers (press-and-hold to repeat)
  flanking it; the + carries the level-up role (pulses green in Manual once a
  level completes). The number pulses on each bump, and a slim fill bar grows
  toward the next speed-up. Exit lives in the header, not here.
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
  }

  let { progress, bpm, isPlaying, onBpmChange, onStepLevel, onToggleHold, onPlayPause }: Props =
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

  // Fine ± with press-and-hold to repeat (accelerates after a short delay).
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let holdInterval: ReturnType<typeof setInterval> | null = null;
  function startFineHold(dir: 1 | -1) {
    fine(dir);
    holdTimer = setTimeout(() => {
      holdInterval = setInterval(() => fine(dir), 90);
    }, 450);
  }
  function stopFineHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
  }

  let isSmooth = $derived(progress.progressionMode === "smooth");
  let isManual = $derived(progress.progressionMode === "manual");

  // Fill toward the next speed-up (smooth has no boundary → a faded full bar).
  let fillPct = $derived(
    isSmooth ? 100 : (progress.roundsPerLevel > 0 ? (progress.loopsCompleted / progress.roundsPerLevel) * 100 : 0)
  );

  // Pulse the BPM number whenever the tempo bumps up, so you feel it tighten.
  let prevBpm = bpm;
  let bumped = $state(false);
  let bumpTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if (bpm > prevBpm) {
      bumped = true;
      if (bumpTimer) clearTimeout(bumpTimer);
      bumpTimer = setTimeout(() => (bumped = false), 360);
    }
    prevBpm = bpm;
  });

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

      <div class="pb-readout" class:bumped role="group" aria-label="Fine tune tempo by 1 BPM">
        <button
          class="pb-fine-btn"
          type="button"
          onpointerdown={() => startFineHold(-1)}
          onpointerup={stopFineHold}
          onpointerleave={stopFineHold}
          onpointercancel={stopFineHold}
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
          onpointerdown={() => startFineHold(1)}
          onpointerup={stopFineHold}
          onpointerleave={stopFineHold}
          onpointercancel={stopFineHold}
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
      <span class="pb-caption" class:ready={progress.readyToAdvance}>{caption}</span>
      <div class="pb-fill-track" aria-hidden="true">
        <div
          class="pb-fill"
          class:smooth={isSmooth}
          class:ready={progress.readyToAdvance}
          style="width:{fillPct}%"
        ></div>
      </div>
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
    display: inline-block;
  }
  /* Bump pulse — the number pops when the tempo climbs. Transform only, so it
     never nudges layout. */
  .pb-readout.bumped .pb-bpm-value { animation: pb-bump 360ms ease-out; }
  @keyframes pb-bump {
    0% { transform: scale(1); }
    35% { transform: scale(1.22); }
    100% { transform: scale(1); }
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
    touch-action: none;
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
  .pb-fill-track {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.12));
    overflow: hidden;
  }
  .pb-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--theme-accent, #8b5cf6);
    transition: width var(--duration-normal, 200ms) ease;
  }
  .pb-fill.smooth { opacity: 0.45; }
  .pb-fill.ready { background: var(--semantic-success, #22c55e); }
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
    .pb-btn, .pb-fine-btn, .pb-fill { transition: none; }
    .pb-level.up.ready { animation: none; }
    .pb-readout.bumped .pb-bpm-value { animation: none; }
    .pb-btn:active, .pb-fine-btn:active { transform: none; }
  }
</style>
