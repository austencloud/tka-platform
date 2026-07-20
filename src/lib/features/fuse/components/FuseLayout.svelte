<script lang="ts">
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

  // The phone layout is a different interaction, not a squeezed desktop grid.
  // Measuring the tab's actual slot also handles split-screen and foldable
  // layouts where the viewport width says little about the room Fuse receives.
  $effect(() => {
    const element = containerElement;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateLayoutMode = (width: number) => {
      compact = width < 600;
    };
    updateLayoutMode(element.clientWidth);

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width =
        entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width;
      updateLayoutMode(width);
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
    aria-busy={fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing}
  >
    <FuseWorkspaceHeader onHelp={openHelp} {compact} />
    {#if !compact}
      <FuseSourceCard
        side="blue"
        showInlineNotation={true}
        onViewNotation={openNotation}
      />
      <FuseSourceCard
        side="red"
        showInlineNotation={true}
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
      grid-template-columns: minmax(330px, 2fr) minmax(0, 3fr);
      grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas:
        "header header"
        "blue preview"
        "red preview";
      align-content: stretch;
      overflow: hidden;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fuse-container {
      scroll-behavior: auto;
    }
  }
</style>
