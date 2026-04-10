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
  import ScrubValue from "$lib/features/poi/components/ScrubValue.svelte";

  const poi = createPoiState(
    container.items.stripPatternEngine,
    container.items.poiDeviceManager,
  );
  setPoiContext(poi);

  // Generate initial pattern on mount (skip if restoring an uploaded image)
  if (!poi.hasUploadedImage) {
    poi.generateFromPreset();
  }

  function setLedCount(v: number): void {
    const clamped = Math.round(Math.max(1, Math.min(256, v)));
    poi.setLedCount(clamped);
    poi.generateFromPreset();
  }

  function setFrameCount(v: number): void {
    const clamped = Math.round(Math.max(2, Math.min(500, v)));
    poi.setFrameCount(clamped);
    poi.generateFromPreset();
  }
</script>

<div class="pov-lab">
  <div class="lab-grid">
    <!-- Left column: pattern selection + controls -->
    <div class="controls-column">
      <PatternPicker />

      <div class="params-section">
        <h3 class="section-title">Parameters</h3>

        <ScrubValue
          label="LEDs"
          value={poi.ledCount}
          min={1}
          max={256}
          step={1}
          onchange={setLedCount}
        />

        <ScrubValue
          label="Frames"
          value={poi.frameCount}
          min={2}
          max={500}
          step={1}
          onchange={setFrameCount}
        />
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
