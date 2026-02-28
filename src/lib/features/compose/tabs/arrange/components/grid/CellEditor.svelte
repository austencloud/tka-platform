<!--
  CellEditor.svelte

  Drawer-hosted editor panel for the selected cell.
  Shows the cell's layers as chips and allows adding/removing sequences.
  Supports display mode toggle (animation / choreo-card) for single-layer cells.
  Restyled to match CellConfigPanel: container queries, clamp(), theme vars.
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
    onCopyCell,
    onPasteLayer,
    onTransformLayer,
    onClose,
  }: {
    cell: GridCell;
    cellIndex: number;
    clipboardHasData?: boolean;
    transformingLayer?: { cellId: string; layerIndex: number } | null;
    onAddSequence: () => void;
    onRemoveLayer: (layerIndex: number) => void;
    onEditLayerOffset: (layerIndex: number) => void;
    onClearCell: () => void;
    onRemoveCell?: () => void;
    onMediaTypeChange: (mediaType: CellMediaType) => void;
    onCopyLayer?: (layerIndex: number) => void;
    onCopyCell?: () => void;
    onPasteLayer?: () => void;
    onTransformLayer?: (layerIndex: number, transformType: TransformType) => void;
    onClose?: () => void;
  } = $props();

  const MAX_LAYERS = 4;
  const canAddLayer = $derived(cell.layers.length < MAX_LAYERS);

  const TRANSFORMS: readonly {
    type: TransformType;
    icon: string;
    shortLabel: string;
    label: string;
    hotkey?: string;
  }[] = [
    { type: "rotate90", icon: "fa-redo", shortLabel: "90", label: "Rotate 90", hotkey: "R" },
    { type: "rotate180", icon: "fa-sync-alt", shortLabel: "180", label: "Rotate 180" },
    { type: "rotate270", icon: "fa-undo", shortLabel: "270", label: "Rotate 270" },
    { type: "mirror", icon: "fa-arrows-alt-h", shortLabel: "Mirror", label: "Mirror", hotkey: "M" },
    { type: "flip", icon: "fa-arrows-alt-v", shortLabel: "Flip", label: "Flip", hotkey: "V" },
    { type: "swapColors", icon: "fa-exchange-alt", shortLabel: "Swap", label: "Swap Colors", hotkey: "S" },
    { type: "invert", icon: "fa-adjust", shortLabel: "Invert", label: "Invert", hotkey: "I" },
    { type: "rewind", icon: "fa-backward", shortLabel: "Rewind", label: "Rewind", hotkey: "⇧R" },
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
      ? "1\u00d71"
      : `${cell.colSpan}\u00d7${cell.rowSpan}`
  );

  function getLayerName(layer: TunnelLayerConfig, index: number): string {
    return layer.sequence.word || layer.sequence.name || `Sequence ${index + 1}`;
  }

  function getLayerBeats(layer: TunnelLayerConfig): number {
    return layer.sequence.steps?.length || 0;
  }
</script>

<div class="cell-editor-body">
  <!-- Header -->
  <header class="panel-header">
    <div class="header-left">
      <h3 class="panel-title">Cell {cellIndex + 1}</h3>
      <div class="header-badges">
        {#if cell.colSpan > 1 || cell.rowSpan > 1}
          <span class="size-badge" title="Drag cell edges to resize">
            {sizeLabel}
          </span>
        {/if}
        {#if cell.mediaType === "animation" && cell.layers.length > 0}
          <span class="layer-count-badge">{cell.layers.length}/{MAX_LAYERS}</span>
        {/if}
      </div>
    </div>
    {#if onClose}
      <button
        class="close-btn"
        onclick={onClose}
        title="Close"
        aria-label="Close panel"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    {/if}
  </header>

  <!-- Layers Section -->
  <section class="panel-section">
    <div class="section-header">
      <span class="section-label">
        Layers
        {#if cell.layers.length > 1}
          <span class="mode-badge tunnel">
            <i class="fas fa-layer-group" aria-hidden="true"></i>
            Tunnel
          </span>
        {/if}
      </span>
      <span class="count">{cell.layers.length}/{MAX_LAYERS}</span>
    </div>

    {#if cell.layers.length === 0}
      <!-- Empty state -->
      <div class="empty-layers">
        <p>No sequences yet</p>
        <button class="add-sequence-btn" onclick={onAddSequence}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          <span>Add Sequence</span>
        </button>
        {#if clipboardHasData && onPasteLayer}
          <button class="paste-btn" onclick={onPasteLayer}>
            <i class="fas fa-paste" aria-hidden="true"></i>
            <span>Paste</span>
          </button>
        {/if}
      </div>
    {:else}
      <!-- Layer chips -->
      <div class="layer-list">
        {#each cell.layers as layer, index}
          <div class="layer-chip">
            <div class="chip-colors">
              <span
                class="color-dot"
                style:background={layer.propColors.left}
              ></span>
              <span
                class="color-dot"
                style:background={layer.propColors.right}
              ></span>
            </div>
            <div class="chip-info">
              <span class="chip-name">{getLayerName(layer, index)}</span>
              <span class="chip-beats">{getLayerBeats(layer)} beats</span>
            </div>
            <div class="chip-actions">
              {#if onCopyLayer}
                <button
                  class="chip-action-btn"
                  onclick={() => onCopyLayer(index)}
                  aria-label="Copy sequence"
                  title="Copy"
                >
                  <i class="fas fa-copy" aria-hidden="true"></i>
                </button>
              {/if}
              {#if onTransformLayer}
                <button
                  class="chip-action-btn"
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
                class="chip-action-btn"
                onclick={() => onEditLayerOffset(index)}
                aria-label="Edit beat offset"
                title="Beat offset: {layer.beatOffset}"
              >
                <i class="fas fa-clock" aria-hidden="true"></i>
              </button>
              <button
                class="chip-action-btn danger"
                onclick={() => onRemoveLayer(index)}
                aria-label="Remove layer"
                title="Remove"
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
                  title={t.hotkey ? `${t.label} (${t.hotkey})` : t.label}
                >
                  {#if transforming}
                    <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                  {:else}
                    <i class="fas {t.icon}" aria-hidden="true"></i>
                  {/if}
                  <span>{t.shortLabel}</span>
                  {#if t.hotkey}
                    <kbd class="hotkey-badge">{t.hotkey}</kbd>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        {/each}
      </div>

      <!-- Add / Paste buttons below list -->
      <div class="layer-add-actions">
        {#if canAddLayer}
          <button class="add-sequence-btn" onclick={onAddSequence}>
            <i class="fas fa-plus" aria-hidden="true"></i>
            <span>Add Layer ({cell.layers.length + 1}/{MAX_LAYERS})</span>
          </button>
        {/if}
        {#if clipboardHasData && canAddLayer && onPasteLayer}
          <button class="paste-btn" onclick={onPasteLayer}>
            <i class="fas fa-paste" aria-hidden="true"></i>
            <span>Paste</span>
          </button>
        {/if}
      </div>
    {/if}
  </section>

  <!-- Display Mode Toggle (only when exactly 1 layer) -->
  {#if showDisplayToggle}
    <section class="panel-section">
      <div class="section-header">
        <span class="section-label">Display</span>
      </div>
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
    </section>
  {/if}

  <!-- Bottom actions: Copy All + Clear All -->
  {#if cell.layers.length > 0}
    <div class="panel-actions">
      {#if onCopyCell}
        <button class="action-btn copy-all-btn" onclick={onCopyCell}>
          <i class="fas fa-copy" aria-hidden="true"></i>
          Copy All
        </button>
      {/if}
      <button class="action-btn clear-all-btn" onclick={onClearCell}>
        <i class="fas fa-trash-alt" aria-hidden="true"></i>
        Clear All
      </button>
    </div>
  {/if}
</div>

<style>
  /* Container query root */
  .cell-editor-body {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3cqi, 20px);
    padding: clamp(12px, 3cqi, 20px);
    height: 100%;
    overflow-y: auto;
    container-type: inline-size;
    container-name: celleditor;
  }

  /* ====== HEADER ====== */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: clamp(8px, 2cqi, 14px);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: clamp(6px, 2cqi, 10px);
  }

  .panel-title {
    margin: 0;
    font-size: clamp(0.9rem, 3.5cqi, 1.1rem);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .header-badges {
    display: flex;
    align-items: center;
    gap: clamp(4px, 1cqi, 6px);
  }

  .size-badge {
    font-size: clamp(0.65rem, 2cqi, 0.75rem);
    color: var(--theme-accent, #8b5cf6);
    padding: 2px clamp(6px, 1.5cqi, 8px);
    background: rgba(139, 92, 246, 0.15);
    border-radius: clamp(3px, 1cqi, 4px);
    cursor: help;
  }

  .layer-count-badge {
    font-size: clamp(0.65rem, 2cqi, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    padding: 2px clamp(6px, 1.5cqi, 8px);
    background: rgba(255, 255, 255, 0.1);
    border-radius: clamp(3px, 1cqi, 4px);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 48px);
    height: var(--min-touch-target, 48px);
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    border-radius: clamp(4px, 1.5cqi, 8px);
    transition: all var(--duration-fast, 150ms) ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, white);
  }

  /* ====== SECTIONS ====== */
  .panel-section {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2cqi, 12px);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: clamp(6px, 2cqi, 10px);
    font-size: clamp(0.75rem, 2.5cqi, 0.85rem);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .mode-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px clamp(6px, 1.5cqi, 8px);
    border-radius: clamp(3px, 1cqi, 4px);
    font-size: clamp(0.65rem, 2cqi, 0.75rem);
    font-weight: 500;
    text-transform: none;
  }

  .mode-badge.tunnel {
    background: rgba(139, 92, 246, 0.2);
    color: rgba(167, 139, 250, 0.95);
  }

  .count {
    font-size: clamp(0.7rem, 2.2cqi, 0.8rem);
    font-weight: 400;
    color: rgba(255, 255, 255, 0.4);
  }

  /* ====== EMPTY STATE ====== */
  .empty-layers {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(10px, 3cqi, 16px);
    padding: clamp(16px, 4cqi, 24px);
    text-align: center;
  }

  .empty-layers p {
    margin: 0;
    font-size: clamp(0.8rem, 2.8cqi, 0.9rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* ====== LAYER CHIPS ====== */
  .layer-list {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 2cqi, 10px);
  }

  .layer-chip {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2cqi, 12px);
    min-height: var(--min-touch-target, 48px);
    padding: clamp(8px, 2cqi, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: clamp(6px, 2cqi, 10px);
  }

  .chip-colors {
    display: flex;
    gap: clamp(3px, 1cqi, 4px);
    flex-shrink: 0;
  }

  .color-dot {
    width: clamp(10px, 3cqi, 14px);
    height: clamp(10px, 3cqi, 14px);
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .chip-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .chip-name {
    font-size: clamp(0.8rem, 2.8cqi, 0.95rem);
    color: var(--theme-text, white);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chip-beats {
    font-size: clamp(0.7rem, 2.2cqi, 0.8rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .chip-actions {
    display: flex;
    gap: clamp(2px, 0.5cqi, 4px);
    flex-shrink: 0;
  }

  .chip-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 48px);
    height: var(--min-touch-target, 48px);
    border: none;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    border-radius: clamp(4px, 1.5cqi, 8px);
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease;
  }

  .chip-action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, white);
  }

  .chip-action-btn.active {
    background: rgba(139, 92, 246, 0.25);
    color: var(--theme-accent, #8b5cf6);
  }

  .chip-action-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: rgba(239, 68, 68, 0.9);
  }

  /* ====== TRANSFORM TOOLBAR ====== */
  .transform-toolbar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: clamp(3px, 1cqi, 4px);
    padding: clamp(6px, 1.5cqi, 10px);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: clamp(4px, 1.5cqi, 8px);
    margin-top: clamp(-6px, -1.5cqi, -3px);
  }

  .transform-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: clamp(4px, 1.5cqi, 8px) clamp(2px, 1cqi, 4px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: clamp(0.7rem, 2.2cqi, 0.8rem);
    border-radius: clamp(4px, 1.5cqi, 6px);
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease;
    min-height: var(--min-touch-target, 48px);
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
    font-size: clamp(12px, 3.5cqi, 14px);
  }

  .transform-btn span {
    font-size: clamp(0.65rem, 2cqi, 0.75rem);
    line-height: 1;
  }

  .hotkey-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    font-size: clamp(8px, 2cqi, 10px);
    line-height: 1;
    padding: 1px 3px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 3px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-family: system-ui, sans-serif;
    pointer-events: none;
  }

  /* ====== ADD / PASTE BUTTONS ====== */
  .layer-add-actions {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 2cqi, 10px);
    margin-top: clamp(4px, 1cqi, 8px);
  }

  .add-sequence-btn,
  .paste-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 2cqi, 10px);
    min-height: var(--min-touch-target, 48px);
    padding: clamp(10px, 2.5cqi, 14px);
    background: rgba(16, 185, 129, 0.15);
    border: 1px dashed rgba(16, 185, 129, 0.4);
    border-radius: clamp(6px, 2cqi, 10px);
    color: rgba(16, 185, 129, 0.9);
    font-size: clamp(0.8rem, 2.8cqi, 0.95rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .add-sequence-btn:hover,
  .paste-btn:hover {
    background: rgba(16, 185, 129, 0.25);
    border-color: rgba(16, 185, 129, 0.6);
  }

  .paste-btn {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.3);
    color: rgba(167, 139, 250, 0.9);
  }

  .paste-btn:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
  }

  /* ====== DISPLAY MODE TOGGLE ====== */
  .mode-toggle {
    display: flex;
    gap: 2px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: clamp(6px, 2cqi, 10px);
    padding: 2px;
  }

  .mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1cqi, 6px);
    padding: clamp(8px, 2cqi, 12px);
    background: transparent;
    border: none;
    border-radius: clamp(4px, 1.5cqi, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: clamp(0.75rem, 2.5cqi, 0.85rem);
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease;
    min-height: var(--min-touch-target, 48px);
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
    font-size: clamp(11px, 3cqi, 13px);
  }

  /* ====== BOTTOM ACTIONS ====== */
  .panel-actions {
    margin-top: auto;
    display: flex;
    gap: clamp(6px, 2cqi, 10px);
    padding-top: clamp(12px, 3cqi, 18px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 2cqi, 10px);
    min-height: var(--min-touch-target, 48px);
    padding: clamp(10px, 2.5cqi, 14px);
    border-radius: clamp(6px, 2cqi, 10px);
    font-size: clamp(0.8rem, 2.8cqi, 0.95rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .copy-all-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, white);
  }

  .copy-all-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .clear-all-btn {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: rgba(239, 68, 68, 0.8);
  }

  .clear-all-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
  }

  /* ====== REDUCED MOTION ====== */
  @media (prefers-reduced-motion: reduce) {
    .close-btn,
    .chip-action-btn,
    .transform-btn,
    .add-sequence-btn,
    .paste-btn,
    .mode-btn,
    .action-btn {
      transition: none;
    }
  }
</style>
