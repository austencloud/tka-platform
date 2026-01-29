<!--
  CellEditor.svelte

  Editor panel for the selected cell.
  Shows the cell's layers and allows adding/removing sequences.
  Includes cell size (span) controls.
-->
<script lang="ts">
  import type { GridCell } from "../../state/arrange-grid-state.svelte";
  import type { TunnelLayerConfig } from "../../../../compose/domain/types";

  let {
    cell,
    cellIndex,
    onAddSequence,
    onRemoveLayer,
    onEditLayerOffset,
    onClearCell,
    onSetSpan,
  }: {
    cell: GridCell;
    cellIndex: number;
    onAddSequence: () => void;
    onRemoveLayer: (layerIndex: number) => void;
    onEditLayerOffset: (layerIndex: number) => void;
    onClearCell: () => void;
    onSetSpan: (colSpan: number, rowSpan: number) => void;
  } = $props();

  const MAX_LAYERS = 4;
  const canAddLayer = $derived(cell.layers.length < MAX_LAYERS);

  // Span presets
  type SpanPreset = { cols: number; rows: number; label: string };
  const spanPresets: SpanPreset[] = [
    { cols: 1, rows: 1, label: "1×1" },
    { cols: 2, rows: 1, label: "2×1" },
    { cols: 1, rows: 2, label: "1×2" },
    { cols: 2, rows: 2, label: "2×2" },
    { cols: 3, rows: 1, label: "Full Width" },
    { cols: 1, rows: 3, label: "Full Height" },
  ];

  // Check if a preset can be applied (within grid bounds)
  function canApplyPreset(preset: SpanPreset): boolean {
    return cell.col + preset.cols <= 3 && cell.row + preset.rows <= 3;
  }

  function isCurrentSpan(preset: SpanPreset): boolean {
    return cell.colSpan === preset.cols && cell.rowSpan === preset.rows;
  }

  function handleSetSpan(preset: SpanPreset) {
    if (canApplyPreset(preset)) {
      onSetSpan(preset.cols, preset.rows);
    }
  }

  function getLayerName(layer: TunnelLayerConfig, index: number): string {
    return layer.sequence.word || layer.sequence.name || `Sequence ${index + 1}`;
  }

  function getLayerBeats(layer: TunnelLayerConfig): number {
    return layer.sequence.steps?.length || 0;
  }
</script>

<div class="cell-editor">
  <div class="editor-header">
    <h4>Cell {cellIndex + 1}</h4>
    <span class="layer-count">{cell.layers.length}/{MAX_LAYERS}</span>
  </div>

  <!-- Size/Span Controls -->
  <div class="size-section">
    <span class="section-label">Size</span>
    <div class="size-buttons">
      {#each spanPresets as preset}
        <button
          class="size-btn"
          class:active={isCurrentSpan(preset)}
          disabled={!canApplyPreset(preset)}
          onclick={() => handleSetSpan(preset)}
          aria-label="Set cell size to {preset.label}"
          title={canApplyPreset(preset) ? preset.label : "Cannot fit in current position"}
        >
          {preset.label}
        </button>
      {/each}
    </div>
  </div>

  {#if cell.layers.length === 0}
    <div class="empty-state">
      <p>No sequences in this cell</p>
      <button class="add-btn primary" onclick={onAddSequence}>
        <i class="fas fa-plus" aria-hidden="true"></i>
        Add Sequence
      </button>
    </div>
  {:else}
    <div class="layers-list">
      {#each cell.layers as layer, index}
        <div class="layer-item">
          <div class="layer-colors">
            <span
              class="color-dot"
              style:background={layer.propColors.left}
            ></span>
            <span
              class="color-dot"
              style:background={layer.propColors.right}
            ></span>
          </div>
          <div class="layer-info">
            <span class="layer-name">{getLayerName(layer, index)}</span>
            <span class="layer-beats">{getLayerBeats(layer)} beats</span>
          </div>
          <div class="layer-actions">
            <button
              class="icon-btn"
              onclick={() => onEditLayerOffset(index)}
              aria-label="Edit beat offset"
              title="Beat offset: {layer.beatOffset}"
            >
              <i class="fas fa-clock" aria-hidden="true"></i>
            </button>
            <button
              class="icon-btn danger"
              onclick={() => onRemoveLayer(index)}
              aria-label="Remove layer"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      {/each}
    </div>

    <div class="editor-actions">
      {#if canAddLayer}
        <button class="add-btn" onclick={onAddSequence}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          Add Another
        </button>
      {/if}
      <button class="clear-btn" onclick={onClearCell}>
        <i class="fas fa-trash" aria-hidden="true"></i>
        Clear Cell
      </button>
    </div>
  {/if}
</div>

<style>
  .cell-editor {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .editor-header h4 {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .layer-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    padding: 2px 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--border-radius-sm);
  }

  /* Size/Span Controls */
  .size-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
    padding-bottom: var(--spacing-md, 12px);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .size-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs, 4px);
  }

  .size-btn {
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm, 4px);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .size-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .size-btn.active {
    background: var(--theme-accent, #8b5cf6);
    border-color: var(--theme-accent, #8b5cf6);
    color: white;
  }

  .size-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    text-align: center;
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .layers-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .layer-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm);
  }

  .layer-colors {
    display: flex;
    gap: 4px;
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .layer-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .layer-name {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, white);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .layer-beats {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .layer-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, white);
  }

  .icon-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .editor-actions {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
  }

  .add-btn,
  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .add-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .add-btn.primary {
    background: var(--theme-accent, #8b5cf6);
    border-color: var(--theme-accent, #8b5cf6);
  }

  .add-btn.primary:hover {
    background: var(--theme-accent-hover, #7c3aed);
  }

  .clear-btn {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .clear-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
</style>
