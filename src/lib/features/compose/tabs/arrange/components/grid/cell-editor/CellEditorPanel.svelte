<script lang="ts">
  import type { GridCell } from "../../../state/arrange-grid-state.svelte";
  import type {
    TransformType,
    CellMediaType,
    CellEffect,
    PropColors,
  } from "../../../../../compose/domain/types";
  import type { TipEffectMap, TipEffortMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import { TrailMode } from "$lib/shared/animation-engine/domain/types/TrailTypes";
  import type { PillId } from "$lib/shared/sequence-viewer/components/pill-nav/pill-types";
  import { buildPillSpecs } from "$lib/shared/sequence-viewer/components/pill-nav/pill-types";
  import IconRailNav from "$lib/shared/sequence-viewer/components/pill-nav/IconRailNav.svelte";
  import ScopeBreadcrumb, { type BreadcrumbSegment } from "./ScopeBreadcrumb.svelte";
  import { createCellEditorPanelState, type ScopeLevel } from "./state/cell-editor-panel-state.svelte";
  import ScopeSelector from "./pill-nav/ScopeSelector.svelte";
  import LayerSection from "./LayerSection.svelte";
  import TransformSection from "./sections/TransformSection.svelte";
  import SpeedSection from "./sections/SpeedSection.svelte";
  import ColorsSection from "./sections/ColorsSection.svelte";
  import UnifiedEffectsSection from "./sections/UnifiedEffectsSection.svelte";
  import UnifiedEffortSection from "./sections/UnifiedEffortSection.svelte";
  import OffsetSection from "./sections/OffsetSection.svelte";
  import DisplaySection from "./sections/DisplaySection.svelte";

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
  }

  const p: CellEditorProps = $props();
  const cell = $derived(p.cell);
  const cellIndex = $derived(p.cellIndex);
  const clipboardHasData = $derived(p.clipboardHasData ?? false);
  const transformingLayer = $derived(p.transformingLayer ?? null);

  const panelState = createCellEditorPanelState();

  const currentCellId = $derived(cell.id);
  let previousCellId: string | null = null;
  $effect(() => {
    if (previousCellId !== null && currentCellId !== previousCellId) {
      panelState.resetForNewCell();
    }
    previousCellId = currentCellId;
  });

  // ── Pill specs with derived summaries ──

  const effectsSummary = $derived(
    cell.effect && cell.effect !== "none"
      ? cell.effect.charAt(0).toUpperCase() + cell.effect.slice(1)
      : "None"
  );

  const effortLabel = $derived(cell.effort ?? "Linear");
  const colorLabel = $derived.by(() => {
    const colors = cell.layers[0]?.propColors;
    if (!colors) return "Blue/Red";
    const labels: Record<string, string> = {
      "#3b82f6": "Blue/Red", "#a855f7": "Purple/Orange",
      "#10b981": "Emerald/Pink", "#06b6d4": "Cyan/Yellow",
    };
    return labels[colors.left] ?? "Custom";
  });
  const styleSummary = $derived(`${effortLabel} · ${colorLabel}`);

  const playbackSummary = $derived(
    `${(cell.speedMultiplier ?? 1).toFixed(1)}x · +${cell.beatOffset}`
  );

  const displaySummary = $derived(cell.mediaType === "choreo-card" ? "Card" : "Anim");

  const exportSummary = $derived("1080p · 30fps");

  const effortAccent = $derived.by(() => {
    if (!cell.effort || cell.effort === "none") return "#94a3b8";
    const colors: Record<string, string> = {
      linear: "#94a3b8", smooth: "#60a5fa", sharp: "#f97316",
      bounce: "#a855f7", elastic: "#34d399",
    };
    return colors[cell.effort] ?? "#94a3b8";
  });

  const pillSpecs = $derived(
    buildPillSpecs({
      effects: { icon: "fa-wand-magic-sparkles", label: "EFFECTS", summary: effectsSummary },
      effort: { label: "STYLE", summary: styleSummary, accentColor: effortAccent },
      playback: { icon: "fa-play", label: "PLAYBACK", summary: playbackSummary },
      display: { icon: "fa-eye", label: "DISPLAY", summary: displaySummary },
      export: { icon: "fa-download", label: "EXPORT", summary: exportSummary },
    })
  );

  // ── Breadcrumb segments ──

  const breadcrumbSegments = $derived.by<BreadcrumbSegment[]>(() => {
    const segs: BreadcrumbSegment[] = [{ level: "grid", label: "Grid" }];
    segs.push({ level: "cell", label: `Cell ${cellIndex + 1}` });
    if (
      panelState.scopeLevel === "layer" ||
      panelState.scopeLevel === "hand" ||
      panelState.scopeLevel === "tip"
    ) {
      segs.push({ level: "layer", label: "L1" });
    }
    return segs;
  });

  function handleBreadcrumbNav(level: ScopeLevel) {
    panelState.setScopeLevel(level);
  }

  // ── Handlers ──

  function handleTransform(type: TransformType) {
    p.onTransformLayer?.(0, type);
  }

  function handleToggleBlueVisibility() {
    p.onSetBlueVisible?.(cell.blueMotionVisible === false);
  }

  function handleToggleRedVisibility() {
    p.onSetRedVisible?.(cell.redMotionVisible === false);
  }

  const blueVisible = $derived(cell.blueMotionVisible !== false);
  const redVisible = $derived(cell.redMotionVisible !== false);

  function handleKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const key = e.key.toLowerCase();
    const shift = e.shiftKey;
    const map: Record<string, TransformType> = {
      m: "mirror", v: "flip", s: "swapColors", i: "invert", f: "shiftStart",
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

<div class="cell-editor-rail-layout">
  <!-- Icon Rail (left) -->
  <IconRailNav
    pills={pillSpecs}
    activeId={panelState.activePill}
    onSelect={(id) => panelState.setActivePill(id)}
  />

  <!-- Main Panel (right) -->
  <div class="cell-editor-main">
    <!-- Breadcrumb -->
    <ScopeBreadcrumb
      segments={breadcrumbSegments}
      onNavigate={handleBreadcrumbNav}
    />

    <!-- Layers section (visible at cell/grid scope) -->
    {#if cell.layers.length > 0 && (panelState.scopeLevel === "cell" || panelState.scopeLevel === "grid")}
      <div class="layers-zone">
        <LayerSection
          {cell}
          {clipboardHasData}
          {transformingLayer}
          onAddSequence={p.onAddSequence}
          onRemoveLayer={p.onRemoveLayer}
          onCopyLayer={p.onCopyLayer}
          onPasteLayer={p.onPasteLayer}
        />
      </div>
    {/if}

    <!-- Pill Body (scrollable) -->
    {#if cell.layers.length > 0}
      <div class="pill-body-scroll" role="region" aria-label="{panelState.activePill} settings">
        {#if panelState.activePill === "effects"}
          <UnifiedEffectsSection
            currentEffect={cell.effect ?? "none"}
            currentTrailMode={cell.trailMode}
            currentMap={cell.tipEffectMap ?? {}}
            bluePropType="staff"
            redPropType="staff"
            onSetEffect={(effect) => p.onSetEffect?.(effect)}
            onSetTrailMode={(mode) => p.onSetTrailMode?.(mode)}
            onUpdateMap={(map) => p.onSetTipEffectMap?.(map)}
          />

        {:else if panelState.activePill === "effort"}
          <div class="style-sections">
            <TransformSection {panelState} onTransform={handleTransform} />
            <ColorsSection
              currentColors={cell.layers[0]?.propColors ?? { left: "#3b82f6", right: "#ef4444" }}
              onSetColors={(colors) => p.onSetColors?.(colors)}
            />
            <UnifiedEffortSection
              currentEffort={cell.effort}
              currentMap={cell.tipEffortMap ?? {}}
              bluePropType="staff"
              redPropType="staff"
              onSetEffort={(effort) => p.onSetEffort?.(effort)}
              onUpdateMap={(map) => p.onSetTipEffortMap?.(map)}
            />
            <div class="visibility-section">
              <span class="section-label">VISIBILITY</span>
              <div class="visibility-row">
                <button
                  type="button"
                  class="vis-btn"
                  class:active={blueVisible}
                  style:--vis-color="#60a5fa"
                  aria-pressed={blueVisible}
                  onclick={handleToggleBlueVisibility}
                >
                  <i class="fas fa-eye" aria-hidden="true"></i> Blue
                </button>
                <button
                  type="button"
                  class="vis-btn"
                  class:active={redVisible}
                  style:--vis-color="#dc2626"
                  aria-pressed={redVisible}
                  onclick={handleToggleRedVisibility}
                >
                  <i class="fas fa-eye" aria-hidden="true"></i> Red
                </button>
              </div>
            </div>
          </div>

        {:else if panelState.activePill === "playback"}
          <SpeedSection
            currentSpeed={cell.speedMultiplier ?? 1.0}
            onSetSpeed={(speed) => p.onSetSpeed?.(speed)}
          />
          <OffsetSection
            currentOffset={cell.beatOffset}
            onSetOffset={(offset) => p.onSetOffset?.(offset)}
          />

        {:else if panelState.activePill === "display"}
          <DisplaySection
            currentMediaType={cell.mediaType}
            layerCount={cell.layers.length}
            onMediaTypeChange={(type) => p.onMediaTypeChange(type)}
          />

        {:else if panelState.activePill === "export"}
          <div class="export-section">
            <button class="download-btn" type="button">
              <i class="fas fa-download" aria-hidden="true"></i>
              Download Arrangement
            </button>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="panel-footer">
        {#if p.onCopyCell}
          <button class="footer-btn copy-all-btn" type="button" onclick={p.onCopyCell}>
            <i class="fas fa-copy" aria-hidden="true"></i>
            Copy All
          </button>
        {/if}
        <button class="footer-btn clear-all-btn" type="button" onclick={p.onClearCell}>
          <i class="fas fa-trash-alt" aria-hidden="true"></i>
          Clear All
        </button>
      </div>
    {:else}
      <div class="empty-state">
        <LayerSection
          {cell}
          {clipboardHasData}
          {transformingLayer}
          onAddSequence={p.onAddSequence}
          onRemoveLayer={p.onRemoveLayer}
          onCopyLayer={p.onCopyLayer}
          onPasteLayer={p.onPasteLayer}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  /* ── Rail Layout ── */
  .cell-editor-rail-layout {
    display: flex;
    min-height: 0;
    flex: 1;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: var(--surface-panel, #0f1119);
    container-type: inline-size;
    container-name: celleditorpanel;

    /* Design tokens (inherited by children) */
    --chip-radius: 22px;
    --action-radius: 10px;
    --badge-radius: 4px;
    --surface-idle: rgba(255, 255, 255, 0.05);
    --surface-hover: rgba(255, 255, 255, 0.08);
    --surface-active-pct: 12%;
    --stroke-idle: rgba(255, 255, 255, 0.08);
    --stroke-hover: rgba(255, 255, 255, 0.15);
    --stroke-active-pct: 35%;
    --chip-gap: clamp(6px, 1.5cqi, 8px);
    --group-gap: clamp(10px, 2.5cqi, 14px);
    --section-gap: clamp(12px, 3cqi, 20px);
  }

  .cell-editor-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  /* ── Layers zone ── */
  .layers-zone {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    flex-shrink: 0;
  }

  /* ── Pill body (scrollable) ── */
  .pill-body-scroll {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .style-sections {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* ── Visibility toggles (inside Style pill) ── */
  .visibility-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
  }

  .visibility-row {
    display: flex;
    gap: 6px;
  }

  .vis-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 44px;
    padding: 8px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.55);
    font-size: 12px;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }

  .vis-btn.active {
    background: color-mix(in srgb, var(--vis-color) 12%, transparent);
    border-color: color-mix(in srgb, var(--vis-color) 30%, transparent);
    color: color-mix(in srgb, var(--vis-color) 100%, white 30%);
  }

  .vis-btn i {
    font-size: 11px;
  }

  /* ── Export section ── */
  .export-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .download-btn {
    width: 100%;
    padding: 11px;
    border-radius: 10px;
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    color: white;
    font-size: 13px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: opacity 150ms ease;
  }

  .download-btn:hover {
    opacity: 0.9;
  }

  /* ── Empty state ── */
  .empty-state {
    flex: 1;
    padding: 10px;
  }

  /* ── Footer ── */
  .panel-footer {
    flex-shrink: 0;
    display: flex;
    gap: var(--chip-gap, 6px);
    padding: 8px 10px;
    border-top: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
  }

  .footer-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 10px 14px;
    border-radius: var(--action-radius, 10px);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .copy-all-btn {
    background: var(--surface-idle);
    border: 1px solid var(--stroke-idle);
    color: rgba(255, 255, 255, 0.6);
  }

  .copy-all-btn:hover {
    background: var(--surface-hover);
    border-color: var(--stroke-hover);
  }

  .clear-all-btn {
    background: color-mix(in srgb, #ef4444 6%, transparent);
    border: 1px solid color-mix(in srgb, #ef4444 10%, transparent);
    color: rgba(239, 68, 68, 0.6);
  }

  .clear-all-btn:hover {
    background: color-mix(in srgb, #ef4444 var(--surface-active-pct), transparent);
    border-color: color-mix(in srgb, #ef4444 20%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .vis-btn,
    .footer-btn,
    .download-btn {
      transition: none;
    }
  }
</style>
