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
  let showInlineNotation = $state(false);

  // CSS owns every layout change. This observer only keeps the expensive
  // notation renderer out of the narrow layout where it lives in the drawer.
  $effect(() => {
    const element = containerElement;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateResourceMode = (width: number) => {
      showInlineNotation = width >= 600;
    };
    updateResourceMode(element.clientWidth);

    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateResourceMode(entry.contentRect.width);
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
    aria-busy={fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing}
  >
    <FuseWorkspaceHeader onHelp={openHelp} />
    <FuseSourceCard
      side="blue"
      {showInlineNotation}
      onViewNotation={openNotation}
    />
    <FuseSourceCard
      side="red"
      {showInlineNotation}
      onViewNotation={openNotation}
    />
    <FusePreviewStage onFuse={handleFuse} />
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

  @container fuse (min-width: 600px) {
    .fuse-workspace {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-areas:
        "header header"
        "blue red"
        "preview preview";
      gap: clamp(12px, 1.6cqw, 18px);
    }
  }

  @container fuse (min-width: 1100px) {
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

  @container fuse (max-height: 860px) {
    .fuse-workspace {
      grid-template-rows: auto auto auto;
      align-content: start;
      overflow-y: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fuse-container {
      scroll-behavior: auto;
    }
  }
</style>
