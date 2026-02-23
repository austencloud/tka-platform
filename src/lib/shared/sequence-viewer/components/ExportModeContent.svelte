<!--
  ExportModeContent.svelte

  Export mode UI for the sequence viewer modal.
  Handles export type selection, preview, and options.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
  import type { ExportOptionsStateManager, VideoFps } from "../state/export-options-state.svelte";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import ChoreoCard from "./ChoreoCard.svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  export type ExportType = "animation" | "image" | "both";

  interface Props {
    sequence: SequenceData;
    exportType: ExportType | null;
    exportOptions: ExportOptionsStateManager;
    animationState: AnimationPanelState;
    animationLoading: boolean;
    currentStep: number;
    currentLetter: Letter | null;
    currentStepData: StartPositionData | StepData | null;
    userName: string;
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
    onSelectType: (type: ExportType) => void;
    onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
  }

  let {
    sequence,
    exportType,
    exportOptions,
    animationState,
    animationLoading,
    currentStep,
    currentLetter,
    currentStepData,
    userName,
    bluePropType,
    redPropType,
    catDogModeEnabled,
    onSelectType,
    onCanvasReady,
  }: Props = $props();
</script>

<div
  class="export-mode-container view-container"
  in:fade={{ duration: 250, delay: 50, easing: cubicOut }}
  out:fade={{ duration: 150, easing: cubicOut }}
>
  {#if !exportType}
    <!-- Export type selector -->
    <div class="export-type-selector">
      <p class="selector-hint">What would you like to export?</p>

      <div class="export-type-cards" role="group" aria-label="Export format options">
        <button
          type="button"
          class="export-type-card"
          onclick={() => onSelectType("animation")}
          aria-describedby="video-desc"
        >
          <div class="card-icon animation" aria-hidden="true">
            <i class="fas fa-play-circle"></i>
          </div>
          <div class="card-content">
            <span class="card-title">Video</span>
            <span class="card-desc" id="video-desc">Animated sequence as MP4</span>
          </div>
          <i class="fas fa-chevron-right card-arrow" aria-hidden="true"></i>
        </button>

        <button
          type="button"
          class="export-type-card"
          onclick={() => onSelectType("image")}
          aria-describedby="image-desc"
        >
          <div class="card-icon image" aria-hidden="true">
            <i class="fas fa-image"></i>
          </div>
          <div class="card-content">
            <span class="card-title">Image</span>
            <span class="card-desc" id="image-desc">Choreo card as PNG</span>
          </div>
          <i class="fas fa-chevron-right card-arrow" aria-hidden="true"></i>
        </button>

        <button
          type="button"
          class="export-type-card combo"
          onclick={() => onSelectType("both")}
          aria-describedby="combo-desc"
        >
          <div class="card-icon combo" aria-hidden="true">
            <i class="fas fa-layer-group"></i>
          </div>
          <div class="card-content">
            <span class="card-title">Combined</span>
            <span class="card-desc" id="combo-desc">Video with choreo card overlay. Opens in Compose.</span>
          </div>
          <div class="card-badge" aria-hidden="true">
            <i class="fas fa-external-link-alt"></i>
            Compose
          </div>
        </button>
      </div>
    </div>
  {:else}
    <!-- Preview area -->
    <div class="export-preview-area">
      {#if exportType === "image"}
        <ChoreoCard
          {sequence}
          showHighlight={false}
          showStepNumbers={exportOptions.imageShowStepNumbers}
          showDifficultyLevel={exportOptions.imageShowDifficulty}
          includeStartPosition={exportOptions.imageIncludeStartPosition}
          showCreatorName={exportOptions.imageShowCreatorName}
          showNotes={exportOptions.imageShowNotes}
          showBirthday={true}
          showLoopGlyph={true}
          darkMode={exportOptions.imageDarkMode}
          {userName}
          {bluePropType}
          {redPropType}
          {catDogModeEnabled}
        />
      {:else}
        <!-- For video exports, show the animation canvas -->
        {#if animationLoading}
          <div class="loading-state">
            <ProgressRing percent={-1} size={32} strokeWidth={3} />
          </div>
        {:else if animationState.error}
          <div class="error-state">
            <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
            <span>{animationState.error}</span>
          </div>
        {:else}
          <AnimatorCanvas
            sequenceData={animationState.sequenceData}
            currentStep={currentStep}
            isPlaying={false}
            blueProp={animationState.bluePropState}
            redProp={animationState.redPropState}
            gridMode={sequence?.gridMode}
            letter={currentLetter}
            stepData={currentStepData}
            word={sequence?.word}
            onCanvasReady={onCanvasReady}
          />
        {/if}
      {/if}
    </div>

    <!-- Export options -->
    <div class="export-options-area">
      <p class="export-hint">
        <i class="fas fa-info-circle" aria-hidden="true"></i>
        Customize your export, then tap the button below.
      </p>
      <div class="export-options-card">
        {#if exportType === "image"}
          <!-- Image export options -->
          <div class="option-group">
            <span class="option-label">Include</span>
            <div class="option-chips">
              <button
                type="button"
                class="chip"
                class:active={exportOptions.imageShowWord}
                onclick={() => exportOptions.setImageShowWord(!exportOptions.imageShowWord)}
                aria-pressed={exportOptions.imageShowWord}
              >Word</button>
              <button
                type="button"
                class="chip"
                class:active={exportOptions.imageIncludeStartPosition}
                onclick={() => exportOptions.setImageIncludeStartPosition(!exportOptions.imageIncludeStartPosition)}
                aria-pressed={exportOptions.imageIncludeStartPosition}
              >Start</button>
              <button
                type="button"
                class="chip"
                class:active={exportOptions.imageShowDifficulty}
                onclick={() => exportOptions.setImageShowDifficulty(!exportOptions.imageShowDifficulty)}
                aria-pressed={exportOptions.imageShowDifficulty}
              >Level</button>
              <button
                type="button"
                class="chip"
                class:active={exportOptions.imageShowCreatorName}
                onclick={() => exportOptions.setImageShowCreatorName(!exportOptions.imageShowCreatorName)}
                aria-pressed={exportOptions.imageShowCreatorName}
              >Name</button>
              <button
                type="button"
                class="chip"
                class:active={exportOptions.imageShowNotes}
                onclick={() => exportOptions.setImageShowNotes(!exportOptions.imageShowNotes)}
                aria-pressed={exportOptions.imageShowNotes}
              >Notes</button>
              <button
                type="button"
                class="chip"
                class:active={exportOptions.imageDarkMode}
                onclick={() => exportOptions.setImageDarkMode(!exportOptions.imageDarkMode)}
                aria-pressed={exportOptions.imageDarkMode}
              >Dark</button>
            </div>
          </div>
        {:else}
          <!-- Animation video export options -->
          <div class="option-group">
            <span class="option-label">FPS</span>
            <div class="option-chips">
              {#each [30, 50, 60] as fps}
                <button
                  type="button"
                  class="chip"
                  class:active={exportOptions.videoFps === fps}
                  onclick={() => exportOptions.setVideoFps(fps as VideoFps)}
                  aria-pressed={exportOptions.videoFps === fps}
                >{fps}</button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .export-mode-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    gap: 16px;
    overflow-y: auto;
  }

  .export-preview-area {
    flex: 0 0 auto;
    max-height: 40vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: 12px;
    overflow: hidden;
  }

  .export-options-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }

  .export-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 0;
    padding: 8px 12px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-align: center;
  }

  .export-hint i {
    font-size: 14px;
    color: var(--theme-accent, #6366f1);
  }

  .export-options-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .option-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .option-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* Export type selector */
  .export-type-selector {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 24px;
    height: 100%;
    min-height: 300px;
  }

  .selector-hint {
    margin: 0;
    font-size: var(--font-size-md, 16px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-align: center;
  }

  .export-type-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 400px;
  }

  .export-type-card {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    padding: 16px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    color: var(--theme-text, white);
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    text-align: left;
  }

  .export-type-card:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: translateX(4px);
  }

  .export-type-card:active {
    transform: scale(0.98);
  }

  .export-type-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    font-size: 20px;
    flex-shrink: 0;
  }

  .card-icon.animation {
    background: rgba(99, 102, 241, 0.15);
    color: #818cf8;
  }

  .card-icon.image {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .card-icon.combo {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .card-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .card-desc {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .card-arrow {
    font-size: 14px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    flex-shrink: 0;
  }

  .card-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(168, 85, 247, 0.2);
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: #c084fc;
    flex-shrink: 0;
  }

  .card-badge i {
    font-size: 10px;
  }

  .export-type-card.combo {
    border-color: rgba(168, 85, 247, 0.3);
  }

  .export-type-card.combo:hover {
    border-color: rgba(168, 85, 247, 0.5);
    background: rgba(168, 85, 247, 0.1);
  }

  /* Chip styles */
  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    min-width: 48px;
    padding: 8px 14px;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .chip:active {
    transform: scale(0.92);
    transition-duration: 50ms;
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
    color: white;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
    animation: chipActivate 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes chipActivate {
    0% { transform: scale(0.92); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  .chip:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  /* Loading/Error states */
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
  }

  .error-state {
    color: var(--semantic-error, #f87171);
  }

  /* View container for absolute positioning */
  .view-container {
    position: absolute;
    inset: 0;
  }

  @media (max-width: 767px) {
    .export-type-selector {
      padding: 16px;
      gap: 20px;
    }

    .export-type-cards {
      max-width: none;
    }

    .card-icon {
      width: 44px;
      height: 44px;
      font-size: 18px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .export-type-card {
      transition: none !important;
    }

    .chip.active {
      animation: none !important;
    }
  }
</style>
