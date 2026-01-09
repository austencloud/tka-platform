<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { AuroraBorealisBackgroundSystem } from "$lib/shared/background/aurora/services/AuroraBorealisBackgroundSystem";
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";

  // Canvas reference
  let canvas: HTMLCanvasElement | null = $state(null);
  let backgroundSystem: AuroraBorealisBackgroundSystem | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;

  // Quality settings
  let quality: QualityLevel = $state("high");

  // Layer toggles
  let layers = $state({
    gradient: true,
    waves: true,
    enhancedEffects: true,
  });

  // Color palette options
  type ColorPalette = "classic" | "purple" | "blue" | "rainbow";
  let colorPalette: ColorPalette = $state("classic");

  // Intensity presets
  type IntensityPreset = "subtle" | "normal" | "vivid" | "intense";
  let intensityPreset: IntensityPreset = $state("normal");

  // Stats
  let stats = $state({ waves: 0 });

  function initializeSystem() {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    backgroundSystem = new AuroraBorealisBackgroundSystem();
    const dimensions = { width: canvas.width, height: canvas.height };
    backgroundSystem.initialize(dimensions, quality);

    // Apply layer visibility if method exists
    if (backgroundSystem.setLayerVisibility) {
      backgroundSystem.setLayerVisibility(layers);
    }

    // Update stats
    updateStats();

    startAnimation();
  }

  function updateStats() {
    if (backgroundSystem?.getStats) {
      stats = backgroundSystem.getStats();
    } else {
      // Fallback: estimate from quality
      const waveCounts: Record<QualityLevel, number> = {
        high: 12,
        medium: 10,
        low: 6,
        minimal: 4,
        "ultra-minimal": 2,
      };
      stats = { waves: waveCounts[quality] || 10 };
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
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
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

  function setColorPalette(palette: ColorPalette) {
    colorPalette = palette;
    if (backgroundSystem?.setColorPalette) {
      backgroundSystem.setColorPalette(palette);
    }
  }

  function setIntensity(preset: IntensityPreset) {
    intensityPreset = preset;
    if (backgroundSystem?.setIntensity) {
      backgroundSystem.setIntensity(preset);
    }
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

<div class="aurora-lab">
  <div class="controls">
    <div class="header">
      <h2>Aurora Lab</h2>
      <span class="badge">Northern Lights</span>
    </div>

    <!-- Quality Chips -->
    <ChipGroup label="Quality" variant="row">
      <ChipToggle label="High" active={quality === "high"} color="emerald" onclick={() => setQuality("high")} />
      <ChipToggle label="Medium" active={quality === "medium"} color="emerald" onclick={() => setQuality("medium")} />
      <ChipToggle label="Low" active={quality === "low"} color="emerald" onclick={() => setQuality("low")} />
    </ChipGroup>

    <!-- Layer Chips -->
    <ChipGroup label="Layers">
      <ChipToggle label="Sky Gradient" icon="fa-moon" active={layers.gradient} color="emerald" onclick={() => toggleLayer("gradient")} />
      <ChipToggle label="Aurora Waves" icon="fa-water" active={layers.waves} color="emerald" onclick={() => toggleLayer("waves")} />
      <ChipToggle label="Wave Effects" icon="fa-wand-magic-sparkles" active={layers.enhancedEffects} color="emerald" onclick={() => toggleLayer("enhancedEffects")} />
    </ChipGroup>

    <!-- Color Palette -->
    <ChipGroup label="Color Palette" variant="row">
      <ChipToggle label="Classic" active={colorPalette === "classic"} color="emerald" onclick={() => setColorPalette("classic")} />
      <ChipToggle label="Purple" active={colorPalette === "purple"} color="default" onclick={() => setColorPalette("purple")} />
      <ChipToggle label="Blue" active={colorPalette === "blue"} color="cyan" onclick={() => setColorPalette("blue")} />
      <ChipToggle label="Rainbow" active={colorPalette === "rainbow"} color="rose" onclick={() => setColorPalette("rainbow")} />
    </ChipGroup>

    <!-- Intensity -->
    <ChipGroup label="Intensity" variant="row">
      <ChipToggle label="Subtle" active={intensityPreset === "subtle"} color="emerald" onclick={() => setIntensity("subtle")} />
      <ChipToggle label="Normal" active={intensityPreset === "normal"} color="emerald" onclick={() => setIntensity("normal")} />
      <ChipToggle label="Vivid" active={intensityPreset === "vivid"} color="emerald" onclick={() => setIntensity("vivid")} />
      <ChipToggle label="Intense" active={intensityPreset === "intense"} color="emerald" onclick={() => setIntensity("intense")} />
    </ChipGroup>

    <!-- Regenerate -->
    <button class="action-btn" onclick={regenerate}>
      <i class="fas fa-sparkles"></i>
      Regenerate
    </button>

    <!-- Stats -->
    <div class="stats-section">
      <span class="label">Scene Stats</span>
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-value">{stats.waves}</span>
          <span class="stat-label">Light Waves</span>
        </div>
      </div>
    </div>

    <!-- Progress Pills -->
    <div class="progress-section">
      <span class="label">Features</span>
      <div class="progress-pills">
        <span class="pill complete">Base Gradient</span>
        <span class="pill complete">Light Waves</span>
        <span class="pill complete">Wave Animation</span>
        <span class="pill active">Layer Controls</span>
        <span class="pill pending">Color Palettes</span>
      </div>
    </div>
  </div>

  <div class="preview">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .aurora-lab {
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
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(52, 211, 153, 0.3));
    border: 1px solid rgba(52, 211, 153, 0.4);
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #34d399;
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
    background: linear-gradient(135deg, #10b981, #059669);
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
    box-shadow: 0 8px 20px rgba(16, 185, 129, 0.35);
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
    color: #34d399;
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
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
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
    background: rgb(5, 10, 25);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .preview canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (max-width: 800px) {
    .aurora-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }
  }
</style>
