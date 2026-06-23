<!--
  ChoreoCardTab.svelte - Choreo card module container

  Routes between the module's tabs (designer, scan activity, theme lab,
  deck releaser, codex print). The catalog browse tab was retired — the
  deck releaser replaces it.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { getThumbnailRenderOrchestrator } from "$lib/shared/browse/get-thumbnail-render-orchestrator";
  import type { ThumbnailRenderOrchestrator } from "$lib/shared/browse/services/thumbnail-render-orchestrator";
  import ScanActivityTab from "./scan-activity/ScanActivityTab.svelte";
  import DeckReleaserTab from "./deck-releaser/DeckReleaserTab.svelte";
  import CodexPrintPage from "./CodexPrintPage.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildChoreoCardContextMenuItems } from "$lib/shared/choreo-card/services/card-designer-context-menu-builder";

  // Context menu for right-click on any choreo card thumbnail.
  // Stores the rerender callback from the specific card that was right-clicked.
  let contextMenuState: ContextMenuState = $state({ open: false });
  let activeCardRerender: (() => void) | undefined = $state(undefined);

  function openCardContextMenu(x: number, y: number, rerender: () => void) {
    activeCardRerender = rerender;
    contextMenuState = { open: true, x, y };
  }

  function closeCardContextMenu() {
    contextMenuState = { open: false };
  }

  const contextMenuItems: ContextMenuEntry[] = $derived(
    buildChoreoCardContextMenuItems({
      onRerender: activeCardRerender,
    })
  );

  // Mode state - synced with global navigation (sidebar tab selection)
  type ChoreoCardMode = "scan-activity" | "releaser" | "codex";
  let mode = $state<ChoreoCardMode>("scan-activity");

  $effect(() => {
    const navTab = navigationState.activeTab;
    if (
      navTab === "scan-activity" ||
      navTab === "releaser" ||
      navTab === "codex"
    ) {
      mode = navTab;
    }
  });

  onDestroy(() => {
    (getThumbnailRenderOrchestrator() as ThumbnailRenderOrchestrator)?.cancelAll();
  });
</script>

<div class="choreo-card-tab">
  <div class="main-content">
    {#if mode === "scan-activity"}
      <ScanActivityTab />
    {:else if mode === "releaser"}
      <main class="content-area">
        <DeckReleaserTab onContextMenu={openCardContextMenu} />
      </main>
    {:else if mode === "codex"}
      <main class="content-area">
        <CodexPrintPage />
      </main>
    {/if}
  </div>
</div>

<!-- Context menu for right-click on any choreo card thumbnail -->
<ContextMenu menuState={contextMenuState} items={contextMenuItems} onClose={closeCardContextMenu} />

<style>
  .choreo-card-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
  }

  .main-content {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-md, 16px);
  }

  .content-area {
    flex: 1;
    min-width: 0;
    min-height: 0;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow: auto;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .main-content {
      flex-direction: column;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm);
    }
  }
</style>
