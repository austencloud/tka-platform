<script lang="ts">
  /**
   * PromoGenerator Component
   *
   * Modern 2026-style UI for the 3D device mockup promo video generator.
   * Features visual selectors, floating controls, and immersive canvas.
   */

  import { onMount, onDestroy } from "svelte";
  import { getPromoOrchestrator } from "$lib/features/promo-generator/get-promo-orchestrator";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import type { PromoOrchestrator } from "../services/promo-orchestrator";
  import type {
    PromoGeneratorState,
    AnimationPreset,
    ExportConfig,
    EnvironmentType,
  } from "../domain/promo-models";
  import type { ExportStage } from "../services/types";
  // Props
  interface Props {
    initialModelPath?: string;
    initialScreenshot?: string;
    width?: number;
    height?: number;
  }

  let {
    initialModelPath = "",
    initialScreenshot = "",
    width = 1920,
    height = 1080,
  }: Props = $props();

  // State
  let canvas: HTMLCanvasElement | null = $state(null);
  let canvasContainer: HTMLDivElement | null = $state(null);
  let orchestrator: PromoOrchestrator | null = $state(null);
  let generatorState: PromoGeneratorState = $state({
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
  let showExportPanel: boolean = $state(false);

  // Export settings
  let exportResolution: "720p" | "1080p" | "4k" = $state("1080p");
  let exportFps: 30 | 60 = $state(60);

  // File input refs
  let modelInput: HTMLInputElement | null = $state(null);
  let screenshotInput: HTMLInputElement | null = $state(null);

  // Environment options with visual representation
  const environments: { id: EnvironmentType; label: string; color: string }[] = [
    { id: "studio", label: "Studio", color: "#1a1a2e" },
    { id: "gradient", label: "Gradient", color: "linear-gradient(135deg, #1a1a2e, #0f0f1a)" },
    { id: "space", label: "Space", color: "#000000" },
    { id: "sunset", label: "Sunset", color: "linear-gradient(135deg, #ff6b35, #f7931e)" },
  ];

  // Resolution options
  const resolutions: { id: "720p" | "1080p" | "4k"; label: string; dims: string }[] = [
    { id: "720p", label: "HD", dims: "1280×720" },
    { id: "1080p", label: "Full HD", dims: "1920×1080" },
    { id: "4k", label: "4K", dims: "3840×2160" },
  ];

  // Initialize on mount
  onMount(async () => {
    if (!canvas || !canvasContainer) return;

    try {
      orchestrator = getPromoOrchestrator();
      if (!orchestrator) {
        console.error("[PromoGenerator] Failed to resolve orchestrator from DI container");
        return;
      }

      // Get container dimensions for responsive canvas
      const rect = canvasContainer.getBoundingClientRect();
      const canvasWidth = Math.floor(rect.width);
      const canvasHeight = Math.floor(rect.height);

      await orchestrator.initialize(canvas, canvasWidth, canvasHeight);

      orchestrator.subscribe((newState) => {
        generatorState = newState;
      });

      availablePresets = orchestrator.getAvailablePresets();

      if (initialModelPath) {
        await orchestrator.loadDevice(initialModelPath);
      }

      if (initialScreenshot) {
        await orchestrator.loadScreenshot(initialScreenshot);
      }
    } catch (error) {
      console.error("[PromoGenerator] Initialization failed:", error);
    }
  });

  onDestroy(() => {
    orchestrator?.dispose();
  });

  // Handlers
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

  function handlePresetChange(presetId: string) {
    if (!orchestrator) return;
    selectedPreset = presetId;
    orchestrator.usePreset(presetId);
  }

  function handleEnvironmentChange(env: EnvironmentType) {
    if (!orchestrator) return;
    selectedEnvironment = env;
    orchestrator.setEnvironment(env);
  }

  function togglePlayback() {
    if (!orchestrator) return;
    if (isPlaying) {
      orchestrator.pausePreview();
      isPlaying = false;
    } else {
      isPlaying = true;
      orchestrator.preview((prog) => {
        progress = prog;
        if (prog >= 1) {
          isPlaying = false;
        }
      });
    }
  }

  function stopPreview() {
    if (!orchestrator) return;
    orchestrator.stopPreview();
    isPlaying = false;
    progress = 0;
  }

  function handleSeek(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!orchestrator) return;
    orchestrator.seekPreview(value);
    progress = value;
  }

  async function exportVideo() {
    if (!orchestrator) return;

    const config: ExportConfig = {
      resolution: exportResolution,
      fps: exportFps,
      format: "mp4",
      filename: `promo-${Date.now()}`,
    };

    await orchestrator.export(config, (prog, stage) => {
      progress = prog / 100;
      exportStage = stage;
    });
  }

  function cancelExport() {
    orchestrator?.cancelExport();
  }

  // Get preset icon based on type
  function getPresetIcon(id: string): string {
    const icons: Record<string, string> = {
      "tka-showcase": "video",
    };
    return icons[id] || "cube";
  }
</script>

<div class="promo-generator">
  <!-- Hidden file inputs -->
  <input
    bind:this={modelInput}
    type="file"
    accept=".glb,.gltf"
    onchange={handleModelUpload}
    class="hidden-input"
  />
  <input
    bind:this={screenshotInput}
    type="file"
    accept="image/*"
    onchange={handleScreenshotUpload}
    class="hidden-input"
  />

  <!-- Main Canvas Area -->
  <div class="canvas-area" bind:this={canvasContainer}>
    <canvas bind:this={canvas} class="preview-canvas"></canvas>

    {#if !generatorState.isReady}
      <div class="loading-overlay">
        <ProgressRing percent={-1} size={32} strokeWidth={3} />
        <span>Initializing 3D Engine...</span>
      </div>
    {/if}

    {#if generatorState.isExporting}
      <div class="export-overlay">
        <div class="export-modal">
          <div class="export-header">
            <span class="export-title">Rendering Video</span>
            <span class="export-stage">{exportStage}</span>
          </div>
          <div class="export-progress-ring">
            <svg viewBox="0 0 100 100">
              <circle class="progress-bg" cx="50" cy="50" r="45" />
              <circle
                class="progress-fill"
                cx="50"
                cy="50"
                r="45"
                style="stroke-dashoffset: {283 - (283 * generatorState.exportProgress) / 100}"
              />
            </svg>
            <span class="progress-text">{Math.round(generatorState.exportProgress)}%</span>
          </div>
          <button class="cancel-btn" onclick={cancelExport}>Cancel</button>
        </div>
      </div>
    {/if}

    <!-- Floating Controls - Top Left: Upload Actions -->
    <div class="floating-controls top-left">
      <button
        class="icon-btn"
        onclick={() => modelInput?.click()}
        disabled={!generatorState.isReady}
        title="Load 3D Model"
      >
        <i class="fas fa-cube"></i>
      </button>
      <button
        class="icon-btn"
        onclick={() => screenshotInput?.click()}
        disabled={!generatorState.isReady}
        title="Load Screenshot"
      >
        <i class="fas fa-image"></i>
      </button>
    </div>

    <!-- Floating Controls - Top Right: Export -->
    <div class="floating-controls top-right">
      <button
        class="export-trigger"
        onclick={() => (showExportPanel = !showExportPanel)}
        disabled={!generatorState.isReady || generatorState.isExporting}
      >
        <i class="fas fa-download"></i>
        <span>Export</span>
      </button>

      {#if showExportPanel}
        <div class="export-panel">
          <div class="panel-section">
            <span class="section-label">Resolution</span>
            <div class="pill-group">
              {#each resolutions as res}
                <button
                  class="pill"
                  class:active={exportResolution === res.id}
                  onclick={() => (exportResolution = res.id)}
                >
                  <span class="pill-label">{res.label}</span>
                  <span class="pill-sub">{res.dims}</span>
                </button>
              {/each}
            </div>
          </div>
          <div class="panel-section">
            <span class="section-label">Frame Rate</span>
            <div class="pill-group">
              <button
                class="pill"
                class:active={exportFps === 30}
                onclick={() => (exportFps = 30)}
              >
                30 fps
              </button>
              <button
                class="pill"
                class:active={exportFps === 60}
                onclick={() => (exportFps = 60)}
              >
                60 fps
              </button>
            </div>
          </div>
          <button class="render-btn" onclick={exportVideo} disabled={generatorState.isExporting}>
            <i class="fas fa-film"></i>
            Render Video
          </button>
        </div>
      {/if}
    </div>

    <!-- Floating Controls - Bottom Center: Playback -->
    <div class="floating-controls bottom-center">
      <div class="playback-bar">
        <button class="playback-btn" onclick={togglePlayback} disabled={!generatorState.isReady} aria-label={isPlaying ? "Pause" : "Play"}>
          {#if isPlaying}
            <i class="fas fa-pause" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-play" aria-hidden="true"></i>
          {/if}
        </button>
        <div class="timeline-container">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            oninput={handleSeek}
            disabled={!generatorState.isReady}
            class="timeline"
          />
          <div class="timeline-fill" style="width: {progress * 100}%"></div>
        </div>
        <button class="playback-btn stop" onclick={stopPreview} disabled={!generatorState.isReady} aria-label="Stop">
          <i class="fas fa-stop" aria-hidden="true"></i>
        </button>
        <span class="time-display">
          {Math.floor(progress * 21)}s
        </span>
      </div>
    </div>
  </div>

  <!-- Right Sidebar: Simple workflow -->
  <aside class="sidebar">
    <section class="sidebar-section">
      <h3 class="section-title">Animation</h3>
      <div class="animation-info">
        <p class="animation-desc">
          7 cinematic shots with hard cuts between angles.
          Each shot showcases a different screenshot.
        </p>
        <div class="shot-list">
          <div class="shot-item">
            <span class="shot-time">0-3s</span>
            <span class="shot-desc">Front zoom in</span>
          </div>
          <div class="shot-item">
            <span class="shot-time">3-6s</span>
            <span class="shot-desc">Right angle pan</span>
          </div>
          <div class="shot-item">
            <span class="shot-time">6-9s</span>
            <span class="shot-desc">Left angle drift</span>
          </div>
          <div class="shot-item">
            <span class="shot-time">9-12s</span>
            <span class="shot-desc">Low angle rise</span>
          </div>
          <div class="shot-item">
            <span class="shot-time">12-15s</span>
            <span class="shot-desc">High angle descent</span>
          </div>
          <div class="shot-item">
            <span class="shot-time">15-18s</span>
            <span class="shot-desc">Three-quarter zoom</span>
          </div>
          <div class="shot-item">
            <span class="shot-time">18-21s</span>
            <span class="shot-desc">Hero drift</span>
          </div>
        </div>
      </div>
    </section>

    <section class="sidebar-section">
      <h3 class="section-title">Background</h3>
      <div class="env-grid">
        {#each environments as env}
          <button
            class="env-card"
            class:active={selectedEnvironment === env.id}
            onclick={() => handleEnvironmentChange(env.id)}
            disabled={!generatorState.isReady}
            style="--env-color: {env.color}"
          >
            <div class="env-preview"></div>
            <span class="env-label">{env.label}</span>
          </button>
        {/each}
      </div>
    </section>

    {#if generatorState.error}
      <div class="error-toast">
        <i class="fas fa-exclamation-circle"></i>
        <span>{generatorState.error}</span>
      </div>
    {/if}
  </aside>
</div>

<style>
  .promo-generator {
    display: grid;
    grid-template-columns: 1fr 280px;
    height: 100vh;
    background: #0a0a0f;
    overflow: hidden;
  }

  .hidden-input {
    display: none;
  }

  /* Canvas Area */
  .canvas-area {
    position: relative;
    background: radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%);
    overflow: hidden;
  }

  .preview-canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Loading Overlay */
  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: rgba(10, 10, 15, 0.9);
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
  }

  /* Floating Controls */
  .floating-controls {
    position: absolute;
    display: flex;
    gap: 8px;
    z-index: 10;
  }

  .floating-controls.top-left {
    top: 20px;
    left: 20px;
  }

  .floating-controls.top-right {
    top: 20px;
    right: 20px;
    flex-direction: column;
    align-items: flex-end;
  }

  .floating-controls.bottom-center {
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
  }

  .icon-btn {
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
    font-size: 18px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    backdrop-filter: blur(8px);
  }

  .icon-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    transform: translateY(-2px);
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Export Trigger */
  .export-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .export-trigger:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
  }

  .export-trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Export Panel */
  .export-panel {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    padding: 16px;
    background: rgba(20, 20, 30, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    backdrop-filter: blur(16px);
    min-width: 280px;
  }

  .panel-section {
    margin-bottom: 16px;
  }

  .section-label {
    display: block;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .pill-group {
    display: flex;
    gap: 6px;
  }

  .pill {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .pill:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .pill.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: #6366f1;
    color: #fff;
  }

  .pill-label {
    font-weight: 600;
  }

  .pill-sub {
    font-size: 10px;
    opacity: 0.6;
  }

  .render-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .render-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
  }

  /* Playback Bar */
  .playback-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background: rgba(20, 20, 30, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    backdrop-filter: blur(16px);
  }

  .playback-btn {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .playback-btn.stop {
    background: rgba(255, 255, 255, 0.1);
    width: 32px;
    height: 32px;
    font-size: 12px;
  }

  .playback-btn:hover:not(:disabled) {
    transform: scale(1.05);
  }

  .playback-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .timeline-container {
    position: relative;
    width: 200px;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .timeline {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    z-index: 1;
  }

  .timeline-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 3px;
    pointer-events: none;
  }

  .time-display {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
    min-width: 32px;
    text-align: right;
  }

  /* Sidebar */
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    background: rgba(15, 15, 20, 0.95);
    border-left: 1px solid rgba(255, 255, 255, 0.06);
    overflow-y: auto;
  }

  .sidebar-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  /* Animation Info */
  .animation-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .animation-desc {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.6);
  }

  .shot-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shot-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    transition: background var(--duration-normal) ease;
  }

  .shot-item:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .shot-time {
    font-size: 11px;
    font-weight: 600;
    color: #6366f1;
    min-width: 40px;
  }

  .shot-desc {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  /* Environment Grid */
  .env-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .env-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .env-card:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
  }

  .env-card.active {
    border-color: #6366f1;
  }

  .env-card:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .env-preview {
    width: 100%;
    height: 32px;
    border-radius: 6px;
    background: var(--env-color);
  }

  .env-label {
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
  }

  .env-card.active .env-label {
    color: #fff;
  }

  /* Export Overlay */
  .export-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 15, 0.9);
    backdrop-filter: blur(8px);
  }

  .export-modal {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 32px 48px;
    background: rgba(20, 20, 30, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
  }

  .export-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .export-title {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
  }

  .export-stage {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    text-transform: capitalize;
  }

  .export-progress-ring {
    position: relative;
    width: 120px;
    height: 120px;
  }

  .export-progress-ring svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .export-progress-ring circle {
    fill: none;
    stroke-width: 6;
    stroke-linecap: round;
  }

  .progress-bg {
    stroke: rgba(255, 255, 255, 0.1);
  }

  .progress-fill {
    stroke: url(#gradient);
    stroke: #6366f1;
    stroke-dasharray: 283;
    transition: stroke-dashoffset var(--duration-emphasis) ease;
  }

  .progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 24px;
    font-weight: 700;
    color: #fff;
  }

  .cancel-btn {
    padding: 10px 24px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  /* Error Toast */
  .error-toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
    color: #fca5a5;
    font-size: 13px;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .promo-generator {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }

    .sidebar {
      flex-direction: row;
      padding: 16px;
      border-left: none;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      overflow-x: auto;
    }

    .sidebar-section {
      min-width: 200px;
    }

    .env-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

</style>
