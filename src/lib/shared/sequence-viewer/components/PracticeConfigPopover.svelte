<!--
  PracticeConfigPopover.svelte

  A small settings popover for tuning the practice tempo ramp. Owns its own
  gear trigger so it can sit next to the Practice button in any viewer header.

  Writes through onUpdate (which persists to userConfig). Changes apply on the
  next practice start; tweaking mid-session is fine, it just affects the next run.
-->
<script lang="ts">
  import { Popover } from "bits-ui";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import type {
    ProgressionMode,
    TempoPracticeConfig,
  } from "../services/tempo-practice-orchestrator";

  interface Props {
    config: Partial<TempoPracticeConfig>;
    onUpdate: (patch: Partial<TempoPracticeConfig>) => void;
  }

  let { config, onUpdate }: Props = $props();

  let open = $state(false);

  // Display values fall back to the orchestrator defaults.
  let startBpm = $derived(config.startBpm ?? 15);
  let increment = $derived(config.increment ?? 5);
  let roundsPerLevel = $derived(config.roundsPerLevel ?? 5);
  let progressionMode: ProgressionMode = $derived(config.progressionMode ?? "auto");

  function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }

  function setStartBpm(next: number) {
    onUpdate({ startBpm: clamp(next, 5, 120) });
  }
  function setIncrement(next: number) {
    onUpdate({ increment: clamp(next, 1, 30) });
  }
  function setRounds(next: number) {
    onUpdate({ roundsPerLevel: clamp(next, 1, 10) });
  }

  const MODE_OPTIONS: { value: ProgressionMode; label: string }[] = [
    { value: "manual", label: "Manual" },
    { value: "auto", label: "Auto" },
  ];
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        type="button"
        class="practice-config-trigger"
        class:open
        aria-label="Practice settings"
        title="Practice settings"
      >
        <i class="fas fa-sliders" aria-hidden="true"></i>
      </button>
    {/snippet}
  </Popover.Trigger>

  <Popover.Content side="bottom" align="end" sideOffset={8} collisionPadding={12} forceMount>
    {#snippet child({ open: contentOpen, wrapperProps, props })}
      <div {...wrapperProps}>
        {#if contentOpen}
          <div {...props} class="practice-config-panel">
            <header class="config-header">Practice ramp</header>

            <div class="config-body">
              {@render stepper("Start tempo", startBpm, "BPM", () => setStartBpm(startBpm - 5), () => setStartBpm(startBpm + 5))}
              {@render stepper("Speed step", increment, "BPM", () => setIncrement(increment - 1), () => setIncrement(increment + 1))}
              {@render stepper("Loops per level", roundsPerLevel, "", () => setRounds(roundsPerLevel - 1), () => setRounds(roundsPerLevel + 1))}

              <div class="config-row mode-row">
                <span class="config-label">Progression</span>
                <div class="mode-control">
                  <SegmentedControl
                    options={MODE_OPTIONS}
                    value={progressionMode}
                    onchange={(v) => onUpdate({ progressionMode: v })}
                    color="accent"
                    size="sm"
                  />
                </div>
              </div>

              <p class="config-hint">
                {progressionMode === "manual"
                  ? "Tempo holds each level. You tap Speed Up when you're ready."
                  : "Tempo ramps up on its own after each set of loops."}
              </p>
            </div>
          </div>
        {/if}
      </div>
    {/snippet}
  </Popover.Content>
</Popover.Root>

{#snippet stepper(label: string, value: number, unit: string, onMinus: () => void, onPlus: () => void)}
  <div class="config-row">
    <span class="config-label">{label}</span>
    <div class="stepper">
      <button type="button" class="step-btn" onclick={onMinus} aria-label={`Decrease ${label}`}>
        <i class="fas fa-minus" aria-hidden="true"></i>
      </button>
      <span class="step-value">{value}{#if unit}<span class="step-unit">{unit}</span>{/if}</span>
      <button type="button" class="step-btn" onclick={onPlus} aria-label={`Increase ${label}`}>
        <i class="fas fa-plus" aria-hidden="true"></i>
      </button>
    </div>
  </div>
{/snippet}

<style>
  .practice-config-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .practice-config-trigger i {
    font-size: 15px;
  }

  @media (hover: hover) and (pointer: fine) {
    .practice-config-trigger:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      color: var(--theme-text, white);
    }
  }

  .practice-config-trigger.open {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 16%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 45%, transparent);
    color: var(--theme-accent, #a78bfa);
  }

  .practice-config-trigger:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .practice-config-panel {
    width: 280px;
    background: var(--theme-panel-bg, #0c0e16);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
    z-index: 50;
  }

  .config-header {
    padding: 12px 16px 10px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

  .config-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px 16px;
  }

  .config-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .config-label {
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .step-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 9px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: 0.7rem;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    .step-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      color: var(--theme-text, white);
    }
  }

  .step-btn:active {
    transform: scale(0.92);
  }

  .step-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .step-value {
    min-width: 56px;
    text-align: center;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
    color: var(--theme-text, white);
    font-variant-numeric: tabular-nums;
  }

  .step-unit {
    font-size: var(--font-size-compact, 11px);
    font-weight: 600;
    opacity: 0.55;
    margin-left: 3px;
  }

  .mode-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .mode-control {
    width: 100%;
  }

  .config-hint {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    line-height: 1.4;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
</style>
