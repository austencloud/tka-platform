<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    FireflyForestBackgroundSystem,
    type FireflyForestLayers,
  } from "$lib/shared/background/firefly-forest/services/FireflyForestBackgroundSystem";
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);
  let backgroundSystem: FireflyForestBackgroundSystem | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;

  // Quality settings
  let quality: QualityLevel = $state("high");

  // Layer toggles
  let layers = $state<FireflyForestLayers>({
    gradient: true,
    stars: true,
    shootingStars: true,
    trees: true,
    fireflies: true,
  });

  // Stats display
  let stats = $state({ fireflies: 0, stars: 0, hasShootingStar: false });
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
      backgroundSystem = new FireflyForestBackgroundSystem();

      const dimensions = { width: canvas.width, height: canvas.height };
      backgroundSystem.initialize(dimensions, quality);

      // Apply initial layer visibility
      backgroundSystem.setLayerVisibility(layers);

      // Fetch initial stats
      stats = backgroundSystem.getStats();

      startAnimation();
    } catch (error) {
      console.error("Failed to initialize Firefly Forest Lab:", error);
    }
  }

  function startAnimation() {
    if (!canvas || !backgroundSystem) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastFrameTime;
      const frameMultiplier = deltaTime / 16.67;
      lastFrameTime = currentTime;

      const dimensions = { width: canvas!.width, height: canvas!.height };
      backgroundSystem!.update(dimensions, frameMultiplier);
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      backgroundSystem!.draw(ctx, dimensions);

      // Update stats every second
      if (currentTime - lastStatsUpdate > 1000) {
        stats = backgroundSystem!.getStats();
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
      backgroundSystem.handleResize(oldDimensions, newDimensions);
    }
  }

  function regenerate() {
    stopAnimation();
    if (backgroundSystem) {
      backgroundSystem.cleanup();
    }
    backgroundSystem = null;
    initializeSystem();
  }

  function setQuality(q: QualityLevel) {
    quality = q;
    if (backgroundSystem) {
      backgroundSystem.setQuality(q);
      stats = backgroundSystem.getStats();
    }
  }

  function toggleLayer(layer: keyof FireflyForestLayers) {
    layers[layer] = !layers[layer];
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
      backgroundSystem.cleanup();
    }
    window.removeEventListener("resize", handleResize);
  });
</script>

<div class="firefly-forest-lab">
  <div class="controls">
    <div class="header">
      <h2>Firefly Forest Lab</h2>
      <span class="badge">Interactive</span>
    </div>

    <!-- Quality Chips -->
    <div class="control-group">
      <span class="label">Quality</span>
      <div class="chip-row">
        <button
          class="chip"
          class:active={quality === "high"}
          onclick={() => setQuality("high")}
        >
          High
        </button>
        <button
          class="chip"
          class:active={quality === "medium"}
          onclick={() => setQuality("medium")}
        >
          Medium
        </button>
        <button
          class="chip"
          class:active={quality === "low"}
          onclick={() => setQuality("low")}
        >
          Low
        </button>
      </div>
    </div>

    <!-- Layer Chips -->
    <div class="control-group">
      <span class="label">Layers</span>
      <div class="chip-grid">
        <button
          class="chip layer-chip"
          class:active={layers.gradient}
          onclick={() => toggleLayer("gradient")}
        >
          <i class="fas fa-fill-drip"></i>
          Gradient
        </button>
        <button
          class="chip layer-chip"
          class:active={layers.stars}
          onclick={() => toggleLayer("stars")}
        >
          <i class="fas fa-star"></i>
          Stars
        </button>
        <button
          class="chip layer-chip"
          class:active={layers.shootingStars}
          onclick={() => toggleLayer("shootingStars")}
        >
          <i class="fas fa-meteor"></i>
          Shooting Stars
        </button>
        <button
          class="chip layer-chip"
          class:active={layers.trees}
          onclick={() => toggleLayer("trees")}
        >
          <i class="fas fa-tree"></i>
          Trees
        </button>
        <button
          class="chip layer-chip"
          class:active={layers.fireflies}
          onclick={() => toggleLayer("fireflies")}
        >
          <i class="fas fa-lightbulb"></i>
          Fireflies
        </button>
      </div>
    </div>

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
        <div class="stat shooting-star-stat" class:active={stats.hasShootingStar}>
          <i class="fas fa-meteor"></i>
          <span class="stat-label">{stats.hasShootingStar ? "Active!" : "Waiting..."}</span>
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
    background: linear-gradient(135deg, rgba(132, 204, 22, 0.3), rgba(163, 230, 53, 0.3));
    border: 1px solid rgba(163, 230, 53, 0.4);
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #a3e635;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .chip-row {
    display: flex;
    gap: 8px;
  }

  .chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    color: #9ca3af;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .chip:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: #e5e7eb;
  }

  .chip.active {
    background: rgba(132, 204, 22, 0.2);
    border-color: rgba(132, 204, 22, 0.5);
    color: #bef264;
    box-shadow: 0 0 12px rgba(132, 204, 22, 0.2);
  }

  .layer-chip {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .layer-chip i {
    font-size: 0.75rem;
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

  .shooting-star-stat {
    grid-column: span 2;
    flex-direction: row;
    gap: 8px;
    color: #6b7280;
  }

  .shooting-star-stat i {
    font-size: 1rem;
    opacity: 0.5;
    transition: all 0.3s ease;
  }

  .shooting-star-stat.active {
    background: rgba(250, 204, 21, 0.1);
  }

  .shooting-star-stat.active i {
    color: #facc15;
    opacity: 1;
    animation: shoot 0.5s ease-out;
  }

  .shooting-star-stat.active .stat-label {
    color: #facc15;
  }

  @keyframes shoot {
    0% { transform: translateX(-10px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }

  .preview {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: #0a1628;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .preview canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (max-width: 800px) {
    .firefly-forest-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }

    .chip-row {
      flex-wrap: wrap;
    }
  }
</style>
