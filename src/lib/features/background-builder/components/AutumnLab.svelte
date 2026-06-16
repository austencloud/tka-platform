<script lang="ts">
  import { onDestroy } from "svelte";
  import { AutumnBackgroundSystem, type QualityLevel } from "@austencloud/backgrounds";
  import { ChipToggle, ChipGroup } from '@austencloud/chip-toggle';
  import LabPreviewCanvas from "./LabPreviewCanvas.svelte";

  // Background system
  let backgroundSystem: AutumnBackgroundSystem | null = $state(null);
  let canvasDimensions = $state({ width: 800, height: 600 });

  // Quality settings
  let quality: QualityLevel = $state("high");

  // Loading state
  let isLoading = $state(true);

  // Layer toggles
  let layers = $state({
    gradient: true,
    leaves: true,
  });

  // Density presets
  type DensityPreset = "sparse" | "normal" | "dense" | "storm";
  let densityPreset: DensityPreset = $state("normal");

  // Wind presets
  type WindPreset = "calm" | "breezy" | "windy" | "gusty";
  let windPreset: WindPreset = $state("breezy");

  // Stats
  let stats = $state({ leaves: 0 });
  let lastStatsUpdate = 0;

  // Initialize system when canvas is ready
  function handleCanvasReady(dimensions: { width: number; height: number }) {
    canvasDimensions = dimensions;
    backgroundSystem = new AutumnBackgroundSystem();
    backgroundSystem.initialize(dimensions, quality);

    // Apply layer visibility
    if (backgroundSystem.setLayerVisibility) {
      backgroundSystem.setLayerVisibility(layers);
    }

    isLoading = false;
  }

  // Update stats on each frame
  function handleFrame() {
    const now = performance.now();
    if (now - lastStatsUpdate > 1000 && backgroundSystem) {
      stats = backgroundSystem.getStats();
      lastStatsUpdate = now;
    }
  }

  function regenerate() {
    if (backgroundSystem) {
      backgroundSystem.cleanup?.();
    }
    backgroundSystem = new AutumnBackgroundSystem();
    backgroundSystem.initialize(canvasDimensions, quality);
    if (backgroundSystem.setLayerVisibility) {
      backgroundSystem.setLayerVisibility(layers);
    }
  }

  function setQuality(q: QualityLevel) {
    quality = q;
    regenerate();
  }

  function setDensity(preset: DensityPreset) {
    densityPreset = preset;
    regenerate();
  }

  function setWindPreset(preset: WindPreset) {
    windPreset = preset;
    // Wind presets would be applied via the system if we add that capability
  }

  function toggleLayer(layer: keyof typeof layers) {
    layers = { ...layers, [layer]: !layers[layer] };
    if (backgroundSystem?.setLayerVisibility) {
      backgroundSystem.setLayerVisibility(layers);
    }
  }

  onDestroy(() => {
    if (backgroundSystem) {
      backgroundSystem.cleanup?.();
    }
  });
</script>

<div class="autumn-lab">
  <div class="controls themed-scrollbar-accent">
    <div class="header">
      <h2>Autumn Lab</h2>
      <span class="badge">Falling Leaves</span>
    </div>

    <!-- Quality Chips -->
    <ChipGroup>
      <ChipToggle label="High" active={quality === "high"} color="amber" onclick={() => setQuality("high")} />
      <ChipToggle label="Medium" active={quality === "medium"} color="amber" onclick={() => setQuality("medium")} />
      <ChipToggle label="Low" active={quality === "low"} color="amber" onclick={() => setQuality("low")} />
    </ChipGroup>

    <!-- Layer Chips -->
    <ChipGroup>
      <ChipToggle label="Background" icon="fill-drip" active={layers.gradient} color="amber" onclick={() => toggleLayer("gradient")} />
      <ChipToggle label="Leaves" icon="leaf" active={layers.leaves} color="amber" onclick={() => toggleLayer("leaves")} />
    </ChipGroup>

    <!-- Density Chips -->
    <ChipGroup>
      <ChipToggle label="Sparse" active={densityPreset === "sparse"} color="amber" onclick={() => setDensity("sparse")} />
      <ChipToggle label="Normal" active={densityPreset === "normal"} color="amber" onclick={() => setDensity("normal")} />
      <ChipToggle label="Dense" active={densityPreset === "dense"} color="amber" onclick={() => setDensity("dense")} />
      <ChipToggle label="Storm" active={densityPreset === "storm"} color="amber" onclick={() => setDensity("storm")} />
    </ChipGroup>

    <!-- Wind Chips -->
    <ChipGroup>
      <ChipToggle label="Calm" active={windPreset === "calm"} color="default" onclick={() => setWindPreset("calm")} />
      <ChipToggle label="Breezy" active={windPreset === "breezy"} color="default" onclick={() => setWindPreset("breezy")} />
      <ChipToggle label="Windy" active={windPreset === "windy"} color="default" onclick={() => setWindPreset("windy")} />
      <ChipToggle label="Gusty" active={windPreset === "gusty"} color="default" onclick={() => setWindPreset("gusty")} />
    </ChipGroup>

    <!-- Regenerate -->
    <button class="action-btn" onclick={regenerate}>
      <i class="fas fa-leaf"></i>
      Regenerate
    </button>

    <!-- Stats -->
    <div class="stats-section">
      <span class="label">Scene Stats</span>
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-value">{stats.leaves}</span>
          <span class="stat-label">Leaves</span>
        </div>
      </div>
    </div>

    <!-- Progress Pills -->
    <div class="progress-section">
      <span class="label">Features</span>
      <div class="progress-pills">
        <span class="pill complete">Sunset Gradient</span>
        <span class="pill complete">Falling Leaves</span>
        <span class="pill complete">Wind System</span>
        <span class="pill complete">Leaf Rotation</span>
        <span class="pill active">Layer Controls</span>
      </div>
    </div>
  </div>

  <LabPreviewCanvas
    system={backgroundSystem}
    {isLoading}
    accentColor="#f59e0b"
    backgroundColor="rgba(45, 24, 16, 0.9)"
    onCanvasReady={handleCanvasReady}
    onFrame={handleFrame}
  />
</div>

<style>
  .autumn-lab {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 20px;
    height: 100%;
    min-height: 600px;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
    background: var(--theme-panel-bg, rgba(15, 15, 25, 0.8));
    border-radius: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    overflow-y: auto;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #ffffff;
  }

  .badge {
    padding: 4px 10px;
    background: linear-gradient(135deg, rgba(217, 119, 6, 0.3), rgba(245, 158, 11, 0.3));
    border: 1px solid rgba(245, 158, 11, 0.4);
    border-radius: 20px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: #f59e0b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #d97706, #b45309);
    border: none;
    border-radius: 12px;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(217, 119, 6, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
  }

  .action-btn:focus-visible {
    outline: 2px solid #fbbf24;
    outline-offset: 2px;
  }

  .stats-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border-radius: 10px;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: #f59e0b;
  }

  .stat-label {
    font-size: var(--font-size-compact, 12px);
    color: #9ca3af;
    text-transform: uppercase;
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .progress-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pill {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
  }

  .pill.complete {
    background: color-mix(in srgb, var(--theme-success, #34d399) 15%, transparent);
    color: var(--theme-success, #34d399);
  }

  .pill.active {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  @media (max-width: 800px) {
    .autumn-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }
  }

  /* Accessibility: Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .action-btn,
    .pill {
      transition: none;
      animation: none;
    }
  }

  /* Accessibility: High contrast */
  @media (prefers-contrast: high) {
    .controls {
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .stat {
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .label,
    .stat-label {
      color: #d1d5db;
    }
  }
</style>
