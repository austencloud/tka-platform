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

  // Subsystem toggles (will be used when we implement toggle functionality)
  let showStars = $state(true);
  let showMoon = $state(true);
  let showNebula = $state(true); // Procedural nebula enabled!
  let showMilkyWay = $state(false); // Disabled by default (reimagining)
  let showConstellations = $state(false); // Disabled by default (geometric issue)
  let showAurora = $state(false); // Coming soon

  // Star parameters
  let starDensityMultiplier = $state(1.0);

  // Accessibility settings for the background
  const accessibilitySettings = {
    reducedMotion: false,
    highContrast: false,
    visibleParticleSize: 1,
  };

  // Quality settings for the background
  function getQualitySettings() {
    const multipliers: Record<QualityLevel, number> = {
      high: 1.0,
      medium: 0.7,
      low: 0.4,
      minimal: 0.2,
      "ultra-minimal": 0.1,
    };
    return {
      level: quality,
      densityMultiplier: multipliers[quality] * starDensityMultiplier,
    };
  }

  function initializeSystem() {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    // Create background system
    backgroundSystem = NightSkyBackgroundSystem.create();

    const dimensions = { width: canvas.width, height: canvas.height };
    backgroundSystem.initialize(dimensions, quality);

    // Start animation
    startAnimation();
  }

  function startAnimation() {
    if (!canvas || !backgroundSystem) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastFrameTime;
      const frameMultiplier = deltaTime / 16.67; // Normalize to 60fps
      lastFrameTime = currentTime;

      const dimensions = { width: canvas!.width, height: canvas!.height };

      // Update
      backgroundSystem!.update(dimensions, frameMultiplier);

      // Clear canvas
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Draw
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
    <h2>Night Sky Lab</h2>
    <p class="description">Experiment with night sky parameters and effects</p>

    <div class="control-section">
      <h3>Quality</h3>
      <select bind:value={quality} onchange={regenerate}>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
        <option value="minimal">Minimal</option>
      </select>
    </div>

    <div class="control-section">
      <h3>Subsystems</h3>
      <p class="note">Aurora and Milky Way coming soon</p>

      <label class="toggle">
        <input type="checkbox" bind:checked={showStars} disabled />
        <span>Stars + Scintillation</span>
      </label>

      <label class="toggle">
        <input type="checkbox" bind:checked={showMoon} disabled />
        <span>Moon</span>
      </label>

      <label class="toggle disabled">
        <input type="checkbox" bind:checked={showNebula} disabled />
        <span>Procedural Nebula (optimizing...)</span>
      </label>

      <label class="toggle disabled">
        <input type="checkbox" bind:checked={showAurora} disabled />
        <span>Aurora (coming soon)</span>
      </label>

      <label class="toggle disabled">
        <input type="checkbox" bind:checked={showMilkyWay} disabled />
        <span>Milky Way (reimagining...)</span>
      </label>
    </div>

    <div class="control-section">
      <h3>Star Parameters</h3>

      <label class="slider">
        <span>Density: {starDensityMultiplier.toFixed(1)}x</span>
        <input
          type="range"
          min="0.2"
          max="3.0"
          step="0.1"
          bind:value={starDensityMultiplier}
          onchange={regenerate}
        />
      </label>
    </div>

    <div class="control-section">
      <button class="regenerate-btn" onclick={regenerate}>
        <i class="fas fa-sync-alt"></i>
        Regenerate Sky
      </button>
    </div>

    <div class="control-section status">
      <h3>2036 Vision Progress</h3>
      <div class="status-grid">
        <span class="label">Phase 1:</span>
        <span class="value complete">Clean canvas</span>
        <span class="label">Phase 2:</span>
        <span class="value complete">Lab ready</span>
        <span class="label">Phase 3:</span>
        <span class="value complete">Scintillation</span>
        <span class="label">Phase 4:</span>
        <span class="value active">Nebula (optimizing)</span>
        <span class="label">Phase 5:</span>
        <span class="value pending">Aurora system</span>
        <span class="label">Phase 6:</span>
        <span class="value pending">Particle Milky Way</span>
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
    grid-template-columns: 320px 1fr;
    gap: 24px;
    height: 100%;
    min-height: 600px;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    overflow-y: auto;
  }

  .controls h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #e0e7ff;
  }

  .description {
    margin: 0;
    font-size: 0.875rem;
    color: #8899aa;
  }

  .control-section {
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
  }

  .control-section h3 {
    margin: 0 0 12px 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: #a0aec0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .note {
    font-size: 0.75rem;
    color: #667788;
    font-style: italic;
    margin: 0 0 12px 0;
  }

  select {
    width: 100%;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #ffffff;
    font-size: 0.875rem;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    cursor: pointer;
  }

  .toggle.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toggle input {
    width: 16px;
    height: 16px;
  }

  .toggle span {
    font-size: 0.875rem;
    color: #c0c8d0;
  }

  .slider {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .slider span {
    font-size: 0.875rem;
    color: #c0c8d0;
  }

  .slider input[type="range"] {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    cursor: pointer;
  }

  .regenerate-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    border: none;
    border-radius: 8px;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .regenerate-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
  }

  .status-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    font-size: 0.75rem;
  }

  .status-grid .label {
    color: #667788;
  }

  .status-grid .value {
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
  }

  .status-grid .value.complete {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .status-grid .value.active {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .status-grid .value.pending {
    background: rgba(255, 255, 255, 0.05);
    color: #667788;
  }

  .preview {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    background: #0a0a1a;
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
  }
</style>
