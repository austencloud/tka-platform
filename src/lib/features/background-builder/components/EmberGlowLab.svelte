<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EmberGlowBackgroundSystem } from "$lib/shared/background/ember-glow/services/EmberGlowBackgroundSystem";
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";
  import type { HeatIntensity, DensityPreset } from "$lib/shared/background/ember-glow/domain/constants/ember-constants";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";
  import {
    getEmberGlowSettings,
    updateEmberGlowSettings,
  } from "../state/background-builder-state.svelte";

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);
  let backgroundSystem: EmberGlowBackgroundSystem | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;

  // Load persisted settings
  const savedSettings = getEmberGlowSettings();

  // Quality settings
  let quality: QualityLevel = $state(savedSettings.quality);

  // Layer toggles
  let layers = $state({ ...savedSettings.layers });

  // Density presets
  let densityPreset: DensityPreset = $state(savedSettings.densityPreset);

  // Heat intensity
  let heatIntensity: HeatIntensity = $state(savedSettings.heatIntensity);

  // Stats
  let stats = $state({
    embers: 0,
    smoke: 0,
    sparks: 0,
    coals: 0,
  });

  function initializeSystem() {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    backgroundSystem = new EmberGlowBackgroundSystem();
    backgroundSystem.setHeatIntensity(heatIntensity);
    backgroundSystem.setDensityPreset(densityPreset);
    const dimensions = { width: canvas.width, height: canvas.height };
    backgroundSystem.initialize(dimensions, quality);
    backgroundSystem.setLayerVisibility(layers);

    updateStats();
    startAnimation();
  }

  function updateStats() {
    if (backgroundSystem) {
      const s = backgroundSystem.getStats();
      stats = {
        embers: s.embers,
        smoke: s.smoke,
        sparks: s.sparks,
        coals: s.coals,
      };
    }
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
      updateStats();
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
    updateEmberGlowSettings({ quality: q });
    if (backgroundSystem) {
      backgroundSystem.setQuality(q);
      updateStats();
    }
  }

  function setDensity(preset: DensityPreset) {
    densityPreset = preset;
    updateEmberGlowSettings({ densityPreset: preset });
    if (backgroundSystem) {
      backgroundSystem.setDensityPreset(preset);
      updateStats();
    }
  }

  function setHeat(intensity: HeatIntensity) {
    heatIntensity = intensity;
    updateEmberGlowSettings({ heatIntensity: intensity });
    if (backgroundSystem) {
      backgroundSystem.setHeatIntensity(intensity);
      updateStats();
    }
  }

  function toggleLayer(layer: keyof typeof layers) {
    layers = { ...layers, [layer]: !layers[layer] };
    updateEmberGlowSettings({ layers: { ...layers } });
    if (backgroundSystem) {
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

<div class="ember-glow-lab">
  <div class="controls">
    <div class="header">
      <h2>Ember Glow Lab</h2>
      <span class="badge">Fire Particles</span>
    </div>

    <!-- Quality Chips -->
    <ChipGroup label="Quality" variant="row">
      <ChipToggle label="High" active={quality === "high"} color="amber" onclick={() => setQuality("high")} />
      <ChipToggle label="Medium" active={quality === "medium"} color="amber" onclick={() => setQuality("medium")} />
      <ChipToggle label="Low" active={quality === "low"} color="amber" onclick={() => setQuality("low")} />
    </ChipGroup>

    <!-- Layer Chips -->
    <ChipGroup label="Layers">
      <ChipToggle label="Base" icon="fa-square" active={layers.gradient} color="amber" onclick={() => toggleLayer("gradient")} />
      <ChipToggle label="Coal Bed" icon="fa-fire-burner" active={layers.coalBed} color="amber" onclick={() => toggleLayer("coalBed")} />
      <ChipToggle label="Smoke" icon="fa-cloud" active={layers.smoke} color="amber" onclick={() => toggleLayer("smoke")} />
      <ChipToggle label="Embers" icon="fa-fire" active={layers.embers} color="amber" onclick={() => toggleLayer("embers")} />
      <ChipToggle label="Sparks" icon="fa-sparkle" active={layers.sparks} color="amber" onclick={() => toggleLayer("sparks")} />
    </ChipGroup>

    <!-- Enhancement Chips -->
    <ChipGroup label="Enhancements">
      <ChipToggle label="Vignette" icon="fa-circle" active={layers.vignette} color="amber" onclick={() => toggleLayer("vignette")} />
      <ChipToggle label="Bottom Glow" icon="fa-sun" active={layers.bottomGlow} color="amber" onclick={() => toggleLayer("bottomGlow")} />
      <ChipToggle label="Spark Trails" icon="fa-comet" active={layers.sparkTrails} color="amber" onclick={() => toggleLayer("sparkTrails")} />
      <ChipToggle label="Breathing" icon="fa-wind" active={layers.breathing} color="amber" onclick={() => toggleLayer("breathing")} />
    </ChipGroup>

    <!-- Density Chips -->
    <ChipGroup label="Density" variant="row">
      <ChipToggle label="Sparse" active={densityPreset === "sparse"} color="amber" onclick={() => setDensity("sparse")} />
      <ChipToggle label="Normal" active={densityPreset === "normal"} color="amber" onclick={() => setDensity("normal")} />
      <ChipToggle label="Dense" active={densityPreset === "dense"} color="amber" onclick={() => setDensity("dense")} />
      <ChipToggle label="Inferno" active={densityPreset === "inferno"} color="amber" onclick={() => setDensity("inferno")} />
    </ChipGroup>

    <!-- Heat Chips -->
    <ChipGroup label="Heat Intensity" variant="row">
      <ChipToggle label="Smolder" active={heatIntensity === "smolder"} color="amber" onclick={() => setHeat("smolder")} />
      <ChipToggle label="Warm" active={heatIntensity === "warm"} color="amber" onclick={() => setHeat("warm")} />
      <ChipToggle label="Hot" active={heatIntensity === "hot"} color="amber" onclick={() => setHeat("hot")} />
      <ChipToggle label="Blazing" active={heatIntensity === "blazing"} color="amber" onclick={() => setHeat("blazing")} />
    </ChipGroup>

    <!-- Regenerate -->
    <button class="action-btn" onclick={regenerate}>
      <i class="fas fa-fire-flame-curved"></i>
      Regenerate
    </button>

    <!-- Stats -->
    <div class="stats-section">
      <span class="label">Scene Stats</span>
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-value">{stats.coals}</span>
          <span class="stat-label">Coals</span>
        </div>
        <div class="stat">
          <span class="stat-value">{stats.embers}</span>
          <span class="stat-label">Embers</span>
        </div>
        <div class="stat">
          <span class="stat-value">{stats.smoke}</span>
          <span class="stat-label">Smoke</span>
        </div>
        <div class="stat">
          <span class="stat-value">{stats.sparks}</span>
          <span class="stat-label">Sparks</span>
        </div>
      </div>
    </div>

    <!-- Info -->
    <div class="info-section">
      <span class="label">About</span>
      <p class="info-text">
        A warm, cozy atmosphere with a glowing coal bed at the bottom,
        rising embers, drifting smoke particles, and bright sparks.
        Heat intensity affects colors, speed, and glow. Density controls
        particle count. The coal bed pulses with offset phases and random
        flare hotspots. Enhancements add vignette, bottom glow, spark trails,
        and breathing (scene-wide pulsing synced with the coals).
      </p>
    </div>

    <!-- Progress Pills -->
    <div class="progress-section">
      <span class="label">Features</span>
      <div class="progress-pills">
        <span class="pill complete">Dark Gradient</span>
        <span class="pill complete">Coal Bed</span>
        <span class="pill complete">Rising Embers</span>
        <span class="pill complete">Glow Effects</span>
        <span class="pill complete">Flicker Animation</span>
        <span class="pill complete">Smoke Particles</span>
        <span class="pill complete">Bright Sparks</span>
        <span class="pill complete">Heat Intensity</span>
        <span class="pill complete">Density Presets</span>
        <span class="pill complete">Quality Levels</span>
        <span class="pill complete">Vignette Effect</span>
        <span class="pill complete">Bottom Glow</span>
        <span class="pill complete">Spark Trails</span>
        <span class="pill complete">Breathing Effect</span>
        <span class="pill complete">Playful Embers</span>
        <span class="pill complete">Billowing Smoke</span>
        <span class="pill complete">Phoenix Easter Egg</span>
      </div>
    </div>
  </div>

  <div class="preview">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .ember-glow-lab {
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

    /* Themed scrollbar */
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-accent) var(--scrollbar-track);
  }

  .controls::-webkit-scrollbar {
    width: 8px;
  }

  .controls::-webkit-scrollbar-track {
    background: var(--scrollbar-track, transparent);
    border-radius: 4px;
  }

  .controls::-webkit-scrollbar-thumb {
    background: var(--scrollbar-accent, rgba(255, 255, 255, 0.2));
    border-radius: 4px;
  }

  .controls::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-accent-hover, rgba(255, 255, 255, 0.35));
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
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(251, 191, 36, 0.3));
    border: 1px solid rgba(251, 191, 36, 0.4);
    border-radius: 20px;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    color: #fbbf24;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .label {
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
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
    box-shadow: 0 8px 20px rgba(245, 158, 11, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
  }

  .action-btn:focus-visible {
    outline: 2px solid #fcd34d;
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
    grid-template-columns: repeat(4, 1fr);
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
    color: #fbbf24;
  }

  .stat-label {
    font-size: var(--font-size-compact, 0.75rem);
    color: #9ca3af;
    text-transform: uppercase;
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .info-text {
    margin: 0;
    font-size: var(--font-size-compact, 0.75rem);
    color: #9ca3af;
    line-height: 1.5;
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
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
  }

  .pill.complete {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .pill.active {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    animation: pulse 2s infinite;
  }

  .pill.pending {
    background: rgba(255, 255, 255, 0.05);
    color: #9ca3af;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .preview {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: #1a0a0a;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .preview canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (max-width: 800px) {
    .ember-glow-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }
  }

  /* Accessibility: Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .action-btn,
    .pill.active {
      transition: none;
      animation: none;
    }
  }

  /* Accessibility: High contrast */
  @media (prefers-contrast: high) {
    .controls {
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .preview {
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .stat {
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .label,
    .stat-label,
    .info-text {
      color: #d1d5db;
    }
  }
</style>
