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
    showGrid: boolean;
    tkaGlyphVisible: boolean;
    tndGlyphVisible: boolean;
    positionsGlyphVisible: boolean;
    reversalIndicatorsVisible: boolean;
    nonRadialVisible: boolean;
    onToggle: (key: string) => void;
    isMobileHidden?: boolean;
  }

  let {
    showGrid,
    tkaGlyphVisible,
    tndGlyphVisible,
    positionsGlyphVisible,
    reversalIndicatorsVisible,
    nonRadialVisible,
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
      onToggleTnD={() => onToggle("tnd")}
      onToggleElemental={() => onToggle("elemental")}
      onTogglePositions={() => onToggle("positions")}
      onToggleReversals={() => onToggle("reversals")}
      onToggleNonRadial={() => onToggle("nonRadial")}
    />
  </div>

  <!-- Controls -->
  <div class="panel-controls">
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
    </div>

    <!-- Glyphs group -->
    <div class="control-group">
      <span class="group-label">Glyphs</span>
      <div class="toggle-grid">
        <button
          class="toggle-btn"
          class:active={tkaGlyphVisible}
          onclick={() => onToggle("tka")}
          aria-pressed={tkaGlyphVisible}
        >
          <i class="fas fa-font" aria-hidden="true"></i>
          TKA
        </button>
        <button
          class="toggle-btn"
          class:active={tndGlyphVisible}
          onclick={() => onToggle("tnd")}
          aria-pressed={tndGlyphVisible}
        >
          <i class="fas fa-layer-group" aria-hidden="true"></i>
          TnD
        </button>
        <button
          class="toggle-btn"
          class:active={positionsGlyphVisible}
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
