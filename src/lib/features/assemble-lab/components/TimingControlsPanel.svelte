<!--
  TimingControlsPanel.svelte - Capture mode, interpretation mode, BPM/subdivision controls.
  Visible only in keyboard mode.
-->
<script lang="ts">
  import type { TimingState } from "../state/timing-state.svelte";

  let { timingState }: { timingState: TimingState } = $props();

  const CAPTURE_MODES = [
    { value: "inter-press" as const, label: "Between Presses" },
    { value: "hold-duration" as const, label: "Hold Duration" },
  ];

  const INTERPRET_MODES = [
    { value: "proportional" as const, label: "Proportional" },
    { value: "absolute" as const, label: "Absolute" },
    { value: "quantized" as const, label: "Quantized" },
  ];

  const SUBDIVISIONS = [
    { value: 4 as const, label: "¼" },
    { value: 8 as const, label: "⅛" },
    { value: 16 as const, label: "1/16" },
  ];

  function adjustBpm(delta: number): void {
    timingState.setBpm(timingState.bpm + delta);
  }
</script>

<div class="timing-controls" aria-label="Timing controls">
  <div class="control-group">
    <span class="group-label">Capture</span>
    <div class="pill-group" role="radiogroup" aria-label="Capture mode">
      {#each CAPTURE_MODES as mode}
        <button
          class="pill"
          class:active={timingState.captureMode === mode.value}
          role="radio"
          aria-checked={timingState.captureMode === mode.value}
          onclick={() => timingState.setCaptureMode(mode.value)}
        >{mode.label}</button>
      {/each}
    </div>
  </div>

  <div class="control-group">
    <span class="group-label">Timing</span>
    <div class="pill-group" role="radiogroup" aria-label="Interpretation mode">
      {#each INTERPRET_MODES as mode}
        <button
          class="pill"
          class:active={timingState.interpretMode === mode.value}
          role="radio"
          aria-checked={timingState.interpretMode === mode.value}
          onclick={() => timingState.setInterpretMode(mode.value)}
        >{mode.label}</button>
      {/each}
    </div>
  </div>

  {#if timingState.interpretMode === "quantized"}
    <div class="control-group">
      <span class="group-label">BPM</span>
      <div class="bpm-control">
        <button
          class="bpm-btn"
          aria-label="Decrease BPM"
          onclick={() => adjustBpm(-5)}
        >−</button>
        <span class="bpm-value">{timingState.bpm}</span>
        <button
          class="bpm-btn"
          aria-label="Increase BPM"
          onclick={() => adjustBpm(5)}
        >+</button>
      </div>
    </div>

    <div class="control-group">
      <span class="group-label">Grid</span>
      <div class="pill-group" role="radiogroup" aria-label="Subdivision">
        {#each SUBDIVISIONS as sub}
          <button
            class="pill"
            class:active={timingState.subdivision === sub.value}
            role="radio"
            aria-checked={timingState.subdivision === sub.value}
            onclick={() => timingState.setSubdivision(sub.value)}
          >{sub.label}</button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .timing-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    align-items: center;
    justify-content: center;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .group-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .pill-group {
    display: flex;
    gap: 2px;
    border-radius: 8px;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.2));
    padding: 2px;
  }

  .pill {
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s ease, color 0.1s ease;
  }

  .pill:hover {
    color: var(--theme-text, #fff);
  }

  .pill.active {
    background: var(--theme-accent-bg, rgba(99, 102, 241, 0.15));
    color: var(--theme-accent, #6366f1);
  }

  .pill:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 1px;
  }

  .bpm-control {
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: 8px;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.2));
    padding: 2px;
  }

  .bpm-btn {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bpm-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #fff);
  }

  .bpm-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    min-width: 36px;
    text-align: center;
    font-family: var(--font-mono, monospace);
  }

  @media (max-width: 768px) {
    .timing-controls {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pill {
      transition: none;
    }
  }
</style>
