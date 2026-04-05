<script lang="ts">
  /**
   * SceneOverlayControls - Overlay controls for 3D scene
   *
   * Positioned absolutely over the scene canvas.
   * Top row: camera presets, sequence info, speed control
   * Bottom: playback controls
   */

  import type { Snippet } from "svelte";
  import CameraPresetBar, {
    type CameraPreset,
  } from "../controls/CameraPresetBar.svelte";
  import SpeedControlBar from "../controls/SpeedControlBar.svelte";
  import PlaybackControlBar from "../controls/PlaybackControlBar.svelte";
  import SequenceInfoBadge from "../controls/SequenceInfoBadge.svelte";
  import FormationSelector from "../controls/FormationSelector.svelte";
  import CameraChoreographyControls from "../controls/CameraChoreographyControls.svelte";
  import type { FormationPreset } from "../../domain/formation";
  import type { CameraChoreographyState } from "../../state/camera-choreography-state.svelte";
  import type { CameraPosition } from "../../domain/camera-choreography";
  import PlaneModeToggle from "../controls/PlaneModeToggle.svelte";
  import type { PlaneMode } from "../../domain/enums/PlaneMode";

  interface Props {
    // Camera
    cameraPreset: CameraPreset;
    isCustomCamera?: boolean;
    onCameraChange: (preset: CameraPreset) => void;

    // Formation (optional - only shown with 2+ performers)
    formationPreset?: FormationPreset;
    isFormationTransitioning?: boolean;
    performerCount?: number;
    onFormationChange?: (preset: FormationPreset) => void;

    // Speed
    speed: number;
    onSpeedChange: (speed: number) => void;

    // Camera choreography (optional)
    cameraChoreography?: CameraChoreographyState;
    currentStep?: number;
    currentCameraPosition?: CameraPosition;
    currentCameraTarget?: CameraPosition;

    // Sequence info (optional)
    sequenceName?: string | null;
    onClearSequence?: () => void;

    // Playback
    isPlaying: boolean;
    progress: number;
    loop: boolean;
    hasSequence?: boolean;
    currentStepIndex?: number;
    totalSteps?: number;
    onPlay: () => void;
    onPause: () => void;
    onTogglePlay: () => void;
    onReset: () => void;
    onProgressChange: (value: number) => void;
    onLoopChange: (value: boolean) => void;
    onPrevStep?: () => void;
    onNextStep?: () => void;

    // Plane mode (optional — only shown in 3D mode)
    planeMode?: PlaneMode;
    onPlaneModeChange?: (mode: PlaneMode) => void;

    /** Callback to show keyboard shortcuts help */
    onShowHelp?: () => void;

    /** Optional trailing content (e.g., panel toggle) */
    trailing?: Snippet;
  }

  let {
    cameraPreset,
    isCustomCamera = false,
    onCameraChange,
    formationPreset,
    isFormationTransitioning = false,
    performerCount = 1,
    onFormationChange,
    speed,
    onSpeedChange,
    cameraChoreography,
    currentStep = 0,
    currentCameraPosition,
    currentCameraTarget,
    sequenceName = null,
    onClearSequence,
    isPlaying,
    progress,
    loop,
    hasSequence = false,
    currentStepIndex = 0,
    totalSteps = 0,
    onPlay,
    onPause,
    onTogglePlay,
    onReset,
    onProgressChange,
    onLoopChange,
    onPrevStep,
    onNextStep,
    planeMode,
    onPlaneModeChange,
    onShowHelp,
    trailing,
  }: Props = $props();
</script>

<div class="scene-overlay">
  <!-- Top Row -->
  <div class="top-row">
    <CameraPresetBar
      value={cameraPreset}
      isCustom={isCustomCamera}
      onchange={onCameraChange}
    />

    {#if performerCount >= 2 && formationPreset && onFormationChange}
      <FormationSelector
        value={formationPreset}
        isTransitioning={isFormationTransitioning}
        {performerCount}
        onchange={onFormationChange}
      />
    {/if}

    {#if sequenceName}
      <SequenceInfoBadge
        name={sequenceName}
        onClear={() => onClearSequence?.()}
      />
    {/if}

    <SpeedControlBar value={speed} onchange={onSpeedChange} />

    {#if planeMode !== undefined && onPlaneModeChange}
      <PlaneModeToggle mode={planeMode} onModeChange={onPlaneModeChange} />
    {/if}

    {#if cameraChoreography}
      <CameraChoreographyControls
        choreographyState={cameraChoreography}
        {currentStep}
        {currentCameraPosition}
        {currentCameraTarget}
        hasSequence={hasSequence}
      />
    {/if}

    {#if onShowHelp}
      <button
        class="help-btn"
        onclick={onShowHelp}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (Shift+?)"
      >
        <i class="fas fa-keyboard" aria-hidden="true"></i>
      </button>
    {/if}
  </div>

  <!-- Bottom Row -->
  <div class="bottom-row">
    <PlaybackControlBar
      {isPlaying}
      {progress}
      {loop}
      {hasSequence}
      {currentStepIndex}
      {totalSteps}
      {onPlay}
      {onPause}
      {onTogglePlay}
      {onReset}
      {onProgressChange}
      {onLoopChange}
      {onPrevStep}
      {onNextStep}
    />

    {#if trailing}
      {@render trailing()}
    {/if}
  </div>
</div>

<style>
  .scene-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 1rem;
  }

  .scene-overlay > * {
    pointer-events: auto;
  }

  .top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .bottom-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .help-btn {
    width: var(--min-touch-target); /* WCAG AA touch target */
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: none;
    border-radius: 8px;
    color: var(--theme-text-muted, var(--theme-text-dim));
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .help-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text));
  }

  @media (max-width: 600px) {
    .scene-overlay {
      padding: 0.5rem;
    }

    .top-row {
      gap: 0.25rem;
    }

    /* Touch targets use var(--min-touch-target) on mobile for WCAG AA */
  }
</style>
