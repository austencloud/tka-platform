<!--
  CellEditorPanel.svelte

  Root component for the redesigned cell editor panel.
  Replaces CellEditor.svelte with a chip-based dashboard layout.
  Preserves the same props interface for backward compatibility
  and adds optional new callbacks for cell property controls.
-->
<script lang="ts">
  import type { GridCell } from "../../../state/arrange-grid-state.svelte";
  import type {
    TransformType,
    CellMediaType,
    CellEffect,
  } from "../../../../../compose/domain/types";
  import type { TipEffectMap, TipEffortMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import { TrailMode } from "$lib/shared/animation-engine/domain/types/TrailTypes";
  import { createCellEditorPanelState } from "./state/cell-editor-panel-state.svelte";
  import LayerSection from "./LayerSection.svelte";
  import ChipGrid from "./ChipGrid.svelte";
  import TransformSection from "./sections/TransformSection.svelte";
  import SpeedSection from "./sections/SpeedSection.svelte";
  import UnifiedEffectsSection from "./sections/UnifiedEffectsSection.svelte";
  import UnifiedEffortSection from "./sections/UnifiedEffortSection.svelte";
  import ColorsSection from "./sections/ColorsSection.svelte";
  import OffsetSection from "./sections/OffsetSection.svelte";
  import DisplaySection from "./sections/DisplaySection.svelte";

  const MAX_LAYERS = 4;

  interface CellEditorProps {
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
    onSetSpeed?: (speed: number) => void;
    onSetEffect?: (effect: CellEffect) => void;
    onSetTrailMode?: (mode: TrailMode) => void;
    onSetEffort?: (effort: string) => void;
    onSetColors?: (colors: import('$lib/features/compose/compose/domain/types').PropColors) => void;
    onSetBlueVisible?: (visible: boolean) => void;
    onSetRedVisible?: (visible: boolean) => void;
    onSetOffset?: (offset: number) => void;
    onSetTipEffectMap?: (map: TipEffectMap) => void;
    onSetTipEffortMap?: (map: TipEffortMap) => void;
  }

  const p: CellEditorProps = $props();
  // Access cell through props object (p.cell) in reactive contexts to avoid state_referenced_locally.
  // Alias other props for convenience since they aren't captured in $derived/$effect closures.
  const cell = $derived(p.cell);
  const cellIndex = $derived(p.cellIndex);
  const clipboardHasData = $derived(p.clipboardHasData ?? false);
  const transformingLayer = $derived(p.transformingLayer ?? null);

  const panelState = createCellEditorPanelState();

  // Reset state when the selected cell changes.
  // Track cell.id reactively via $derived to avoid state_referenced_locally warning.
  const currentCellId = $derived(cell.id);
  let previousCellId: string | null = null;
  $effect(() => {
    if (previousCellId !== null && currentCellId !== previousCellId) {
      panelState.resetForNewCell();
    }
    previousCellId = currentCellId;
  });

  const sizeLabel = $derived(
    cell.colSpan === 1 && cell.rowSpan === 1
      ? "1\u00d71"
      : `${cell.colSpan}\u00d7${cell.rowSpan}`
  );

  const showSizeBadge = $derived(cell.colSpan > 1 || cell.rowSpan > 1);

  function handleToggleBlueVisibility() {
    const current = cell.blueMotionVisible !== false;
    p.onSetBlueVisible?.(!current);
  }

  function handleToggleRedVisibility() {
    const current = cell.redMotionVisible !== false;
    p.onSetRedVisible?.(!current);
  }

  function handleTransform(type: TransformType) {
    p.onTransformLayer?.(0, type);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const key = e.key.toLowerCase();
    const shift = e.shiftKey;
    const map: Record<string, TransformType> = {
      m: "mirror",
      v: "flip",
      s: "swapColors",
      i: "invert",
      f: "shiftStart",
    };
    if (shift && key === "r") {
      handleTransform("rewind");
      e.preventDefault();
    } else if (map[key]) {
      handleTransform(map[key]);
      e.preventDefault();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="cell-editor-panel">
  <!-- Header -->
  <header class="panel-header">
    <div class="header-left">
      <h3 class="panel-title">Cell {cellIndex + 1}</h3>
      <div class="header-badges">
        {#if showSizeBadge}
          <span class="size-badge" title="Drag cell edges to resize">
            {sizeLabel}
          </span>
        {/if}
        {#if cell.layers.length > 0}
          <span class="layer-ratio-badge">
            {cell.layers.length}/{MAX_LAYERS}
          </span>
        {/if}
      </div>
    </div>
    {#if p.onClose}
      <button
        class="close-btn"
        onclick={p.onClose}
        title="Close"
        aria-label="Close panel"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    {/if}
  </header>

  <!-- Layers -->
  <LayerSection
    {cell}
    {clipboardHasData}
    {transformingLayer}
    onAddSequence={p.onAddSequence}
    onRemoveLayer={p.onRemoveLayer}
    onCopyLayer={p.onCopyLayer}
    onPasteLayer={p.onPasteLayer}
  />

  <!-- Control Chips -->
  {#if cell.layers.length > 0}
    <ChipGrid
      {cell}
      {panelState}
      onToggleBlueVisibility={handleToggleBlueVisibility}
      onToggleRedVisibility={handleToggleRedVisibility}
    />
  {/if}

  <!-- Expanded sections -->
  {#if panelState.expandedSection === 'transform'}
    <TransformSection {panelState} onTransform={handleTransform} />
  {:else if panelState.expandedSection === 'speed'}
    <SpeedSection
      currentSpeed={cell.speedMultiplier ?? 1.0}
      onSetSpeed={speed => p.onSetSpeed?.(speed)}
    />
  {:else if panelState.expandedSection === 'effects'}
    <UnifiedEffectsSection
      currentEffect={cell.effect ?? "none"}
      currentTrailMode={cell.trailMode}
      currentMap={cell.tipEffectMap ?? {}}
      bluePropType="staff"
      redPropType="staff"
      onSetEffect={effect => p.onSetEffect?.(effect)}
      onSetTrailMode={mode => p.onSetTrailMode?.(mode)}
      onUpdateMap={map => p.onSetTipEffectMap?.(map)}
    />
  {:else if panelState.expandedSection === 'colors'}
    <ColorsSection
      currentColors={cell.layers[0]?.propColors ?? { left: '#3b82f6', right: '#ef4444' }}
      onSetColors={colors => p.onSetColors?.(colors)}
    />
  {:else if panelState.expandedSection === 'effort'}
    <UnifiedEffortSection
      currentEffort={cell.effort}
      currentMap={cell.tipEffortMap ?? {}}
      bluePropType="staff"
      redPropType="staff"
      onSetEffort={effort => p.onSetEffort?.(effort)}
      onUpdateMap={map => p.onSetTipEffortMap?.(map)}
    />
  {:else if panelState.expandedSection === 'offset'}
    <OffsetSection
      currentOffset={cell.beatOffset}
      onSetOffset={offset => p.onSetOffset?.(offset)}
    />
  {:else if panelState.expandedSection === 'display'}
    <DisplaySection
      currentMediaType={cell.mediaType}
      layerCount={cell.layers.length}
      onMediaTypeChange={type => p.onMediaTypeChange(type)}
    />
  {/if}

  <!-- Footer actions -->
  {#if cell.layers.length > 0}
    <div class="panel-footer">
      {#if p.onCopyCell}
        <button class="footer-btn copy-all-btn" onclick={p.onCopyCell}>
          <i class="fas fa-copy" aria-hidden="true"></i>
          Copy All
        </button>
      {/if}
      <button class="footer-btn clear-all-btn" onclick={p.onClearCell}>
        <i class="fas fa-trash-alt" aria-hidden="true"></i>
        Clear All
      </button>
    </div>
  {/if}
</div>

<style>
  .cell-editor-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3cqi, 20px);
    padding: clamp(12px, 3cqi, 20px);
    height: 100%;
    overflow-y: auto;
    container-type: inline-size;
    container-name: celleditorpanel;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  /* Header */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: clamp(8px, 2cqi, 14px);
    border-bottom: 1px solid rgba(139, 92, 246, 0.12);
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

  .layer-ratio-badge {
    font-size: clamp(0.65rem, 2cqi, 0.75rem);
    color: rgba(167, 139, 250, 0.8);
    padding: 2px clamp(6px, 1.5cqi, 8px);
    background: rgba(139, 92, 246, 0.12);
    border-radius: clamp(3px, 1cqi, 4px);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    border-radius: 10px;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
    color: var(--theme-text, white);
  }

  /* Footer */
  .panel-footer {
    margin-top: auto;
    display: flex;
    gap: clamp(6px, 2cqi, 10px);
    padding-top: clamp(12px, 3cqi, 18px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .footer-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 2cqi, 10px);
    min-height: 44px;
    padding: clamp(10px, 2.5cqi, 14px);
    border-radius: clamp(6px, 2cqi, 10px);
    font-size: clamp(0.8rem, 2.8cqi, 0.95rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .copy-all-btn {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.6);
  }

  .copy-all-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .clear-all-btn {
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid rgba(239, 68, 68, 0.1);
    color: rgba(239, 68, 68, 0.6);
  }

  .clear-all-btn:hover {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.2);
  }

  @media (prefers-reduced-motion: reduce) {
    .close-btn,
    .footer-btn {
      transition: none;
    }
  }
</style>
