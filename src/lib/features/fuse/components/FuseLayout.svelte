<script lang="ts">
  import { LANDSCAPE_THRESHOLDS } from "$lib/shared/device/domain/constants/device-constants";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
  import { getLibrarySaveService } from "$lib/features/library/get-library-save-service";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { LibraryError } from "$lib/shared/library/domain/library-error";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getFuseContext } from "../context/fuse-context";
  import FusePreviewStage from "./FusePreviewStage.svelte";
  import FuseRelationshipComposer from "./FuseRelationshipComposer.svelte";
  import FuseSettingsDrawer from "./FuseSettingsDrawer.svelte";
  import FuseSourceCard from "./FuseSourceCard.svelte";
  import FuseFirstStepPanel from "./FuseFirstStepPanel.svelte";
  import FuseWorkspaceHeader from "./FuseWorkspaceHeader.svelte";

  const { state: fuseState } = getFuseContext();
  const settings = getSettings();
  let containerElement = $state<HTMLDivElement | null>(null);
  let compact = $state(true);
  let landscapeSplit = $state(false);
  let settingsOpen = $state(false);
  let actionSide = $state<"blue" | "red" | null>(null);
  let firstStepOpen = $state(false);
  let inlineFirstStepSide = $state<"blue" | "red" | null>(null);
  let isSavingResult = $state(false);
  // On the locked desktop layout the source cards sit in a tall column with
  // room to spare, so each pictograph stays large even with a start position
  // and a mandala added. Gate the full choreo card on that size (matching the
  // 1100/780 layout breakpoint) so smaller screens keep the lean, big-cell view.
  let fullCard = $state(false);
  let wideWorkspace = $state(false);
  const controlsInDrawer = $derived(!fullCard);

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
  const LAPTOP_MIN_LEFT = 560;
  const WIDE_MIN_LEFT = 1050;
  const WIDE_MAX_LEFT = 1400;
  const CANVAS_FLOOR = 560; // canvas never narrower than this
  const STEP_COL_CANDIDATES = [2, 4, 6, 8] as const; // step columns to weigh (+1 start col)
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
  const stepCount = $derived(
    fuseState.appliedLength ?? fuseState.requestedLength
  );

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
    let best: number = STEP_COL_CANDIDATES[0];
    let bestCell = -1;
    for (const sc of STEP_COL_CANDIDATES) {
      const cell = cellSizeFor(leftW, sc);
      // A shallow desktop card can make several column counts produce the same
      // cell size because height, not width, is the limiting dimension. Use
      // the denser option in that tie so the LOOP fills the horizontal card
      // instead of becoming a small grid surrounded by empty surface.
      if (
        cell > bestCell + 0.5 ||
        (Math.abs(cell - bestCell) <= 0.5 && sc > best)
      ) {
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

  const minLeft = () =>
    wideWorkspace
      ? WIDE_MIN_LEFT
      : containerWidth >= 1180
        ? LAPTOP_MIN_LEFT
        : MIN_LEFT;
  const maxLeft = () =>
    wideWorkspace
      ? Math.min(WIDE_MAX_LEFT, containerWidth - CANVAS_FLOOR)
      : Math.max(MIN_LEFT, containerWidth - CANVAS_FLOOR);
  const clampSplit = (px: number) =>
    Math.round(Math.min(maxLeft(), Math.max(minLeft(), px)));

  // Default seam: jointly pick the step-column count and the width that MAXIMIZE
  // pictograph size. Each candidate's ideal width is its aspect-matched fill
  // (gridCols/rows * cardBoxH), clamped by the canvas floor; take the candidate
  // whose clamped width yields the largest cell. A wide container thus lands on
  // more columns, a tall one on fewer — the size the user reaches by dragging.
  function optimalSplit(): number {
    if (contentH <= 0 || cardBoxH <= 0)
      return clampSplit(containerWidth * 0.42);
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

  function commitSplit(px: number): void {
    splitPx = clampSplit(px);
    overrides = { ...overrides, [deviceBucket]: splitPx };
    persistOverrides();
  }

  function onSplitKeyDown(event: KeyboardEvent): void {
    const current = splitPx ?? optimalSplit();
    const step = event.shiftKey ? 64 : 24;
    let next: number | null = null;

    if (event.key === "ArrowLeft") next = current - step;
    else if (event.key === "ArrowRight") next = current + step;
    else if (event.key === "Home") next = minLeft();
    else if (event.key === "End") next = maxLeft();

    if (next === null) return;
    event.preventDefault();
    commitSplit(next);
  }

  // The phone layout is a different interaction, not a squeezed desktop grid.
  // Measuring the tab's actual slot also handles split-screen and foldable
  // layouts where the viewport width says little about the room Fuse receives.
  $effect(() => {
    const element = containerElement;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateLayoutMode = (width: number, height: number) => {
      const useCompactLayout = width < 600;
      const useFullCards = width >= 1100 && height >= 780;
      const aspectRatio = height > 0 ? width / height : 1;
      compact = useCompactLayout;
      fullCard = useFullCards;
      wideWorkspace = width >= 1680 && height >= 900;
      // Use the measured Fuse slot, not the physical screen: Android chrome and
      // the app nav can pull an unfolded Fold's content height below 600px.
      // Phone-shaped landscape screens stay on the existing scroll layout.
      landscapeSplit =
        !useFullCards &&
        !useCompactLayout &&
        width > height &&
        aspectRatio <= LANDSCAPE_THRESHOLDS.WIDE_ASPECT_RATIO;
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

  async function handleOpenViewer(): Promise<void> {
    await openBuiltResult(false);
  }

  async function handleShare(): Promise<void> {
    await openBuiltResult(true);
  }

  async function openBuiltResult(shareOnOpen: boolean): Promise<void> {
    const sequence = await fuseState.buildFusedSequence();
    if (!sequence) return;

    try {
      openSequenceViewer(sequence, {
        returnPath: "/app/create",
        returnLabel: "Fuse",
        initialBpm: fuseState.bpm,
        shareOnOpen,
      });
    } catch (failure) {
      fuseState.reportViewerFailure(failure);
    }
  }

  async function handleSaveResult(): Promise<void> {
    if (isSavingResult) return;
    const sequence = await fuseState.buildFusedSequence();
    if (!sequence) return;
    isSavingResult = true;
    try {
      const intended = createSequenceData({
        ...sequence,
        intendedProp: {
          bluePropType: settings.bluePropType ?? PropType.STAFF,
          redPropType: settings.redPropType ?? PropType.STAFF,
          catDogMode: settings.catDogMode ?? false,
        },
      });
      const name = intended.word || intended.name || "Fused LOOP";
      await getLibrarySaveService().saveSequence(intended, {
        name,
        visibility: "private",
        tags: [],
        notes: "Created in Fuse",
      });
      showToast("Fused LOOP saved to your library", "success");
    } catch (failure) {
      if (
        failure instanceof LibraryError &&
        failure.code === "ALREADY_EXISTS"
      ) {
        showToast("That fused LOOP is already in your library", "info");
        return;
      }
      console.error("[FuseLayout] Failed to save fused LOOP", failure);
      const message =
        failure instanceof Error
          ? failure.message
          : "Couldn't save the fused LOOP";
      showToast(message, "error");
    } finally {
      isSavingResult = false;
    }
  }

  function openFirstStep(side: "blue" | "red"): void {
    if (compact) {
      actionSide = side;
      firstStepOpen = true;
      return;
    }
    inlineFirstStepSide = side;
  }

  function closeFirstStep(): void {
    firstStepOpen = false;
    actionSide = null;
  }

  function closeInlineFirstStep(): void {
    inlineFirstStepSide = null;
  }
</script>

<div class="fuse-container" bind:this={containerElement}>
  <div
    class="fuse-workspace themed-scrollbar"
    class:compact-workspace={compact}
    class:condensed-workspace={controlsInDrawer}
    class:landscape-workspace={landscapeSplit}
    class:wide-workspace={wideWorkspace}
    class:dragging
    style:--fuse-left={fullCard && splitPx !== null ? `${splitPx}px` : null}
    aria-busy={fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing}
  >
    <FuseWorkspaceHeader
      compact={controlsInDrawer}
      onOpenOptions={() => (settingsOpen = true)}
    />
    {#if !controlsInDrawer}
      <FuseRelationshipComposer />
    {/if}
    {#if fullCard}
      <div class="fuse-left-col" bind:this={leftColEl}>
        <FuseSourceCard
          side="blue"
          full={true}
          {stepCols}
          onChooseFirstStep={openFirstStep}
          firstStepPickerActive={inlineFirstStepSide === "blue"}
          onFirstStepComplete={closeInlineFirstStep}
          onCancelFirstStep={closeInlineFirstStep}
        />
        <FuseSourceCard
          side="red"
          full={true}
          {stepCols}
          onChooseFirstStep={openFirstStep}
          firstStepPickerActive={inlineFirstStepSide === "red"}
          onFirstStepComplete={closeInlineFirstStep}
          onCancelFirstStep={closeInlineFirstStep}
        />
        <div
          class="split-handle"
          role="slider"
          tabindex="0"
          aria-label="Resize path panel"
          aria-orientation="vertical"
          aria-valuemin={minLeft()}
          aria-valuemax={maxLeft()}
          aria-valuenow={splitPx ?? 0}
          aria-valuetext={`${splitPx ?? 0} pixels for source paths`}
          onpointerdown={onSplitDown}
          onpointermove={onSplitMove}
          onpointerup={onSplitUp}
          onpointercancel={onSplitUp}
          ondblclick={onSplitReset}
          onkeydown={onSplitKeyDown}
        >
          <span class="split-flow" aria-hidden="true">
            <span class="pair-dots">
              <span class="path-dot blue-dot"></span>
              <span class="path-dot red-dot"></span>
            </span>
            <i class="fas fa-plus"></i>
            <i class="fas fa-arrow-right"></i>
          </span>
        </div>
      </div>
    {:else if compact}
      <div class="fuse-mobile-sources" aria-label="Source paths">
        <FuseSourceCard
          side="blue"
          compactHero={true}
          onChooseFirstStep={openFirstStep}
        />
        <div class="fusion-bridge" aria-hidden="true">
          <span class="fusion-beam beam-blue"></span>
          <span class="fusion-core">
            <i class="fas fa-link"></i>
          </span>
          <span class="fusion-beam beam-red"></span>
          <span class="fusion-spark spark-one"></span>
          <span class="fusion-spark spark-two"></span>
          <span class="fusion-spark spark-three"></span>
        </div>
        <FuseSourceCard
          side="red"
          compactHero={true}
          onChooseFirstStep={openFirstStep}
        />
      </div>
    {:else if landscapeSplit}
      <div class="fuse-left-col">
        <FuseSourceCard
          side="blue"
          full={false}
          onChooseFirstStep={openFirstStep}
          firstStepPickerActive={inlineFirstStepSide === "blue"}
          onFirstStepComplete={closeInlineFirstStep}
          onCancelFirstStep={closeInlineFirstStep}
        />
        <FuseSourceCard
          side="red"
          full={false}
          onChooseFirstStep={openFirstStep}
          firstStepPickerActive={inlineFirstStepSide === "red"}
          onFirstStepComplete={closeInlineFirstStep}
          onCancelFirstStep={closeInlineFirstStep}
        />
      </div>
    {:else}
      <FuseSourceCard
        side="blue"
        full={false}
        onChooseFirstStep={openFirstStep}
        firstStepPickerActive={inlineFirstStepSide === "blue"}
        onFirstStepComplete={closeInlineFirstStep}
        onCancelFirstStep={closeInlineFirstStep}
      />
      <FuseSourceCard
        side="red"
        full={false}
        onChooseFirstStep={openFirstStep}
        firstStepPickerActive={inlineFirstStepSide === "red"}
        onFirstStepComplete={closeInlineFirstStep}
        onCancelFirstStep={closeInlineFirstStep}
      />
    {/if}
    <FusePreviewStage
      onOpenViewer={handleOpenViewer}
      onShare={handleShare}
      onSave={handleSaveResult}
      isSaving={isSavingResult}
      {compact}
    />
  </div>

  <FuseSettingsDrawer bind:isOpen={settingsOpen} />
  <FuseFirstStepPanel
    bind:isOpen={firstStepOpen}
    side={actionSide}
    onClose={closeFirstStep}
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
    grid-template-rows: auto clamp(132px, 23cqh, 210px) minmax(0, 1fr);
    grid-template-areas:
      "header"
      "sources"
      "preview";
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-sm, 8px);
    overflow: hidden;
  }

  .fuse-mobile-sources {
    grid-area: sources;
    position: relative;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--settings-spacing-sm, 8px);
    min-width: 0;
    min-height: 0;
  }

  /* A small, non-interactive bridge makes the relationship explicit: the two
     live paths feed the combined canvas below. It sits in the gutter and never
     steals taps from either card. */
  .fusion-bridge {
    position: absolute;
    z-index: 6;
    top: 50%;
    left: 50%;
    display: flex;
    align-items: center;
    width: 54px;
    height: 34px;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .fusion-beam {
    position: absolute;
    top: 50%;
    width: 17px;
    height: 2px;
    transform: translateY(-50%);
    box-shadow: 0 0 8px currentColor;
  }

  .beam-blue {
    left: 0;
    color: var(--prop-blue, #2196f3);
    background: linear-gradient(90deg, transparent, currentColor);
  }

  .beam-red {
    right: 0;
    color: var(--prop-red, #f44336);
    background: linear-gradient(90deg, currentColor, transparent);
  }

  .fusion-core {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    transform: translate(-50%, -50%);
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-warning, #f97316) 76%,
        var(--theme-text, #fff)
      );
    border-radius: 50%;
    color: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 24%,
      var(--theme-text, #fff)
    );
    background:
      radial-gradient(
        circle at 35% 30%,
        color-mix(in srgb, var(--theme-text, #fff) 34%, transparent),
        transparent 34%
      ),
      color-mix(
        in srgb,
        var(--semantic-warning, #f97316) 72%,
        var(--theme-panel-bg, #17131d)
      );
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--theme-shadow) 56%, transparent),
      0 0 16px
        color-mix(in srgb, var(--semantic-warning, #f97316) 58%, transparent);
    font-size: 12px;
    animation: fusion-core-pulse 1800ms ease-in-out infinite;
  }

  .fusion-spark {
    position: absolute;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 36%,
      var(--theme-text, #fff)
    );
    box-shadow: 0 0 6px var(--semantic-warning, #f97316);
    animation: fusion-spark 1500ms ease-in-out infinite;
  }

  .spark-one {
    top: 0;
    left: 29px;
  }

  .spark-two {
    right: 5px;
    bottom: 2px;
    animation-delay: -500ms;
  }

  .spark-three {
    bottom: 0;
    left: 6px;
    animation-delay: -1000ms;
  }

  @keyframes fusion-core-pulse {
    0%,
    100% {
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--theme-shadow) 56%, transparent),
        0 0 11px
          color-mix(in srgb, var(--semantic-warning, #f97316) 42%, transparent);
    }
    50% {
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--theme-shadow) 56%, transparent),
        0 0 20px
          color-mix(in srgb, var(--semantic-warning, #f97316) 72%, transparent);
    }
  }

  @keyframes fusion-spark {
    0%,
    100% {
      opacity: 0.25;
      transform: scale(0.7);
    }
    50% {
      opacity: 1;
      transform: scale(1.45);
    }
  }

  .fuse-mobile-sources :global(.source-card) {
    grid-area: auto;
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

    .fuse-workspace.condensed-workspace:not(.landscape-workspace) {
      grid-template-rows: repeat(3, max-content);
      grid-template-areas:
        "header header"
        "blue red"
        "preview preview";
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

    .fuse-workspace.condensed-workspace:not(.landscape-workspace) {
      grid-template-rows: max-content minmax(0, 0.9fr) minmax(0, 1.7fr);
    }
  }

  /* Unfolded foldables and landscape tablets: reuse the desktop source column,
     but keep the lean source cards so the notation remains the hero. The
     preview now owns the full content-row height instead of a shallow row. */
  .fuse-workspace.landscape-workspace {
    grid-template-columns: minmax(300px, 0.95fr) minmax(0, 1.15fr);
    grid-template-rows: max-content minmax(0, 1fr);
    grid-template-areas:
      "header header"
      "left preview";
    align-content: stretch;
    overflow: hidden;
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
    background: color-mix(in srgb, var(--theme-text, #fff) 8%, transparent);
    border-radius: 1px;
    transition:
      background 150ms ease,
      width 150ms ease;
  }

  .split-handle:focus-visible::before {
    width: 4px;
    background: var(--theme-accent, #8b6cff);
  }

  /* 4K gives the result the additional room. The source workbench stops
     growing once its full LOOP cards are comfortably readable. */
  @container fuse (min-width: 1680px) and (min-height: 900px) {
    .fuse-workspace {
      --font-size-min: 16px;
      --font-size-compact: 14px;
      --font-size-sm: 17px;
      --min-touch-target: 48px;
      grid-template-columns: var(--fuse-left, 1400px) minmax(0, 1fr);
      grid-template-rows: max-content max-content minmax(0, 1fr);
      grid-template-areas:
        "header header"
        "mode preview"
        "left preview";
      gap: 18px;
      padding: 24px;
    }

    .fuse-left-col {
      gap: 18px;
    }

    .split-flow {
      display: flex;
    }
  }

  /* At native 4K the two halves become a real workbench rather than a 1080p
     layout surrounded by pixels. The source tools scale for arm's-length use,
     while the result keeps the larger share of the canvas. */
  @container fuse (min-width: 2600px) and (min-height: 1400px) {
    .fuse-workspace {
      --font-size-min: 18px;
      --font-size-compact: 16px;
      --font-size-sm: 19px;
      --min-touch-target: 64px;
      gap: 24px;
      padding: 32px;
    }

    .fuse-left-col {
      gap: 24px;
    }
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
    background: color-mix(in srgb, var(--theme-text, #fff) 18%, transparent);
    transition:
      background 150ms ease,
      height 150ms ease;
  }

  .split-flow {
    position: absolute;
    z-index: 2;
    top: 50%;
    left: 50%;
    display: none;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 82px;
    height: 54px;
    transform: translate(-50%, -50%);
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-warning, #f97316) 48%,
        var(--theme-stroke)
      );
    border-radius: 999px;
    color: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 78%,
      var(--theme-text, #fff)
    );
    background: var(--theme-panel-bg, #0c0e16);
    box-shadow: 0 10px 28px var(--theme-shadow, rgba(0, 0, 0, 0.4));
    font-size: 13px;
    pointer-events: none;
  }

  .pair-dots {
    display: grid;
    gap: 4px;
  }

  .path-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    box-shadow: 0 0 8px currentColor;
  }

  .blue-dot {
    color: var(--prop-blue, #2196f3);
    background: currentColor;
  }

  .red-dot {
    color: var(--prop-red, #f44336);
    background: currentColor;
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
    .split-handle::after,
    .fusion-core,
    .fusion-spark {
      transition: none;
      animation: none;
    }
  }
</style>
