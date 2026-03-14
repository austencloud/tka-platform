<script lang="ts">
  import { onDestroy } from "svelte";
  import { getVideoTrailsContext } from "../context/video-trails-context";
  import TimelineScrubber from "../components/TimelineScrubber.svelte";
  import EndpointEditor from "../components/EndpointEditor.svelte";
  import OcclusionMarker from "../components/OcclusionMarker.svelte";
  import TrainingDataPanel from "../components/TrainingDataPanel.svelte";
  import DetectorEvaluator from "../components/DetectorEvaluator.svelte";

  const { state: trailsState } = getVideoTrailsContext();

  let videoElement: HTMLVideoElement | null = $state(null);
  let canvasWidth = $state(640);
  let canvasHeight = $state(360);
  let selectedPropIndex = $state<0 | 1>(0);
  let selectedTipIndex = $state(0);

  // Create video element for frame rendering and wire it to the source URL
  $effect(() => {
    if (!trailsState.source?.url) return;

    if (!videoElement) {
      videoElement = document.createElement("video");
      videoElement.crossOrigin = "anonymous";
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.preload = "auto";
    }

    videoElement.src = trailsState.source.url;
    videoElement.onloadedmetadata = () => {
      if (!videoElement) return;
      canvasWidth = videoElement.videoWidth;
      canvasHeight = videoElement.videoHeight;
    };
  });

  // Seek the hidden video element to the current frame whenever it changes
  $effect(() => {
    if (!videoElement || !trailsState.source) return;
    const time = trailsState.currentFrame / trailsState.source.fps;
    if (Math.abs(videoElement.currentTime - time) > 0.01) {
      videoElement.currentTime = time;
    }
  });

  onDestroy(() => {
    if (videoElement) {
      videoElement.pause();
      videoElement.src = "";
    }
  });
</script>

{#if !trailsState.source}
  <div class="no-video">
    <i class="fas fa-film" aria-hidden="true"></i>
    <p>No video loaded. Go to the Workspace tab to load a source.</p>
  </div>
{:else}
  <div class="studio">
    <div class="main-area">
      <EndpointEditor
        {videoElement}
        width={canvasWidth}
        height={canvasHeight}
      />
    </div>

    <div class="sidebar">
      <OcclusionMarker
        {selectedPropIndex}
        {selectedTipIndex}
      />
      <TrainingDataPanel {videoElement} />
      <DetectorEvaluator {videoElement} />
    </div>

    <div class="scrubber-row">
      <TimelineScrubber />
    </div>
  </div>
{/if}

<style>
  .no-video {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .no-video i {
    font-size: 48px;
    opacity: 0.3;
  }

  .no-video p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
  }

  /* Two-column layout with timeline spanning full width below */
  .studio {
    container-type: inline-size;
    display: grid;
    grid-template-columns: 1fr 280px;
    grid-template-rows: 1fr auto;
    grid-template-areas:
      "main sidebar"
      "scrubber scrubber";
    gap: 12px;
    height: 100%;
    padding: 12px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .main-area {
    grid-area: main;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .sidebar {
    grid-area: sidebar;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .scrubber-row {
    grid-area: scrubber;
  }

  /* Stack vertically on narrow containers */
  @container (max-width: 640px) {
    .studio {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
      grid-template-areas:
        "main"
        "sidebar"
        "scrubber";
    }

    .sidebar {
      flex-direction: row;
      flex-wrap: wrap;
      overflow-y: visible;
    }

    .sidebar > :global(*) {
      flex: 1 1 240px;
    }
  }
</style>
