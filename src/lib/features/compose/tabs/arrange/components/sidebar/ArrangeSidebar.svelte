<!--
  ArrangeSidebar.svelte

  Unified sidebar for the arrange tab. Contains collapsible sections:
  - Grid Layout (auto-collapses on cell selection)
  - Cell Editor (appears on cell selection)
  - Playback (always pinned to bottom)
-->
<script lang="ts">
  import type { GridCell } from "../../state/arrange-grid-state.svelte";
  import type { CellMediaType, TransformType } from "../../../../compose/domain/types";
  import type { CellEffect } from "../../../../compose/domain/types";
  import type { TipEffectMap, TipEffortMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import type { TrailMode } from "$lib/shared/animation-engine/domain/types/TrailTypes";
  import type { PropColors } from "../../../../compose/domain/types";
  import GridLayoutControls from "../grid/GridLayoutControls.svelte";
  import CellEditorPanel from "../grid/cell-editor/CellEditorPanel.svelte";
  import PlaybackBar from "../shared/PlaybackBar.svelte";

  type PresetLayoutType =
    | "single"
    | "vertical"
    | "horizontal"
    | "line"
    | "square"
    | "hero-thumbs"
    | "main-banner"
    | "pip";

  interface ArrangeSidebarProps {
    // Grid layout props
    gridRows: number;
    gridCols: number;
    hasContent: boolean;
    onSetGridRows: (n: number) => void;
    onSetGridCols: (n: number) => void;
    onSetDimensions: (rows: number, cols: number) => void;
    onPresetLayout: (preset: PresetLayoutType) => void;

    // Cell editor props (null when no cell selected)
    selectedCell: GridCell | null;
    cellIndex: number;
    clipboardHasData: boolean;
    transformingLayer: { cellId: string; layerIndex: number } | null;
    onAddSequence: () => void;
    onRemoveLayer: (layerIndex: number) => void;
    onEditLayerOffset: (layerIndex: number) => void;
    onClearCell: () => void;
    onMediaTypeChange: (mediaType: CellMediaType) => void;
    onCopyLayer?: (layerIndex: number) => void;
    onCopyCell?: () => void;
    onPasteLayer?: () => void;
    onTransformLayer?: (layerIndex: number, transformType: TransformType) => void;
    onSetSpeed?: (speed: number) => void;
    onSetEffect?: (effect: CellEffect) => void;
    onSetTrailMode?: (mode: TrailMode) => void;
    onSetEffort?: (effort: string) => void;
    onSetColors?: (colors: PropColors) => void;
    onSetBlueVisible?: (visible: boolean) => void;
    onSetRedVisible?: (visible: boolean) => void;
    onSetOffset?: (offset: number) => void;
    onSetTipEffectMap?: (map: TipEffectMap) => void;
    onSetTipEffortMap?: (map: TipEffortMap) => void;

    // Playback props
    hasAnyLayers: boolean;
    isPlaying: boolean;
    currentStep: number;
    totalSteps: number;
    bpm: number;
    skipStartPosition: boolean;
    onPlayPause: () => void;
    onStop: () => void;
    onStepHalfBack: () => void;
    onStepHalfFwd: () => void;
    onStepFullBack: () => void;
    onStepFullFwd: () => void;
    onBpmChange?: (bpm: number) => void;
    onToggleLoop?: () => void;
  }

  const p: ArrangeSidebarProps = $props();

  // Grid config section: auto-collapse when cell selected, auto-expand when deselected
  let gridConfigManualOverride = $state<boolean | null>(null);
  let prevSelectedCell = $state<GridCell | null>(null);

  // Reset manual override when selection changes
  $effect(() => {
    if (p.selectedCell !== prevSelectedCell) {
      gridConfigManualOverride = null;
      prevSelectedCell = p.selectedCell;
    }
  });

  const gridConfigExpanded = $derived(
    gridConfigManualOverride !== null
      ? gridConfigManualOverride
      : p.selectedCell === null
  );

  function toggleGridConfig() {
    gridConfigManualOverride = !gridConfigExpanded;
  }
</script>

<aside class="arrange-sidebar">
  <!-- Section 1: Grid Layout -->
  <div class="sidebar-section">
    <button
      class="section-header"
      onclick={toggleGridConfig}
      aria-expanded={gridConfigExpanded}
    >
      <span class="section-title">
        <i class="fas fa-th" aria-hidden="true"></i>
        Grid
      </span>
      <div class="section-header-right">
        {#if !gridConfigExpanded}
          <span class="section-meta">{p.gridCols}&times;{p.gridRows}</span>
        {/if}
        <i
          class="fas fa-chevron-down section-chevron"
          class:collapsed={!gridConfigExpanded}
          aria-hidden="true"
        ></i>
      </div>
    </button>
    {#if gridConfigExpanded}
      <div class="section-body">
        <GridLayoutControls
          gridRows={p.gridRows}
          gridCols={p.gridCols}
          hasContent={p.hasContent}
          onSetGridRows={p.onSetGridRows}
          onSetGridCols={p.onSetGridCols}
          onSetDimensions={p.onSetDimensions}
          onPresetLayout={p.onPresetLayout}
        />
      </div>
    {/if}
  </div>

  <!-- Section 2: Cell Editor (only when cell selected) -->
  {#if p.selectedCell}
    <div class="sidebar-section cell-editor-section">
      <CellEditorPanel
        cell={p.selectedCell}
        cellIndex={p.cellIndex}
        clipboardHasData={p.clipboardHasData}
        transformingLayer={p.transformingLayer}
        onAddSequence={p.onAddSequence}
        onRemoveLayer={p.onRemoveLayer}
        onEditLayerOffset={p.onEditLayerOffset}
        onClearCell={p.onClearCell}
        onMediaTypeChange={p.onMediaTypeChange}
        onCopyLayer={p.onCopyLayer}
        onCopyCell={p.onCopyCell}
        onPasteLayer={p.onPasteLayer}
        onTransformLayer={p.onTransformLayer}
        onSetSpeed={p.onSetSpeed}
        onSetEffect={p.onSetEffect}
        onSetTrailMode={p.onSetTrailMode}
        onSetEffort={p.onSetEffort}
        onSetColors={p.onSetColors}
        onSetBlueVisible={p.onSetBlueVisible}
        onSetRedVisible={p.onSetRedVisible}
        onSetOffset={p.onSetOffset}
        onSetTipEffectMap={p.onSetTipEffectMap}
        onSetTipEffortMap={p.onSetTipEffortMap}
      />
    </div>
  {:else}
    <div class="empty-cell-placeholder">
      <i class="fas fa-mouse-pointer" aria-hidden="true"></i>
      <span>Click a cell to edit</span>
    </div>
  {/if}

  <!-- Section 3: Playback (always pinned to bottom) -->
  {#if p.hasAnyLayers}
    <div class="sidebar-section playback-section">
      <PlaybackBar
        isPlaying={p.isPlaying}
        currentStep={p.currentStep}
        totalSteps={p.totalSteps}
        bpm={p.bpm}
        skipStartPosition={p.skipStartPosition}
        onPlayPause={p.onPlayPause}
        onStop={p.onStop}
        onStepHalfBack={p.onStepHalfBack}
        onStepHalfFwd={p.onStepHalfFwd}
        onStepFullBack={p.onStepFullBack}
        onStepFullFwd={p.onStepFullFwd}
        onBpmChange={p.onBpmChange}
        onToggleLoop={p.onToggleLoop}
      />
    </div>
  {/if}
</aside>

<style>
  .arrange-sidebar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow-y: auto;
    padding: var(--spacing-sm, 8px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: var(--border-radius-lg);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  /* Section containers */
  .sidebar-section {
    flex-shrink: 0;
  }

  .cell-editor-section {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    border: 1px solid rgba(139, 92, 246, 0.08);
    border-radius: 10px;
    background: rgba(139, 92, 246, 0.02);
  }

  /* Collapsible section header */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 12px;
    min-height: 44px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .section-header:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-title i {
    font-size: 11px;
    opacity: 0.6;
  }

  .section-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-meta {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
  }

  .section-chevron {
    font-size: 8px;
    color: rgba(255, 255, 255, 0.25);
    transition: transform 150ms ease;
  }

  .section-chevron.collapsed {
    transform: rotate(-90deg);
  }

  .section-body {
    padding: 8px 0 0;
  }

  /* Empty state placeholder */
  .empty-cell-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.15);
    font-size: 12px;
    font-style: italic;
    min-height: 100px;
  }

  .empty-cell-placeholder i {
    font-size: 18px;
    opacity: 0.5;
  }

  /* Playback: pinned to bottom */
  .playback-section {
    margin-top: auto;
    flex-shrink: 0;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  @media (prefers-reduced-motion: reduce) {
    .section-header,
    .section-chevron {
      transition: none;
    }
  }
</style>
