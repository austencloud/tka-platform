<!--
  PracticeBar.svelte

  Docked cockpit bar for focused practice mode. Centered, prominent controls in
  one full-width strip at the bottom of the viewer:

    play/pause | [Slower]  [− BPM +]  [Faster] | ❄ Hold | config + caption + fill

  One model, no modes: you set X (loops between speed-ups) and Y (BPM per
  speed-up), with an optional goal. X=1 is the gentle per-loop creep; X=5,Y=5 is
  a hold-then-jump staircase. The big Slower/Faster step by Y; the BPM pill has
  small ±1 fine steppers flanking it. The number pulses on each bump and a slim
  fill bar grows toward the next speed-up (or the goal). Exit lives in the header.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import type { TempoPracticeConfig, TempoPracticeProgress } from "../services/tempo-practice-orchestrator";

  interface Props {
    progress: TempoPracticeProgress;
    bpm: number;
    isPlaying: boolean;
    onBpmChange: (bpm: number) => void;
    onPlayPause: () => void;
    /** Step the tempo by Y: +1 dir up, -1 down. */
    onStepLevel: (dir: 1 | -1) => void;
    /** Freeze/resume the auto-climb at the current speed. */
    onToggleHold: () => void;
    /** Apply a live config change (loops X, step Y, goal, target on/off). Omit to
     *  hide the inline config controls. */
    onSetConfig?: (patch: Partial<TempoPracticeConfig>) => void;
  }

  let { progress, bpm, isPlaying, onBpmChange, onStepLevel, onToggleHold, onPlayPause, onSetConfig }: Props =
    $props();

  let bpmColor = $derived.by(() => {
    if (bpm <= 30) return "var(--semantic-success, #22c55e)";
    if (bpm <= 75) return "var(--theme-accent, #8b5cf6)";
    if (bpm <= 120) return "var(--semantic-warning, #f59e0b)";
    return "var(--semantic-error, #ef4444)";
  });

  // Floor/ceiling shared by the level buttons and the fine spinner. Ceiling =
  // the goal when a target is set, else the maxBpm cap (progress.targetBpm
  // carries whichever applies).
  let atFloor = $derived(bpm <= progress.startBpm);
  let atCeiling = $derived(bpm >= progress.targetBpm);

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

  // Two knobs + an optional goal. X=1 reads as a continuous creep (no levels).
  let hasTarget = $derived(progress.targetEnabled);
  let isCreep = $derived(progress.roundsPerLevel <= 1);

  // Inline config steppers (loops X, step Y, goal). Bounds mirror the gear popover.
  const LOOPS_MIN = 1, LOOPS_MAX = 20, STEP_MIN = 1, STEP_MAX = 30, GOAL_STEP = 5;
  function cfgLoops(dir: 1 | -1) {
    const v = Math.max(LOOPS_MIN, Math.min(LOOPS_MAX, progress.roundsPerLevel + dir));
    if (v !== progress.roundsPerLevel) onSetConfig?.({ roundsPerLevel: v });
  }
  function cfgStep(dir: 1 | -1) {
    const v = Math.max(STEP_MIN, Math.min(STEP_MAX, progress.increment + dir));
    if (v !== progress.increment) onSetConfig?.({ increment: v });
  }
  function cfgGoal(dir: 1 | -1) {
    const v = Math.max(progress.startBpm + GOAL_STEP, Math.min(progress.maxBpm, progress.goalBpm + dir * GOAL_STEP));
    if (v !== progress.goalBpm) onSetConfig?.({ targetBpm: v });
  }
  function toggleTarget() {
    onSetConfig?.({ targetEnabled: !progress.targetEnabled });
  }
  let loopsAtMin = $derived(progress.roundsPerLevel <= LOOPS_MIN);
  let loopsAtMax = $derived(progress.roundsPerLevel >= LOOPS_MAX);
  let stepAtMin = $derived(progress.increment <= STEP_MIN);
  let stepAtMax = $derived(progress.increment >= STEP_MAX);
  let goalAtMin = $derived(progress.goalBpm <= progress.startBpm + GOAL_STEP);
  let goalAtMax = $derived(progress.goalBpm >= progress.maxBpm);

  // Fill semantics: goal set → real start→goal progress; creep (X=1) → a faded
  // full (breathing) bar; staircase (X>1) → progress toward the next speed-up.
  let fillPct = $derived.by(() => {
    if (hasTarget) {
      const span = progress.targetBpm - progress.startBpm;
      return span > 0 ? Math.max(0, Math.min(100, ((bpm - progress.startBpm) / span) * 100)) : 0;
    }
    if (isCreep) return 100;
    return progress.roundsPerLevel > 0
      ? (progress.loopsCompleted / progress.roundsPerLevel) * 100
      : 0;
  });

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

  // Reduced-motion gate for the JS-driven svelte transitions below (CSS
  // animations are gated by the @media block in styles).
  let reduceMotion = $state(false);
  onMount(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const sync = () => (reduceMotion = mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  });

  // Celebrate a real milestone: crossing a staircase speed-up (suppressed during
  // the X=1 creep so it doesn't fire every loop) OR reaching the goal.
  let prevLevel = progress.currentLevel;
  let prevReached = progress.reachedTarget;
  let celebrate = $state(false);
  let celebrateTimer: ReturnType<typeof setTimeout> | null = null;
  function fireCelebrate() {
    celebrate = true;
    if (celebrateTimer) clearTimeout(celebrateTimer);
    celebrateTimer = setTimeout(() => (celebrate = false), 620);
  }
  $effect(() => {
    const lvl = progress.currentLevel;
    const reached = progress.reachedTarget;
    if ((!isCreep && lvl > prevLevel) || (reached && !prevReached)) fireCelebrate();
    prevLevel = lvl;
    prevReached = reached;
  });

  let caption = $derived.by(() => {
    if (progress.held) return `Holding at ${bpm} BPM`;
    if (hasTarget) {
      return progress.reachedTarget
        ? `Reached ${bpm} BPM`
        : `Climbing to ${progress.targetBpm} BPM`;
    }
    if (isCreep) return `Climbing +${progress.increment} BPM each loop`;
    const n = progress.loopsRemaining;
    return `Speeds up in ${n} ${n === 1 ? "loop" : "loops"}`;
  });
</script>

{#snippet cfgStepper(label: string, value: number, unit: string, dec: () => void, inc: () => void, atMin: boolean, atMax: boolean)}
  <div class="pb-cfg" role="group" aria-label={label}>
    <span class="pb-cfg-label">{label}</span>
    <button class="pb-fine-btn" type="button" onclick={dec} disabled={atMin} aria-label="Decrease {label}">
      <i class="fas fa-minus" aria-hidden="true"></i>
    </button>
    <span class="pb-cfg-value">{value}{#if unit}<span class="pb-cfg-unit">{unit}</span>{/if}</span>
    <button class="pb-fine-btn" type="button" onclick={inc} disabled={atMax} aria-label="Increase {label}">
      <i class="fas fa-plus" aria-hidden="true"></i>
    </button>
  </div>
{/snippet}

<div class="practice-bar" role="region" aria-label="Practice controls">
  <div class="pb-group">
    <button
      class="pb-btn pb-play"
      type="button"
      onclick={onPlayPause}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      <span class="pb-icon-stack">
        {#key isPlaying}
          <i
            class="fas {isPlaying ? 'fa-pause' : 'fa-play'}"
            aria-hidden="true"
            in:fade|local={{ duration: reduceMotion ? 0 : 160 }}
            out:fade|local={{ duration: reduceMotion ? 0 : 160 }}
          ></i>
        {/key}
      </span>
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
        class:celebrate
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

    {#if onSetConfig}
      <span class="pb-divider" aria-hidden="true"></span>
      <div class="pb-config" role="group" aria-label="Speed-up schedule">
        {@render cfgStepper("Every", progress.roundsPerLevel, "loops", () => cfgLoops(-1), () => cfgLoops(1), loopsAtMin, loopsAtMax)}
        {@render cfgStepper("+", progress.increment, "BPM", () => cfgStep(-1), () => cfgStep(1), stepAtMin, stepAtMax)}
        <button
          class="pb-target-toggle"
          class:on={hasTarget}
          type="button"
          onclick={toggleTarget}
          aria-pressed={hasTarget}
        >
          <i class="fas {hasTarget ? 'fa-flag-checkered' : 'fa-flag'}" aria-hidden="true"></i>
          <span>Goal</span>
        </button>
        <div class="pb-goal-slot" class:hidden={!hasTarget} aria-hidden={!hasTarget} inert={!hasTarget}>
          {@render cfgStepper("Goal", progress.goalBpm, "BPM", () => cfgGoal(-1), () => cfgGoal(1), goalAtMin, goalAtMax)}
        </div>
      </div>
    {/if}
  </div>

  <!-- Status line: caption above a slim fill bar, full-width below the controls.
       Kept out of the control row so the schedule steppers no longer stack into
       a tall side column that pushed the whole bar's height up asymmetrically. -->
  <div class="pb-status">
    <span class="pb-caption-wrap">
      {#key caption}
        <span
          class="pb-caption"
          class:ready={progress.reachedTarget}
          in:fade|local={{ duration: reduceMotion ? 0 : 150 }}
          out:fade|local={{ duration: reduceMotion ? 0 : 150 }}
        >{caption}</span>
      {/key}
    </span>
    <div class="pb-fill-track" aria-hidden="true">
      <div
        class="pb-fill"
        class:creep={isCreep && !hasTarget}
        class:ready={progress.reachedTarget}
        style="width:{fillPct}%"
      ></div>
    </div>
  </div>
</div>

<style>
  .practice-bar {
    --ctrl-h: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
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

  /* Schedule config — one inline row alongside the tempo controls: Every X
     loops · +Y BPM · Goal [stepper]. No longer a tall stacked side column. */
  .pb-config {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  /* Status line below the controls: caption + slim fill, full-width but capped
     so the line stays centred and readable. */
  .pb-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 100%;
    max-width: 30rem;
  }
  .pb-cfg {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pb-cfg-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .pb-cfg-value {
    min-width: 2.75rem;
    text-align: center;
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
  }
  .pb-cfg-unit {
    font-size: 9px;
    font-weight: 700;
    opacity: 0.5;
    margin-left: 2px;
  }

  /* Goal toggle — button + indicator (no checkbox); fills when active. */
  .pb-target-toggle {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 14px;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }
  .pb-target-toggle:focus-visible { outline: 3px solid var(--theme-accent, #6366f1); outline-offset: 2px; }
  .pb-target-toggle:active { transform: scale(0.96); }
  @media (hover: hover) and (pointer: fine) {
    .pb-target-toggle:hover { background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12)); color: var(--theme-text, #fff); }
  }
  .pb-target-toggle.on {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 26%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 55%, transparent);
    color: color-mix(in srgb, var(--theme-accent, #c4b5fd) 80%, white);
  }

  /* Goal stepper keeps its slot reserved so toggling the goal never shifts the
     row width/height (visibility, not display). */
  .pb-goal-slot { display: flex; transition: opacity var(--duration-fast, 150ms) ease; }
  .pb-goal-slot.hidden { visibility: hidden; opacity: 0; pointer-events: none; }

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
  /* Creep-mode fill breathes so the steady per-loop climb reads as alive. */
  .pb-fill.creep { opacity: 0.45; animation: pb-fill-breathe 2.6s ease-in-out infinite; }
  @keyframes pb-fill-breathe {
    0%, 100% { opacity: 0.35; box-shadow: 0 0 4px 0 color-mix(in srgb, var(--theme-accent, #8b5cf6) 35%, transparent); }
    50% { opacity: 0.6; box-shadow: 0 0 12px 1px color-mix(in srgb, var(--theme-accent, #8b5cf6) 60%, transparent); }
  }
  /* When the goal is reached the fill settles to full with a playful overshoot. */
  .pb-fill.ready {
    background: var(--semantic-success, #22c55e);
    transition: width var(--duration-normal, 200ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  }

  /* Caption crossfades on change; the wrap reserves a line so swaps never
     reflow. The keyed span stacks absolutely inside it. */
  .pb-caption-wrap { position: relative; display: block; width: 100%; height: 1.25em; }
  .pb-caption {
    position: absolute;
    inset: 0;
    width: 100%;
    text-align: center;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }
  .pb-caption.ready { color: color-mix(in srgb, var(--semantic-success, #22c55e) 60%, white); }

  /* Play/pause glyph crossfade — old and new stack and fade so it morphs
     instead of blinking. */
  .pb-icon-stack {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
  }
  .pb-icon-stack i {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* One-shot celebration when the tempo crosses a staircase speed-up. */
  .pb-level.up.celebrate {
    animation: pb-celebrate 620ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  }
  @keyframes pb-celebrate {
    0% { transform: scale(1); box-shadow: 0 0 0 0 color-mix(in srgb, var(--semantic-success, #22c55e) 60%, transparent); }
    35% { transform: scale(1.16); filter: brightness(1.25); box-shadow: 0 0 22px 6px color-mix(in srgb, var(--semantic-success, #22c55e) 65%, transparent); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 color-mix(in srgb, var(--semantic-success, #22c55e) 0%, transparent); }
  }

  /* Narrow: tighten gaps, drop the divider; the config wraps within the control
     row and the status line is already full-width below. */
  @container practice-bar (max-width: 600px) {
    .pb-group { gap: 12px; }
    .pb-divider { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pb-btn, .pb-fine-btn, .pb-fill, .pb-target-toggle, .pb-goal-slot { transition: none; }
    .pb-level.up.celebrate,
    .pb-fill.creep { animation: none; }
    .pb-readout.bumped .pb-bpm-value { animation: none; }
    .pb-btn:active, .pb-fine-btn:active, .pb-target-toggle:active { transform: none; }
  }
</style>
