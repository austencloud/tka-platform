<!--
  ComposeModule.svelte - Choreography & Arrangement Module

  Tabs:
  - Arrange (Compose): Unified composition builder with inline playback
  - Browse: Saved compositions gallery

  Architecture:
  - CompositionBuilder replaces old ArrangeTab with layout-first approach
  - Each cell in the grid can be single or tunnel (multiple overlaid sequences)
  - Playback happens inline - no separate overlay needed for new compositions
  - PlaybackOverlay still used for Browse tab (legacy saved compositions)
-->
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { getComposeModuleState } from "./shared/state/compose-module-state.svelte.ts";
  import type { ComposeTab } from "./shared/state/compose-module-state.svelte.ts";
  import type { IURLSyncer } from "$lib/shared/navigation/services/contracts/IURLSyncer";
  import type { IDeepLinker } from "$lib/shared/navigation/services/contracts/IDeepLinker";

  // Import tab components
  // CompositionBuilder replaces old ArrangeTab with unified layout-first composition builder
  import CompositionBuilder from "./compose/CompositionBuilder.svelte";
  import BrowseTab from "./tabs/browse/BrowseTab.svelte";

  // Import playback overlay (for Browse tab - legacy saved compositions)
  import PlaybackOverlay from "./tabs/playback/PlaybackTab.svelte";

  // Get module state (singleton)
  const composeState = getComposeModuleState();

  // Services
  let urlSyncService: IURLSyncer | null = $state(null);
  let deepLinkService: IDeepLinker | null = $state(null);

  // Track if deep link has been processed
  let deepLinkProcessed = $state(false);

  // Sync current tab with navigation state
  $effect(() => {
    const section = navigationState.activeTab;
    if (section === "arrange" || section === "browse") {
      composeState.setCurrentTab(section as ComposeTab);
    }
  });

  // Sync tab to URL for sharing
  $effect(() => {
    if (!urlSyncService) return;
    const currentModule = navigationState.currentModule;
    if (currentModule !== "compose") return;

    // TODO: Sync composition ID to URL when viewing saved compositions
  });

  // Initialize on mount
  onMount(() => {
    // Resolve services
    try {
      urlSyncService = container.items.urlSyncer;
      deepLinkService = container.items.deepLinker;
    } catch (error) {
      console.warn("Failed to resolve navigation services:", error);
    }

    // Set default tab if none persisted or invalid
    const section = navigationState.activeTab;
    if (!section || (section !== "arrange" && section !== "browse")) {
      navigationState.setActiveTab("arrange");
    }

    // Check for deep link (e.g., shared composition URL)
    const deepLinkData = deepLinkService?.consumeData("compose");
    if (deepLinkData) {
      try {
        // TODO: Load composition by ID and open playback overlay
        // For now, just navigate to the specified tab
        if (
          deepLinkData.tabId &&
          (deepLinkData.tabId === "arrange" || deepLinkData.tabId === "browse")
        ) {
          navigationState.setActiveTab(deepLinkData.tabId);
          composeState.setCurrentTab(deepLinkData.tabId as ComposeTab);
        }
      } catch (err) {
        console.error("❌ Failed to load deep link composition:", err);
      }
    }

    // Mark deep link as processed
    deepLinkProcessed = true;
  });

  // Check if tab is active
  function isTabActive(tab: ComposeTab): boolean {
    return composeState.currentTab === tab;
  }
</script>

<div class="compose-module">
  <div class="content-container">
    {#key composeState.currentTab}
      <div class="tab-panel">
        {#if isTabActive("arrange")}
          <CompositionBuilder />
        {:else if isTabActive("browse")}
          <BrowseTab />
        {/if}
      </div>
    {/key}
  </div>

  <!-- Playback Overlay - renders fullscreen over tabs when open -->
  {#if composeState.isPlaybackOpen}
    <div class="playback-overlay">
      <PlaybackOverlay />
    </div>
  {/if}
</div>

<style>
  .compose-module {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: transparent;
    color: var(--foreground, #ffffff);
  }

  .content-container {
    position: relative;
    flex: 1;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .tab-panel {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* Playback overlay - fullscreen over tabs */
  .playback-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    background: transparent;
  }
</style>
