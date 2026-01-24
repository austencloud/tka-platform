<!--
  ExportModeContent.svelte

  Content area for export mode showing preview and export options.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import LayeredSequencePreview from "./LayeredSequencePreview.svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import {
    getExportOptionsState,
    type VideoFps,
    type GridStepSize,
  } from "../state/export-options-state.svelte";

  interface Props {
    viewMode: "animation" | "image" | "split";
    sequence: SequenceData;
    sequenceData: SequenceData | null;
    currentStep: number;
    currentLetter: string | null;
    currentStepData: StepData | null;
    bluePropState: unknown;
    redPropState: unknown;
    animationLoading: boolean;
    animationError: string | null;
    userName: string;
    onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
  }

  let {
    viewMode,
    sequence,
    sequenceData,
    currentStep,
    currentLetter,
    currentStepData,
    bluePropState,
    redPropState,
    animationLoading,
    animationError,
    userName,
    onCanvasReady,
  }: Props = $props();

  const exportOptions = getExportOptionsState();
</script>

<div
  class="export-mode-container view-container"
  in:fade={{ duration: 250, delay: 50, easing: cubicOut }}
  out:fade={{ duration: 150, easing: cubicOut }}
>
  <!-- Preview area (smaller) -->
  <div class="export-preview-area">
    {#if viewMode === "image"}
      <LayeredSequencePreview
        {sequence}
        showHighlight={false}
        showWord={exportOptions.imageShowWord}
        showStepNumbers={exportOptions.imageShowStepNumbers}
        showDifficultyLevel={exportOptions.imageShowDifficulty}
        includeStartPosition={exportOptions.imageIncludeStartPosition}
        showCreatorName={exportOptions.imageShowCreatorName}
        showNotes={exportOptions.imageShowNotes}
        showBirthday={true}
        showLoopGlyph={true}
        darkMode={exportOptions.imageDarkMode}
        {userName}
      />
    {:else}
      <!-- For video exports, show the animation canvas -->
      {#if animationLoading}
        <div class="loading-state">
          <div class="spinner"></div>
        </div>
      {:else if animationError}
        <div class="error-state">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{animationError}</span>
        </div>
      {:else}
        <AnimatorCanvas
          {sequenceData}
          currentStep={currentStep}
          isPlaying={false}
          blueProp={bluePropState}
          redProp={redPropState}
          gridMode={sequence?.gridMode}
          letter={currentLetter}
          stepData={currentStepData}
          onCanvasReady={onCanvasReady}
        />
      {/if}
    {/if}
  </div>

  <!-- Export options -->
  <div class="export-options-area">
    <!-- Guidance hint -->
    <p class="export-hint">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      Customize your export, then tap the button below.
    </p>
    <div class="export-options-card">
      {#if viewMode === "image"}
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
      {:else if viewMode === "split"}
        <!-- Split video export options -->
        <div class="option-group">
          <span class="option-label">FPS</span>
          <div class="option-chips">
            {#each [30, 50, 60] as fps}
              <button
                type="button"
                class="chip"
                class:active={exportOptions.splitFps === fps}
                onclick={() => exportOptions.setSplitFps(fps as VideoFps)}
                aria-pressed={exportOptions.splitFps === fps}
              >{fps}</button>
            {/each}
          </div>
        </div>
        <div class="option-group">
          <span class="option-label">Layout</span>
          <div class="option-chips">
            <button
              type="button"
              class="chip"
              class:active={exportOptions.splitOrientation === "horizontal"}
              onclick={() => exportOptions.setSplitOrientation("horizontal")}
              aria-pressed={exportOptions.splitOrientation === "horizontal"}
            >Horizontal</button>
            <button
              type="button"
              class="chip"
              class:active={exportOptions.splitOrientation === "vertical"}
              onclick={() => exportOptions.setSplitOrientation("vertical")}
              aria-pressed={exportOptions.splitOrientation === "vertical"}
            >Vertical</button>
          </div>
        </div>
        <div class="option-group">
          <span class="option-label">Grid Size</span>
          <div class="option-chips">
            {#each [80, 120, 160] as size}
              <button
                type="button"
                class="chip"
                class:active={exportOptions.splitGridStepSize === size}
                onclick={() => exportOptions.setSplitGridStepSize(size as GridStepSize)}
                aria-pressed={exportOptions.splitGridStepSize === size}
              >{size === 80 ? "S" : size === 120 ? "M" : "L"}</button>
            {/each}
          </div>
        </div>
        <div class="option-group">
          <span class="option-label">Include</span>
          <div class="option-chips">
            <button
              type="button"
              class="chip"
              class:active={exportOptions.splitIncludeStartPosition}
              onclick={() => exportOptions.setSplitIncludeStartPosition(!exportOptions.splitIncludeStartPosition)}
              aria-pressed={exportOptions.splitIncludeStartPosition}
            >Start</button>
            <button
              type="button"
              class="chip"
              class:active={exportOptions.splitShowStepNumbers}
              onclick={() => exportOptions.setSplitShowStepNumbers(!exportOptions.splitShowStepNumbers)}
              aria-pressed={exportOptions.splitShowStepNumbers}
            >Numbers</button>
          </div>
        </div>
      {:else}
        <!-- Animation-only video export options -->
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
</div>

<style>
  .export-mode-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  .export-preview-area {
    flex: 0 0 auto;
    max-height: 40%;
    min-height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    overflow: hidden;
  }

  .export-options-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .export-hint {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
  }

  .export-hint i {
    color: var(--theme-accent, #6366f1);
  }

  .export-options-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
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
    font-size: var(--font-size-xs, 12px);
    font-weight: 500;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .option-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    padding: 8px 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    background: transparent;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .chip:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .chip.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  /* Loading and error states */
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #6366f1);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-state i {
    font-size: 24px;
    color: var(--semantic-error, #ef4444);
  }

  /* Responsive */
  @media (max-width: 767px) {
    .export-mode-container {
      padding: 12px;
    }

    .export-preview-area {
      max-height: 35%;
      min-height: 120px;
    }

    .chip {
      padding: 6px 12px;
      font-size: var(--font-size-xs, 12px);
    }
  }
</style>
