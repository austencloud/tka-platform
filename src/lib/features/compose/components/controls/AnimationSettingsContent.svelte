<!--
  AnimationSettingsContent.svelte

  Content for the animation settings sheet/drawer.
  Consolidates playback configuration options:
  - Playback mode (continuous/step)
  - Motion visibility toggles
  - Speed (BPM) controls
  - Trail presets

  Note: Export settings (loop count) are in ExportActionsPanel
-->
<script lang="ts">
  import BpmChips from "$lib/shared/animation-engine/components/controls/BpmChips.svelte";
  import SimpleTrailControls from "$lib/shared/animation-engine/components/trail/SimpleTrailControls.svelte";
  import PlaybackModeToggle from "$lib/shared/animation-engine/components/controls/PlaybackModeToggle.svelte";
  import StepModeSettings from "./StepModeSettings.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type {
    PlaybackMode,
    StepPlaybackStepSize,
  } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

  let {
    bpm = $bindable(60),
    blueMotionVisible = true,
    redMotionVisible = true,
    currentPropType = null,
    playbackMode = "continuous",
    stepPlaybackPauseMs = 300,
    stepPlaybackStepSize = 1,
    isPlaying = false,
    onBpmChange = () => {},
    onToggleBlue = () => {},
    onToggleRed = () => {},
    onPlaybackModeChange = () => {},
    onStepPlaybackPauseMsChange = () => {},
    onStepPlaybackStepSizeChange = () => {},
    onPlaybackToggle = () => {},
  }: {
    bpm: number;
    blueMotionVisible?: boolean;
    redMotionVisible?: boolean;
    currentPropType?: PropType | string | null;
    playbackMode?: PlaybackMode;
    stepPlaybackPauseMs?: number;
    stepPlaybackStepSize?: StepPlaybackStepSize;
    isPlaying?: boolean;
    onBpmChange?: (bpm: number) => void;
    onToggleBlue?: () => void;
    onToggleRed?: () => void;
    onPlaybackModeChange?: (mode: PlaybackMode) => void;
    onStepPlaybackPauseMsChange?: (pauseMs: number) => void;
    onStepPlaybackStepSizeChange?: (stepSize: StepPlaybackStepSize) => void;
    onPlaybackToggle?: () => void;
  } = $props();
</script>

<div class="settings-content">
  <!-- Top row: Playback Mode + Visibility side by side -->
  <div class="top-row">
    <!-- Playback Mode -->
    <section class="settings-section compact">
      <h4 class="settings-section-title">Playback Mode</h4>
      <PlaybackModeToggle
        {playbackMode}
        {isPlaying}
        {onPlaybackModeChange}
        {onPlaybackToggle}
      />
    </section>

    <!-- Motion Visibility -->
    <section class="settings-section compact">
      <h4 class="settings-section-title">Motion Visibility</h4>
      <div class="visibility-toggles">
        <button
          class="visibility-toggle blue"
          class:active={blueMotionVisible}
          onclick={onToggleBlue}
          type="button"
          aria-label={blueMotionVisible
            ? "Hide blue motion"
            : "Show blue motion"}
        >
          <i
            class="fas {blueMotionVisible ? 'fa-eye' : 'fa-eye-slash'}"
            aria-hidden="true"
          ></i>
          <span>Blue</span>
        </button>
        <button
          class="visibility-toggle red"
          class:active={redMotionVisible}
          onclick={onToggleRed}
          type="button"
          aria-label={redMotionVisible ? "Hide red motion" : "Show red motion"}
        >
          <i
            class="fas {redMotionVisible ? 'fa-eye' : 'fa-eye-slash'}"
            aria-hidden="true"
          ></i>
          <span>Red</span>
        </button>
      </div>
    </section>
  </div>

  <!-- Step settings (only when step mode active) -->
  {#if playbackMode === "step"}
    <div class="step-row">
      <StepModeSettings
        {stepPlaybackStepSize}
        {stepPlaybackPauseMs}
        {isPlaying}
        {onStepPlaybackStepSizeChange}
        {onStepPlaybackPauseMsChange}
      />
    </div>
  {/if}

  <!-- Speed -->
  <section class="settings-section">
    <h4 class="settings-section-title">Speed</h4>
    <BpmChips bind:bpm min={15} max={180} step={1} {onBpmChange} />
  </section>

  <!-- Trails -->
  <section class="settings-section">
    <h4 class="settings-section-title">Trails</h4>
    <SimpleTrailControls propType={currentPropType} />
  </section>
</div>

<style>
  .settings-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Top row: 2-column grid for Playback Mode + Visibility */
  .top-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  /* Step settings row */
  .step-row {
    margin-top: -4px;
  }

  /* Settings sections */
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* Compact variant for top row sections */
  .settings-section.compact {
    gap: 4px;
  }

  .settings-section.compact .settings-section-title {
    font-size: var(--font-size-compact, 12px);
  }

  .settings-section-title {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
  }

  /* Visibility toggles - vertical stack in compact layout */
  .visibility-toggles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .visibility-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 36px;
    padding: 6px 10px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .visibility-toggle.blue.active {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--prop-blue) 20%, transparent) 0%,
      color-mix(in srgb, var(--prop-blue) 15%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--prop-blue) 40%, transparent);
    color: color-mix(in srgb, var(--prop-blue) 60%, white);
  }

  .visibility-toggle.red.active {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--prop-red) 20%, transparent) 0%,
      color-mix(in srgb, var(--prop-red) 15%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--prop-red) 40%, transparent);
    color: color-mix(in srgb, var(--prop-red) 60%, white);
  }

  .visibility-toggle:active {
    transform: scale(0.97);
  }

  @media (prefers-reduced-motion: reduce) {
    .visibility-toggle {
      transition: none;
    }
  }
</style>
