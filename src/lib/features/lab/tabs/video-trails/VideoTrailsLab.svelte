<script lang="ts">
  import { onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import { createVideoTrailsState } from "./state/video-trails-state.svelte";
  import { setVideoTrailsContext } from "./context/video-trails-context";
  import type { VideoTrailsView } from "./domain/types";

  const state = createVideoTrailsState(
    container.items.videoTrailsRepository,
    container.items.detectionCorrector,
    container.items.videoTipAdapter,
  );
  setVideoTrailsContext({ state });

  const views: { id: VideoTrailsView; label: string; icon: string }[] = [
    { id: "workspace", label: "Workspace", icon: "fa-video" },
    { id: "detection-studio", label: "Detection Studio", icon: "fa-crosshairs" },
    { id: "library", label: "Library", icon: "fa-folder-open" },
  ];

  let WorkspaceView: any = $state(null);
  let DetectionStudioView: any = $state(null);
  let LibraryView: any = $state(null);

  $effect(() => {
    switch (state.activeView) {
      case "workspace":
        if (!WorkspaceView) {
          import("./views/WorkspaceView.svelte").then((m) => { WorkspaceView = m.default; });
        }
        break;
      case "detection-studio":
        if (!DetectionStudioView) {
          import("./views/DetectionStudioView.svelte").then((m) => { DetectionStudioView = m.default; });
        }
        break;
      case "library":
        if (!LibraryView) {
          import("./views/LibraryView.svelte").then((m) => { LibraryView = m.default; });
        }
        break;
    }
  });

  onDestroy(() => state.destroy());
</script>

<div class="video-trails-root">
  <nav class="sub-nav" role="tablist">
    {#each views as view}
      <button
        class="sub-nav-tab"
        class:active={state.activeView === view.id}
        role="tab"
        aria-selected={state.activeView === view.id}
        onclick={() => { state.activeView = view.id; }}
      >
        <i class="fas {view.icon}" aria-hidden="true"></i>
        <span>{view.label}</span>
      </button>
    {/each}
  </nav>

  <div class="view-container">
    {#if state.activeView === "workspace" && WorkspaceView}
      <WorkspaceView />
    {:else if state.activeView === "detection-studio" && DetectionStudioView}
      <DetectionStudioView />
    {:else if state.activeView === "library" && LibraryView}
      <LibraryView />
    {:else}
      <div class="loading-view">Loading...</div>
    {/if}
  </div>
</div>

<style>
  .video-trails-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
  }

  .sub-nav {
    display: flex;
    gap: 2px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .sub-nav-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .sub-nav-tab:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
  }

  .sub-nav-tab.active {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-accent, #f43f5e);
  }

  .view-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .loading-view {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }
</style>
