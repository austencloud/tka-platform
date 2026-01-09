<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { SakuraDriftBackgroundSystem, type CherryBlossomLayers } from "$lib/shared/background/sakura-drift/services/SakuraDriftBackgroundSystem";
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";
  import { type TimeOfDay, getTimeOfDayPreset } from "$lib/shared/background/sakura-drift/domain/constants/time-of-day-presets";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);
  let backgroundSystem: SakuraDriftBackgroundSystem | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;

  // Quality settings
  let quality: QualityLevel = $state("high");

  // Time of day
  let timeOfDay: TimeOfDay = $state("twilight");

  // Layer toggles - expanded for all features
  let layers = $state<CherryBlossomLayers>({
    gradient: true,
    petals: true,
    petalsFar: true,
    petalsMid: true,
    petalsNear: true,
    trails: false,
    accumulation: false,
    vortex: false,
    moon: false,
    stars: false,
    lightRays: false,
    trees: false,
    lanterns: false,
    reflection: false,
  });

  // Density presets
  type DensityPreset = "sparse" | "normal" | "dense" | "ultra";
  let densityPreset: DensityPreset = $state("normal");

  // Wind presets
  type WindPreset = "calm" | "gentle" | "breezy" | "gusty";
  let windPreset: WindPreset = $state("gentle");

  // Stats
  let stats = $state({ petals: 0, flowers: 0 });
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

    backgroundSystem = new SakuraDriftBackgroundSystem();
    const dimensions = { width: canvas.width, height: canvas.height };
    backgroundSystem.initialize(dimensions, quality);

    // Apply time of day
    backgroundSystem.setTimeOfDay(timeOfDay);

    // Sync layers from preset defaults
    layers = backgroundSystem.getLayerVisibility();

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

  function setTimeOfDayMode(mode: TimeOfDay) {
    timeOfDay = mode;
    if (backgroundSystem) {
      backgroundSystem.setTimeOfDay(mode);
      // Sync layers from new preset defaults
      layers = backgroundSystem.getLayerVisibility();
    }
  }

  function setDensity(preset: DensityPreset) {
    densityPreset = preset;
    regenerate();
  }

  function setWindPreset(preset: WindPreset) {
    windPreset = preset;
    // Wind presets could be applied via the system if we add that capability
  }

  function toggleLayer(layer: keyof CherryBlossomLayers) {
    layers = { ...layers, [layer]: !layers[layer] };
    if (backgroundSystem?.setLayerVisibility) {
      backgroundSystem.setLayerVisibility(layers);
    }
  }

  function triggerGust() {
    if (backgroundSystem?.triggerGust) {
      backgroundSystem.triggerGust();
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

<div class="cherry-blossom-lab">
  <div class="controls">
    <div class="header">
      <h2>Cherry Blossom Lab</h2>
      <span class="badge">Petals</span>
    </div>

    <!-- Time of Day Selector -->
    <ChipGroup label="Time of Day" variant="row">
      <ChipToggle
        label="Twilight"
        icon="fa-cloud-moon"
        active={timeOfDay === "twilight"}
        color="default"
        onclick={() => setTimeOfDayMode("twilight")}
      />
      <ChipToggle
        label="Golden Hour"
        icon="fa-sun"
        active={timeOfDay === "goldenHour"}
        color="amber"
        onclick={() => setTimeOfDayMode("goldenHour")}
      />
      <ChipToggle
        label="Night"
        icon="fa-moon"
        active={timeOfDay === "night"}
        color="cyan"
        onclick={() => setTimeOfDayMode("night")}
      />
    </ChipGroup>

    <!-- Quality Chips -->
    <ChipGroup label="Quality" variant="row">
      <ChipToggle label="High" active={quality === "high"} color="rose" onclick={() => setQuality("high")} />
      <ChipToggle label="Medium" active={quality === "medium"} color="rose" onclick={() => setQuality("medium")} />
      <ChipToggle label="Low" active={quality === "low"} color="rose" onclick={() => setQuality("low")} />
    </ChipGroup>

    <!-- Core Layer Toggles -->
    <ChipGroup label="Core Layers">
      <ChipToggle label="Gradient" icon="fa-fill-drip" active={layers.gradient} color="rose" onclick={() => toggleLayer("gradient")} />
      <ChipToggle label="Petals" icon="fa-leaf" active={layers.petals} color="rose" onclick={() => toggleLayer("petals")} />
    </ChipGroup>

    <!-- Parallax Depth Toggles -->
    <ChipGroup label="Petal Depth">
      <ChipToggle label="Far" active={layers.petalsFar} color="default" onclick={() => toggleLayer("petalsFar")} />
      <ChipToggle label="Mid" active={layers.petalsMid} color="default" onclick={() => toggleLayer("petalsMid")} />
      <ChipToggle label="Near" active={layers.petalsNear} color="default" onclick={() => toggleLayer("petalsNear")} />
    </ChipGroup>

    <!-- Environmental Layers -->
    <ChipGroup label="Environment">
      <ChipToggle label="Moon" icon="fa-moon" active={layers.moon} color="cyan" onclick={() => toggleLayer("moon")} />
      <ChipToggle label="Stars" icon="fa-star" active={layers.stars} color="cyan" onclick={() => toggleLayer("stars")} />
      <ChipToggle label="Light Rays" icon="fa-sun" active={layers.lightRays} color="amber" onclick={() => toggleLayer("lightRays")} />
      <ChipToggle label="Trees" icon="fa-tree" active={layers.trees} color="emerald" onclick={() => toggleLayer("trees")} />
      <ChipToggle label="Lanterns" icon="fa-lightbulb" active={layers.lanterns} color="amber" onclick={() => toggleLayer("lanterns")} />
      <ChipToggle label="Reflection" icon="fa-water" active={layers.reflection} color="cyan" onclick={() => toggleLayer("reflection")} />
    </ChipGroup>

    <!-- Effect Layers -->
    <ChipGroup label="Effects">
      <ChipToggle label="Trails" icon="fa-wind" active={layers.trails} color="rose" onclick={() => toggleLayer("trails")} />
      <ChipToggle label="Accumulation" icon="fa-layer-group" active={layers.accumulation} color="rose" onclick={() => toggleLayer("accumulation")} />
      <ChipToggle label="Vortex" icon="fa-hurricane" active={layers.vortex} color="rose" onclick={() => toggleLayer("vortex")} />
    </ChipGroup>

    <!-- Density Chips -->
    <ChipGroup label="Petal Density" variant="row">
      <ChipToggle label="Sparse" active={densityPreset === "sparse"} color="rose" onclick={() => setDensity("sparse")} />
      <ChipToggle label="Normal" active={densityPreset === "normal"} color="rose" onclick={() => setDensity("normal")} />
      <ChipToggle label="Dense" active={densityPreset === "dense"} color="rose" onclick={() => setDensity("dense")} />
      <ChipToggle label="Ultra" active={densityPreset === "ultra"} color="rose" onclick={() => setDensity("ultra")} />
    </ChipGroup>

    <!-- Wind Chips -->
    <ChipGroup label="Wind" variant="row">
      <ChipToggle label="Calm" active={windPreset === "calm"} color="default" onclick={() => setWindPreset("calm")} />
      <ChipToggle label="Gentle" active={windPreset === "gentle"} color="default" onclick={() => setWindPreset("gentle")} />
      <ChipToggle label="Breezy" active={windPreset === "breezy"} color="default" onclick={() => setWindPreset("breezy")} />
      <ChipToggle label="Gusty" active={windPreset === "gusty"} color="default" onclick={() => setWindPreset("gusty")} />
    </ChipGroup>

    <!-- Actions -->
    <div class="action-row">
      <button class="action-btn gust-btn" onclick={triggerGust}>
        <i class="fas fa-wind"></i>
        Trigger Gust
      </button>
      <button class="action-btn" onclick={regenerate}>
        <i class="fas fa-sparkles"></i>
        Regenerate
      </button>
    </div>

    <!-- Stats -->
    <div class="stats-section">
      <span class="label">Scene Stats</span>
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-value">{stats.petals}</span>
          <span class="stat-label">Petals</span>
        </div>
        <div class="stat">
          <span class="stat-value">{stats.flowers}</span>
          <span class="stat-label">Flowers</span>
        </div>
      </div>
    </div>

    <!-- Progress Pills -->
    <div class="progress-section">
      <span class="label">Features</span>
      <div class="progress-pills">
        <span class="pill complete">Time of Day</span>
        <span class="pill complete">Twilight Gradient</span>
        <span class="pill complete">Tumble Physics</span>
        <span class="pill complete">Wind Gusts</span>
        <span class="pill complete">Flower Rendering</span>
        <span class="pill complete">Layer Controls</span>
        <span class="pill active">Parallax Depth</span>
        <span class="pill pending">Moon & Stars</span>
        <span class="pill pending">Light Rays</span>
        <span class="pill pending">Tree Silhouettes</span>
        <span class="pill pending">Lanterns</span>
      </div>
    </div>
  </div>

  <div class="preview">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .cherry-blossom-lab {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 20px;
    height: 100%;
    min-height: 600px;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
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
    background: linear-gradient(135deg, rgba(244, 63, 94, 0.3), rgba(251, 113, 133, 0.3));
    border: 1px solid rgba(251, 113, 133, 0.4);
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #fb7185;
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

  .action-row {
    display: flex;
    gap: 10px;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #f43f5e, #e11d48);
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
    box-shadow: 0 8px 20px rgba(244, 63, 94, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
  }

  .gust-btn {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
  }

  .gust-btn:hover {
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
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
    grid-template-columns: repeat(2, 1fr);
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
    color: #fb7185;
  }

  .stat-label {
    font-size: 0.7rem;
    color: #6b7280;
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
    font-size: 0.7rem;
    font-weight: 500;
  }

  .pill.complete {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .pill.active {
    background: rgba(244, 63, 94, 0.2);
    color: #fb7185;
    animation: pulse 2s infinite;
  }

  .pill.pending {
    background: rgba(255, 255, 255, 0.05);
    color: #6b7280;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .preview {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: #2a1f2e;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .preview canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (max-width: 800px) {
    .cherry-blossom-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }

    .action-row {
      flex-direction: column;
    }
  }
</style>
