<!--
  Visual harness for the real Post Studio surface. It uses a published sequence,
  its real linked performance video when one exists, and the production card
  renderer. Missing sources stay missing so preset readiness is honest.
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import PostStudio from "$lib/shared/share/components/post-studio/PostStudio.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { hydrateSequence } from "$lib/shared/sequence-viewer/services/sequence-data-provider";
  import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
  import { getSharer } from "$lib/shared/share/get-sharer";
  import { getVideosForSequence } from "$lib/shared/video-collaboration/services/collaborative-video-manager";
  import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
  import { registerLoopDetector } from "$lib/shared/create/get-loop-detector";
  import type { SequenceTimeMap } from "$lib/shared/media-composition/domain/sequence-time-map";
  import { migrateLegacyStepMap } from "$lib/shared/media-composition/domain/sequence-time-map";

  const SEQUENCE_WORD = "BΣTW";
  const SEQUENCE_ID = "BΣTW";

  let sequence = $state<SequenceData | null>(null);
  let cardPreviewUrl = $state<string | null>(null);
  let animationPreviewUrl = $state<string | null>(null);
  let animationPreviewType = $state<"video" | "image">("video");
  let isPreparingAnimation = $state(false);
  let performanceDurationSeconds = $state<number | undefined>();
  let sequenceTimeMap = $state<SequenceTimeMap | null>(null);
  let loadError = $state<string | null>(null);
  let animationTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    registerLoopDetector(loopDetector);
    try {
      const loaded = await getBrowseLoader().loadFullSequenceData(
        SEQUENCE_WORD,
        SEQUENCE_ID
      );
      if (!loaded)
        throw new Error("The visual fixture is no longer published.");
      const hydrated = await hydrateSequence(loaded);
      const linkedVideos = await getVideosForSequence(SEQUENCE_ID).catch(
        () => []
      );
      const linkedVideo = linkedVideos[0];
      const performanceVideoUrl =
        hydrated.performanceVideoUrl ?? linkedVideo?.videoUrl;
      performanceDurationSeconds = linkedVideo?.duration;
      if (linkedVideo?.beatMap && linkedVideo.duration > 0) {
        sequenceTimeMap = migrateLegacyStepMap({
          stepMap: linkedVideo.beatMap,
          sequenceRef: {
            sequenceId: hydrated.id,
            revisionId: `published:${hydrated.id}:${hydrated.word}:${hydrated.steps.length}`,
          },
          mediaSourceId: linkedVideo.id,
          mediaDurationSeconds: linkedVideo.duration,
        });
      }
      sequence = performanceVideoUrl
        ? { ...hydrated, performanceVideoUrl }
        : hydrated;

      const blob = await getSharer().getCardImageBlob(sequence, {
        darkMode: true,
      });
      cardPreviewUrl = URL.createObjectURL(blob);

      if (sequence.animatedSequenceUrl) {
        animationPreviewUrl = sequence.animatedSequenceUrl;
        animationPreviewType = "image";
      }
    } catch (error) {
      loadError =
        error instanceof Error ? error.message : "Could not load Post Studio.";
    }
  });

  onDestroy(() => {
    if (cardPreviewUrl) URL.revokeObjectURL(cardPreviewUrl);
    if (animationTimer) clearTimeout(animationTimer);
  });

  function requestAnimation(): void {
    if (animationPreviewUrl || isPreparingAnimation) return;
    isPreparingAnimation = true;
    animationTimer = setTimeout(() => {
      isPreparingAnimation = false;
      animationTimer = null;
    }, 1800);
  }
</script>

<svelte:head>
  <title>Post Studio visual harness</title>
</svelte:head>

<main class="harness">
  {#if loadError}
    <div class="load-state error" role="alert">{loadError}</div>
  {:else if !sequence}
    <div class="load-state" role="status">
      <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
      Loading a published sequence…
    </div>
  {:else}
    <PostStudio
      {sequence}
      {cardPreviewUrl}
      {animationPreviewUrl}
      {animationPreviewType}
      {performanceDurationSeconds}
      {sequenceTimeMap}
      isPreparingCard={!cardPreviewUrl}
      {isPreparingAnimation}
      onRequestAnimation={requestAnimation}
    />
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    background: #09090d;
  }

  .harness {
    display: grid;
    align-items: start;
    width: 100%;
    height: 100dvh;
    padding: clamp(0.5rem, 1.5vw, 2rem);
    overflow: hidden;
    background:
      radial-gradient(
        circle at 12% 0%,
        rgba(87, 64, 180, 0.18),
        transparent 34rem
      ),
      #09090d;
  }

  .load-state {
    display: flex;
    align-items: center;
    justify-self: center;
    gap: 0.625rem;
    margin-top: 25dvh;
    padding: 1rem 1.25rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.875rem;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9375rem;
  }

  .load-state.error {
    border-color: rgba(229, 90, 90, 0.28);
    color: #ffb4b4;
  }
</style>
