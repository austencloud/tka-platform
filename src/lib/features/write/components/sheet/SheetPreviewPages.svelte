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

  Stage fit: the page's on-screen size comes from the stage container
  (`sheet-stage`, container-type: size on the host's preview pane). The base is
  Fit — the page fills the stage's LIMITING dimension, so the whole sheet is
  visible — and `zoom` scales up from there, scrolling the stage. No magic
  max-width, so the sheet grows with the workspace at 4K instead of freezing at
  a desktop cap. Physical geometry, the planner, and the PDF are untouched: this
  only changes how LARGE the same page is drawn.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { flip } from "svelte/animate";
  import { flyFade, growFade, flipDuration } from "$lib/shared/transitions/motion";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import ShimmerBlock from "$lib/shared/components/loading/ShimmerBlock.svelte";
  import SelectionHit from "$lib/shared/selection/SelectionHit.svelte";
  import { getSequenceSelection } from "$lib/shared/selection/sequence-selection.svelte";
  import type { SheetPage, SheetCell, SheetBand, SheetBandPage } from "../../services/sheet-row-planner";
  import type { SheetPageGeometry } from "../../domain/sheet-page-layout";
  import type {
    ChoreoSheetLayout,
    ChoreoSheetAnnotations,
    SheetHeader,
    NoteMark,
  } from "../../domain/types/choreo-sheet";
  import { SHEET_CELL_VISIBILITY } from "../../services/sheet-cell-config";

  let {
    pages,
    geo,
    layout,
    breakSequenceIds = new Set<string>(),
    selectedSequenceId = null,
    onSelectSequence,
    onRemoveSequence,
    // ── Annotated ("aligned") branch ────────────────────────────────────────
    bandPages = [],
    annotations,
    sheetName = "",
    onSetCue,
    onAddNote,
    onSetNote,
    onRemoveNote,
    onSetHeader,
    placeholderRoster,
    zoom = 1,
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
    /** Row-aligned, height-packed pages — only consumed when packing="aligned". */
    bandPages?: SheetBandPage[];
    /** Cue/note/header annotations for the aligned branch. */
    annotations?: ChoreoSheetAnnotations;
    /** The act/sheet name, shown in the page-1 title block. */
    sheetName?: string;
    onSetCue?: (band: string, patch: { timestamp?: string; text?: string }) => void;
    onAddNote?: (band: string, count: number | null) => string;
    onSetNote?: (id: string, patch: { text?: string }) => void;
    onRemoveNote?: (id: string) => void;
    onSetHeader?: (patch: Partial<SheetHeader>) => void;
    /**
     * One entry per roster row while the sheet is still hydrating. Drives the
     * reserved skeleton page: the sheet's real geometry, filled with shimmer, so
     * the moment the real cells arrive nothing moves. Omit (or pass empty) once
     * the roster is complete — the planned pages take over.
     */
    placeholderRoster?: { stepCount: number | null }[];
    /**
     * Scale factor on the fitted page. 1 = Fit: the whole sheet sits in the
     * stage's limiting dimension, which is the baseline the sheet is designed
     * around. Above 1 the page grows past the stage and the stage scrolls — for
     * reading Compact pictographs, not for composition.
     *
     * (This replaced a "page | width" toggle. Fit-width was `stage width` and
     * fit-page was `min(stage width, stage height × aspect)`, so whenever width
     * was the binding constraint — every landscape sheet on a normal workspace —
     * the two produced an identical page and the control did nothing.)
     */
    zoom?: number;
  } = $props();

  // Whole-sequence selection scope (provided by ChoreoSheetView). Null on hosts
  // that don't provide one → no ring, SelectionHit renders nothing.
  const selection = getSequenceSelection();

  // Header for the title block / running header (aligned branch only).
  const header = $derived(annotations?.header);
  // Column indices for the note-strip's per-count add affordances.
  const columnIndexes = $derived(Array.from({ length: geo.columns }, (_, i) => i));

  // A note pins under a column only when its count addresses an existing cell
  // (1..cells.length); otherwise (null, < 1, or past a short last row) it reads as
  // a full-width bullet. Predicate matches the PDF exporter's exactly so a note
  // never classifies differently on screen vs paper.
  function pinnedNotes(band: SheetBand): NoteMark[] {
    return band.notes.filter((n) => n.count != null && n.count >= 1 && n.count <= band.cells.length);
  }
  function bulletNotes(band: SheetBand): NoteMark[] {
    return band.notes.filter((n) => n.count == null || n.count < 1 || n.count > band.cells.length);
  }

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
  // Same ratio as a bare number, for the fit math in calc() (aspect-ratio takes
  // the `a / b` form; calc() multiplication wants the scalar).
  const pageAspectRatio = $derived(geo.pageWidthPt / geo.pageHeightPt);

  // ── Stage fit ───────────────────────────────────────────────────────────────
  // The page's width is pure CSS off the stage container. The ONE thing CSS
  // can't decide is whether two fit-height pages plus the gap clear the stage
  // width, so that single question is measured. Two-up is a pinned composition
  // decision — never `auto-fill`, never a row that happens to wrap.
  //
  // Reserves below mirror the CSS: 4.5rem horizontal (padding + scrollbar),
  // 6rem vertical (padding + caption), 2rem inter-page gap.
  const STAGE_PAD_X_REM = 4.5;
  const STAGE_PAD_Y_REM = 6;
  const PAGE_GAP_REM = 2;

  let scrollEl = $state<HTMLElement | undefined>(undefined);
  let stageWidth = $state(0);
  let stageHeight = $state(0);
  let remPx = 16;

  $effect(() => {
    // The scroll wrapper's parent IS the stage (the size container the fit
    // formula queries), so measuring it keeps JS and CSS reading one box.
    const stage = scrollEl?.parentElement;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const parsed = parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (Number.isFinite(parsed) && parsed > 0) remPx = parsed;
    const read = (entry?: ResizeObserverEntry) => {
      // contentBoxSize excludes padding — exactly what 100cqw/100cqh resolve to.
      const box = entry?.contentBoxSize?.[0];
      stageWidth = box ? box.inlineSize : stage.clientWidth;
      stageHeight = box ? box.blockSize : stage.clientHeight;
    };
    const ro = new ResizeObserver((entries) => read(entries[0]));
    ro.observe(stage);
    read();
    return () => ro.disconnect();
  });

  const pageCount = $derived(layout.packing === "aligned" ? bandPages.length : pages.length);

  const twoUp = $derived.by(() => {
    if (zoom !== 1 || pageCount < 2 || stageWidth === 0 || stageHeight === 0) return false;
    const fitHeightWidth = (stageHeight - STAGE_PAD_Y_REM * remPx) * pageAspectRatio;
    // Demanding literally two full fit-height pages side by side needs a ~2.7:1
    // stage no real monitor has — verified dead at 3840×2160. Instead: spread
    // when a single fit-height page would strand ≥35% of the stage as dead rail;
    // the two-up width rule then splits the width (capped at fit-height), which
    // shrinks each page but keeps the canvas full — the 4k-native-layout trade.
    // Floor: a half-page under 640px is a thumbnail, not a readable Letter
    // sheet (verified at 820×1180, where the short stacked stage passed the
    // ratio test and rendered two illegible pages).
    const halfWidth = (stageWidth - STAGE_PAD_X_REM * remPx - PAGE_GAP_REM * remPx) / 2;
    if (halfWidth < 640) return false;
    return stageWidth - STAGE_PAD_X_REM * remPx > fitHeightWidth * 1.35;
  });

  function pageCaption(index: number): string {
    const paper = geo.orientation === "portrait" ? "Portrait" : "Landscape";
    return `Page ${index + 1} of ${pageCount} · Letter · ${paper}`;
  }

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

  // ── Hydrating placeholder ───────────────────────────────────────────────────
  // While the roster is incomplete the planner returns nothing (the derived
  // pipeline refuses to paginate a sheet with holes), so without this the user
  // stares at "No sequences yet" on a sheet that plainly has sequences. Instead
  // reserve the page: same frame, same grid, same square cells, shimmer inside.
  // Real cells then swap in with zero layout shift.
  const showPlaceholder = $derived(
    pages.length === 0 && bandPages.length === 0 && (placeholderRoster?.length ?? 0) > 0,
  );

  // How many cells of each reserved row are "filled" (the rest read as blanks,
  // exactly like a short last row on the real sheet). One row per `columns`
  // steps; an unknown step count reserves a single full row. Capped at the
  // page's row capacity — the placeholder is one page, never a paginated guess.
  const placeholderRows = $derived.by<{ filled: number }[]>(() => {
    const cols = Math.max(1, geo.columns);
    const rows: { filled: number }[] = [];
    for (const entry of placeholderRoster ?? []) {
      const steps = entry.stepCount ?? cols;
      const needed = Math.max(1, Math.ceil(steps / cols));
      for (let i = 0; i < needed && rows.length < geo.rows; i++) {
        rows.push({ filled: Math.min(cols, Math.max(1, steps - i * cols)) });
      }
      if (rows.length >= geo.rows) break;
    }
    return rows;
  });
</script>

{#if showPlaceholder}
  <div
    class="pages-scroll"
    class:zoomed={zoom !== 1} style:--zoom={zoom}
    bind:this={scrollEl}
    style="--page-aspect: {pageAspectRatio};"
  >
    <figure class="pagefig">
      <div class="page" style="aspect-ratio: {pageAspect};" aria-hidden="true">
      <div class="grid-area" style="inset: {marginYPct}% {marginXPct}%; row-gap: {rowGapPct}%;">
        {#each placeholderRows as row, ri (ri)}
          <div
            class="sheet-row"
            style="grid-template-columns: repeat({geo.columns}, 1fr); column-gap: {colGapPct}%;"
          >
            {#each columnIndexes as ci (ci)}
              <div class="cell" class:blank={ci >= row.filled}>
                {#if ci < row.filled}
                  <div class="cell-skeleton">
                    <ShimmerBlock
                      width="58%"
                      height="58%"
                      borderRadius="6px"
                      delay={Math.min((ri * geo.columns + ci) * 40, 600)}
                    />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
      </div>
      <!-- Reserved, not shown: the real pages carry a caption, so holding its
           box here means the swap out of the placeholder moves nothing. -->
      <figcaption class="page-caption" aria-hidden="true" style="visibility: hidden;">
        Page 1 of 1 · Letter · Landscape
      </figcaption>
    </figure>
  </div>
{:else if layout.packing === "aligned"}
  {#if bandPages.length === 0}
    <p class="empty" transition:flyFade>No sequences yet.</p>
  {:else}
    <div
      class="pages-scroll"
      class:zoomed={zoom !== 1} style:--zoom={zoom}
      class:two-up={twoUp}
      bind:this={scrollEl}
      style="--page-aspect: {pageAspectRatio};"
    >
      {#each bandPages as page (page.pageIndex)}
        <figure class="pagefig" in:flyFade|global={{ y: 12, delay: Math.min(page.pageIndex * 60, 240) }}>
        <div
          class="page annotated"
          class:no-rail={!layout.showCueRail}
          class:no-strip={!layout.showNoteStrips}
          use:observePage={page.pageIndex}
          style="aspect-ratio: {pageAspect}; --pt: calc(100cqw / {geo.pageWidthPt}); --rail-w: calc({geo.railWidthPt} * var(--pt)); --gutter: calc({geo.gutterPt} * var(--pt)); --strip-h: calc({geo.stripBaseHeightPt} * var(--pt)); --margin: calc({geo.marginYPt} * var(--pt)); --band-gap: calc({geo.interBandGutterPt} * var(--pt));"
        >
          <div class="pad">
            {#if page.pageIndex === 0 && header?.showTitleBlock}
              <span class="cornerno" aria-hidden="true">1</span>
              {#if header?.date}
                <span class="date">{header.date}</span>
              {/if}
              <div class="titleblock">
                <div class="act">{sheetName || "Untitled"}</div>
                <div class="by">
                  Choreography by
                  <input
                    class="hdr-inline"
                    value={header?.choreographer ?? ""}
                    placeholder="choreographer"
                    aria-label="Choreographer"
                    oninput={(e) => onSetHeader?.({ choreographer: e.currentTarget.value })}
                  />
                </div>
                <div class="by">
                  Song by
                  <input
                    class="hdr-inline"
                    value={header?.songArtist ?? ""}
                    placeholder="artist"
                    aria-label="Song artist"
                    oninput={(e) => onSetHeader?.({ songArtist: e.currentTarget.value })}
                  />
                </div>
                <div class="made">Created using The Kinetic Alphabet</div>
                <input
                  class="tag"
                  value={header?.tagline ?? ""}
                  placeholder="tagline…"
                  aria-label="Tagline"
                  oninput={(e) => onSetHeader?.({ tagline: e.currentTarget.value })}
                />
              </div>
            {:else if page.pageIndex > 0}
              <div class="runhead">
                <span class="song"
                  >{header?.songName || sheetName}{header?.songArtist
                    ? ` — ${header.songArtist}`
                    : ""}</span
                >
                <span class="ts">page starts {page.bands[0]?.cue?.timestamp || "—"}</span>
                <span class="pageno">{page.pageIndex + 1}</span>
              </div>
            {/if}

            <div class="bands">
              {#each page.bands as band, bi (band.key)}
                <div
                  class="band"
                  animate:flip={{ duration: flipDuration() }}
                  in:flyFade={{ y: 8 }}
                  out:growFade={{ axis: "y" }}
                >
                  {#if layout.showCueRail}
                    <div class="rail">
                      <input
                        class="ts-input"
                        value={band.cue?.timestamp ?? ""}
                        placeholder="0:00"
                        aria-label="Cue timestamp"
                        oninput={(e) => onSetCue?.(band.key, { timestamp: e.currentTarget.value })}
                      />
                      <textarea
                        class="cue-input"
                        rows="1"
                        value={band.cue?.text ?? ""}
                        placeholder="cue…"
                        aria-label="Cue text"
                        oninput={(e) => onSetCue?.(band.key, { text: e.currentTarget.value })}
                      ></textarea>
                    </div>
                  {/if}
                  <div class="band-body">
                    <div
                      class="cells"
                      style="grid-template-columns: repeat({geo.columns}, 1fr); gap: var(--gutter);"
                    >
                      {#each band.cells as cell, ci (ci)}
                        <div
                          class="cell"
                          class:tka-seq-cell={!cell.isBlank && !!cell.sequenceId}
                          class:is-hovered={cell.sequenceId
                            ? selection?.isHovered(cell.sequenceId)
                            : false}
                          class:is-selected={cell.sequenceId
                            ? selection?.isSelected(cell.sequenceId)
                            : false}
                          class:break={isCellBreak(cell)}
                          class:separator={isCellSeparator(
                            cell,
                            page.pageIndex === 0 && bi === 0 && ci === 0,
                          )}
                        >
                          <!-- Same selection primitive the Study branch uses. The
                               annotated sheet shipped without it, so clicking a
                               band's pictograph did nothing while the identical
                               click in Study selected the whole sequence. -->
                          {#if !cell.isBlank && cell.sequenceId && onSelectSequence}
                            <SelectionHit
                              groupId={cell.sequenceId}
                              isGroupStart={cell.isSequenceStart}
                              label="Select this sequence"
                              onselect={(id) => onSelectSequence?.(id)}
                            />
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
                          {#if cell.step && visiblePages.has(page.pageIndex)}
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
                    {#if layout.showNoteStrips}
                      <div class="strip">
                        <!-- Behind the notes: one clickable column per count. Clicking an
                             empty column pins a fresh note under that count. -->
                        <div
                          class="add-cols"
                          style="grid-template-columns: repeat({geo.columns}, 1fr);"
                        >
                          {#each columnIndexes as ci (ci)}
                            <button
                              type="button"
                              class="add-col"
                              aria-label={`Add note under count ${ci + 1}`}
                              onclick={() => onAddNote?.(band.key, ci + 1)}
                            ></button>
                          {/each}
                        </div>
                        {#each pinnedNotes(band) as note (note.id)}
                          <div
                            class="pin"
                            style="left: calc({(note.count ?? 1) - 1} * ({geo.cellSizePt} + {geo.gutterPt}) * var(--pt));"
                          >
                            <input
                              class="pin-input"
                              value={note.text}
                              placeholder="note…"
                              aria-label={`Note at count ${note.count}`}
                              oninput={(e) => onSetNote?.(note.id, { text: e.currentTarget.value })}
                            />
                            <button
                              type="button"
                              class="note-remove"
                              aria-label="Remove note"
                              onclick={() => onRemoveNote?.(note.id)}
                            >
                              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                            </button>
                          </div>
                        {/each}
                        <div class="bullets">
                          {#each bulletNotes(band) as note (note.id)}
                            <div class="bullet-row">
                              <span class="bullet-dot" aria-hidden="true">•</span>
                              <input
                                class="bullet-input"
                                value={note.text}
                                placeholder="note…"
                                aria-label="Note"
                                oninput={(e) =>
                                  onSetNote?.(note.id, { text: e.currentTarget.value })}
                              />
                              <button
                                type="button"
                                class="note-remove"
                                aria-label="Remove note"
                                onclick={() => onRemoveNote?.(note.id)}
                              >
                                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                              </button>
                            </div>
                          {/each}
                          <button
                            type="button"
                            class="add-note"
                            onclick={() => onAddNote?.(band.key, null)}
                          >
                            <i class="fa-solid fa-plus" aria-hidden="true"></i> note
                          </button>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
        <figcaption class="page-caption">{pageCaption(page.pageIndex)}</figcaption>
        </figure>
      {/each}
    </div>
  {/if}
{:else if pages.length === 0}
  <p class="empty" transition:flyFade>No sequences yet.</p>
{:else}
  <div
    class="pages-scroll"
    class:zoomed={zoom !== 1} style:--zoom={zoom}
    class:two-up={twoUp}
    bind:this={scrollEl}
    style="--page-aspect: {pageAspectRatio};"
  >
    {#each pages as page, pi (pi)}
      <figure class="pagefig" in:flyFade|global={{ y: 12, delay: Math.min(pi * 60, 240) }}>
      <div
        class="page"
        use:observePage={pi}
        style="aspect-ratio: {pageAspect};"
      >
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
                  class:tka-seq-cell={!cell.isBlank && !!cell.sequenceId}
                  class:blank={cell.isBlank}
                  class:is-hovered={cell.sequenceId ? selection?.isHovered(cell.sequenceId) : false}
                  class:is-selected={cell.sequenceId ? selection?.isSelected(cell.sequenceId) : false}
                  class:break={isCellBreak(cell)}
                  class:separator={isCellSeparator(cell, pi === 0 && ri === 0 && ci === 0)}
                >
                  {#if !cell.isBlank && cell.sequenceId && onSelectSequence}
                    <SelectionHit
                      groupId={cell.sequenceId}
                      isGroupStart={cell.isSequenceStart}
                      label="Select this sequence"
                      onselect={(id) => onSelectSequence?.(id)}
                    />
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
      <figcaption class="page-caption">{pageCaption(pi)}</figcaption>
      </figure>
    {/each}
  </div>
{/if}

<style>
  /* The stage is the hero: pages centre in the stage box and grow with it.
     `safe center` so a sheet taller than the stage still scrolls to its top
     edge instead of overflowing past it. */
  .pages-scroll {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    align-items: center;
    justify-content: safe center;
    min-height: 100%;
    padding-bottom: 1.5rem;
  }

  /* Zoomed in, the sheet reads top-down like a document — no vertical centring,
     and the stage scrolls in both axes to reach the corners. */
  .pages-scroll.zoomed {
    justify-content: flex-start;
    align-items: safe center;
  }

  /* Two-up spread: entered only when the measurement proves two fit-height
     pages plus the gap clear the stage (SheetPreviewPages script). A pinned
     composition decision, never `auto-fill`. */
  .pages-scroll.two-up {
    flex-flow: row wrap;
    justify-content: center;
    align-content: safe center;
    gap: 2rem;
  }

  .pagefig {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    min-width: 0;
  }

  /* Small caps under the sheet, the way a plate is captioned. tabular-nums so
     "Page 9 of 12" and "Page 10 of 12" occupy the same box. */
  .page-caption {
    font-size: var(--font-size-compact, 0.75rem);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .page {
    /* Component-scoped print-surface borders (the white sheet is print-fixed —
       these never track the app theme, so no global token applies). */
    --print-border-faint: rgba(0, 0, 0, 0.06);
    --print-border-strong: rgba(0, 0, 0, 0.4);
    position: relative;
    background: var(--print-bg, #ffffff);
    border-radius: 4px;
    /* Layered lift: contact shadow, mid drop, deep ambient, and a cool halo —
       the sheet reads as paper on a light table, not a white div. */
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.5),
      0 12px 28px rgba(0, 0, 0, 0.45),
      0 34px 90px rgba(0, 0, 0, 0.5),
      0 0 120px rgba(140, 160, 210, 0.07);
    /* Fit-page: fill the stage's LIMITING dimension. No desktop-era cap — the
       page grows with the workspace (4k-native-layout.md). max-width is only a
       guard for hosts without a size container. */
    width: calc(
      min(calc(100cqw - 4.5rem), calc((100cqh - 6rem) * var(--page-aspect, 1.294))) *
        var(--zoom, 1)
    );
    max-width: none;
    flex: 0 0 auto;
    box-sizing: border-box;
    /* Clip any sub-pixel overflow from rounded cell sizes so rows never bleed. */
    overflow: hidden;
  }

  /* Two-up: cap at half the stage so exactly two land per row. */
  .pages-scroll.two-up .page {
    width: min(
      calc((100cqw - 4.5rem - 2rem) / 2),
      calc((100cqh - 6rem) * var(--page-aspect, 1.294))
    );
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

  /* Shimmer sits inside the exact cell box a pictograph will occupy, so the
     swap to real content moves nothing. */
  .cell-skeleton {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Separator: a vertical divider on the left edge of a sequence-start cell —
     in flow mode a boundary is between two cells, not two rows. */
  .cell.separator {
    border-left: 2px solid var(--print-border-strong, rgba(0, 0, 0, 0.4));
  }

  /* Whole-sequence selection is the shared primitive now: the .cell carries
     .tka-seq-cell + is-hovered/is-selected (selection.css) and hosts a <SelectionHit>.
     The Remove button on the first cell stays below. */

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

  /* ── Annotated ("aligned") branch ─────────────────────────────────────────
     A container-query context makes 1 PDF point resolve to a fixed fraction of
     the (fluid) page width via --pt = 100cqw / pageWidthPt, so every pt-based
     size below scales exactly with the sheet the way the PDF export does — no
     magic screen pixels. Print-fixed ink/accent tokens (like the .page border
     tokens) never track the app theme. */
  .page.annotated {
    container-type: inline-size;
    --print-ink: #1a1a1a;
    --print-ink-soft: #333333;
    --print-ink-faint: #555555;
    --print-accent: #6ea8fe;
    --print-accent-bg: rgba(110, 168, 254, 0.1);
  }

  .pad {
    position: absolute;
    inset: var(--margin);
    color: var(--print-ink);
    font-family: Georgia, "Times New Roman", serif;
  }

  /* Page-1 title block.

     The height is PINNED to TITLE_BLOCK_PT (sheet-page-layout.ts), the same
     reservation the band packer subtracts from page 1's budget and the PDF
     advances by. Content-sized chrome is what let the preview and the planner
     disagree, and the last band fell off the bottom of a portrait page. */
  .titleblock {
    box-sizing: border-box;
    height: calc(186 * var(--pt));
    text-align: center;
    padding-bottom: calc(10 * var(--pt));
  }
  .titleblock .act {
    font-size: calc(40 * var(--pt));
    letter-spacing: 0.02em;
  }
  .titleblock .by {
    font-size: calc(15 * var(--pt));
    margin-top: calc(6 * var(--pt));
    color: var(--print-ink-soft);
  }
  .titleblock .made {
    font-size: calc(11 * var(--pt));
    font-style: italic;
    color: var(--print-ink-faint);
    margin-top: calc(6 * var(--pt));
  }
  .titleblock .tag {
    display: block;
    width: 100%;
    text-align: center;
    font-family: inherit;
    font-weight: 700;
    font-size: calc(13 * var(--pt));
    margin-top: calc(10 * var(--pt));
  }

  /* Editable header fields sit invisibly on the print surface until hovered /
     focused, so the sheet reads clean but every value is one click from edit. */
  .hdr-inline,
  .tag,
  .ts-input,
  .cue-input,
  .pin-input,
  .bullet-input {
    border: 1px solid transparent;
    background: transparent;
    color: inherit;
    padding: 0 calc(2 * var(--pt));
    border-radius: 3px;
    transition:
      background-color var(--duration-fast, 0.12s) ease,
      border-color var(--duration-fast, 0.12s) ease;
  }
  .hdr-inline:hover,
  .tag:hover,
  .ts-input:hover,
  .cue-input:hover,
  .pin-input:hover,
  .bullet-input:hover {
    background: var(--print-accent-bg);
  }
  .hdr-inline:focus-visible,
  .tag:focus-visible,
  .ts-input:focus-visible,
  .cue-input:focus-visible,
  .pin-input:focus-visible,
  .bullet-input:focus-visible {
    outline: none;
    border-color: var(--print-accent);
    background: var(--print-accent-bg);
  }
  .hdr-inline {
    font-family: inherit;
    font-size: inherit;
    text-align: center;
    min-width: calc(120 * var(--pt));
  }

  /* Page-2+ running header. Pinned to RUNNING_HEADER_PT for the same reason the
     title block is — see .titleblock. */
  .runhead {
    box-sizing: border-box;
    height: calc(28 * var(--pt));
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: calc(11 * var(--pt));
    color: var(--print-ink-soft);
    padding-bottom: calc(6 * var(--pt));
    border-bottom: 1px solid var(--print-border-faint, rgba(0, 0, 0, 0.06));
  }
  .runhead .song {
    font-style: italic;
  }
  .runhead .ts {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
  }
  .runhead .pageno {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: calc(20 * var(--pt));
    height: calc(20 * var(--pt));
    border: 1.5px solid var(--print-ink);
    border-radius: 50%;
    font-size: calc(11 * var(--pt));
  }
  .cornerno {
    position: absolute;
    top: 0;
    right: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: calc(22 * var(--pt));
    height: calc(22 * var(--pt));
    border: 1.5px solid var(--print-ink);
    border-radius: 50%;
    font-size: calc(12 * var(--pt));
  }
  .date {
    position: absolute;
    top: 0;
    left: 0;
    font-size: calc(10 * var(--pt));
    color: var(--print-ink-faint);
  }

  /* Bands flow top-down; a growing note strip pushes later bands DOWN, never
     shifts a sibling sideways (no-layout-shift by construction). */
  .bands {
    margin-top: calc(8 * var(--pt));
  }
  .band {
    display: grid;
    grid-template-columns: var(--rail-w) 1fr;
    column-gap: calc(6 * var(--pt));
  }
  .no-rail .band {
    grid-template-columns: 1fr;
  }
  .band + .band {
    margin-top: var(--band-gap);
  }

  .rail {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-right: calc(6 * var(--pt));
    border-right: 1px solid var(--print-border-faint, rgba(0, 0, 0, 0.06));
  }
  .ts-input {
    font-family: Georgia, serif;
    font-style: italic;
    font-size: calc(11 * var(--pt));
    font-variant-numeric: tabular-nums;
  }
  .cue-input {
    font-family: Georgia, serif;
    font-style: italic;
    font-size: calc(10.5 * var(--pt));
    color: var(--print-ink-soft);
    line-height: 1.25;
    margin-top: calc(2 * var(--pt));
    resize: none;
    overflow: hidden;
    /* Auto-grow to fit the cue text without a manual resize handler. */
    field-sizing: content;
  }

  .band-body {
    min-width: 0;
  }
  .cells {
    display: grid;
  }

  /* Note strip: a half-cell floor that grows with stacked bullets. */
  .strip {
    position: relative;
    min-height: var(--strip-h);
    margin-top: calc(2 * var(--pt));
    border-top: 1px dashed var(--print-border-faint, rgba(0, 0, 0, 0.06));
    font-family: "Segoe UI", Roboto, sans-serif;
  }
  .add-cols {
    position: absolute;
    inset: 0;
    display: grid;
    z-index: 0;
  }
  .add-col {
    border: 0;
    background: transparent;
    cursor: pointer;
    transition: background-color var(--duration-fast, 0.12s) ease;
  }
  .add-col:hover {
    background: var(--print-accent-bg);
  }

  .bullets {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding-top: calc(2 * var(--pt));
  }
  .bullet-row {
    display: flex;
    align-items: center;
    gap: calc(2 * var(--pt));
    width: 100%;
  }
  .bullet-dot {
    font-size: calc(10.5 * var(--pt));
    color: var(--print-ink);
  }
  .bullet-input {
    flex: 1;
    min-width: 0;
    font-family: inherit;
    font-size: calc(10.5 * var(--pt));
    font-style: italic;
    color: var(--print-ink);
  }

  .pin {
    position: absolute;
    top: calc(2 * var(--pt));
    z-index: 1;
    display: flex;
    align-items: center;
    gap: calc(2 * var(--pt));
    padding: 1px calc(3 * var(--pt));
    border-left: 1.5px solid var(--print-accent);
    background: var(--print-accent-bg);
    white-space: nowrap;
  }
  .pin-input {
    font-family: inherit;
    font-size: calc(9.5 * var(--pt));
    color: var(--print-ink-soft);
  }

  /* Interactive chrome keeps a 44px touch floor even on the scaled sheet. */
  .note-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    border: 0;
    background: transparent;
    color: var(--print-ink-faint);
    font-size: calc(9 * var(--pt));
    cursor: pointer;
  }
  .note-remove:hover {
    color: var(--theme-danger, #ef4444);
  }
  .add-note {
    display: inline-flex;
    align-items: center;
    gap: calc(2 * var(--pt));
    min-height: var(--min-touch-target, 44px);
    margin-top: calc(2 * var(--pt));
    padding: 0 calc(6 * var(--pt));
    border: 1px dashed var(--print-border-faint, rgba(0, 0, 0, 0.06));
    border-radius: 6px;
    background: transparent;
    color: var(--print-ink-faint);
    font-family: inherit;
    font-size: calc(9.5 * var(--pt));
    cursor: pointer;
  }
  .add-note:hover {
    border-color: var(--print-accent);
    color: var(--print-ink);
  }

  @media (prefers-reduced-motion: reduce) {
    .hdr-inline,
    .tag,
    .ts-input,
    .cue-input,
    .pin-input,
    .bullet-input,
    .add-col {
      transition: none;
    }
  }
</style>
