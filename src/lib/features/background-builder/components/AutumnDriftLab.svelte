<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { AutumnDriftBackgroundSystem } from "$lib/shared/background/autumn-drift/services/AutumnDriftBackgroundSystem";
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);
  let backgroundSystem: AutumnDriftBackgroundSystem | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;

  // Quality settings
  let quality: QualityLevel = $state("high");

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

  function initializeSystem() {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    backgroundSystem = new AutumnDriftBackgroundSystem();
    const dimensions = { width: canvas.width, height: canvas.height };
    backgroundSystem.initialize(dimensions, quality);

    // Apply layer visibility
    if (backgroundSystem.setLayerVisibility) {
      backgroundSystem.setLayerVisibility(layers);
    }

    startAnimation();
  }

  function startAnimation() {
    if (!canvas || !backgroundSystem) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (currentTime: number) => {
      // Guard against destroyed component
      if (!canvas || !backgroundSystem) return;

      const deltaTime = currentTime - lastFrameTime;
      const frameMultiplier = deltaTime / 16.67;
      lastFrameTime = currentTime;

      const dimensions = { width: canvas.width, height: canvas.height };
      backgroundSystem.update(dimensions, frameMultiplier);
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      backgroundSystem.draw(ctx, dimensions);

      // Update stats every second
      if (currentTime - lastStatsUpdate > 1000 && backgroundSystem) {
        stats = backgroundSystem.getStats();
        lastStatsUpdate = currentTime;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    lastFrameTime = performance.now();
    animationFrame = requestAnimationFrame(animate);
  }

  function stopAnimation() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function handleResize() {
    if (!canvas || !backgroundSystem) return;

    const container = canvas.parentElement;
    if (container) {
      const oldDimensions = { width: canvas.width, height: canvas.height };
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      const newDimensions = { width: canvas.width, height: canvas.height };
      backgroundSystem.handleResize?.(oldDimensions, newDimensions);
    }
  }

  function regenerate() {
    stopAnimation();
    if (backgroundSystem) {
      backgroundSystem.cleanup?.();
    }
    backgroundSystem = null;
    initializeSystem();
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

  onMount(() => {
    initializeSystem();
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    stopAnimation();
    if (backgroundSystem) {
      backgroundSystem.cleanup?.();
    }
    window.removeEventListener("resize", handleResize);
  });
</script>

<div class="autumn-drift-lab">
  <div class="controls themed-scrollbar-accent">
    <div class="header">
      <h2>Autumn Drift Lab</h2>
      <span class="badge">Falling Leaves</span>
    </div>

    <!-- Quality Chips -->
    <ChipGroup label="Quality" variant="row">
      <ChipToggle label="High" active={quality === "high"} color="amber" onclick={() => setQuality("high")} />
      <ChipToggle label="Medium" active={quality === "medium"} color="amber" onclick={() => setQuality("medium")} />
      <ChipToggle label="Low" active={quality === "low"} color="amber" onclick={() => setQuality("low")} />
    </ChipGroup>

    <!-- Layer Chips -->
    <ChipGroup label="Layers">
      <ChipToggle label="Background" icon="fa-fill-drip" active={layers.gradient} color="amber" onclick={() => toggleLayer("gradient")} />
      <ChipToggle label="Leaves" icon="fa-leaf" active={layers.leaves} color="amber" onclick={() => toggleLayer("leaves")} />
    </ChipGroup>

    <!-- Density Chips -->
    <ChipGroup label="Leaf Density" variant="row">
      <ChipToggle label="Sparse" active={densityPreset === "sparse"} color="amber" onclick={() => setDensity("sparse")} />
      <ChipToggle label="Normal" active={densityPreset === "normal"} color="amber" onclick={() => setDensity("normal")} />
      <ChipToggle label="Dense" active={densityPreset === "dense"} color="amber" onclick={() => setDensity("dense")} />
      <ChipToggle label="Storm" active={densityPreset === "storm"} color="amber" onclick={() => setDensity("storm")} />
    </ChipGroup>

    <!-- Wind Chips -->
    <ChipGroup label="Wind" variant="row">
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

  <div class="preview">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .autumn-drift-lab {
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
    background: rgba(15, 15, 25, 0.8);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
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
    border-top: 1px solid rgba(255, 255, 255, 0.06);
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
    background: rgba(255, 255, 255, 0.03);
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
    border-top: 1px solid rgba(255, 255, 255, 0.06);
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
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
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

  .preview {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: #2d1810;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .preview canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (max-width: 800px) {
    .autumn-drift-lab {
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
    .controls,
    .preview {
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
