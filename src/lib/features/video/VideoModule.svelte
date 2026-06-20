<!--
  VideoModule.svelte - Video analysis, trails, effects, and notation extraction

  Graduated from Lab (Mar 2026). Three tabs:
    - Video Trails: prop endpoint detection, fire/LED effects, training data
    - Video Lab: beat mapping, BPM-synced playback, video-to-notation alignment
    - Skel2TKA: video-to-TKA notation pipeline

  Navigation between tabs is handled by the sidebar - no internal tab bar needed.
-->
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { VIDEO_TABS } from "$lib/shared/navigation/config/tab-definitions";
  import type { Component } from "svelte";

  // Dynamic tab imports - lazy-load each tab component
  const tabComponents: Record<string, () => Promise<{ default: Component }>> = {
    "video-trails": () => import("./video-trails/VideoTrailsLab.svelte"),
    "video-lab": () => import("./video-lab/VideoLab.svelte"),
    skel2tka: () => import("$lib/features/skel2tka/Skel2TKALab.svelte"),
  };

  // Get current tab, default to first tab
  const activeTab = $derived(navigationState.activeTab || VIDEO_TABS[0]?.id || "video-trails");

  // Load the active tab component
  let TabComponent = $state<Component | null>(null);
  let loadError = $state<string | null>(null);

  $effect(() => {
    const loader = tabComponents[activeTab];
    if (loader) {
      loadError = null;
      loader()
        .then((mod) => {
          TabComponent = mod.default;
        })
        .catch((err: Error) => {
          console.error(`Failed to load video tab "${activeTab}":`, err);
          loadError = `Failed to load "${activeTab}" tab`;
          TabComponent = null;
        });
    } else {
      if (navigationState.currentModule === "video") {
        loadError = `Unknown tab: ${activeTab}`;
      }
      TabComponent = null;
    }
  });
</script>

<div class="video-module">
  {#if loadError}
    <div class="video-error">
      <i class="fas fa-exclamation-triangle"></i>
      <span>{loadError}</span>
    </div>
  {:else if TabComponent}
    <TabComponent />
  {:else}
    <div class="video-loading">
      <i class="fas fa-circle-notch fa-spin"></i>
      <span>Loading video tab...</span>
    </div>
  {/if}
</div>

<style>
  .video-module {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .video-loading,
  .video-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 14px;
  }

  .video-error {
    color: var(--semantic-error, #ef4444);
  }

  .video-loading i,
  .video-error i {
    font-size: 24px;
  }
</style>
