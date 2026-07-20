<script lang="ts">
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
  import { getFuseContext } from "../context/fuse-context";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";
  import FuseDetailDrawer from "./FuseDetailDrawer.svelte";
  import FuseModeBar from "./FuseModeBar.svelte";
  import FusePreviewStage from "./FusePreviewStage.svelte";
  import FuseSourceCard from "./FuseSourceCard.svelte";
  import FuseTransformPicker from "./FuseTransformPicker.svelte";
  import FuseWorkspaceHeader from "./FuseWorkspaceHeader.svelte";

  const { state: fuseState } = getFuseContext();
  let detailOpen = $state(false);
  let detailKind = $state<"help" | "notation">("help");
  let detailSide = $state<FuseSide>("blue");
  let containerElement = $state<HTMLDivElement | null>(null);
  let compact = $state(true);
  // On the locked desktop layout the source cards sit in a tall column with
  // room to spare, so each pictograph stays large even with a start position
  // and a mandala added. Gate the full choreo card on that size (matching the
  // 1100/780 layout breakpoint) so smaller screens keep the lean, big-cell view.
  let fullCard = $state(false);

  // Desktop-only draggable seam between the path column and the animation
  // canvas — same pattern as the sequence viewer's sidebar resize
  // (ViewerContentRail): pointer-capture drag, col-resize handle, double-click
  // reset. Drives the grid's left track via --fuse-left.
  //
  // Default is COMPUTED, not a fixed fraction: the canvas is square, so its
  // column reaches minimal empty space exactly when its width equals the
  // content-row height. The remaining width goes to the path column — and at
  // ~16:9 that same point fits the stacked cards to width too, so both panes
  // fill at once. A user drag is saved per approximate device size and wins over
  // the computed default on the next visit at that size.
  const SPLIT_KEY = "tka-fuse-splits"; // JSON map: deviceBucket -> px
  const MIN_LEFT = 340; // path column never narrower than this
  const CANVAS_FLOOR = 560; // canvas never narrower than this
  const STEP_COL_CANDIDATES = [2, 4, 6, 8]; // step columns to weigh (+1 start col)
  const CARD_GAP = 14; // vertical gap between the stacked blue/red cards
  const CARD_HPAD = 44; // card horizontal padding, both sides
  const CARD_CHROME_V = 96; // card vertical chrome: padding + the Back/Shuffle row

  let containerWidth = $state(0);
  let contentH = $state(0); // measured content-row height (the left column fills it)
  let overrides = $state<Record<string, number>>(loadOverrides());
  let splitPx = $state<number | null>(null);
  let dragging = $state(false);
  let leftColEl = $state<HTMLDivElement | null>(null);

  function loadOverrides(): Record<string, number> {
    try {
      const raw = localStorage.getItem(SPLIT_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return parsed as Record<string, number>;
        }
      }
    } catch {
      /* ignore */
    }
    return {};
  }
  function persistOverrides(): void {
    try {
      localStorage.setItem(SPLIT_KEY, JSON.stringify(overrides));
    } catch {
      /* ignore */
    }
  }

  // requested length shows before the load settles so the seam is right away.
  const stepCount = $derived(fuseState.appliedLength ?? fuseState.requestedLength);

  // Pictograph cell size for one card at a given path-column width and step
  // column count. Grid = sc step columns + 1 start column; rows = ceil(steps/sc)
  // but at least 2 (the start column stacks the start position over the mandala).
  // Each card owns half the content row minus the gap and its own chrome.
  const cardBoxH = $derived(
    Math.max(0, (contentH - CARD_GAP) / 2 - CARD_CHROME_V)
  );
  function cellSizeFor(leftW: number, sc: number): number {
    const gridCols = sc + 1;
    const rows = Math.max(Math.ceil(stepCount / sc), 2);
    const boxW = Math.max(0, leftW - CARD_HPAD);
    return Math.min(boxW / gridCols, cardBoxH / rows);
  }
  function bestStepCols(leftW: number): number {
    let best = STEP_COL_CANDIDATES[0];
    let bestCell = -1;
    for (const sc of STEP_COL_CANDIDATES) {
      const cell = cellSizeFor(leftW, sc);
      if (cell > bestCell) {
        bestCell = cell;
        best = sc;
      }
    }
    return best;
  }
  // Step columns the visible cards render with: whichever maximizes cell size for
  // the resolved seam. Recomputed live as the seam is dragged, so a wide box
  // takes more columns and a narrow box fewer.
  const stepCols = $derived(bestStepCols(splitPx ?? containerWidth * 0.4));

  // 160px granularity AND step count: a saved seam restores on the same screen,
  // but a different window OR a different length (differently shaped card) each
  // gets its own default and its own remembered override.
  const bucketOf = (w: number, h: number, steps: number) =>
    `${Math.round(w / 160) * 160}x${Math.round(h / 160) * 160}x${steps}`;
  const deviceBucket = $derived(bucketOf(containerWidth, contentH, stepCount));

  const maxLeft = () => Math.max(MIN_LEFT, containerWidth - CANVAS_FLOOR);
  const clampSplit = (px: number) =>
    Math.round(Math.min(maxLeft(), Math.max(MIN_LEFT, px)));

  // Default seam: jointly pick the step-column count and the width that MAXIMIZE
  // pictograph size. Each candidate's ideal width is its aspect-matched fill
  // (gridCols/rows * cardBoxH), clamped by the canvas floor; take the candidate
  // whose clamped width yields the largest cell. A wide container thus lands on
  // more columns, a tall one on fewer — the size the user reaches by dragging.
  function optimalSplit(): number {
    if (contentH <= 0 || cardBoxH <= 0) return clampSplit(containerWidth * 0.42);
    let bestSeam = clampSplit(containerWidth * 0.42);
    let bestCell = -1;
    for (const sc of STEP_COL_CANDIDATES) {
      const gridCols = sc + 1;
      const rows = Math.max(Math.ceil(stepCount / sc), 2);
      const seam = clampSplit((gridCols / rows) * cardBoxH + CARD_HPAD);
      const cell = cellSizeFor(seam, sc);
      if (cell > bestCell) {
        bestCell = cell;
        bestSeam = seam;
      }
    }
    return bestSeam;
  }

  // Resolve the seam whenever the layout changes and the user isn't dragging:
  // a saved per-device override wins, otherwise the computed optimum. Writing
  // splitPx here never re-triggers this effect (splitPx isn't read in it).
  $effect(() => {
    if (!fullCard || dragging) return;
    const saved = overrides[deviceBucket];
    splitPx = saved != null ? clampSplit(saved) : optimalSplit();
  });

  // Measure the content-row height so optimalSplit targets a square canvas
  // exactly, independent of header/padding guesses.
  $effect(() => {
    const el = leftColEl;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      contentH = Math.round(entry?.contentRect.height ?? el.clientHeight);
    });
    ro.observe(el);
    contentH = Math.round(el.clientHeight);
    return () => ro.disconnect();
  });

  function onSplitDown(e: PointerEvent): void {
    e.preventDefault();
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onSplitMove(e: PointerEvent): void {
    if (!dragging || !leftColEl) return;
    splitPx = clampSplit(e.clientX - leftColEl.getBoundingClientRect().left);
  }
  function onSplitUp(): void {
    if (!dragging) return;
    dragging = false;
    if (splitPx !== null) {
      overrides = { ...overrides, [deviceBucket]: splitPx };
      persistOverrides();
    }
  }
  function onSplitReset(): void {
    const { [deviceBucket]: _cleared, ...rest } = overrides;
    overrides = rest;
    persistOverrides();
    splitPx = optimalSplit();
  }

  // The phone layout is a different interaction, not a squeezed desktop grid.
  // Measuring the tab's actual slot also handles split-screen and foldable
  // layouts where the viewport width says little about the room Fuse receives.
  $effect(() => {
    const element = containerElement;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateLayoutMode = (width: number, height: number) => {
      compact = width < 600;
      fullCard = width >= 1100 && height >= 780;
      containerWidth = width;
    };
    updateLayoutMode(element.clientWidth, element.clientHeight);

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width =
        entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width;
      const height =
        entry.contentBoxSize[0]?.blockSize ?? entry.contentRect.height;
      updateLayoutMode(width, height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  });

  function openNotation(side: FuseSide): void {
    detailKind = "notation";
    detailSide = side;
    detailOpen = true;
  }

  async function handleFuse(): Promise<void> {
    const sequence = await fuseState.buildFusedSequence();
    if (!sequence) return;

    try {
      openSequenceViewer(sequence, {
        returnPath: "/app/create",
        returnLabel: "Fuse",
        initialBpm: fuseState.bpm,
      });
    } catch (failure) {
      fuseState.reportViewerFailure(failure);
    }
  }
</script>

<div class="fuse-container" bind:this={containerElement}>
  <div
    class="fuse-workspace themed-scrollbar"
    class:compact-workspace={compact}
    class:dragging
    style:--fuse-left={fullCard && splitPx !== null ? `${splitPx}px` : null}
    aria-busy={fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing}
  >
    <FuseWorkspaceHeader {compact} />
    <div class="fuse-mode-row">
      <FuseModeBar />
      {#if fuseState.mode === "symmetry"}
        <FuseTransformPicker />
      {/if}
    </div>
    {#if fullCard}
      <div class="fuse-left-col" bind:this={leftColEl}>
        <FuseSourceCard
          side="blue"
          showInlineNotation={true}
          full={true}
          {stepCols}
          onViewNotation={openNotation}
        />
        <FuseSourceCard
          side="red"
          showInlineNotation={true}
          full={true}
          {stepCols}
          onViewNotation={openNotation}
        />
        <div
          class="split-handle"
          role="slider"
          tabindex="0"
          aria-label="Resize path panel"
          aria-orientation="vertical"
          aria-valuemin={MIN_LEFT}
          aria-valuemax={maxLeft()}
          aria-valuenow={splitPx ?? 0}
          onpointerdown={onSplitDown}
          onpointermove={onSplitMove}
          onpointerup={onSplitUp}
          onpointercancel={onSplitUp}
          ondblclick={onSplitReset}
        ></div>
      </div>
    {:else if !compact}
      <FuseSourceCard
        side="blue"
        showInlineNotation={true}
        full={false}
        onViewNotation={openNotation}
      />
      <FuseSourceCard
        side="red"
        showInlineNotation={true}
        full={false}
        onViewNotation={openNotation}
      />
    {/if}
    <FusePreviewStage onFuse={handleFuse} {compact} />
  </div>

  <FuseDetailDrawer
    bind:isOpen={detailOpen}
    kind={detailKind}
    side={detailSide}
  />
</div>

<style>
  .fuse-container {
    --min-touch-target: 48px;
    container: fuse / size;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background:
      radial-gradient(
        circle at 72% 42%,
        color-mix(in srgb, var(--semantic-warning, #f97316) 5%, transparent),
        transparent 38%
      ),
      var(--theme-page-bg, transparent);
  }

  .fuse-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    /* max-content rows, NOT auto: the workspace is a definite-height scroll
       container, and auto rows in an overflowing grid collapse to the items'
       minimum contribution (zero for the overflow-hidden cards), stacking the
       cards on top of each other. max-content rows never shrink below content. */
    grid-template-rows: repeat(5, max-content);
    grid-template-areas:
      "header"
      "mode"
      "blue"
      "red"
      "preview";
    align-content: start;
    gap: var(--settings-spacing-md, 12px);
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding: clamp(10px, 2.5cqw, 20px);
    overflow-x: hidden;
    overflow-y: auto;
  }

  .fuse-workspace.compact-workspace {
    grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas:
      "header"
      "mode"
      "preview";
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-sm, 8px);
    overflow: hidden;
  }

  @container fuse (min-width: 600px) {
    .fuse-workspace {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(4, max-content);
      grid-template-areas:
        "header header"
        "mode mode"
        "blue red"
        "preview preview";
      gap: clamp(10px, 1.4cqw, 14px);
    }
  }

  /* One-page fit layout: any container with real height locks to the viewport
     — no scrolling. Header stays content-sized; the card row and preview row
     split the rest (fr rows). FuseSourceCard and FusePreviewStage mirror this
     exact condition to apply min-height: 0 (a zero minimum contribution
     collapses auto rows in the scroll layouts, so it must not leak there). */
  @container fuse (min-width: 600px) and (min-height: 600px) {
    .fuse-workspace {
      grid-template-rows: max-content max-content minmax(0, 0.9fr) minmax(
          0,
          1.7fr
        );
      align-content: stretch;
      overflow: hidden;
    }
  }

  /* Locked desktop layout: cards stack in a left column beside a tall preview.
     Requires real height on top of the fit layout's floor. */
  @container fuse (min-width: 1100px) and (min-height: 780px) {
    .fuse-workspace {
      grid-template-columns: var(--fuse-left, 1.8fr) minmax(0, 1fr);
      grid-template-rows: auto auto minmax(0, 1fr);
      grid-template-areas:
        "header header"
        "mode mode"
        "left preview";
      align-content: stretch;
      overflow: hidden;
    }
  }

  /* Mode row: the shuffle/symmetry switch, plus the symmetry transform picker
     when it's on. Spans the full width in every layout (grid-area: mode). Wraps
     so the mode bar and picker stack on narrow containers. */
  .fuse-mode-row {
    grid-area: mode;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--settings-spacing-sm, 10px);
    min-width: 0;
  }

  /* Desktop path column: blue over red, with the drag seam pinned to its right
     edge. Only rendered at the locked desktop size, so grid-area: left never
     applies in the narrower layouts. */
  .fuse-left-col {
    position: relative;
    grid-area: left;
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 1.4cqw, 14px);
    min-width: 0;
    min-height: 0;
  }

  .fuse-left-col :global(.source-card) {
    flex: 1 1 0;
    min-height: 0;
  }

  .split-handle {
    position: absolute;
    top: 0;
    right: -7px;
    width: 14px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
    touch-action: none;
  }

  .split-handle::before {
    content: "";
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 2px;
    height: 100%;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 1px;
    transition:
      background 150ms ease,
      width 150ms ease;
  }

  .split-handle::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 44px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.18);
    transition:
      background 150ms ease,
      height 150ms ease;
  }

  .split-handle:hover::before,
  .dragging .split-handle::before {
    background: var(--semantic-warning, #f97316);
    width: 3px;
  }

  .split-handle:hover::after,
  .dragging .split-handle::after {
    background: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 70%,
      transparent
    );
    height: 60px;
  }

  .split-handle:focus-visible {
    outline: 2px solid var(--semantic-warning, #f97316);
    outline-offset: 2px;
  }

  .fuse-workspace.dragging {
    cursor: col-resize;
    user-select: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .fuse-container {
      scroll-behavior: auto;
    }
    .split-handle::before,
    .split-handle::after {
      transition: none;
    }
  }
</style>
