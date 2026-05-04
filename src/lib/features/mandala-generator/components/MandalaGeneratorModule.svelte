<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { mandalaState } from "../state/mandala-state.svelte";
  import { MandalaController } from "../state/mandala-controller";
  import type { Point } from "../domain/models/mandala-element";
  import { CANVAS_CENTER } from "../domain/constants/symmetry-constants";
  import MandalaCanvas from "./canvas/MandalaCanvas.svelte";
  import AssetLibrary from "./panels/AssetLibrary.svelte";
  import SymmetryControls from "./controls/SymmetryControls.svelte";

  // Initialize controller
  const controller = new MandalaController(mandalaState);

  // Viewport detection
  let innerWidth = $state(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const isMobile = $derived(innerWidth < 750);

  // Track keyboard events
  function handleKeyDown(event: KeyboardEvent) {
    controller.handleKeyDown(event);
  }

  onMount(() => {
    // Listen for keyboard shortcuts
    window.addEventListener("keydown", handleKeyDown);

    // Listen for resize
    const resizeHandler = () => {
      innerWidth = window.innerWidth;
    };
    window.addEventListener("resize", resizeHandler);

    // Initialize history with empty state
    mandalaState.pushHistory();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", resizeHandler);
    };
  });

  onDestroy(() => {
    controller.cleanup();
  });

  // Handle asset selection from library (click to add at center)
  function handleAssetSelect(
    assetType: string,
    motionType: string,
    color: string,
    svgData?: { svgContent: string; viewBox: { width: number; height: number }; center: { x: number; y: number } }
  ) {
    // Place element near center with slight random offset
    const offset = {
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 100,
    };
    const position: Point = {
      x: CANVAS_CENTER.x + offset.x,
      y: CANVAS_CENTER.y + offset.y,
    };

    controller.addElement(
      assetType as "arrow" | "staff" | "gridDot",
      position,
      {
        color,
        arrowSpec: assetType === "arrow" ? { motionType } : undefined,
        svgContent: svgData?.svgContent,
        viewBox: svgData?.viewBox,
        center: svgData?.center,
      }
    );
  }

  // Action bar handlers
  function handleUndo() {
    controller.undo();
  }

  function handleRedo() {
    controller.redo();
  }

  function handleClear() {
    if (mandalaState.hasElements) {
      controller.clearCanvas();
    }
  }

  function handleExport() {
    controller.openExportSheet();
  }
</script>

<div class="mandala-generator" class:mobile={isMobile}>
  {#if isMobile}
    <!-- Mobile layout: stacked -->
    <div class="mobile-layout">
      <!-- Canvas -->
      <div class="canvas-wrapper">
        <MandalaCanvas />
      </div>

      <!-- Action bar -->
      <div class="action-bar">
        <button
          class="action-btn"
          onclick={handleUndo}
          disabled={!mandalaState.canUndo}
          title={t('mandala_undo')}
        >
          {t('mandala_undo')}
        </button>
        <button
          class="action-btn"
          onclick={handleRedo}
          disabled={!mandalaState.canRedo}
          title={t('mandala_redo')}
        >
          {t('mandala_redo')}
        </button>
        <button
          class="action-btn"
          onclick={handleClear}
          disabled={!mandalaState.hasElements}
          title={t('mandala_clear')}
        >
          {t('mandala_clear')}
        </button>
        <button
          class="action-btn primary"
          onclick={handleExport}
          disabled={!mandalaState.hasElements}
          title={t('mandala_export')}
        >
          {t('mandala_export')}
        </button>
      </div>

      <!-- Controls in collapsible sections -->
      <div class="mobile-controls">
        <details class="control-section" open>
          <summary>{t('mandala_asset_library')}</summary>
          <AssetLibrary onAssetSelect={handleAssetSelect} />
        </details>

        <details class="control-section">
          <summary>{t('mandala_symmetry')}</summary>
          <SymmetryControls />
        </details>
      </div>
    </div>
  {:else}
    <!-- Desktop layout: three-column -->
    <div class="desktop-layout">
      <!-- Left panel: Asset Library -->
      <aside class="left-panel">
        <div class="panel-header">
          <h2>{t('mandala_asset_library')}</h2>
        </div>
        <AssetLibrary onAssetSelect={handleAssetSelect} />
      </aside>

      <!-- Center: Canvas -->
      <main class="center-panel">
        <div class="panel-header">
          <h2>{t('mandala_canvas')}</h2>
          <div class="action-bar">
            <button
              class="action-btn"
              onclick={handleUndo}
              disabled={!mandalaState.canUndo}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              class="action-btn"
              onclick={handleRedo}
              disabled={!mandalaState.canRedo}
              title="Redo (Ctrl+Y)"
            >
              Redo
            </button>
            <button
              class="action-btn"
              onclick={handleClear}
              disabled={!mandalaState.hasElements}
              title="Clear canvas"
            >
              Clear
            </button>
            <button
              class="action-btn primary"
              onclick={handleExport}
              disabled={!mandalaState.hasElements}
              title={t('mandala_export')}
            >
              Export
            </button>
          </div>
        </div>
        <div class="canvas-wrapper">
          <MandalaCanvas />
        </div>
      </main>

      <!-- Right panel: Controls -->
      <aside class="right-panel">
        <div class="panel-header">
          <h2>{t('mandala_symmetry')}</h2>
        </div>
        <SymmetryControls />

        <!-- Selected element properties -->
        {#if mandalaState.selectedElement}
          <div class="properties-panel">
            <div class="panel-header">
              <h3>{t('mandala_properties')}</h3>
            </div>
            <div class="property-row">
              <span class="property-label">{t('mandala_type')}</span>
              <span class="property-value"
                >{mandalaState.selectedElement.type}</span
              >
            </div>
            <div class="property-row">
              <span class="property-label">{t('mandala_rotation')}</span>
              <input
                type="range"
                min="0"
                max="360"
                value={mandalaState.selectedElement.rotation}
                oninput={(e) => {
                  const el = mandalaState.selectedElement;
                  if (el) {
                    controller.rotateElement(
                      el.id,
                      parseInt(e.currentTarget.value)
                    );
                  }
                }}
              />
              <span class="property-value"
                >{Math.round(mandalaState.selectedElement.rotation)}°</span
              >
            </div>
            <div class="property-row">
              <span class="property-label">{t('mandala_scale')}</span>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={mandalaState.selectedElement.scale}
                oninput={(e) => {
                  const el = mandalaState.selectedElement;
                  if (el) {
                    controller.scaleElement(
                      el.id,
                      parseFloat(e.currentTarget.value)
                    );
                  }
                }}
              />
              <span class="property-value"
                >{mandalaState.selectedElement.scale.toFixed(1)}x</span
              >
            </div>
            <div class="property-actions">
              <button
                class="action-btn"
                onclick={() => controller.duplicateSelectedElement()}
              >
                {t('mandala_duplicate')}
              </button>
              <button
                class="action-btn danger"
                onclick={() => controller.removeSelectedElement()}
              >
                {t('mandala_delete')}
              </button>
            </div>
          </div>
        {/if}
      </aside>
    </div>
  {/if}
</div>

<style>
  .mandala-generator {
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, white);
    overflow: hidden;
  }

  /* Desktop layout */
  .desktop-layout {
    display: grid;
    grid-template-columns: 260px 1fr 280px;
    gap: 16px;
    height: 100%;
    padding: 16px;
  }

  .left-panel,
  .right-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }

  .center-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .canvas-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--settings-radius-md, 8px);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
  }

  .panel-header h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: var(--theme-text, white);
  }

  .panel-header h3 {
    font-size: 14px;
    font-weight: 500;
    margin: 0;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
  }

  .action-bar {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    min-height: var(--min-touch-target);
    padding: 12px 16px;
    font-size: var(--font-size-min, 14px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    border-radius: 6px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .action-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    color: var(--theme-text, white);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .action-btn.primary {
    background: var(--theme-accent, #4a9eff);
    border-color: var(--theme-accent, #4a9eff);
    color: white;
  }

  .action-btn.primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent, #4a9eff) 80%, white);
  }

  .action-btn.danger {
    border-color: var(--semantic-error, #ef4444);
    color: var(--semantic-error, #ef4444);
  }

  .action-btn.danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.1);
  }

  /* Properties panel */
  .properties-panel {
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--settings-radius-md, 8px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .property-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .property-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    min-width: 60px;
  }

  .property-value {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, white);
    min-width: 40px;
    text-align: right;
  }

  .property-row input[type="range"] {
    flex: 1;
    accent-color: var(--theme-accent, #4a9eff);
  }

  .property-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  /* Mobile layout */
  .mobile-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 8px;
    gap: 8px;
  }

  .mobile-layout .canvas-wrapper {
    flex: 1;
    min-height: 300px;
  }

  .mobile-layout .action-bar {
    justify-content: center;
    padding: 8px 0;
  }

  .mobile-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    max-height: 40vh;
  }

  .control-section {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--settings-radius-md, 8px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .control-section summary {
    padding: 12px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    user-select: none;
  }

  .control-section summary:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .control-section[open] summary {
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
</style>
