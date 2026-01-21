<script lang="ts">
  import { onDestroy } from "svelte";
  import { AuroraBackgroundSystem } from "$lib/shared/background/aurora/services/AuroraBackgroundSystem";
  import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";
  import LabPreviewCanvas from "./LabPreviewCanvas.svelte";

  // Background system
  let backgroundSystem: AuroraBackgroundSystem | null = $state(null);
  let canvasDimensions = $state({ width: 800, height: 600 });

  // Quality settings
  let quality: QualityLevel = $state("high");

  // Loading state
  let isLoading = $state(true);

  // Stats
  let stats = $state({ lensFlares: 0, sparkles: 0 });

  // Initialize system when canvas is ready
  function handleCanvasReady(dimensions: { width: number; height: number }) {
    canvasDimensions = dimensions;
    backgroundSystem = new AuroraBackgroundSystem();
    backgroundSystem.initialize(dimensions, quality);
    updateStats();
    isLoading = false;
  }

  function updateStats() {
    if (backgroundSystem) {
      // The system tracks lens flares + sparkles as particleCount
      const flareCounts: Record<QualityLevel, number> = {
        high: 5,
        medium: 3,
        low: 2,
        minimal: 1,
        "ultra-minimal": 1,
      };
      const sparkleCounts: Record<QualityLevel, number> = {
        high: 50,
        medium: 30,
        low: 15,
        minimal: 5,
        "ultra-minimal": 0,
      };
      stats = {
        lensFlares: flareCounts[quality] || 3,
        sparkles: sparkleCounts[quality] || 30,
      };
    }
  }

  function regenerate() {
    if (backgroundSystem) {
      backgroundSystem.cleanup?.();
    }
    backgroundSystem = new AuroraBackgroundSystem();
    backgroundSystem.initialize(canvasDimensions, quality);
    updateStats();
  }

  function setQuality(q: QualityLevel) {
    quality = q;
    if (backgroundSystem) {
      backgroundSystem.setQuality(q);
      updateStats();
    }
  }

  onDestroy(() => {
    if (backgroundSystem) {
      backgroundSystem.cleanup?.();
    }
  });
</script>

<div class="aurora-lab">
  <div class="controls themed-scrollbar-accent">
    <div class="header">
      <h2>Aurora Lab</h2>
      <span class="badge">Rainbow</span>
    </div>

    <!-- Quality Chips -->
    <ChipGroup label="Quality" variant="row">
      <ChipToggle label="High" active={quality === "high"} color="violet" onclick={() => setQuality("high")} />
      <ChipToggle label="Medium" active={quality === "medium"} color="violet" onclick={() => setQuality("medium")} />
      <ChipToggle label="Low" active={quality === "low"} color="violet" onclick={() => setQuality("low")} />
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
          <span class="stat-value">{stats.lensFlares}</span>
          <span class="stat-label">Lens Flares</span>
        </div>
        <div class="stat">
          <span class="stat-value">{stats.sparkles}</span>
          <span class="stat-label">Sparkles</span>
        </div>
      </div>
    </div>

    <!-- Info -->
    <div class="info-section">
      <span class="label">About</span>
      <p class="info-text">
        Rainbow gradient with cycling colors, animated lens flares, and sparkle effects.
        Colors shift through the spectrum for a vibrant aurora effect.
      </p>
    </div>

    <!-- Progress Pills -->
    <div class="progress-section">
      <span class="label">Features</span>
      <div class="progress-pills">
        <span class="pill complete">Wavy Gradient</span>
        <span class="pill complete">Color Cycling</span>
        <span class="pill complete">Lens Flares</span>
        <span class="pill complete">Sparkles</span>
        <span class="pill complete">Quality Levels</span>
      </div>
    </div>
  </div>

  <LabPreviewCanvas
    system={backgroundSystem}
    {isLoading}
    accentColor="#a78bfa"
    backgroundColor="rgba(5, 10, 25, 0.9)"
    onCanvasReady={handleCanvasReady}
  />
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
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3));
    border: 1px solid rgba(167, 139, 250, 0.4);
    border-radius: 20px;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    color: #a78bfa;
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
    background: linear-gradient(135deg, #8b5cf6, #ec4899);
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
    box-shadow: 0 8px 20px rgba(139, 92, 246, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
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
    grid-template-columns: repeat(2, 1fr);
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
    color: #a78bfa;
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
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
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
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
  }

  .pill.complete {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  @media (max-width: 800px) {
    .aurora-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }
  }

  .action-btn:focus-visible {
    outline: 2px solid #a78bfa;
    outline-offset: 2px;
  }

  /* Accessibility: Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .action-btn {
      transition: none;
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
    .stat-label,
    .info-text {
      color: #d1d5db;
    }
  }
</style>
