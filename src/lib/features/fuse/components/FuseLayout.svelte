<script lang="ts">
  import { untrack } from "svelte";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
  import { getFuseContext } from "../context/fuse-context";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";
  import FuseDetailDrawer from "./FuseDetailDrawer.svelte";
  import FusePreviewStage from "./FusePreviewStage.svelte";
  import FuseSourceCard from "./FuseSourceCard.svelte";
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
  // (ViewerContentRail): pointer-capture drag, col-resize handle, persisted
  // width, double-click to reset. Drives the grid's left track via --fuse-left.
  const SPLIT_KEY = "tka-fuse-split-px";
  const MIN_LEFT = 340; // path column never narrower than this
  const CANVAS_FLOOR = 560; // canvas never narrower than this
  let containerWidth = $state(0);
  let splitPx = $state<number | null>(loadSplit());
  let dragging = $state(false);
  let leftColEl = $state<HTMLDivElement | null>(null);

  function loadSplit(): number | null {
    try {
      const raw = localStorage.getItem(SPLIT_KEY);
      if (raw) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n)) return n;
      }
    } catch {
      /* ignore */
    }
    return null;
  }
  const maxLeft = () => Math.max(MIN_LEFT, containerWidth - CANVAS_FLOOR);
  const clampSplit = (px: number) =>
    Math.round(Math.min(maxLeft(), Math.max(MIN_LEFT, px)));

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
      try {
        localStorage.setItem(SPLIT_KEY, String(splitPx));
      } catch {
        /* ignore */
      }
    }
  }
  function onSplitReset(): void {
    splitPx = clampSplit(containerWidth * 0.36);
    try {
      localStorage.removeItem(SPLIT_KEY);
    } catch {
      /* ignore */
    }
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
      // Keep the seam valid: seed a default on first desktop entry, re-clamp
      // to new bounds on resize so the canvas floor is always respected.
      // untrack so reading splitPx here doesn't re-subscribe the effect and
      // rebuild the ResizeObserver on every drag frame.
      if (fullCard) {
        untrack(() => {
          splitPx = splitPx === null ? clampSplit(width * 0.36) : clampSplit(splitPx);
        });
      }
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

  function openHelp(): void {
    detailKind = "help";
    detailOpen = true;
  }

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
    <FuseWorkspaceHeader onHelp={openHelp} {compact} />
    {#if fullCard}
      <div class="fuse-left-col" bind:this={leftColEl}>
        <FuseSourceCard
          side="blue"
          showInlineNotation={true}
          full={true}
          onViewNotation={openNotation}
        />
        <FuseSourceCard
          side="red"
          showInlineNotation={true}
          full={true}
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
    .fuse-workspace {
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
    .fuse-workspace {
      grid-template-rows: max-content minmax(0, 0.9fr) minmax(0, 1.7fr);
      align-content: stretch;
      overflow: hidden;
    }
  }

  /* Locked desktop layout: cards stack in a left column beside a tall preview.
     Requires real height on top of the fit layout's floor. */
  @container fuse (min-width: 1100px) and (min-height: 780px) {
    .fuse-workspace {
      grid-template-columns: var(--fuse-left, 1.8fr) minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
      grid-template-areas:
        "header header"
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
