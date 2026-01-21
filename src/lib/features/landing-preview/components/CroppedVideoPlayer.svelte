<script lang="ts">
  /**
   * CroppedVideoPlayer
   *
   * Single source of truth for rendering videos with crop and/or snip modifications.
   * - Crop: spatial (pan, zoom, aspect ratio)
   * - Snip: temporal (in-point, out-point)
   */
  import type { VideoCropData, VideoSnipData } from "../types";

  interface Props {
    src: string;
    crop?: VideoCropData;
    snip?: VideoSnipData;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    controls?: boolean;
    playsinline?: boolean;
    class?: string;
    /** Bind to get the underlying video element */
    videoElement?: HTMLVideoElement | null;
    /** Called on timeupdate events (after snip boundary enforcement) */
    onTimeUpdate?: () => void;
  }

  let {
    src,
    crop,
    snip,
    autoplay = false,
    loop = false,
    muted = false,
    controls = false,
    playsinline = true,
    class: className = "",
    videoElement = $bindable(null),
    onTimeUpdate,
  }: Props = $props();

  // Snip boundary enforcement
  function handleTimeUpdate() {
    if (snip && videoElement) {
      const { inPoint, outPoint } = snip;

      // If past out-point, either loop back to in-point or pause
      if (videoElement.currentTime >= outPoint) {
        if (loop) {
          videoElement.currentTime = inPoint;
        } else {
          videoElement.pause();
          videoElement.currentTime = outPoint;
        }
      }

      // If somehow before in-point (user scrubbed), jump to in-point
      if (videoElement.currentTime < inPoint) {
        videoElement.currentTime = inPoint;
      }
    }

    onTimeUpdate?.();
  }

  // Seek to in-point when video loads (if snipped)
  function handleLoadedMetadata() {
    if (snip && videoElement) {
      videoElement.currentTime = snip.inPoint;
    }
  }

  // Calculate CSS transform from crop data
  const videoTransform = $derived.by(() => {
    if (!crop) return "";

    const { position, scale } = crop;
    const translateX = -50 + position.x * 100;
    const translateY = -50 + position.y * 100;

    return `transform: translate(${translateX}%, ${translateY}%) scale(${scale});`;
  });

  // Calculate container aspect ratio from crop
  const containerStyle = $derived.by(() => {
    if (!crop) return "";
    return `aspect-ratio: ${crop.aspect};`;
  });

  const hasCrop = $derived(
    !!crop &&
      (crop.scale !== 1 ||
        crop.position.x !== 0 ||
        crop.position.y !== 0 ||
        crop.aspectLabel !== "original")
  );
</script>

{#if hasCrop}
  <div class="cropped-container {className}" style={containerStyle}>
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      bind:this={videoElement}
      {src}
      {autoplay}
      {loop}
      {muted}
      {controls}
      {playsinline}
      class="cropped-video"
      style={videoTransform}
      ontimeupdate={handleTimeUpdate}
      onloadedmetadata={handleLoadedMetadata}
    ></video>
  </div>
{:else}
  <!-- No crop - render video directly -->
  <!-- svelte-ignore a11y_media_has_caption -->
  <video
    bind:this={videoElement}
    {src}
    {autoplay}
    {loop}
    {muted}
    {controls}
    {playsinline}
    class={className}
    ontimeupdate={handleTimeUpdate}
    onloadedmetadata={handleLoadedMetadata}
  ></video>
{/if}

<style>
  .cropped-container {
    position: relative;
    overflow: hidden;
    border-radius: inherit;
  }

  .cropped-video {
    position: absolute;
    top: 50%;
    left: 50%;
    min-width: 100%;
    min-height: 100%;
    width: auto;
    height: auto;
    transform-origin: center center;
    transform: translate(-50%, -50%);
  }
</style>
