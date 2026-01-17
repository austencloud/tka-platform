<script lang="ts">
  /**
   * CompositionBuilder - Unified composition canvas and playback
   *
   * This component replaces the old ArrangeTab + PlaybackTab architecture
   * with a single unified view where you build and play compositions
   * in the same interface.
   *
   * Features:
   * - Layout-first composition (choose grid, configure cells)
   * - Inline playback (no separate overlay)
   * - Toggle between live preview and static thumbnails
   * - Inline controls below canvas (participates in layout flow)
   * - Templates accessible via button (secondary)
   * - Slide-out cell config panel (right on desktop, bottom on mobile)
   * - Workflow stepper: Canvas → Audio → Export
   */

  import { getCompositionState } from "./state/composition-state.svelte";
  import type {
    WorkflowPhase,
    BeatMarker,
    TempoRegion,
  } from "./state/composition-state.svelte";
  import CompositionCanvas from "./components/canvas/CompositionCanvas.svelte";
  import CanvasControls from "./components/controls/CanvasControls.svelte";
  import TemplatesSheet from "./components/sheets/TemplatesSheet.svelte";
  import CellConfigPanel from "./components/panels/CellConfigPanel.svelte";
  import WorkflowStepper from "./components/stepper/WorkflowStepper.svelte";
  import AudioPhase from "./phases/audio/AudioPhase.svelte";
  import ExportPhase from "./phases/export/ExportPhase.svelte";

  // Get singleton state (renamed to avoid conflict with $state rune)
  const compState = getCompositionState();

  // Reactive bindings
  const composition = $derived(compState.composition);
  const isPlaying = $derived(compState.isPlaying);
  const isPreviewing = $derived(compState.isPreviewing);
  const isTemplatesOpen = $derived(compState.isTemplatesOpen);
  const selectedCellId = $derived(compState.selectedCellId);

  // Workflow phase bindings
  const currentPhase = $derived(compState.currentPhase);
  const audioState = $derived(compState.audioState);
  const hasContent = $derived(compState.canPlay);
  const hasAudio = $derived(compState.hasAudio);

  function handlePhaseChange(phase: WorkflowPhase) {
    compState.setCurrentPhase(phase);
  }

  function handleLoadAudio(file: File) {
    compState.loadAudioFile(file);
  }

  function handleClearAudio() {
    compState.clearAudio();
  }

  function handleSetDetectedBpm(bpm: number) {
    compState.setDetectedBpm(bpm);
  }

  function handleSetManualBpm(bpm: number) {
    compState.setManualBpm(bpm);
  }

  function handleAddBeatMarker(marker: BeatMarker) {
    compState.addBeatMarker(marker);
  }

  function handleRemoveBeatMarker(id: string) {
    compState.removeBeatMarker(id);
  }

  function handleAddTempoRegion(region: TempoRegion) {
    compState.addTempoRegion(region);
  }

  function handleRemoveTempoRegion(id: string) {
    compState.removeTempoRegion(id);
  }

  function handleUpdateTempoRegion(id: string, updates: Partial<TempoRegion>) {
    compState.updateTempoRegion(id, updates);
  }

  // Fullscreen mode binding
  const isFullscreen = $derived(compState.isFullscreen);

  function handleCellClick(cellId: string) {
    // In fullscreen mode, any cell click exits fullscreen
    if (isFullscreen) {
      compState.exitFullscreen();
      return;
    }

    if (isPlaying) {
      // During playback, ignore cell clicks
      return;
    }

    // Open cell config panel (slides from right on desktop, bottom on mobile)
    compState.openCellConfig(cellId);
  }

  function handleCanvasClick() {
    // Exit fullscreen on canvas tap
    if (isFullscreen) {
      compState.exitFullscreen();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Exit fullscreen on Escape
    if (e.key === "Escape" && isFullscreen) {
      compState.exitFullscreen();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="composition-builder"
  class:fullscreen={isFullscreen}
  role="application"
  aria-label="Composition Builder"
>
  <!-- Workflow Stepper -->
  <WorkflowStepper
    {currentPhase}
    onPhaseChange={handlePhaseChange}
    {hasContent}
    {hasAudio}
  />

  <!-- Phase Content -->
  <div class="phase-content">
    {#if currentPhase === "canvas"}
      <!-- Canvas Phase -->
      <div class="canvas-phase">
        <div class="canvas-column">
          <div
            class="canvas-area"
            onclick={handleCanvasClick}
            onkeydown={(e) => e.key === "Enter" && handleCanvasClick()}
            role="button"
            tabindex="0"
            aria-label="Composition canvas - click to exit fullscreen"
          >
            <CompositionCanvas
              {composition}
              {isPlaying}
              {isPreviewing}
              {selectedCellId}
              onCellClick={handleCellClick}
            />

            <!-- Fullscreen exit hint -->
            {#if isFullscreen}
              <div class="fullscreen-hint">
                <span>Tap to exit fullscreen</span>
              </div>
            {/if}
          </div>

          <!-- Inline Controls (hidden in fullscreen) -->
          {#if !isFullscreen}
            <div class="inline-controls" class:playing={isPlaying}>
              <CanvasControls />
            </div>
          {/if}
        </div>
      </div>
    {:else if currentPhase === "audio"}
      <!-- Audio Phase -->
      <AudioPhase
        {audioState}
        onLoadAudio={handleLoadAudio}
        onClearAudio={handleClearAudio}
        onSetDetectedBpm={handleSetDetectedBpm}
        onSetManualBpm={handleSetManualBpm}
        onSetDuration={(duration) => compState.setAudioDuration(duration)}
        onSetAnalyzing={(analyzing) => compState.setAnalyzing(analyzing)}
        onAddBeatMarker={handleAddBeatMarker}
        onRemoveBeatMarker={handleRemoveBeatMarker}
        onAddTempoRegion={handleAddTempoRegion}
        onRemoveTempoRegion={handleRemoveTempoRegion}
        onUpdateTempoRegion={handleUpdateTempoRegion}
        onRestoreFromCache={() => compState.restoreAudioFromCache()}
      />
    {:else if currentPhase === "export"}
      <!-- Export Phase -->
      <ExportPhase {hasContent} {hasAudio} {audioState} />
    {/if}
  </div>

  <!-- Templates Sheet (Drawer) - only for canvas phase -->
  {#if currentPhase === "canvas"}
    <TemplatesSheet
      isOpen={isTemplatesOpen}
      onClose={() => compState.closeTemplates()}
      onSelectTemplate={(id: string) => compState.applyTemplate(id)}
    />

    <!-- Cell Configuration Panel (slides from right on desktop, bottom on mobile) -->
    <CellConfigPanel />
  {/if}
</div>

<style>
  .composition-builder {
    position: relative;
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: transparent;
    overflow: hidden;
    container-type: size;
    container-name: builder;
  }

  /* Fullscreen mode */
  .composition-builder.fullscreen {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: var(--theme-panel-bg);
  }

  .composition-builder.fullscreen .phase-content {
    flex: 1;
  }

  .composition-builder.fullscreen .canvas-phase {
    flex: 1;
  }

  .composition-builder.fullscreen .canvas-column {
    flex: 1;
  }

  .composition-builder.fullscreen .canvas-area {
    padding: 0;
    cursor: pointer;
    /* Prevent tap highlight flash on touch devices */
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
  }

  /* Hide stepper in fullscreen */
  .composition-builder.fullscreen :global(.workflow-stepper) {
    display: none;
  }

  /* Phase content area - fills remaining space */
  .phase-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  /* Canvas phase */
  .canvas-phase {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* Canvas + Controls column */
  .canvas-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }

  .canvas-area {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(8px, 2cqi, 24px);
    min-height: 0;
    min-width: 0;
    container-type: size;
    container-name: canvas;
  }

  /* Inline Controls - participates in flex layout */
  .inline-controls {
    flex-shrink: 0;
    padding: clamp(8px, 2cqi, 16px);
    transition: opacity var(--duration-emphasis) ease;
  }

  .inline-controls.playing {
    opacity: 0.9;
  }

  /* Slight dim on mobile when playing */
  @media (hover: none) and (pointer: coarse) {
    .inline-controls.playing {
      opacity: 0.85;
    }
  }

  /* Fullscreen hint */
  .fullscreen-hint {
    position: absolute;
    bottom: clamp(16px, 4cqi, 32px);
    left: 50%;
    transform: translateX(-50%);
    padding: clamp(8px, 2cqi, 12px) clamp(16px, 4cqi, 24px);
    background: rgba(0, 0, 0, 0.6);
    border-radius: clamp(20px, 4cqi, 30px);
    backdrop-filter: blur(8px);
    animation: fadeInOut 3s ease-in-out forwards;
    pointer-events: none;
  }

  .fullscreen-hint span {
    color: rgba(255, 255, 255, 0.8);
    font-size: clamp(0.75rem, 2.5cqi, 0.9rem);
    white-space: nowrap;
  }

  @keyframes fadeInOut {
    0% {
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .inline-controls {
      transition: none;
    }

    .fullscreen-hint {
      animation: none;
      opacity: 0.8;
    }
  }
</style>
