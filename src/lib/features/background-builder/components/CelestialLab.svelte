<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    CelestialBackgroundSystem,
    type QualityLevel,
    type CelestialLayers,
  } from "@austencloud/backgrounds";
  import { ChipToggle, ChipGroup } from "@austencloud/chip-toggle";
  import LabPreviewCanvas from "./LabPreviewCanvas.svelte";
  import {
    getCelestialLabSettings,
    updateCelestialLabSettings,
  } from "../state/background-builder-state.svelte";

  // The UI exposes four conceptual layers (clouds / godRays / islands / pillars)
  // whose names predate the package. The package's CelestialBackgroundSystem
  // only models `clouds` from that set; setLayerVisibility merges any extra keys
  // into its layer bag harmlessly. We type the payload as the package's partial
  // widened with the UI-only keys so the call is type-checked without `as any`.
  type CelestialLayerVisibility = Partial<CelestialLayers> & {
    godRays: boolean;
    islands: boolean;
    pillars: boolean;
  };

  function buildLayerVisibility(): CelestialLayerVisibility {
    return {
      clouds: layers.clouds,
      godRays: layers.godRays,
      islands: layers.islands,
      pillars: layers.pillars,
    };
  }

  let backgroundSystem: CelestialBackgroundSystem | null = $state(null);
  let canvasDimensions = $state({ width: 800, height: 600 });
  let isLoading = $state(true);

  const savedSettings = getCelestialLabSettings();
  let quality: QualityLevel = $state(savedSettings.quality);
  let layers = $state({ ...savedSettings.layers });

  function handleCanvasReady(dimensions: { width: number; height: number }) {
    canvasDimensions = dimensions;
    backgroundSystem = new CelestialBackgroundSystem();
    backgroundSystem.initialize(dimensions, quality);
    backgroundSystem.setLayerVisibility(buildLayerVisibility());
    isLoading = false;
  }

  function regenerate() {
    backgroundSystem?.cleanup?.();
    backgroundSystem = new CelestialBackgroundSystem();
    backgroundSystem.initialize(canvasDimensions, quality);
    backgroundSystem.setLayerVisibility(buildLayerVisibility());
  }

  function setQuality(q: QualityLevel) {
    quality = q;
    updateCelestialLabSettings({ quality: q });
    backgroundSystem?.setQuality(q);
  }

  function toggleLayer(layer: keyof typeof layers) {
    layers = { ...layers, [layer]: !layers[layer] };
    updateCelestialLabSettings({ layers: { ...layers } });
    backgroundSystem?.setLayerVisibility(buildLayerVisibility());
  }

  onDestroy(() => {
    backgroundSystem?.cleanup?.();
  });
</script>

<div class="celestial-lab">
  <div class="controls themed-scrollbar-accent">
    <div class="header">
      <h2>Celestial Lab</h2>
      <span class="badge">God Rays</span>
    </div>

    <ChipGroup>
      <ChipToggle label="High" active={quality === "high"} color="amber" onclick={() => setQuality("high")} />
      <ChipToggle label="Medium" active={quality === "medium"} color="amber" onclick={() => setQuality("medium")} />
      <ChipToggle label="Low" active={quality === "low"} color="amber" onclick={() => setQuality("low")} />
    </ChipGroup>

    <ChipGroup>
      <ChipToggle label="Clouds" icon="cloud" active={layers.clouds} color="amber" onclick={() => toggleLayer("clouds")} />
      <ChipToggle label="God Rays" icon="sun" active={layers.godRays} color="amber" onclick={() => toggleLayer("godRays")} />
      <ChipToggle label="Islands" icon="mountain" active={layers.islands} color="amber" onclick={() => toggleLayer("islands")} />
      <ChipToggle label="Pillars" icon="landmark" active={layers.pillars} color="amber" onclick={() => toggleLayer("pillars")} />
    </ChipGroup>

    <button class="action-btn" onclick={regenerate}>
      <i class="fas fa-star"></i>
      Regenerate
    </button>
  </div>

  <LabPreviewCanvas
    system={backgroundSystem}
    {isLoading}
    accentColor="#ffd080"
    backgroundColor="rgba(10, 26, 74, 0.9)"
    onCanvasReady={handleCanvasReady}
  />
</div>

<style>
  .celestial-lab {
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
    background: linear-gradient(135deg, rgba(255, 208, 128, 0.3), rgba(184, 144, 80, 0.3));
    border: 1px solid rgba(255, 208, 128, 0.4);
    border-radius: 20px;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    color: #ffd080;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #b89050, #8a6a3a);
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
    box-shadow: 0 8px 20px rgba(184, 144, 80, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
  }

  .action-btn:focus-visible {
    outline: 2px solid #ffd080;
    outline-offset: 2px;
  }

  @media (max-width: 800px) {
    .celestial-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .action-btn {
      transition: none;
    }
  }
</style>
