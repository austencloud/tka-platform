<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { NightSkyBackgroundSystem } from "$lib/shared/background/night-sky/services/NightSkyBackgroundSystem";
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);
  let backgroundSystem: NightSkyBackgroundSystem | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;

  // Quality settings
  let quality: QualityLevel = $state("high");

  // Layer toggles
  let layers = $state({
    stars: true,
    moon: true,
    nebula: true,
    aurora: true, // 2036 Vision - flowing curtains
    milkyWay: true, // 2036 Vision - particle river
  });

  // Star density presets
  type DensityPreset = "sparse" | "normal" | "dense" | "ultra";
  let densityPreset: DensityPreset = $state("normal");

  const densityMultipliers: Record<DensityPreset, number> = {
    sparse: 0.5,
    normal: 1.0,
    dense: 1.8,
    ultra: 3.0,
  };

  function initializeSystem() {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    backgroundSystem = NightSkyBackgroundSystem.create();
    const dimensions = { width: canvas.width, height: canvas.height };
    backgroundSystem.initialize(dimensions, quality);
    startAnimation();
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

  function toggleLayer(layer: keyof typeof layers) {
    // Reassign entire object to ensure Svelte 5 reactivity triggers
    layers = { ...layers, [layer]: !layers[layer] };
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

<div class="night-sky-lab">
  <div class="controls">
    <div class="header">
      <h2>Night Sky Lab</h2>
      <span class="badge">2036 Vision</span>
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
          class:active={layers.stars}
          onclick={() => toggleLayer("stars")}
        >
          <i class="fas fa-star"></i>
          Stars
        </button>
        <button
          class="chip layer-chip"
          class:active={layers.moon}
          onclick={() => toggleLayer("moon")}
        >
          <i class="fas fa-moon"></i>
          Moon
        </button>
        <button
          class="chip layer-chip"
          class:active={layers.nebula}
          onclick={() => toggleLayer("nebula")}
        >
          <i class="fas fa-cloud"></i>
          Nebula
        </button>
        <button
          class="chip layer-chip"
          class:active={layers.aurora}
          onclick={() => toggleLayer("aurora")}
        >
          <i class="fas fa-wind"></i>
          Aurora
        </button>
        <button
          class="chip layer-chip"
          class:active={layers.milkyWay}
          onclick={() => toggleLayer("milkyWay")}
        >
          <i class="fas fa-galaxy"></i>
          Milky Way
        </button>
      </div>
    </div>

    <!-- Density Chips -->
    <div class="control-group">
      <span class="label">Star Density</span>
      <div class="chip-row">
        <button
          class="chip"
          class:active={densityPreset === "sparse"}
          onclick={() => setDensity("sparse")}
        >
          Sparse
        </button>
        <button
          class="chip"
          class:active={densityPreset === "normal"}
          onclick={() => setDensity("normal")}
        >
          Normal
        </button>
        <button
          class="chip"
          class:active={densityPreset === "dense"}
          onclick={() => setDensity("dense")}
        >
          Dense
        </button>
        <button
          class="chip"
          class:active={densityPreset === "ultra"}
          onclick={() => setDensity("ultra")}
        >
          Ultra
        </button>
      </div>
    </div>

    <!-- Regenerate -->
    <button class="action-btn" onclick={regenerate}>
      <i class="fas fa-sparkles"></i>
      Regenerate
    </button>

    <!-- Progress Pills -->
    <div class="progress-section">
      <span class="label">Progress</span>
      <div class="progress-pills">
        <span class="pill complete">Clean Canvas</span>
        <span class="pill complete">Lab Ready</span>
        <span class="pill complete">Scintillation</span>
        <span class="pill complete">Nebula</span>
        <span class="pill complete">Aurora</span>
        <span class="pill complete">Milky Way</span>
        <span class="pill active">Meteors</span>
      </div>
    </div>
  </div>

  <div class="preview">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .night-sky-lab {
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
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3));
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #a78bfa;
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

  .chip.active,
  .chip.active:hover {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.5);
    color: #a5b4fc;
    box-shadow: 0 0 12px rgba(99, 102, 241, 0.2);
  }

  .layer-chip {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .layer-chip i {
    font-size: 0.75rem;
  }

  /* Explicit active state for layer chips - fixes mobile touch rendering */
  .layer-chip.active {
    background: rgba(99, 102, 241, 0.2) !important;
    border-color: rgba(99, 102, 241, 0.5) !important;
    color: #a5b4fc !important;
    box-shadow: 0 0 12px rgba(99, 102, 241, 0.2);
  }

  .layer-chip:not(.active) {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
    color: #9ca3af;
    box-shadow: none;
  }

  .layer-chip.coming-soon {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .layer-chip.coming-soon::after {
    content: "Soon";
    font-size: 0.6rem;
    padding: 2px 5px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    margin-left: 4px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
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
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
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
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
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
    background: #050510;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .preview canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (max-width: 800px) {
    .night-sky-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }

    .chip-row {
      flex-wrap: wrap;
    }
  }
</style>
