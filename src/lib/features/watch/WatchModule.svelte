<!--
  WatchModule.svelte

  Video browsing hub with two main tabs:
  - Feed: TikTok-style vertical feed from the community
  - Library: User's personal videos and saved performances

  Uses standard bottom navigation (tabs provided via WATCH_TABS)
  Content renders based on navigationState.activeTab
-->
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";

  // Tab components
  import FeedTab from "./components/tabs/FeedTab.svelte";
  import LibraryTab from "./components/tabs/LibraryTab.svelte";

  // Derive active tab - default to feed
  const activeTab = $derived(navigationState.activeTab || "feed");
</script>

<div class="watch-module">
  <div class="tab-content">
    {#if activeTab === "feed"}
      <FeedTab />
    {:else if activeTab === "library"}
      <LibraryTab />
    {:else}
      <!-- Default to feed -->
      <FeedTab />
    {/if}
  </div>
</div>

<style>
  .watch-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: #000;
  }

  .tab-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
