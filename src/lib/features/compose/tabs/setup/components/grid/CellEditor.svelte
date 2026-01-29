<!--
  CellEditor.svelte

  Editor panel for the selected cell.
  Shows the cell's layers and allows adding/removing sequences.
  Size controls are handled by drag-to-resize on the cell itself.
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
  }: {
    cell: GridCell;
    cellIndex: number;
    onAddSequence: () => void;
    onRemoveLayer: (layerIndex: number) => void;
    onEditLayerOffset: (layerIndex: number) => void;
    onClearCell: () => void;
  } = $props();

  const MAX_LAYERS = 4;
  const canAddLayer = $derived(cell.layers.length < MAX_LAYERS);

  // Show current size as text (read-only indicator)
  const sizeLabel = $derived(
    cell.colSpan === 1 && cell.rowSpan === 1
      ? "1×1"
      : `${cell.colSpan}×${cell.rowSpan}`
  );

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
    <div class="header-badges">
      {#if cell.colSpan > 1 || cell.rowSpan > 1}
        <span class="size-badge" title="Drag cell edges to resize">
          {sizeLabel}
        </span>
      {/if}
      <span class="layer-count">{cell.layers.length}/{MAX_LAYERS}</span>
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

  .header-badges {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
  }

  .layer-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    padding: 2px 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--border-radius-sm);
  }

  .size-badge {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-accent, #8b5cf6);
    padding: 2px 8px;
    background: rgba(139, 92, 246, 0.15);
    border-radius: var(--border-radius-sm);
    cursor: help;
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
