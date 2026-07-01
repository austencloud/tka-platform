<!--
  SheetPreviewPages.svelte

  On-screen landscape preview of a choreo sheet. Mirrors the print-preview page
  frame (PrintPreviewPages.svelte) but landscape (aspect-ratio 11/8.5) and
  grid-spec driven instead of card-inches driven. Each page is a fixed-aspect
  white .page; each row is its own CSS grid of `columns` square cells so block
  separators can span the full row width. Cells render LIVE via
  PictographContainer (the same smart wrapper WorkspaceGrid / the viewer use)
  with the locked sheet visibility — instant + crisp, no worker cold-start.

  Layout + visual parity with the PDF comes from both consuming the same
  planSheet() rows, getSheetPageLayout() geometry, and SHEET_CELL_VISIBILITY.

  Reuse note: PictographContainer (not StepCell) is the cell — StepCell wraps it
  with interactive button/selection/haptic/context-menu machinery and renders
  with the GLOBAL visibility settings, neither of which suits a 48-cell static
  print grid; StepStrip is a sliding focus carousel, not a static grid.

  Virtualization: only pages near the viewport mount their pictograph cells (one
  shared IntersectionObserver, project pattern from PropAwareThumbnail). Off-screen
  pages keep their aspect-ratio frame and empty cell boxes, so toggling never
  shifts layout (no-layout-shift) while capping live-component count.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import type { SheetPage, SheetCell } from "../../services/sheet-row-planner";
  import type { SheetPageGeometry } from "../../domain/sheet-page-layout";
  import type { ChoreoSheetLayout } from "../../domain/types/choreo-sheet";
  import { SHEET_CELL_VISIBILITY } from "../../services/sheet-cell-config";

  let {
    pages,
    geo,
    layout,
    breakSequenceIds = new Set<string>(),
    selectedSequenceId = null,
    onSelectSequence,
    onRemoveSequence,
  }: {
    pages: SheetPage[];
    geo: SheetPageGeometry;
    layout: ChoreoSheetLayout;
    /** Sequence ids whose block does NOT connect to the sequence above it. */
    breakSequenceIds?: Set<string>;
    /** The currently-selected sequence block (whole-sequence select-then-remove). */
    selectedSequenceId?: string | null;
    onSelectSequence?: (sequenceId: string) => void;
    onRemoveSequence?: (sequenceId: string) => void;
  } = $props();

  // PictographContainer takes a boolean showHandPoints; the locked config carries
  // the richer "all" | "active" | "none". Map "none" → hidden, everything else on.
  const showHandPoints = SHEET_CELL_VISIBILITY.handPointVisibility !== "none";

  // Geometry → CSS. The centered grid box equals the page's usable area, so a
  // column track is one cell and the gaps are the gutter. Percentages resolve
  // against the row container's width (column-gap) and the page height (row-gap),
  // and since the page has a fixed aspect ratio both axes scale together — the
  // gutter stays visually equal on both. Square cells (aspect-ratio:1) mean
  // neither axis reflows the other.
  const gridWidthPt = $derived(geo.columns * geo.cellSizePt + (geo.columns - 1) * geo.gutterPt);
  const gridHeightPt = $derived(geo.rows * geo.cellSizePt + (geo.rows - 1) * geo.gutterPt);
  const marginXPct = $derived((geo.marginXPt / geo.pageWidthPt) * 100);
  const marginYPct = $derived((geo.marginYPt / geo.pageHeightPt) * 100);
  const colGapPct = $derived((geo.gutterPt / gridWidthPt) * 100);
  const rowGapPct = $derived((geo.gutterPt / gridHeightPt) * 100);
  const pageAspect = $derived(`${geo.pageWidthPt} / ${geo.pageHeightPt}`);

  // Pages near the viewport mount their cells; the rest hold an empty frame.
  let visiblePages = $state(new Set<number>());

  // Lazily-created shared observer (actions run before the component's onMount,
  // so create it on first observe rather than in onMount).
  let observer: IntersectionObserver | null = null;
  function ensureObserver(): IntersectionObserver | null {
    if (observer) return observer;
    if (typeof IntersectionObserver === "undefined") return null; // SSR / unsupported
    observer = new IntersectionObserver(
      (entries) => {
        const next = new Set(visiblePages);
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.pageIndex);
          if (Number.isNaN(idx)) continue;
          if (entry.isIntersecting) next.add(idx);
          else next.delete(idx);
        }
        visiblePages = next;
      },
      { rootMargin: "400px 0px", threshold: 0.01 },
    );
    return observer;
  }

  function observePage(el: HTMLElement, index: number) {
    el.dataset.pageIndex = String(index);
    const obs = ensureObserver();
    obs?.observe(el);
    return {
      destroy() {
        obs?.unobserve(el);
      },
    };
  }

  onDestroy(() => observer?.disconnect());

  // Sequences flow continuously, so a boundary falls on the sequence-start CELL
  // (it can land mid-row), not on a whole row. All three marks are per-cell.

  // A break: the sequence starting here doesn't connect to the one before it. A
  // warning, so it draws regardless of the group-separator style.
  function isCellBreak(cell: SheetCell): boolean {
    return cell.isSequenceStart && !!cell.sequenceId && breakSequenceIds.has(cell.sequenceId);
  }

  // A separator: a divider at each sequence start (except the sheet's very first
  // cell). Only the "rule" style draws it.
  function isCellSeparator(cell: SheetCell, isFirstCell: boolean): boolean {
    return layout.groupSeparator === "rule" && cell.isSequenceStart && !isFirstCell;
  }

  function isSelected(sequenceId: string | null | undefined): boolean {
    return !!sequenceId && sequenceId === selectedSequenceId;
  }
</script>

{#if pages.length === 0}
  <p class="empty">No sequences yet.</p>
{:else}
  <div class="pages-scroll">
    {#each pages as page, pi (pi)}
      <div class="page" use:observePage={pi} style="aspect-ratio: {pageAspect};">
        <div
          class="grid-area"
          style="inset: {marginYPct}% {marginXPct}%; row-gap: {rowGapPct}%;"
        >
          {#each page.rows as row, ri (ri)}
            <div
              class="sheet-row"
              style="grid-template-columns: repeat({geo.columns}, 1fr); column-gap: {colGapPct}%;"
            >
              {#each row.cells as cell, ci (ci)}
                <div
                  class="cell"
                  class:blank={cell.isBlank}
                  class:selected={isSelected(cell.sequenceId)}
                  class:break={isCellBreak(cell)}
                  class:separator={isCellSeparator(cell, pi === 0 && ri === 0 && ci === 0)}
                >
                  {#if !cell.isBlank && cell.sequenceId && onSelectSequence}
                    <button
                      type="button"
                      class="cell-select"
                      aria-label="Select this sequence"
                      aria-pressed={isSelected(cell.sequenceId)}
                      onclick={() => onSelectSequence?.(cell.sequenceId!)}
                    ></button>
                  {/if}
                  {#if isCellBreak(cell)}
                    <span class="cell-break-label">
                      <i class="fa-solid fa-link-slash" aria-hidden="true"></i> break
                    </span>
                  {/if}
                  {#if cell.isSequenceStart && isSelected(cell.sequenceId) && onRemoveSequence}
                    <button
                      type="button"
                      class="block-remove"
                      onclick={(e) => {
                        e.stopPropagation();
                        onRemoveSequence?.(cell.sequenceId!);
                      }}
                    >
                      <i class="fa-solid fa-trash" aria-hidden="true"></i> Remove
                    </button>
                  {/if}
                  {#if cell.step && visiblePages.has(pi)}
                    <PictographContainer
                      pictographData={cell.step}
                      disableTransitions={true}
                      printMode={true}
                      darkMode={false}
                      showGrid={SHEET_CELL_VISIBILITY.showGrid}
                      showTKA={SHEET_CELL_VISIBILITY.showTKA}
                      showReversals={SHEET_CELL_VISIBILITY.showReversals}
                      showNonRadialPoints={SHEET_CELL_VISIBILITY.showNonRadialPoints}
                      showTnD={SHEET_CELL_VISIBILITY.showTnD}
                      showElemental={SHEET_CELL_VISIBILITY.showElemental}
                      showPositions={SHEET_CELL_VISIBILITY.showPositions}
                      stepNumberOverride={layout.showStepNumbers}
                      {showHandPoints}
                    />
                  {/if}
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .pages-scroll {
    display: flex;
    flex-direction: column;
    gap: 24px;
    align-items: center;
    padding-bottom: 24px;
  }

  .page {
    /* Component-scoped print-surface borders (the white sheet is print-fixed —
       these never track the app theme, so no global token applies). */
    --print-border-faint: rgba(0, 0, 0, 0.06);
    --print-border-strong: rgba(0, 0, 0, 0.4);
    position: relative;
    background: var(--print-bg, #ffffff);
    border-radius: 4px;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.3));
    width: 100%;
    max-width: 1100px;
    box-sizing: border-box;
    /* Clip any sub-pixel overflow from rounded cell sizes so rows never bleed. */
    overflow: hidden;
  }

  /* The usable grid area, centered on the page via the margin insets. Rows stack
     top-down; each row stretches to the full width (its grid handles columns). */
  .grid-area {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
  }

  .sheet-row {
    position: relative;
    display: grid;
    width: 100%;
  }

  .cell {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1px solid var(--sheet-cell-stroke, rgba(0, 0, 0, 0.18));
    border-radius: 3px;
    box-sizing: border-box;
  }

  .cell.blank {
    background: transparent;
    border-color: var(--print-border-faint, rgba(0, 0, 0, 0.06));
  }

  /* Separator: a vertical divider on the left edge of a sequence-start cell —
     in flow mode a boundary is between two cells, not two rows. */
  .cell.separator {
    border-left: 2px solid var(--print-border-strong, rgba(0, 0, 0, 0.4));
  }

  /* Whole-sequence selection: a transparent hit layer over each cell, an accent
     ring on every cell of the selected sequence, and a Remove button on its
     first cell. */
  .cell-select {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
  }

  .cell.selected::after {
    content: "";
    position: absolute;
    inset: 0;
    border: 2px solid var(--theme-accent, #6366f1);
    border-radius: 3px;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 14%, transparent);
    pointer-events: none;
    z-index: 2;
  }

  .block-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 12px;
    background: var(--theme-danger, #ef4444);
    color: var(--theme-text-inverse, #fff);
    border: none;
    border-radius: 8px;
    font-size: var(--font-size-compact, 0.72rem);
    font-weight: 700;
    cursor: pointer;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.3));
  }

  .block-remove:hover {
    filter: brightness(1.08);
  }

  /* Break: a thick red left edge on the start cell (the boundary is vertical in
     flow) + a small corner flag. */
  .cell.break {
    border-left: 3px solid var(--theme-danger, #ef4444);
  }

  .cell-break-label {
    position: absolute;
    top: 1px;
    left: 1px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 0 4px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    color: var(--theme-text-inverse, #fff);
    background: var(--theme-danger, #ef4444);
    border-radius: 3px;
    pointer-events: none;
  }

  .empty {
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    padding: 40px 0;
  }
</style>
