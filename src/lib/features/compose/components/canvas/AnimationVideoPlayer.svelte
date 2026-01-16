<!--
  AnimationVideoPlayer.svelte

  Handles animation playback with two modes:
  1. Live Preview - Real-time rendering (shows immediately)
  2. Video Playback - Pre-rendered video (generated in background)

  Flow:
  1. User sees live preview immediately (real-time trail drawing)
  2. User can click "Generate Video" to start background rendering
  3. Progress indicator shows generation status
  4. When ready, user can switch to video playback
  5. Video plays back perfectly smooth, regardless of device
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type {
    VideoRenderProgress,
    VideoRenderResult,
  } from "../../services/contracts/IVideoPreRenderer";
  import { getVideoPlayer } from "../../services/implementations/VideoPlayer";
  import { getVideoGenerationCoordinator } from "../../services/implementations/VideoGenerationCoordinator";
  import VideoGenerationStatus from "../video-player/VideoGenerationStatus.svelte";
  import VideoReadyNotification from "../video-player/VideoReadyNotification.svelte";
  import GenerateVideoButton from "../video-player/GenerateVideoButton.svelte";
  import PlaybackModeToggle from "../video-player/PlaybackModeToggle.svelte";

  // Props
  let {
    sequenceData = null,
    isPlaying = $bindable(false),
    speed = 1.0,
    autoGenerateVideo = false,
    onVideoReady = () => {},
    onModeChange = () => {},
    onBeatChange = () => {},
  }: {
    sequenceData?: SequenceData | null;
    isPlaying?: boolean;
    speed?: number;
    autoGenerateVideo?: boolean;
    onVideoReady?: (result: VideoRenderResult) => void;
    onModeChange?: (mode: "live" | "video") => void;
    onBeatChange?: (beat: number) => void;
  } = $props();

  // State
  let playbackMode = $state<"live" | "video">("live");
  let videoResult = $state<VideoRenderResult | null>(null);
  let isGeneratingVideo = $state(false);
  let videoProgress = $state<VideoRenderProgress | null>(null);
  let videoElement: HTMLVideoElement | null = $state(null);

  // Services
  const playbackService = getVideoPlayer();
  const generationCoordinator = getVideoGenerationCoordinator();

  // Check for cached video on mount
  onMount(async () => {
    if (sequenceData) {
      const cached = await generationCoordinator.checkCachedVideo(sequenceData);
      if (cached) {
        videoResult = cached;
        onVideoReady(cached);
      } else if (autoGenerateVideo) {
        startVideoGeneration();
      }
    }
  });

  // Clean up on destroy
  onDestroy(() => {
    playbackService.dispose();
    if (videoResult?.blobUrl) {
      URL.revokeObjectURL(videoResult.blobUrl);
    }
  });

  // Watch for sequence changes
  $effect(() => {
    if (sequenceData) {
      // Reset state for new sequence
      playbackMode = "live";
      videoResult = null;
      videoProgress = null;

      // Check for cached video
      generationCoordinator.checkCachedVideo(sequenceData).then((cached) => {
        if (cached) {
          videoResult = cached;
          onVideoReady(cached);
        }
      });
    }
  });

  // Initialize playback service when video element is available
  $effect(() => {
    if (videoElement) {
      playbackService.initialize(videoElement);
    }
  });

  // Sync video playback with isPlaying
  $effect(() => {
    if (playbackMode === "video" && videoElement) {
      if (isPlaying) {
        playbackService.play();
        playbackService.startBeatTracking(onBeatChange);
      } else {
        playbackService.pause();
        playbackService.stopBeatTracking();
      }
    }
  });

  // Sync video playback rate with speed (BPM)
  $effect(() => {
    if (videoElement) {
      playbackService.setPlaybackRate(speed);
    }
  });

  /**
   * Start generating video in the background
   */
  async function startVideoGeneration() {
    if (!sequenceData || isGeneratingVideo) return;

    isGeneratingVideo = true;
    videoProgress = {
      currentFrame: 0,
      totalFrames: 0,
      percent: 0,
      estimatedTimeRemaining: 0,
      phase: "rendering",
    };

    try {
      const result = await generationCoordinator.generateVideo(
        sequenceData,
        {
          fps: 60,
          quality: 0.9,
          width: 500,
          height: 500,
        },
        (progress) => {
          videoProgress = progress;
        }
      );

      videoResult = result;
      onVideoReady(result);
    } catch (error) {
      console.error("Video generation error:", error);
    } finally {
      isGeneratingVideo = false;
      videoProgress = null;
    }
  }

  function cancelVideoGeneration() {
    generationCoordinator.cancelGeneration();
    isGeneratingVideo = false;
    videoProgress = null;
  }

  function switchToVideo() {
    if (videoResult?.blobUrl) {
      playbackMode = "video";
      onModeChange("video");
      // Auto-play video when switching to video mode
      setTimeout(() => {
        if (videoElement) {
          playbackService.seek(0);
          playbackService.play();
        }
      }, 50);
    }
  }

  function switchToLive() {
    playbackMode = "live";
    onModeChange("live");
  }

  function handleModeChange(mode: "live" | "video") {
    if (mode === "live") {
      switchToLive();
    } else {
      switchToVideo();
    }
  }

  // Handle video ended event - loop playback
  function handleVideoEnded() {
    if (videoElement && isPlaying) {
      playbackService.seek(0);
      playbackService.play();
    }
  }

  // Handle video errors
  function handleVideoError(event: Event) {
    const video = event.target as HTMLVideoElement;
    const error = video.error;
    console.error("Video playback error:", {
      code: error?.code,
      message: error?.message,
      blobUrl: videoResult?.blobUrl,
      videoSize: videoResult?.videoBlob?.size,
    });
  }

  // Handle video can play
  function handleCanPlay() {
    // Video is ready for playback
  }

  // Handle video loaded metadata
  function handleLoadedMetadata() {
    // Video metadata is now available
  }
</script>

<!-- Video generation status indicator -->
{#if isGeneratingVideo && videoProgress}
  <VideoGenerationStatus
    progress={videoProgress}
    onCancel={cancelVideoGeneration}
  />
{/if}

<!-- Video ready notification -->
{#if videoResult?.success && playbackMode === "live" && !isGeneratingVideo}
  <VideoReadyNotification onSwitchToVideo={switchToVideo} />
{/if}

<!-- Generate video button (when no video exists) -->
<!-- {#if !videoResult && !isGeneratingVideo && sequenceData} -->
<!-- <GenerateVideoButton onGenerate={startVideoGeneration} /> -->
<!-- {/if} -->

<!-- Mode toggle (when video exists) -->
{#if videoResult?.success}
  <PlaybackModeToggle
    bind:currentMode={playbackMode}
    onModeChange={handleModeChange}
  />
{/if}

<!-- Video element (hidden when in live mode) -->
{#if videoResult?.blobUrl}
  <video
    bind:this={videoElement}
    src={videoResult.blobUrl}
    playsinline
    muted
    class="video-player"
    class:hidden={playbackMode !== "video"}
    onended={handleVideoEnded}
    onerror={handleVideoError}
    oncanplay={handleCanPlay}
    onloadedmetadata={handleLoadedMetadata}
  >
    <track kind="captions" />
  </video>
{/if}

<style>
  .video-player {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: inherit;
  }

  .video-player.hidden {
    display: none;
  }
</style>
