<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    FireflyForestBackgroundSystem,
    type FireflyForestLayers,
  } from "$lib/shared/background/firefly-forest/services/FireflyForestBackgroundSystem";
  import type { TreeTypeVisibility } from "$lib/shared/background/firefly-forest/services/TreeSilhouetteSystem";
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;

  // System
  let system: FireflyForestBackgroundSystem | null = $state(null);
  let layers = $state<FireflyForestLayers>({
    gradient: true,
    stars: true,
    moon: true,
    shootingStars: true,
    trees: true,
    grass: true,
    fireflies: true,
  });

  // Tree type visibility
  let treeTypes = $state<TreeTypeVisibility>({
    pine: true,
    fir: true,
    spruce: true,
    oak: true,
    maple: true,
    poplar: true,
    bare: true,
  });

  // Quality setting
  let quality: QualityLevel = $state("high");

  // Stats display
  let stats = $state<{
    fireflies: number;
    stars: number;
    hasShootingStar: boolean;
  }>({
    fireflies: 0,
    stars: 0,
    hasShootingStar: false,
  });
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

    try {
      system = new FireflyForestBackgroundSystem();
      const dimensions = { width: canvas.width, height: canvas.height };
      system.initialize(dimensions, quality);
      system.setLayerVisibility(layers);

      const systemStats = system.getStats();
      stats = { ...stats, ...systemStats };

      startAnimation();
    } catch (error) {
      console.error("Failed to initialize Firefly Forest Lab:", error);
    }
  }

  function startAnimation() {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (currentTime: number) => {
      // Guard against destroyed component
      if (!canvas || !system) return;

      const deltaTime = currentTime - lastFrameTime;
      const frameMultiplier = deltaTime / 16.67;
      lastFrameTime = currentTime;

      const dimensions = { width: canvas.width, height: canvas.height };

      system.update(dimensions, frameMultiplier);
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      system.draw(ctx, dimensions);

      // Update stats every second
      if (currentTime - lastStatsUpdate > 1000 && system) {
        const systemStats = system.getStats();
        stats = { ...stats, ...systemStats };
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
    if (!canvas) return;

    const container = canvas.parentElement;
    if (container) {
      const oldDimensions = { width: canvas.width, height: canvas.height };
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      const newDimensions = { width: canvas.width, height: canvas.height };

      if (system) {
        system.handleResize(oldDimensions, newDimensions);
      }
    }
  }

  function cleanup() {
    if (system) {
      system.cleanup();
      system = null;
    }
  }

  function regenerate() {
    stopAnimation();
    cleanup();
    initializeSystem();
  }

  function setQuality(q: QualityLevel) {
    quality = q;
    if (system) {
      system.setQuality(q);
      const systemStats = system.getStats();
      stats = { ...stats, ...systemStats };
    }
  }

  function toggleLayer(layer: keyof FireflyForestLayers) {
    layers[layer] = !layers[layer];
    if (system) {
      system.setLayerVisibility(layers);
    }
  }

  function toggleTreeType(type: keyof TreeTypeVisibility) {
    treeTypes[type] = !treeTypes[type];
    if (system) {
      system.setTreeVisibility(treeTypes);
      system.regenerateTrees();
    }
  }

  onMount(() => {
    initializeSystem();
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    stopAnimation();
    cleanup();
    window.removeEventListener("resize", handleResize);
  });
</script>

<div class="firefly-forest-lab">
  <div class="controls">
    <div class="header">
      <h2>Firefly Forest Lab</h2>
      <span class="badge">Classic</span>
    </div>

    <!-- Quality Chips -->
    <ChipGroup label="Quality" variant="row">
      <ChipToggle label="High" active={quality === "high"} color="lime" onclick={() => setQuality("high")} />
      <ChipToggle label="Medium" active={quality === "medium"} color="lime" onclick={() => setQuality("medium")} />
      <ChipToggle label="Low" active={quality === "low"} color="lime" onclick={() => setQuality("low")} />
    </ChipGroup>

    <!-- Layer Chips -->
    <ChipGroup label="Layers">
      <ChipToggle label="Gradient" icon="fa-fill-drip" active={layers.gradient} color="lime" onclick={() => toggleLayer("gradient")} />
      <ChipToggle label="Stars" icon="fa-star" active={layers.stars} color="lime" onclick={() => toggleLayer("stars")} />
      <ChipToggle label="Moon" icon="fa-moon" active={layers.moon} color="lime" onclick={() => toggleLayer("moon")} />
      <ChipToggle label="Shooting Stars" icon="fa-meteor" active={layers.shootingStars} color="lime" onclick={() => toggleLayer("shootingStars")} />
      <ChipToggle label="Trees" icon="fa-tree" active={layers.trees} color="lime" onclick={() => toggleLayer("trees")} />
      <ChipToggle label="Grass" icon="fa-seedling" active={layers.grass} color="lime" onclick={() => toggleLayer("grass")} />
      <ChipToggle label="Fireflies" icon="fa-lightbulb" active={layers.fireflies} color="lime" onclick={() => toggleLayer("fireflies")} />
    </ChipGroup>

    <!-- Tree Type Chips -->
    <ChipGroup label="Tree Types">
      <ChipToggle label="Pine" active={treeTypes.pine} color="lime" onclick={() => toggleTreeType("pine")} />
      <ChipToggle label="Fir" active={treeTypes.fir} color="lime" onclick={() => toggleTreeType("fir")} />
      <ChipToggle label="Spruce" active={treeTypes.spruce} color="lime" onclick={() => toggleTreeType("spruce")} />
      <ChipToggle label="Oak" active={treeTypes.oak} color="lime" onclick={() => toggleTreeType("oak")} />
      <ChipToggle label="Maple" active={treeTypes.maple} color="lime" onclick={() => toggleTreeType("maple")} />
      <ChipToggle label="Poplar" active={treeTypes.poplar} color="lime" onclick={() => toggleTreeType("poplar")} />
      <ChipToggle label="Bare" active={treeTypes.bare} color="lime" onclick={() => toggleTreeType("bare")} />
    </ChipGroup>

    <!-- Regenerate -->
    <button class="action-btn" onclick={regenerate}>
      <i class="fas fa-rotate"></i>
      Regenerate
    </button>

    <!-- Stats -->
    <div class="stats-section">
      <span class="label">Scene Stats</span>
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-value">{stats.fireflies}</span>
          <span class="stat-label">Fireflies</span>
        </div>
        <div class="stat">
          <span class="stat-value">{stats.stars}</span>
          <span class="stat-label">Stars</span>
        </div>
        <div class="stat easter-egg-stat" class:active={stats.hasShootingStar}>
          <i class="fas fa-meteor"></i>
          <span class="stat-label">{stats.hasShootingStar ? "Shooting!" : "Waiting..."}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="preview">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .firefly-forest-lab {
    display: grid;
    grid-template-columns: 320px 1fr;
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
    background: linear-gradient(135deg, rgba(132, 204, 22, 0.3), rgba(163, 230, 53, 0.3));
    border: 1px solid rgba(163, 230, 53, 0.4);
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #a3e635;
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
    background: linear-gradient(135deg, #84cc16, #65a30d);
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
    box-shadow: 0 8px 20px rgba(132, 204, 22, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
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
    color: #bef264;
  }

  .stat-label {
    font-size: 0.7rem;
    color: #6b7280;
    text-transform: uppercase;
  }

  .easter-egg-stat {
    flex-direction: row;
    gap: 8px;
    color: #6b7280;
  }

  .easter-egg-stat i {
    font-size: 1rem;
    opacity: 0.5;
    transition: all 0.3s ease;
  }

  .easter-egg-stat.active {
    background: rgba(250, 204, 21, 0.1);
  }

  .easter-egg-stat.active i {
    color: #facc15;
    opacity: 1;
  }

  .easter-egg-stat.active .stat-label {
    color: #facc15;
  }

  .preview {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: linear-gradient(to bottom, #0a1628 0%, #162033 50%, #1a2a3d 100%);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .preview canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (max-width: 900px) {
    .firefly-forest-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }
  }
</style>
