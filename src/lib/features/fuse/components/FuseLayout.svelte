<script lang="ts">
  import {
    BREAKPOINTS,
    LANDSCAPE_THRESHOLDS,
  } from "$lib/shared/device/domain/constants/device-constants";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
  import { getLibrarySaveService } from "$lib/features/library/get-library-save-service";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { LibraryError } from "$lib/shared/library/domain/library-error";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    getBestFuseStepColumns,
    resolveBalancedFuseWorkspaceSplit,
  } from "../services/fuse-workspace-split";
  import { getFuseContext } from "../context/fuse-context";
  import type { FuseSettingsDestination } from "../domain/fuse-recipe-destination";
  import FusePreviewStage from "./FusePreviewStage.svelte";
  import FuseSettingsDrawer from "./FuseSettingsDrawer.svelte";
  import FuseSourceCard from "./FuseSourceCard.svelte";
  import FuseFirstStepPanel from "./FuseFirstStepPanel.svelte";
  import FusePathBuilderDialog from "./FusePathBuilderDialog.svelte";
  import FuseWorkspaceHeader from "./FuseWorkspaceHeader.svelte";

  const { state: fuseState } = getFuseContext();
  const settings = getSettings();
  let containerElement = $state<HTMLDivElement | null>(null);
  let compact = $state(true);
  let landscapeSplit = $state(false);
  let shortLandscape = $state(false);
  let settingsOpen = $state(false);
  let settingsDestination = $state<FuseSettingsDestination>(null);
  let actionSide = $state<"blue" | "red" | null>(null);
  let firstStepOpen = $state(false);
  let inlineFirstStepSide = $state<"blue" | "red" | null>(null);
  let pathBuilderOpen = $state(false);
  let pathBuilderSide = $state<"blue" | "red" | null>(null);
  let isSavingResult = $state(false);
  // On the locked desktop layout the source cards sit in a tall column with
  // room to spare, so each pictograph stays large even with a start position
  // and a mandala added. Gate the full choreo card on that size (matching the
  // 1100/780 layout breakpoint) so smaller screens keep the lean, big-cell view.
  let fullCard = $state(false);
  let wideWorkspace = $state(false);

  // Desktop-only draggable seam between the path column and the animation
  // canvas — same pattern as the sequence viewer's sidebar resize
  // (ViewerContentRail): pointer-capture drag, col-resize handle, double-click
  // reset. Drives the grid's left track via --fuse-left.
  //
  // Default is COMPUTED, not a fixed fraction. The source cards and the square
  // animation frame each derive an ideal width from the available height, then
  // share any surplus or deficit proportionally. A user drag is saved per
  // approximate device size and wins over the computed default on the next
  // visit at that size.
  const SPLIT_KEY = "tka-fuse-splits"; // JSON map: deviceBucket -> px
  const MIN_LEFT = 340; // path column never narrower than this
  const LAPTOP_MIN_LEFT = 560;
  const WIDE_MIN_LEFT = 720;
  const WIDE_MIN_LEFT_CAP = 1050;
  const WIDE_MAX_LEFT = 1400;
  const NATIVE_4K_MAX_LEFT = 2000;
  const NATIVE_4K_CANVAS_FLOOR = 1200;
  const CANVAS_FLOOR = 560; // canvas never narrower than this
  const CARD_GAP = 14; // vertical gap between the stacked blue/red cards
  const CARD_HPAD = 44; // card horizontal padding, both sides
  const CARD_CHROME_V = 96; // card vertical chrome: padding + the Back/Shuffle row
  const PREVIEW_CHROME_V = 190; // matches FusePreviewStage's square frame cap
  const PREVIEW_HPAD = 48; // maximum desktop stage padding, both sides

  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let workspaceGridWidth = $state(0);
  let contentH = $state(0); // measured content-row height (the left column fills it)
  let overrides = $state<Record<string, number>>(loadOverrides());
  let splitPx = $state<number | null>(null);
  let dragging = $state(false);
  let leftColEl = $state<HTMLDivElement | null>(null);
  let workspaceEl = $state<HTMLDivElement | null>(null);

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
  // column count. Grid = step columns + 1 context column. The context column
  // holds Start above the mandala, so full cards always distribute beats across
  // at least two rows instead of stranding the mandala in a row by itself.
  // Each card owns half the content row minus the gap and its own chrome.
  const cardBoxH = $derived(
    Math.max(0, (contentH - CARD_GAP) / 2 - CARD_CHROME_V)
  );
  function bestStepCols(leftW: number): number {
    return getBestFuseStepColumns(leftW, cardBoxH, stepCount, CARD_HPAD);
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

  const splitAvailableWidth = () => workspaceGridWidth || containerWidth;
  const desiredMinLeft = () =>
    wideWorkspace
      ? Math.round(
          Math.min(
            WIDE_MIN_LEFT_CAP,
            Math.max(WIDE_MIN_LEFT, splitAvailableWidth() * 0.3)
          )
        )
      : containerWidth >= 1180
        ? LAPTOP_MIN_LEFT
        : MIN_LEFT;
  const minLeft = () =>
    Math.min(
      desiredMinLeft(),
      Math.max(MIN_LEFT, splitAvailableWidth() - CANVAS_FLOOR)
    );
  const maxLeft = () => {
    if (!wideWorkspace)
      return Math.max(MIN_LEFT, splitAvailableWidth() - CANVAS_FLOOR);

    const nativeFourK = containerWidth >= 2600 && contentH >= 1400;
    return Math.max(
      minLeft(),
      Math.min(
        nativeFourK ? NATIVE_4K_MAX_LEFT : WIDE_MAX_LEFT,
        splitAvailableWidth() -
          (nativeFourK ? NATIVE_4K_CANVAS_FLOOR : CANVAS_FLOOR)
      )
    );
  };
  const clampSplit = (px: number) =>
    Math.round(Math.min(maxLeft(), Math.max(minLeft(), px)));

  // Default seam: jointly solve each source-card arrangement and the preview's
  // height-capped square. Both sides receive the same proportion of their ideal
  // width before the usability floors apply, so resizing never privileges one
  // pane merely because it was scored first.
  function optimalSplit(): number {
    const previewIdealWidth = Math.max(
      CANVAS_FLOOR,
      containerHeight - PREVIEW_CHROME_V + PREVIEW_HPAD
    );
    return resolveBalancedFuseWorkspaceSplit({
      availableWidth: splitAvailableWidth(),
      cardBoxHeight: cardBoxH,
      stepCount,
      previewIdealWidth,
      minLeft: minLeft(),
      maxLeft: maxLeft(),
      cardHorizontalChrome: CARD_HPAD,
    }).splitPx;
  }

  // Resolve the seam whenever the layout changes and the user isn't dragging:
  // a saved per-device override wins, otherwise the computed optimum. Writing
  // splitPx here never re-triggers this effect (splitPx isn't read in it).
  $effect(() => {
    if (!fullCard || dragging) return;
    const saved = overrides[deviceBucket];
    splitPx = saved != null ? clampSplit(saved) : optimalSplit();
  });

  // Read the grid's content box instead of guessing from the outer container.
  // ResizeObserver excludes padding; subtracting the live column gap leaves the
  // exact width the two tracks negotiate over at every responsive tier.
  $effect(() => {
    const el = workspaceEl;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = (contentWidth: number) => {
      const columnGap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
      workspaceGridWidth = Math.max(0, Math.round(contentWidth - columnGap));
    };
    const initialStyle = getComputedStyle(el);
    measure(
      el.clientWidth -
        (Number.parseFloat(initialStyle.paddingLeft) || 0) -
        (Number.parseFloat(initialStyle.paddingRight) || 0)
    );
    const ro = new ResizeObserver(([entry]) => {
      measure(entry?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
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
      const useShortLandscape =
        width >= BREAKPOINTS.PORTRAIT_MOBILE &&
        width > height &&
        height < LANDSCAPE_THRESHOLDS.MAX_PHONE_HEIGHT;
      const useCompactLayout = width < BREAKPOINTS.MOBILE || useShortLandscape;
      const useFullCards = width >= 1100 && height >= 780;
      const aspectRatio = height > 0 ? width / height : 1;
      compact = useCompactLayout;
      shortLandscape = useShortLandscape;
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
      containerHeight = height;
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

  function openPathBuilder(side: "blue" | "red"): void {
    pathBuilderSide = side;
    pathBuilderOpen = true;
  }

  function closePathBuilder(): void {
    pathBuilderOpen = false;
    pathBuilderSide = null;
  }

  function openSettings(destination: FuseSettingsDestination): void {
    settingsDestination = destination;
    settingsOpen = true;
  }

  // The follower card's footer states the rule that built it, so clicking it
  // opens the editor for that rule — the drawer, already scoped to Pairing.
  function editPairing(): void {
    openSettings("pairing");
  }
</script>

<div class="fuse-container" bind:this={containerElement}>
  <div
    class="fuse-workspace themed-scrollbar"
    bind:this={workspaceEl}
    class:compact-workspace={compact}
    class:short-landscape-workspace={shortLandscape}
    class:landscape-workspace={landscapeSplit}
    class:full-card-workspace={fullCard}
    class:wide-workspace={wideWorkspace}
    class:dragging
    style:--fuse-left={fullCard && splitPx !== null ? `${splitPx}px` : null}
    aria-busy={fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing}
  >
    <FuseWorkspaceHeader onOpenRecipe={() => openSettings(null)} />
    {#if fullCard}
      <div class="fuse-left-col" bind:this={leftColEl}>
        <FuseSourceCard
          side="blue"
          full={true}
          {stepCols}
          onChooseFirstStep={openFirstStep}
          onBuildPath={openPathBuilder}
          firstStepPickerActive={inlineFirstStepSide === "blue"}
          onFirstStepComplete={closeInlineFirstStep}
          onCancelFirstStep={closeInlineFirstStep}
          onEditPairing={editPairing}
        />
        <FuseSourceCard
          side="red"
          full={true}
          {stepCols}
          onChooseFirstStep={openFirstStep}
          onBuildPath={openPathBuilder}
          firstStepPickerActive={inlineFirstStepSide === "red"}
          onFirstStepComplete={closeInlineFirstStep}
          onCancelFirstStep={closeInlineFirstStep}
          onEditPairing={editPairing}
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
    {:else if landscapeSplit}
      <div class="fuse-left-col">
        <FuseSourceCard
          side="blue"
          full={false}
          onChooseFirstStep={openFirstStep}
          onBuildPath={openPathBuilder}
          firstStepPickerActive={inlineFirstStepSide === "blue"}
          onFirstStepComplete={closeInlineFirstStep}
          onCancelFirstStep={closeInlineFirstStep}
          onEditPairing={editPairing}
        />
        <FuseSourceCard
          side="red"
          full={false}
          onChooseFirstStep={openFirstStep}
          onBuildPath={openPathBuilder}
          firstStepPickerActive={inlineFirstStepSide === "red"}
          onFirstStepComplete={closeInlineFirstStep}
          onCancelFirstStep={closeInlineFirstStep}
          onEditPairing={editPairing}
        />
      </div>
    {:else if !compact}
      <FuseSourceCard
        side="blue"
        full={false}
        onChooseFirstStep={openFirstStep}
        onBuildPath={openPathBuilder}
        firstStepPickerActive={inlineFirstStepSide === "blue"}
        onFirstStepComplete={closeInlineFirstStep}
        onCancelFirstStep={closeInlineFirstStep}
        onEditPairing={editPairing}
      />
      <FuseSourceCard
        side="red"
        full={false}
        onChooseFirstStep={openFirstStep}
        onBuildPath={openPathBuilder}
        firstStepPickerActive={inlineFirstStepSide === "red"}
        onFirstStepComplete={closeInlineFirstStep}
        onCancelFirstStep={closeInlineFirstStep}
        onEditPairing={editPairing}
      />
    {/if}
    <FusePreviewStage
      onOpenViewer={handleOpenViewer}
      onShare={handleShare}
      onSave={handleSaveResult}
      isSaving={isSavingResult}
      onChooseFirstStep={openFirstStep}
      onBuildPath={openPathBuilder}
      onEditPairing={editPairing}
      {compact}
      defaultDecomposed={wideWorkspace}
    />
  </div>

  <FuseSettingsDrawer
    bind:isOpen={settingsOpen}
    bind:destination={settingsDestination}
  />
  <FuseFirstStepPanel
    bind:isOpen={firstStepOpen}
    side={actionSide}
    onClose={closeFirstStep}
  />
  <FusePathBuilderDialog
    bind:isOpen={pathBuilderOpen}
    side={pathBuilderSide}
    desktopModal={fullCard}
    onClose={closePathBuilder}
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
    grid-template-rows: repeat(4, max-content);
    grid-template-areas:
      "header"
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
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      "header"
      "preview";
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-sm, 8px);
    overflow: hidden;
  }

  @container fuse (min-width: 600px) {
    .fuse-workspace:not(.compact-workspace) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(3, max-content);
      grid-template-areas:
        "header header"
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
    .fuse-workspace:not(.compact-workspace) {
      grid-template-rows: max-content minmax(0, 0.9fr) minmax(0, 1.7fr);
      align-content: stretch;
      overflow: hidden;
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

  /* A short landscape screen cannot carry two detailed source cards plus the
     result vertically. Keep both live source beats together in a compact rail
     and give the result the wider pane, all inside the available height. */
  .fuse-workspace.compact-workspace.short-landscape-workspace {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: max-content minmax(0, 1fr);
    grid-template-areas:
      "header"
      "preview";
  }

  /* Full-card markup and its grid must change as one state transition. Keeping
     the layout behind a second CSS threshold let browser zoom put the markup
     and grid on opposite sides of the seam, creating implicit columns. */
  .fuse-workspace.full-card-workspace {
    grid-template-columns: var(--fuse-left, 1.8fr) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      "header header"
      "left preview";
    align-content: stretch;
    overflow: hidden;
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
      grid-template-rows: max-content minmax(0, 1fr);
      grid-template-areas:
        "header header"
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
    .split-handle::after {
      transition: none;
      animation: none;
    }
  }
</style>
