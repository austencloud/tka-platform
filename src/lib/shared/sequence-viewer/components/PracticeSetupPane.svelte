<!--
  PracticeSetupPane.svelte

  The practice setup screen, shown in the split companion pane while in practice
  mode but not yet running. Default-ready: pick a ramp preset (or Custom) and hit
  Start. The animation canvas stays visible in the other pane. On Start the pane
  is replaced by the read-ahead lane and the cockpit bar slides up.

  Microinteractions: a staggered entrance (head → presets → detail → Start), a
  sliding Custom-form reveal, a crossfading preset hint, and a gentle "ready"
  glow on the Start button. All gated by prefers-reduced-motion.
-->
<script lang="ts">
  import { fly, fade, slide } from "svelte/transition";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import RampConfigForm from "./RampConfigForm.svelte";
  import type { TempoPracticeConfig } from "../services/tempo-practice-orchestrator";

  interface Props {
    config: Partial<TempoPracticeConfig>;
    onSetConfig: (patch: Partial<TempoPracticeConfig>) => void;
    onStart: () => void;
  }

  let { config, onSetConfig, onStart }: Props = $props();

  type PresetId = "creep" | "staircase" | "custom";

  const PRESETS: { value: PresetId; label: string }[] = [
    { value: "creep", label: "Creep" },
    { value: "staircase", label: "Staircase" },
    { value: "custom", label: "Custom" },
  ];

  // Which preset does the persisted config correspond to? (Creep = +1 every loop,
  // Staircase = +5 every 5 loops; anything else is Custom.)
  function matchPreset(c: Partial<TempoPracticeConfig>): PresetId {
    const inc = c.increment ?? 1;
    const rounds = c.roundsPerLevel ?? 1;
    if (inc === 1 && rounds === 1) return "creep";
    if (inc === 5 && rounds === 5) return "staircase";
    return "custom";
  }

  let selected = $state<PresetId>(matchPreset(config));

  function pick(p: PresetId) {
    selected = p;
    if (p === "creep") onSetConfig({ increment: 1, roundsPerLevel: 1 });
    else if (p === "staircase") onSetConfig({ increment: 5, roundsPerLevel: 5 });
    // custom: keep the current config, reveal the form below.
  }

  let presetHint = $derived(
    selected === "creep"
      ? "Speeds up +1 BPM every loop — a gentle, continuous climb."
      : selected === "staircase"
        ? "Holds 5 loops at each speed, then jumps +5 BPM."
        : ""
  );

  // Read reduced-motion synchronously at init so the entrance transitions don't
  // race a post-mount flag flip.
  let reduceMotion = $state(
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  // Staggered fly-in: same rise, increasing delay down the column.
  const rise = (delay: number) => ({
    y: 12,
    duration: reduceMotion ? 0 : 360,
    delay: reduceMotion ? 0 : delay,
  });
  let revealMs = $derived(reduceMotion ? 0 : 220);
  let fadeMs = $derived(reduceMotion ? 0 : 160);
</script>

<div class="practice-setup">
  <div class="setup-inner">
    <header class="setup-head" in:fly={rise(40)}>
      <h2 class="setup-title">Practice</h2>
      <p class="setup-sub">Pick how the tempo climbs, then start.</p>
    </header>

    <div class="setup-presets" in:fly={rise(100)}>
      <SegmentedControl options={PRESETS} value={selected} onchange={pick} color="accent" />
    </div>

    <div class="setup-detail" in:fly={rise(160)}>
      {#if selected === "custom"}
        <div transition:slide={{ duration: revealMs }}>
          <RampConfigForm {config} onUpdate={onSetConfig} />
        </div>
      {:else}
        {#key presetHint}
          <p
            class="setup-preset-hint"
            in:fade={{ duration: fadeMs }}
            out:fade={{ duration: fadeMs }}
          >{presetHint}</p>
        {/key}
      {/if}
    </div>

    <!-- Camera-background toggle slot — reserved for the AR-mirror overlay
         (project_practice_camera_overlay). Intentionally not rendered until that
         feature lands; the layout already accommodates a row here. -->

    <button class="setup-start" type="button" onclick={onStart} in:fly={rise(220)}>
      <i class="fas fa-play" aria-hidden="true"></i>
      <span>Start practice</span>
    </button>
  </div>
</div>

<style>
  .practice-setup {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.25);
  }

  /* A real panel surface so the card reads as a deliberate element instead of
     text floating in the black companion pane. */
  .setup-inner {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 100%;
    max-width: 24rem;
    padding: 28px 26px;
    border-radius: 20px;
    background: color-mix(in srgb, var(--theme-panel-bg, #0c0e16) 72%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  }

  .setup-head {
    text-align: center;
  }
  .setup-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--theme-text, #fff);
    letter-spacing: -0.01em;
  }
  .setup-sub {
    margin: 4px 0 0;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Detail region reserves a line so the hint↔form swap doesn't jump the Start
     button when there's nothing to slide. */
  .setup-detail {
    min-height: 1.4em;
  }
  .setup-preset-hint {
    margin: 0;
    text-align: center;
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.4;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .setup-start {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    min-height: 56px;
    margin-top: 4px;
    border-radius: 16px;
    border: 2px solid color-mix(in srgb, var(--theme-accent, #8b5cf6) 55%, transparent);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent);
    color: #fff;
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease, border-color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease, box-shadow var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    /* Idle "ready" pull — a slow breathing glow that says press me. */
    animation: setup-start-ready 2.6s ease-in-out infinite;
  }
  .setup-start i {
    font-size: 0.95rem;
    transition: transform var(--duration-fast, 150ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
  }
  @keyframes setup-start-ready {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--theme-accent, #8b5cf6) 0%, transparent); }
    50% { box-shadow: 0 0 22px 2px color-mix(in srgb, var(--theme-accent, #8b5cf6) 35%, transparent); }
  }
  @media (hover: hover) and (pointer: fine) {
    .setup-start:hover {
      background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 42%, transparent);
      border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 70%, transparent);
      box-shadow: 0 0 24px color-mix(in srgb, var(--theme-accent, #8b5cf6) 40%, transparent);
    }
    /* Nudge the play glyph forward on hover — a small "go" cue. */
    .setup-start:hover i {
      transform: translateX(2px);
    }
  }
  .setup-start:active {
    transform: scale(0.98);
  }
  .setup-start:focus-visible {
    outline: 3px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .setup-start {
      transition: none;
      animation: none;
    }
    .setup-start i { transition: none; }
    .setup-start:active { transform: none; }
  }
</style>
