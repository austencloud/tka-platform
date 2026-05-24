<script lang="ts">
  import { onDestroy } from "svelte";
  import { VoidBackgroundSystem } from "@austencloud/backgrounds";
  import { ChipToggle, ChipGroup } from "@austencloud/chip-toggle";
  import LabPreviewCanvas from "./LabPreviewCanvas.svelte";
  import {
    getVoidLabSettings,
    updateVoidLabSettings,
  } from "../state/background-builder-state.svelte";

  let backgroundSystem: VoidBackgroundSystem | null = $state(null);
  let canvasDimensions = $state({ width: 800, height: 600 });
  let isLoading = $state(true);

  const savedSettings = getVoidLabSettings();
  let layers = $state({ ...savedSettings.layers });
  let gridOpacity = $state(savedSettings.gridOpacity);
  let gridSpacing = $state(savedSettings.gridSpacing);

  function handleCanvasReady(dimensions: { width: number; height: number }) {
    canvasDimensions = dimensions;
    backgroundSystem = new VoidBackgroundSystem();
    backgroundSystem.initialize(dimensions, "high");
    backgroundSystem.setLayerVisibility(layers);
    backgroundSystem.setConfig({ gridOpacity, gridSpacing });
    isLoading = false;
  }

  function toggleLayer(layer: keyof typeof layers) {
    layers = { ...layers, [layer]: !layers[layer] };
    updateVoidLabSettings({ layers: { ...layers } });
    backgroundSystem?.setLayerVisibility(layers);
  }

  function handleGridOpacity(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    gridOpacity = val;
    updateVoidLabSettings({ gridOpacity: val });
    backgroundSystem?.setConfig({ gridOpacity: val });
  }

  function handleGridSpacing(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    gridSpacing = val;
    updateVoidLabSettings({ gridSpacing: val });
    backgroundSystem?.setConfig({ gridSpacing: val });
  }

  onDestroy(() => {
    backgroundSystem?.cleanup?.();
  });
</script>

<div class="void-lab">
  <div class="controls themed-scrollbar-accent">
    <div class="header">
      <h2>Void Lab</h2>
      <span class="badge">Minimal</span>
    </div>

    <ChipGroup>
      <ChipToggle label="Grid" icon="grip" active={layers.grid} color="gray" onclick={() => toggleLayer("grid")} />
      <ChipToggle label="Vignette" icon="circle" active={layers.vignette} color="gray" onclick={() => toggleLayer("vignette")} />
    </ChipGroup>

    {#if layers.grid}
      <div class="slider-group">
        <label class="slider-label" for="void-grid-opacity">
          Grid Opacity
          <span class="slider-value">{(gridOpacity * 100).toFixed(0)}%</span>
        </label>
        <input
          id="void-grid-opacity"
          type="range"
          min="0.02"
          max="0.3"
          step="0.01"
          value={gridOpacity}
          oninput={handleGridOpacity}
          class="slider"
        />
      </div>

      <div class="slider-group">
        <label class="slider-label" for="void-grid-spacing">
          Grid Spacing
          <span class="slider-value">{gridSpacing}px</span>
        </label>
        <input
          id="void-grid-spacing"
          type="range"
          min="10"
          max="100"
          step="5"
          value={gridSpacing}
          oninput={handleGridSpacing}
          class="slider"
        />
      </div>
    {/if}
  </div>

  <LabPreviewCanvas
    system={backgroundSystem}
    {isLoading}
    accentColor="#6b7280"
    backgroundColor="rgba(0, 0, 0, 0.95)"
    onCanvasReady={handleCanvasReady}
  />
</div>

<style>
  .void-lab {
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
    background: rgba(107, 114, 128, 0.3);
    border: 1px solid rgba(107, 114, 128, 0.4);
    border-radius: 20px;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .slider-label {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
    color: #9ca3af;
  }

  .slider-value {
    color: #d1d5db;
    font-variant-numeric: tabular-nums;
  }

  .slider {
    width: 100%;
    height: 4px;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    outline: none;
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #9ca3af;
    cursor: pointer;
  }

  .slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #9ca3af;
    border: none;
    cursor: pointer;
  }

  @media (max-width: 800px) {
    .void-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 400px;
    }
  }
</style>
