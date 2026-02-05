<!--
  CellEditor.svelte

  Editor panel for the selected cell.
  Shows the cell's layers and allows adding/removing sequences.
  Supports display mode toggle (animation ↔ choreo-card) for single-layer cells.
  Size controls are handled by drag-to-resize on the cell itself.
-->
<script lang="ts">
  import type { GridCell } from "../../state/arrange-grid-state.svelte";
  import type { TunnelLayerConfig, TransformType } from "../../../../compose/domain/types";
  import type { CellMediaType } from "../../../../compose/domain/types";

  let {
    cell,
    cellIndex,
    clipboardHasData = false,
    transformingLayer = null,
    onAddSequence,
    onRemoveLayer,
    onEditLayerOffset,
    onClearCell,
    onRemoveCell,
    onMediaTypeChange,
    onCopyLayer,
    onPasteLayer,
    onTransformLayer,
  }: {
    cell: GridCell;
    cellIndex: number;
    clipboardHasData?: boolean;
    transformingLayer?: { cellId: string; layerIndex: number } | null;
    onAddSequence: () => void;
    onRemoveLayer: (layerIndex: number) => void;
    onEditLayerOffset: (layerIndex: number) => void;
    onClearCell: () => void;
    onRemoveCell: () => void;
    onMediaTypeChange: (mediaType: CellMediaType) => void;
    onCopyLayer?: (layerIndex: number) => void;
    onPasteLayer?: () => void;
    onTransformLayer?: (layerIndex: number, transformType: TransformType) => void;
  } = $props();

  const MAX_LAYERS = 4;
  const canAddLayer = $derived(cell.layers.length < MAX_LAYERS);

  const TRANSFORMS: readonly {
    type: TransformType;
    icon: string;
    shortLabel: string;
    label: string;
  }[] = [
    { type: "rotate90", icon: "fa-redo", shortLabel: "90", label: "Rotate 90" },
    { type: "rotate180", icon: "fa-sync-alt", shortLabel: "180", label: "Rotate 180" },
    { type: "rotate270", icon: "fa-undo", shortLabel: "270", label: "Rotate 270" },
    { type: "mirror", icon: "fa-arrows-alt-h", shortLabel: "Mirror", label: "Mirror" },
    { type: "flip", icon: "fa-arrows-alt-v", shortLabel: "Flip", label: "Flip" },
    { type: "swapColors", icon: "fa-exchange-alt", shortLabel: "Swap", label: "Swap Colors" },
    { type: "invert", icon: "fa-adjust", shortLabel: "Invert", label: "Invert" },
    { type: "rewind", icon: "fa-backward", shortLabel: "Rewind", label: "Rewind" },
  ];

  // Expanded transform toolbar per layer index (-1 = none)
  let expandedTransformLayer = $state(-1);

  function isLayerTransforming(index: number): boolean {
    return (
      transformingLayer !== null &&
      transformingLayer.cellId === cell.id &&
      transformingLayer.layerIndex === index
    );
  }

  // Show display mode toggle when there's exactly 1 layer
  // Multiple layers = tunnel mode = always animation
  const showDisplayToggle = $derived(cell.layers.length === 1);

  // Is currently showing as choreo card?
  const isChoreoCard = $derived(cell.mediaType === "choreo-card");

  function handleToggleDisplayMode() {
    const newMode: CellMediaType = isChoreoCard ? "animation" : "choreo-card";
    onMediaTypeChange(newMode);
  }

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
      {#if cell.mediaType === "animation"}
        <span class="layer-count">{cell.layers.length}/{MAX_LAYERS}</span>
      {/if}
    </div>
  </div>

  {#if cell.layers.length === 0}
    <!-- No layers yet -->
    <div class="empty-state">
      <p>No sequences in this cell</p>
      <button class="add-btn primary" onclick={onAddSequence}>
        <i class="fas fa-plus" aria-hidden="true"></i>
        Add Sequence
      </button>
      {#if clipboardHasData && onPasteLayer}
        <button class="add-btn" onclick={onPasteLayer}>
          <i class="fas fa-paste" aria-hidden="true"></i>
          Paste
        </button>
      {/if}
      <button
        class="remove-cell-btn"
        onclick={onRemoveCell}
        title="Remove this cell from the grid (Delete)"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
        Remove Cell
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
            {#if onCopyLayer}
              <button
                class="icon-btn"
                onclick={() => onCopyLayer(index)}
                aria-label="Copy sequence"
                title="Copy"
              >
                <i class="fas fa-copy" aria-hidden="true"></i>
              </button>
            {/if}
            {#if onTransformLayer}
              <button
                class="icon-btn"
                class:active={expandedTransformLayer === index}
                onclick={() =>
                  (expandedTransformLayer =
                    expandedTransformLayer === index ? -1 : index)}
                aria-label="Transform sequence"
                title="Transforms"
              >
                <i class="fas fa-magic" aria-hidden="true"></i>
              </button>
            {/if}
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

        <!-- Transform toolbar (expandable per layer) -->
        {#if expandedTransformLayer === index && onTransformLayer}
          {@const transforming = isLayerTransforming(index)}
          <div class="transform-toolbar">
            {#each TRANSFORMS as t}
              <button
                class="transform-btn"
                onclick={() => onTransformLayer(index, t.type)}
                disabled={transforming}
                aria-label={t.label}
                title={t.label}
              >
                {#if transforming}
                  <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                {:else}
                  <i class="fas {t.icon}" aria-hidden="true"></i>
                {/if}
                <span>{t.shortLabel}</span>
              </button>
            {/each}
          </div>
        {/if}
      {/each}
    </div>

    <div class="editor-actions">
      {#if canAddLayer}
        <button class="add-btn" onclick={onAddSequence}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          Add Another
        </button>
      {/if}
      {#if clipboardHasData && canAddLayer && onPasteLayer}
        <button class="add-btn" onclick={onPasteLayer}>
          <i class="fas fa-paste" aria-hidden="true"></i>
          Paste
        </button>
      {/if}
      <button class="clear-btn" onclick={onClearCell}>
        <i class="fas fa-eraser" aria-hidden="true"></i>
        Clear
      </button>
      <button
        class="remove-cell-btn"
        onclick={onRemoveCell}
        title="Remove this cell from the grid (Delete)"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
        Remove
      </button>
    </div>

    <!-- Display Mode Toggle (only when exactly 1 layer) -->
    {#if showDisplayToggle}
      <div class="display-mode-section">
        <span class="mode-label">Display Mode</span>
        <div class="mode-toggle">
          <button
            class="mode-btn"
            class:active={!isChoreoCard}
            onclick={handleToggleDisplayMode}
            aria-pressed={!isChoreoCard}
          >
            <i class="fas fa-film" aria-hidden="true"></i>
            <span>Animation</span>
          </button>
          <button
            class="mode-btn"
            class:active={isChoreoCard}
            onclick={handleToggleDisplayMode}
            aria-pressed={isChoreoCard}
          >
            <i class="fas fa-id-card" aria-hidden="true"></i>
            <span>Choreo Card</span>
          </button>
        </div>
      </div>
    {/if}
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
    width: 48px;
    height: 48px;
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

  .icon-btn.active {
    background: rgba(139, 92, 246, 0.25);
    color: var(--theme-accent, #8b5cf6);
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
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .remove-cell-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid rgba(239, 68, 68, 0.3);
    background: transparent;
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-min, 14px);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .remove-cell-btn:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .empty-state .remove-cell-btn {
    margin-top: var(--spacing-sm);
  }

  /* Display mode toggle section */
  .display-mode-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs, 4px);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin-top: var(--spacing-sm);
  }

  .mode-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .mode-toggle {
    display: flex;
    gap: 2px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    padding: 2px;
  }

  .mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-sm, 8px);
    background: transparent;
    border: none;
    border-radius: var(--border-radius-sm, 6px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    min-height: 40px;
  }

  .mode-btn:hover:not(.active) {
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text, white);
  }

  .mode-btn.active {
    background: var(--theme-accent, #8b5cf6);
    color: white;
  }

  .mode-btn i {
    font-size: 12px;
  }

  /* Transform toolbar */
  .transform-toolbar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: var(--spacing-sm);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: var(--border-radius-sm);
    margin-top: -4px;
  }

  .transform-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 6px 4px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
    min-height: 40px;
  }

  .transform-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, white);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .transform-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .transform-btn i {
    font-size: 14px;
  }

  .transform-btn span {
    font-size: var(--font-size-compact, 12px);
    line-height: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-btn,
    .transform-btn {
      transition: none;
    }
  }
</style>
