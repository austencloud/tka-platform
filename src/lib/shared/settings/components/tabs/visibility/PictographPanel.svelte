<!--
  PictographPanel.svelte

  Settings panel for controlling pictograph visibility options.
  Shows a live preview alongside toggle controls for motions, grid, glyphs,
  and display details.
-->
<script lang="ts">
  import PictographWithVisibility from "$lib/shared/pictograph/shared/components/PictographWithVisibility.svelte";
  import { examplePictographData } from "./example-data";

  interface Props {
    blueMotionVisible: boolean;
    redMotionVisible: boolean;
    showGrid: boolean;
    tkaGlyphVisible: boolean;
    vtgGlyphVisible: boolean;
    elementalGlyphVisible: boolean;
    positionsGlyphVisible: boolean;
    reversalIndicatorsVisible: boolean;
    nonRadialVisible: boolean;
    stepNumbersVisible: boolean;
    handPointVisibility: "all" | "active";
    allMotionsVisible: boolean;
    onToggle: (key: string) => void;
    isMobileHidden?: boolean;
  }

  let {
    blueMotionVisible,
    redMotionVisible,
    showGrid,
    tkaGlyphVisible,
    vtgGlyphVisible,
    elementalGlyphVisible,
    positionsGlyphVisible,
    reversalIndicatorsVisible,
    nonRadialVisible,
    stepNumbersVisible,
    handPointVisibility,
    allMotionsVisible,
    onToggle,
    isMobileHidden = false,
  }: Props = $props();
</script>

<section
  class="settings-panel pictograph-panel"
  class:mobile-hidden={isMobileHidden}
>
  <!-- Header -->
  <header class="panel-header">
    <span class="panel-icon pictograph-icon">
      <i class="fas fa-image" aria-hidden="true"></i>
    </span>
    <h3 class="panel-title">Pictograph</h3>
  </header>

  <!-- Live Preview -->
  <div class="preview-frame">
    <PictographWithVisibility
      pictographData={examplePictographData}
      forceShowAll={true}
      previewMode={true}
      onToggleTKA={() => onToggle("tka")}
      onToggleVTG={() => onToggle("vtg")}
      onToggleElemental={() => onToggle("elemental")}
      onTogglePositions={() => onToggle("positions")}
      onToggleReversals={() => onToggle("reversals")}
      onToggleNonRadial={() => onToggle("nonRadial")}
    />
  </div>

  <!-- Controls -->
  <div class="panel-controls">
    <!-- Motions group -->
    <div class="control-group">
      <span class="group-label">Motions</span>
      <div class="toggle-grid">
        <button
          class="toggle-btn"
          class:active={blueMotionVisible}
          onclick={() => onToggle("blue")}
          aria-pressed={blueMotionVisible}
        >
          <span class="chip-dot" style="background: #2563eb;"></span>
          Blue
        </button>
        <button
          class="toggle-btn"
          class:active={redMotionVisible}
          onclick={() => onToggle("red")}
          aria-pressed={redMotionVisible}
        >
          <span class="chip-dot" style="background: #dc2626;"></span>
          Red
        </button>
      </div>
    </div>

    <!-- Grid & Points group -->
    <div class="control-group">
      <span class="group-label">Grid & Points</span>
      <div class="toggle-grid">
        <button
          class="toggle-btn"
          class:active={showGrid}
          onclick={() => onToggle("grid")}
          aria-pressed={showGrid}
        >
          <i class="fas fa-border-all" aria-hidden="true"></i>
          Grid
        </button>
        <button
          class="toggle-btn"
          class:active={nonRadialVisible}
          onclick={() => onToggle("nonRadial")}
          aria-pressed={nonRadialVisible}
        >
          <i class="fas fa-dot-circle" aria-hidden="true"></i>
          Non-Radial
        </button>
      </div>
      <div class="segmented-pair">
        <button
          class="toggle-btn segment-half"
          class:active={handPointVisibility === "all"}
          onclick={() => onToggle("handPointsAll")}
          aria-pressed={handPointVisibility === "all"}
        >
          All Points
        </button>
        <button
          class="toggle-btn segment-half"
          class:active={handPointVisibility === "active"}
          onclick={() => onToggle("handPointsActive")}
          aria-pressed={handPointVisibility === "active"}
        >
          Active Only
        </button>
      </div>
    </div>

    <!-- Glyphs group -->
    <div class="control-group">
      <span class="group-label">Glyphs</span>
      {#if !allMotionsVisible}
        <p class="hint">Some glyphs need both motions visible</p>
      {/if}
      <div class="toggle-grid">
        <button
          class="toggle-btn"
          class:active={tkaGlyphVisible}
          disabled={!allMotionsVisible}
          onclick={() => onToggle("tka")}
          aria-pressed={tkaGlyphVisible}
        >
          <i class="fas fa-font" aria-hidden="true"></i>
          TKA
        </button>
        <button
          class="toggle-btn"
          class:active={vtgGlyphVisible}
          disabled={!allMotionsVisible}
          onclick={() => onToggle("vtg")}
          aria-pressed={vtgGlyphVisible}
        >
          <i class="fas fa-layer-group" aria-hidden="true"></i>
          VTG
        </button>
        <button
          class="toggle-btn"
          class:active={elementalGlyphVisible}
          disabled={!allMotionsVisible}
          onclick={() => onToggle("elemental")}
          aria-pressed={elementalGlyphVisible}
        >
          <i class="fas fa-fire" aria-hidden="true"></i>
          Elemental
        </button>
        <button
          class="toggle-btn"
          class:active={positionsGlyphVisible}
          disabled={!allMotionsVisible}
          onclick={() => onToggle("positions")}
          aria-pressed={positionsGlyphVisible}
        >
          <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
          Positions
        </button>
        <button
          class="toggle-btn"
          class:active={reversalIndicatorsVisible}
          onclick={() => onToggle("reversals")}
          aria-pressed={reversalIndicatorsVisible}
        >
          <i class="fas fa-exchange-alt" aria-hidden="true"></i>
          Reversals
        </button>
      </div>
    </div>

    <!-- Display group -->
    <div class="control-group">
      <span class="group-label">Display</span>
      <div class="toggle-grid">
        <button
          class="toggle-btn"
          class:active={stepNumbersVisible}
          onclick={() => onToggle("stepNumbers")}
          aria-pressed={stepNumbersVisible}
        >
          <i class="fas fa-list-ol" aria-hidden="true"></i>
          Step Numbers
        </button>
      </div>
    </div>
  </div>
</section>

<style>
  .settings-panel {
    container-type: inline-size;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    overflow: hidden;
    padding: 20px;
    gap: 16px;
  }

  .settings-panel.mobile-hidden {
    display: none;
  }

  /* Panel Header */
  .panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .panel-icon {
    --icon-color: #818cf8;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--icon-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--icon-color) 30%, transparent);
    color: var(--icon-color);
    font-size: 15px;
    flex-shrink: 0;
    box-shadow: 0 0 12px color-mix(in srgb, var(--icon-color) 20%, transparent);
  }

  .pictograph-icon {
    --icon-color: #818cf8;
  }

  .panel-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    letter-spacing: 0.02em;
    margin: 0;
  }

  /* Live Preview Frame */
  .preview-frame {
    aspect-ratio: 1;
    max-width: 280px;
    width: 100%;
    align-self: center;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
  }

  /* Controls */
  .panel-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .toggle-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .segmented-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .segmented-pair .toggle-btn.segment-half {
    border-radius: 0;
    border: none;
  }

  .segmented-pair .toggle-btn.segment-half:first-child {
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Toggle Buttons */
  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 10px 12px;
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 80%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    cursor: pointer;
    transition: all 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .toggle-btn i {
    font-size: var(--font-size-sm, 14px);
    transition: all 150ms ease;
  }

  .toggle-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 100%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #ffffff);
  }

  .toggle-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .toggle-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-text, #ffffff);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--theme-accent) 15%, transparent),
      0 2px 8px color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .toggle-btn.active i {
    filter: drop-shadow(0 0 4px var(--theme-accent));
  }

  .toggle-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .toggle-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

  .chip-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-style: italic;
    margin: 0;
    padding: 4px 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-btn,
    .toggle-btn i {
      transition: none;
    }

    .toggle-btn:active:not(:disabled) {
      transform: none;
    }
  }

  @media (prefers-contrast: high) {
    .toggle-btn {
      border-width: 2px;
    }

    .toggle-btn.active {
      border-color: var(--theme-accent);
    }

    .toggle-btn:focus-visible {
      outline-width: 3px;
    }
  }
</style>
