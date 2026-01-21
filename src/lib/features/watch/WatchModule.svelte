<!--
  WatchModule.svelte

  Video browsing hub with three tabs:
  - Feed: Public videos from the community
  - Library: User's personal video library
  - Showcase: Curated Instagram content

  Uses standard bottom navigation (tabs provided via WATCH_TABS)
  Content renders based on navigationState.activeTab
-->
<script lang="ts">
  import {
    navigationState,
    WATCH_TABS,
  } from "$lib/shared/navigation/state/navigation-state.svelte";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import type { ShowcaseVideo } from "$lib/features/landing-preview/types";

  // Tab components
  import FeedTab from "./components/tabs/FeedTab.svelte";
  import LibraryTab from "./components/tabs/LibraryTab.svelte";
  import ShowcaseTab from "./components/tabs/ShowcaseTab.svelte";
  import CuratorTab from "./components/tabs/CuratorTab.svelte";

  // Video player state
  let selectedVideo = $state<CollaborativeVideo | ShowcaseVideo | null>(null);
  let showVideoPlayer = $state(false);

  function handleVideoClick(video: CollaborativeVideo | ShowcaseVideo) {
    selectedVideo = video;
    showVideoPlayer = true;
    // TODO: Open video player modal
    console.log("Selected video:", video);
  }

  function handleClosePlayer() {
    showVideoPlayer = false;
    selectedVideo = null;
  }

  // Derive active tab
  const activeTab = $derived(navigationState.activeTab || "feed");
</script>

<div class="watch-module">
  <div class="tab-content">
    {#if activeTab === "feed"}
      <FeedTab onVideoClick={handleVideoClick} />
    {:else if activeTab === "library"}
      <LibraryTab onVideoClick={handleVideoClick} />
    {:else if activeTab === "showcase"}
      <ShowcaseTab onVideoClick={handleVideoClick} />
    {:else if activeTab === "curator"}
      <CuratorTab />
    {:else}
      <!-- Default to feed -->
      <FeedTab onVideoClick={handleVideoClick} />
    {/if}
  </div>

  <!-- TODO: Video Player Modal -->
  {#if showVideoPlayer && selectedVideo}
    <div class="video-player-overlay" role="dialog" aria-modal="true">
      <div class="video-player-backdrop" onclick={handleClosePlayer}></div>
      <div class="video-player-content">
        <button
          class="close-btn"
          onclick={handleClosePlayer}
          aria-label="Close video player"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
        <div class="video-container">
          {#if "videoUrl" in selectedVideo && selectedVideo.videoUrl}
            <video
              src={selectedVideo.videoUrl}
              controls
              autoplay
              playsinline
            ></video>
          {:else if "thumbnailUrl" in selectedVideo}
            <div class="video-placeholder">
              <i class="fas fa-video" aria-hidden="true"></i>
              <span>Video playback coming soon</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .watch-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .tab-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Video Player Overlay */
  .video-player-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .video-player-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    cursor: pointer;
  }

  .video-player-content {
    position: relative;
    z-index: 1;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    background: var(--theme-card-bg, rgba(30, 30, 40, 0.98));
    border-radius: 12px;
    overflow: hidden;
  }

  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 2;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    transition: background var(--duration-normal, 150ms) ease;
  }

  .close-btn:hover {
    background: rgba(0, 0, 0, 0.8);
  }

  .video-container {
    width: 100%;
    aspect-ratio: 16/9;
    background: black;
  }

  .video-container video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .video-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--theme-text-dim, var(--text-secondary));
  }

  .video-placeholder i {
    font-size: 3rem;
    opacity: 0.4;
  }

  @media (max-width: 640px) {
    .video-player-content {
      width: 100%;
      max-width: none;
      max-height: 100vh;
      border-radius: 0;
    }

    .video-container {
      aspect-ratio: 9/16;
      max-height: calc(100vh - 60px);
    }
  }
</style>
