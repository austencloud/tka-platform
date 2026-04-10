<!--
  PovPatternLab.svelte — Toybox for the LED strip pattern engine.

  Generate algorithmic patterns or upload POV images, preview them flat,
  adjust persistence duration, and upload to physical poi hardware via BLE.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { createPoiState } from "$lib/features/poi/state/poi-state.svelte";
  import { setPoiContext } from "$lib/features/poi/context/poi-context";
  import PatternPicker from "$lib/features/poi/components/PatternPicker.svelte";
  import PovPreview from "$lib/features/poi/components/PovPreview.svelte";
  import PovSpinPreview from "$lib/features/poi/components/PovSpinPreview.svelte";
  import StripPatternExporter from "$lib/features/poi/components/StripPatternExporter.svelte";
  import DevicePanel from "$lib/features/poi/components/DevicePanel.svelte";

  const poi = createPoiState(
    container.items.stripPatternEngine,
    container.items.poiDeviceManager,
  );
  setPoiContext(poi);

  // Generate initial pattern on mount
  poi.generateFromPreset();

  function handlePersistenceChange(e: Event): void {
    const value = parseFloat((e.target as HTMLInputElement).value);
    poi.setPersistenceDuration(value);
  }

  function handleLedCountChange(e: Event): void {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    if (value > 0 && value <= 256) {
      poi.setLedCount(value);
      poi.generateFromPreset();
    }
  }

  function handleFrameCountChange(e: Event): void {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    if (value > 0 && value <= 500) {
      poi.setFrameCount(value);
      poi.generateFromPreset();
    }
  }
</script>

<div class="pov-lab">
  <div class="lab-grid">
    <!-- Left column: pattern selection + controls -->
    <div class="controls-column">
      <PatternPicker />

      <div class="params-section">
        <h3 class="section-title">Parameters</h3>

        <label class="param-row">
          <span class="param-label">LEDs</span>
          <input
            type="number"
            class="param-input"
            value={poi.ledCount}
            min="1"
            max="256"
            onchange={handleLedCountChange}
          />
        </label>

        <label class="param-row">
          <span class="param-label">Frames</span>
          <input
            type="number"
            class="param-input"
            value={poi.frameCount}
            min="2"
            max="500"
            onchange={handleFrameCountChange}
          />
        </label>

        <label class="param-row">
          <span class="param-label">Persistence</span>
          <input
            type="range"
            class="param-slider"
            min="0.05"
            max="0.5"
            step="0.01"
            value={poi.persistenceDuration}
            oninput={handlePersistenceChange}
          />
          <span class="param-value">{Math.round(poi.persistenceDuration * 1000)}ms</span>
        </label>
      </div>

      <PovPreview />

      <div class="bottom-row">
        <StripPatternExporter />
        {#if poi.activePattern}
          <div class="pattern-stats">
            <span>{poi.activePattern.metadata.name}</span>
            <span class="stat-dim">{poi.activePattern.metadata.source}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Right column: spinning disc (hero) + devices -->
    <div class="preview-column">
      <PovSpinPreview />
      <DevicePanel />
    </div>
  </div>
</div>

<style>
  .pov-lab {
    padding: 1rem;
    height: 100%;
    overflow-y: auto;
  }

  .lab-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }

  .controls-column,
  .preview-column {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
  }

  .section-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text-primary, #e2e8f0);
    margin: 0 0 0.5rem;
  }

  .params-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255 255 255 / 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255 255 255 / 0.05));
  }

  .param-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .param-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #94a3b8);
    min-width: 80px;
  }

  .param-input {
    width: 80px;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--theme-stroke, rgba(255 255 255 / 0.15));
    border-radius: 4px;
    background: rgba(0 0 0 / 0.2);
    color: var(--theme-text-primary, #e2e8f0);
    font-size: var(--font-size-compact, 12px);
  }

  .param-slider {
    flex: 1;
    accent-color: var(--theme-accent, #3b82f6);
  }

  .param-value {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #94a3b8);
    min-width: 45px;
    text-align: right;
  }

  .bottom-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .pattern-stats {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    background: var(--theme-card-bg, rgba(255 255 255 / 0.05));
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-primary, #e2e8f0);
    flex: 1;
  }

  .stat-dim {
    color: var(--theme-text-secondary, #94a3b8);
  }

  @container (max-width: 600px) {
    .lab-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
