<script lang="ts">
  import type { CompositionSourceBinding } from "$lib/shared/media-composition/state/media-composition-state.svelte";
  import type { LayoutRegion } from "$lib/shared/media-composition/domain/media-layout-schema";
  import type { EvaluatedFrameLayer } from "$lib/shared/media-composition/services/frame-evaluator";
  import { getMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import PostStudioSequenceAnimationLayer from "./PostStudioSequenceAnimationLayer.svelte";
  import PostStudioChoreoLayer from "./PostStudioChoreoLayer.svelte";

  interface Props {
    binding: CompositionSourceBinding;
    fit: LayoutRegion["fit"];
    opacity: number;
    sourceTimeSeconds: number;
    playing: boolean;
    sequence: SequenceData;
    sequencePosition?: number;
    displayedBeatNumber?: number;
    clipId: string;
    transform: EvaluatedFrameLayer["transform"];
  }

  let {
    binding,
    fit,
    opacity,
    sourceTimeSeconds,
    playing,
    sequence,
    sequencePosition,
    displayedBeatNumber,
    clipId,
    transform,
  }: Props = $props();
  const composition = getMediaCompositionContext();
  let video = $state<HTMLVideoElement | null>(null);

  function syncVideoTime(): void {
    if (!video || video.readyState < 1 || !Number.isFinite(sourceTimeSeconds))
      return;
    const ceiling = Math.max(0, video.duration - 1 / 60);
    const target = Math.min(ceiling, Math.max(0, sourceTimeSeconds));
    if (Math.abs(video.currentTime - target) > 0.12) video.currentTime = target;
  }

  function onMetadata(): void {
    if (!video || !Number.isFinite(video.duration)) return;
    composition.setSourceDuration(binding.roleKey, video.duration);
    syncVideoTime();
  }

  $effect(() => {
    sourceTimeSeconds;
    playing;
    syncVideoTime();
    if (!video) return;
    if (playing) {
      if (video.paused) void video.play().catch(() => undefined);
    } else if (!video.paused) {
      video.pause();
    }
  });
</script>

<div
  class="media-layer"
  style:opacity
  style:transform={`translate(${transform.translateX * 100}%, ${transform.translateY * 100}%) rotate(${transform.rotationDegrees}deg) scale(${transform.scale})`}
  data-clip-id={clipId}
  data-source-role={binding.roleKey}
  data-render-mode={binding.renderMode ?? "external-media"}
>
  {#if binding.renderMode === "sequence-animation" && sequencePosition !== undefined}
    <PostStudioSequenceAnimationLayer {sequence} {sequencePosition} {playing} />
  {:else if binding.renderMode === "choreo-card" && displayedBeatNumber !== undefined}
    <PostStudioChoreoLayer {sequence} {displayedBeatNumber} />
  {:else if binding.previewType === "video" || binding.kind === "video"}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      bind:this={video}
      src={binding.previewUrl ?? undefined}
      crossorigin="anonymous"
      muted
      playsinline
      preload="auto"
      style:object-fit={fit}
      onloadedmetadata={onMetadata}
    ></video>
  {:else}
    <img
      src={binding.previewUrl ?? undefined}
      crossorigin="anonymous"
      alt=""
      style:object-fit={fit}
    />
  {/if}
</div>

<style>
  .media-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transform-origin: center;
  }

  img,
  video {
    width: 100%;
    height: 100%;
  }
</style>
