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
  import type {
    ContextMenuState,
    ContextMenuEntry,
  } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildCardMenuSection } from "$lib/shared/choreo-card/services/card-menu-section";
  import {
    openSendSequenceSheet,
    buildSequenceSharePayload,
  } from "$lib/shared/inbox/state/send-sequence-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { createScanActivityState } from "../state/scan-activity-state.svelte";
  import { watchScanActivityConnection } from "../state/scan-activity-connection.svelte";
  import { getScanActivityWatcher } from "../services/getScanActivityWatcher";
  import { setScanActivityContext } from "../context/scan-activity-context";
  import { decodeSequenceFromQR } from "$lib/shared/navigation/services/sequence-encoder";

  const scanActivity = createScanActivityState({
    data: getScanActivityWatcher(),
    decodeSequence: decodeSequenceFromQR,
  });
  setScanActivityContext({ state: scanActivity });

  // Scan activity stays live while this module is open. Switching to another
  // Choreo Card tab keeps the latest event window and card cache intact.
  watchScanActivityConnection(scanActivity, () => ({
    loading: authState.loading,
    userId: authState.user?.uid ?? null,
    isAdmin: authState.isAdmin === true,
  }));

  // Context menu for right-click on any choreo card thumbnail.
  // Stores the rerender callback + sequence from the specific card clicked.
  // Card section only — releaser/print cards render the frozen canonical
  // visibility profile, so the pictograph section is deliberately absent
  // (see docs/superpowers/specs/2026-07-09-context-menu-unification-design.md).
  let contextMenuState: ContextMenuState = $state({ open: false });
  let activeCardRerender: (() => void) | undefined = $state(undefined);
  let activeCardSequence: SequenceData | undefined = $state(undefined);
  let menuVersion = $state(0);

  function openCardContextMenu(
    x: number,
    y: number,
    rerender: () => void,
    sequence?: SequenceData
  ) {
    activeCardRerender = rerender;
    activeCardSequence = sequence;
    menuVersion++;
    contextMenuState = { open: true, x, y };
  }

  function closeCardContextMenu() {
    contextMenuState = { open: false };
  }

  const contextMenuItems: ContextMenuEntry[] = $derived.by(() => {
    void menuVersion;
    const seq = activeCardSequence;
    return buildCardMenuSection({
      onRerender: activeCardRerender,
      stepCount: seq?.steps?.length ?? 0,
      onColumnCountChange: () => {
        menuVersion++;
      },
      onSendTo: seq
        ? () => {
            closeCardContextMenu();
            openSendSequenceSheet(buildSequenceSharePayload(seq));
          }
        : undefined,
    });
  });

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
    (
      getThumbnailRenderOrchestrator() as ThumbnailRenderOrchestrator
    )?.cancelAll();
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
<ContextMenu
  menuState={contextMenuState}
  items={contextMenuItems}
  onClose={closeCardContextMenu}
/>

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
