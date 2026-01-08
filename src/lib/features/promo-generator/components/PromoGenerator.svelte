<script lang="ts">
  /**
   * PromoGenerator Component
   *
   * Main UI for the 3D device mockup promo video generator.
   * Provides controls for device selection, screenshot loading,
   * animation presets, and video export.
   */

  import { onMount, onDestroy } from "svelte";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { loadFeatureModule } from "$lib/shared/inversify/di";
  import type { IPromoOrchestrator } from "../services/contracts/IPromoOrchestrator";
  import type {
    PromoGeneratorState,
    AnimationPreset,
    ExportConfig,
    EnvironmentType,
  } from "../domain/promo-models";
  import type { ExportStage } from "../services/contracts/IPromoVideoExporter";

  // Props
  interface Props {
    /** Initial device model path (optional) */
    initialModelPath?: string;
    /** Initial screenshot path (optional) */
    initialScreenshot?: string;
    /** Width of the preview canvas */
    width?: number;
    /** Height of the preview canvas */
    height?: number;
  }

  let {
    initialModelPath = "",
    initialScreenshot = "",
    width = 800,
    height = 600,
  }: Props = $props();

  // State
  let canvas: HTMLCanvasElement | null = $state(null);
  let orchestrator: IPromoOrchestrator | null = $state(null);
  let state: PromoGeneratorState = $state({
    isReady: false,
    isExporting: false,
    exportProgress: 0,
    error: null,
    currentDevice: null,
    currentPreset: null,
    screenshots: [],
  });
  let availablePresets: AnimationPreset[] = $state([]);
  let selectedPreset: string = $state("float-rotate");
  let selectedEnvironment: EnvironmentType = $state("studio");
  let exportStage: ExportStage = $state("preparing");
  let isPlaying: boolean = $state(false);
  let progress: number = $state(0);

  // Export settings
  let exportResolution: "720p" | "1080p" | "4k" = $state("1080p");
  let exportFps: 30 | 60 = $state(60);
  let exportFilename: string = $state("tka-promo");

  // File input refs
  let modelInput: HTMLInputElement | null = $state(null);
  let screenshotInput: HTMLInputElement | null = $state(null);

  // Initialize on mount
  onMount(async () => {
    if (!canvas) return;

    try {
      // Load the promo generator module
      await loadFeatureModule("promo-generator");

      // Resolve orchestrator
      orchestrator = resolve<IPromoOrchestrator>(TYPES.IPromoOrchestrator);

      // Initialize with canvas
      await orchestrator.initialize(canvas, width, height);

      // Subscribe to state changes
      orchestrator.subscribe((newState) => {
        state = newState;
      });

      // Get available presets
      availablePresets = orchestrator.getAvailablePresets();

      // Load initial model if provided
      if (initialModelPath) {
        await orchestrator.loadDevice(initialModelPath);
      }

      // Load initial screenshot if provided
      if (initialScreenshot) {
        await orchestrator.loadScreenshot(initialScreenshot);
      }
    } catch (error) {
      console.error("[PromoGenerator] Initialization failed:", error);
    }
  });

  // Cleanup on destroy
  onDestroy(() => {
    orchestrator?.dispose();
  });

  // Handle model file selection
  async function handleModelUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !orchestrator) return;

    try {
      const url = URL.createObjectURL(file);
      await orchestrator.loadDevice(url);
    } catch (error) {
      console.error("Failed to load model:", error);
    }
  }

  // Handle screenshot file selection
  async function handleScreenshotUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !orchestrator) return;

    try {
      const url = URL.createObjectURL(file);
      await orchestrator.loadScreenshot(url);
    } catch (error) {
      console.error("Failed to load screenshot:", error);
    }
  }

  // Handle preset change
  function handlePresetChange(presetId: string) {
    if (!orchestrator) return;
    selectedPreset = presetId;
    orchestrator.usePreset(presetId);
  }

  // Handle environment change
  function handleEnvironmentChange(env: EnvironmentType) {
    if (!orchestrator) return;
    selectedEnvironment = env;
    orchestrator.setEnvironment(env);
  }

  // Play preview
  function playPreview() {
    if (!orchestrator) return;
    isPlaying = true;
    orchestrator.preview((prog) => {
      progress = prog;
      if (prog >= 1) {
        isPlaying = false;
      }
    });
  }

  // Pause preview
  function pausePreview() {
    if (!orchestrator) return;
    orchestrator.pausePreview();
    isPlaying = false;
  }

  // Stop preview
  function stopPreview() {
    if (!orchestrator) return;
    orchestrator.stopPreview();
    isPlaying = false;
    progress = 0;
  }

  // Handle seek
  function handleSeek(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!orchestrator) return;
    orchestrator.seekPreview(value);
    progress = value;
  }

  // Export video
  async function exportVideo() {
    if (!orchestrator) return;

    const config: ExportConfig = {
      resolution: exportResolution,
      fps: exportFps,
      format: "mp4",
      filename: exportFilename,
    };

    await orchestrator.export(config, (prog, stage) => {
      progress = prog / 100;
      exportStage = stage;
    });
  }

  // Cancel export
  function cancelExport() {
    if (!orchestrator) return;
    orchestrator.cancelExport();
  }
</script>

<div class="promo-generator">
  <div class="preview-container">
    <canvas
      bind:this={canvas}
      {width}
      {height}
      class="preview-canvas"
    ></canvas>

    {#if !state.isReady}
      <div class="loading-overlay">
        <div class="spinner"></div>
        <p>Initializing...</p>
      </div>
    {/if}

    {#if state.isExporting}
      <div class="export-overlay">
        <div class="export-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width: {state.exportProgress}%"
            ></div>
          </div>
          <p class="export-stage">{exportStage}</p>
          <p class="export-percent">{Math.round(state.exportProgress)}%</p>
          <button class="cancel-btn" onclick={cancelExport}>Cancel</button>
        </div>
      </div>
    {/if}
  </div>

  <div class="controls">
    <section class="control-section">
      <h3>Device Model</h3>
      <input
        bind:this={modelInput}
        type="file"
        accept=".glb,.gltf"
        onchange={handleModelUpload}
        class="file-input"
      />
      <button
        class="upload-btn"
        onclick={() => modelInput?.click()}
        disabled={!state.isReady}
      >
        Load Device Model (.glb)
      </button>
      {#if state.currentDevice}
        <p class="current-value">Current: {state.currentDevice}</p>
      {/if}
    </section>

    <section class="control-section">
      <h3>Screenshot</h3>
      <input
        bind:this={screenshotInput}
        type="file"
        accept="image/*"
        onchange={handleScreenshotUpload}
        class="file-input"
      />
      <button
        class="upload-btn"
        onclick={() => screenshotInput?.click()}
        disabled={!state.isReady}
      >
        Load Screenshot
      </button>
      {#if state.screenshots.length > 0}
        <p class="current-value">
          {state.screenshots.length} screenshot(s) loaded
        </p>
      {/if}
    </section>

    <section class="control-section">
      <h3>Animation Preset</h3>
      <select
        value={selectedPreset}
        onchange={(e) => handlePresetChange(e.currentTarget.value)}
        disabled={!state.isReady}
      >
        {#each availablePresets as preset}
          <option value={preset.id}>{preset.name}</option>
        {/each}
      </select>
      {#if selectedPreset}
        {@const preset = availablePresets.find((p) => p.id === selectedPreset)}
        {#if preset}
          <p class="preset-description">{preset.description}</p>
        {/if}
      {/if}
    </section>

    <section class="control-section">
      <h3>Environment</h3>
      <select
        value={selectedEnvironment}
        onchange={(e) =>
          handleEnvironmentChange(e.currentTarget.value as EnvironmentType)}
        disabled={!state.isReady}
      >
        <option value="studio">Studio</option>
        <option value="gradient">Gradient</option>
        <option value="space">Space</option>
        <option value="sunset">Sunset</option>
      </select>
    </section>

    <section class="control-section">
      <h3>Preview</h3>
      <div class="playback-controls">
        {#if !isPlaying}
          <button
            class="play-btn"
            onclick={playPreview}
            disabled={!state.isReady || state.isExporting}
          >
            ▶ Play
          </button>
        {:else}
          <button class="pause-btn" onclick={pausePreview}>⏸ Pause</button>
        {/if}
        <button
          class="stop-btn"
          onclick={stopPreview}
          disabled={!state.isReady}
        >
          ⏹ Stop
        </button>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.001"
        value={progress}
        oninput={handleSeek}
        disabled={!state.isReady}
        class="seek-slider"
      />
    </section>

    <section class="control-section">
      <h3>Export Settings</h3>
      <div class="export-settings">
        <label>
          Resolution:
          <select bind:value={exportResolution}>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="4k">4K</option>
          </select>
        </label>
        <label>
          FPS:
          <select bind:value={exportFps}>
            <option value={30}>30 fps</option>
            <option value={60}>60 fps</option>
          </select>
        </label>
        <label>
          Filename:
          <input type="text" bind:value={exportFilename} />
        </label>
      </div>
      <button
        class="export-btn"
        onclick={exportVideo}
        disabled={!state.isReady || state.isExporting}
      >
        Export Video
      </button>
    </section>

    {#if state.error}
      <div class="error-message">
        <p>{state.error}</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .promo-generator {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg, 24px);
    padding: var(--spacing-lg, 24px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: var(--radius-lg, 12px);
    color: var(--theme-text, #ffffff);
  }

  .preview-container {
    position: relative;
    width: 100%;
    aspect-ratio: 4/3;
    background: #000;
    border-radius: var(--radius-md, 8px);
    overflow: hidden;
  }

  .preview-canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .loading-overlay,
  .export-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top-color: var(--theme-accent, #6366f1);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .export-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md, 16px);
    width: 80%;
    max-width: 400px;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    transition: width 0.1s ease;
  }

  .export-stage {
    font-size: var(--font-size-sm, 14px);
    text-transform: capitalize;
    opacity: 0.8;
  }

  .export-percent {
    font-size: var(--font-size-lg, 20px);
    font-weight: 600;
  }

  .controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md, 16px);
  }

  .control-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .control-section h3 {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
  }

  .file-input {
    display: none;
  }

  .upload-btn,
  .play-btn,
  .pause-btn,
  .stop-btn,
  .export-btn,
  .cancel-btn {
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    border: none;
    border-radius: var(--radius-sm, 4px);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .upload-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .upload-btn:hover:not(:disabled) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.12));
  }

  .play-btn,
  .export-btn {
    background: var(--theme-accent, #6366f1);
    color: white;
  }

  .play-btn:hover:not(:disabled),
  .export-btn:hover:not(:disabled) {
    background: var(--theme-accent-hover, #5558e3);
  }

  .pause-btn {
    background: var(--semantic-warning, #f59e0b);
    color: white;
  }

  .stop-btn,
  .cancel-btn {
    background: var(--semantic-error, #ef4444);
    color: white;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  select,
  input[type="text"] {
    padding: var(--spacing-sm, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-sm, 4px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
  }

  select:focus,
  input[type="text"]:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
  }

  .playback-controls {
    display: flex;
    gap: var(--spacing-sm, 8px);
  }

  .seek-slider {
    width: 100%;
    height: 8px;
    border-radius: 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    appearance: none;
    cursor: pointer;
  }

  .seek-slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    cursor: pointer;
  }

  .export-settings {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .export-settings label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    font-size: var(--font-size-sm, 14px);
  }

  .export-settings select,
  .export-settings input {
    flex: 1;
    max-width: 150px;
  }

  .current-value,
  .preset-description {
    font-size: var(--font-size-xs, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .error-message {
    grid-column: 1 / -1;
    padding: var(--spacing-md, 16px);
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid var(--semantic-error, #ef4444);
    border-radius: var(--radius-md, 8px);
    color: var(--semantic-error, #ef4444);
  }

  .error-message p {
    margin: 0;
  }
</style>
