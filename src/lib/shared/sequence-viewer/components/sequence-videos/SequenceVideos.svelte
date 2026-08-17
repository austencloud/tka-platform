<!--
  SequenceVideos.svelte

  Everything this sequence's performance videos need: browsing them, adding
  one, and mapping a performance to the steps.

  It replaces the pair of galleries that used to render at once — one in the
  viewer body, one in the sidebar upload pane — showing the same videos in two
  visual languages behind two different delete dialogs. The list now comes from
  the shared per-sequence store, so an upload or a delete here reaches every
  other surface showing the same sequence.

  See docs/superpowers/specs/2026-08-16-sequence-videos-consolidation-design.md
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { getSequenceVideosStore } from "$lib/shared/video-collaboration/state/sequence-videos-store.svelte";
  import {
    getCreatorDisplayName,
    type CollaborativeVideo,
    type StepMap,
  } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { tryGetVideoPlayheadContext } from "../../context/video-playhead-context";
  import {
    getStepIndexFromVideo,
    passCountFromStepMap,
    passNumberFromVideo,
  } from "$lib/shared/video-collaboration/utils/step-map-utils";
  import DeleteConfirmDialog from "../DeleteConfirmDialog.svelte";
  import StepMapEditor from "../step-mapping/StepMapEditor.svelte";
  import VideoUploadFlow from "./VideoUploadFlow.svelte";

  interface Props {
    sequence: SequenceData;
    isOwned: boolean;
    isLoggedIn?: boolean;
    /** Seeds the timing editor's even-spacing guess. Browsing never needs it. */
    bpm?: number;
    /** Signed in and the upload feature is on. Browse-only hosts leave it off. */
    canUpload?: boolean;
    /**
     * The viewer's own record of whether this surface is working rather than
     * browsing. Held outside the component because other entry points open the
     * flow — the split-pane companion's Add performance, for one — and because
     * the viewer pauses playback and announces the change on the same signal.
     */
    uploadRequested?: boolean;
    onSaveFirst?: () => Promise<void>;
    onUploadOpenChange?: (open: boolean) => void;
  }

  let {
    sequence,
    isOwned,
    isLoggedIn = false,
    bpm = 120,
    canUpload = false,
    uploadRequested = false,
    onSaveFirst,
    onUploadOpenChange,
  }: Props = $props();

  let mappingVideoId = $state<string | null>(null);
  const view = $derived(
    mappingVideoId ? "map" : uploadRequested ? "upload" : "browse"
  );
  let selectedVideoId = $state<string | null>(null);
  let pendingDeleteId = $state<string | null>(null);
  let isDeleting = $state(false);
  let deleteError = $state("");
  let videoAspectRatios = $state<Record<string, number>>({});

  const store = $derived(getSequenceVideosStore(sequence?.id ?? ""));

  $effect(() => {
    if (!sequence?.id) return;
    void store.load();
  });

  // Selection follows the list: it lands on the first video, and on a
  // neighbour when the selected one is deleted.
  $effect(() => {
    const list = store.videos;
    if (list.length === 0) {
      selectedVideoId = null;
      return;
    }
    if (!list.some((video) => video.id === selectedVideoId)) {
      selectedVideoId = list[0]!.id;
    }
  });

  const videos = $derived(store.videos);
  const selectedVideo = $derived(
    videos.find((video) => video.id === selectedVideoId) ?? null
  );
  const pendingDeleteVideo = $derived(
    videos.find((video) => video.id === pendingDeleteId) ?? null
  );
  const mappingVideo = $derived(
    videos.find((video) => video.id === mappingVideoId) ?? null
  );
  const selectedVideoAspectRatio = $derived(
    selectedVideo ? (videoAspectRatios[selectedVideo.id] ?? 16 / 9) : 16 / 9
  );

  function getCreatorName(video: CollaborativeVideo): string {
    return getCreatorDisplayName(video) ?? "Anonymous";
  }

  function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function getTimingLabel(video: CollaborativeVideo): string {
    if (!video.beatMap) return "Timing not mapped";
    return video.beatMap.source === "manual"
      ? "Timing mapped manually"
      : "Timing map saved";
  }

  /**
   * A performance's shape belongs to the media, not to the gallery. Metadata
   * arrives after the source starts loading, so retain it per video while a
   * curator moves through the collection.
   */
  function rememberVideoAspectRatio(
    videoId: string,
    width: number,
    height: number
  ): void {
    if (width <= 0 || height <= 0) return;

    const aspectRatio = width / height;
    if (
      !Number.isFinite(aspectRatio) ||
      videoAspectRatios[videoId] === aspectRatio
    )
      return;

    videoAspectRatios = { ...videoAspectRatios, [videoId]: aspectRatio };
  }

  function seekPreviewToThumbnailFrame(event: Event): void {
    const preview = event.currentTarget as HTMLVideoElement;
    if (!Number.isFinite(preview.duration) || preview.duration <= 0) return;
    preview.currentTime = Math.min(1, preview.duration / 2);
  }

  async function confirmDelete() {
    const id = pendingDeleteId;
    if (!id) return;
    isDeleting = true;
    deleteError = "";
    try {
      await store.remove(id);
      pendingDeleteId = null;
    } catch (error) {
      // Removing the row on a failed delete would claim the video is gone
      // while the record survives. Keep it, and say what happened.
      deleteError =
        error instanceof Error
          ? error.message
          : "That performance could not be deleted.";
    } finally {
      isDeleting = false;
    }
  }

  function handleUploaded(video: CollaborativeVideo) {
    selectedVideoId = video.id;
    returnToBrowsing();
  }

  async function handleStepMapSave(stepMap: StepMap) {
    if (!mappingVideo) return;
    await store.applyStepMap(mappingVideo.id, stepMap);
    toast.success("Timing saved");
    returnToBrowsing();
  }

  function startMapping(videoId: string) {
    mappingVideoId = videoId;
    // Same signal the uploader raises: the viewer stops playback while this
    // surface is being worked in rather than browsed.
    onUploadOpenChange?.(true);
  }

  function returnToBrowsing() {
    mappingVideoId = null;
    onUploadOpenChange?.(false);
  }

  // ---- The shared playhead ----
  //
  // Present only inside the viewer. Everywhere else this component renders -
  // Create's videos panel, the test routes - there is no notation beside the
  // footage to keep in step, and every call below is a no-op.

  const playhead = tryGetVideoPlayheadContext();

  /** The timing on the performance being watched, if it has any. */
  const activeMap = $derived(view === "browse" ? (selectedVideo?.beatMap ?? null) : null);

  let playerTime = $state(0);

  $effect(() => {
    // Reads activeMap so switching performance, or leaving browse for the
    // uploader or the timing editor, hands the playhead back.
    const map = activeMap;
    playhead?.attach(map ?? null);
    playerTime = 0;
    return () => playhead?.attach(null);
  });

  /**
   * Where the footage is, in the sequence's own terms. A take almost always
   * runs the LOOP several times, so this says which time through as well -
   * without it the highlight counts 1 to 16 four times over with nothing to
   * say it went round again.
   */
  const playheadLabel = $derived.by(() => {
    if (!activeMap) return "";
    const step = getStepIndexFromVideo(playerTime, activeMap);
    if (step < 0) return "";
    const move = `Move ${step + 1}`;
    if (passCountFromStepMap(activeMap) < 2) return move;
    return `${move} · pass ${passNumberFromVideo(playerTime, activeMap)}`;
  });

  function handlePlayerTimeUpdate(event: Event): void {
    const player = event.currentTarget as HTMLVideoElement;
    playerTime = player.currentTime;
    playhead?.reportTime(player.currentTime);
  }

  /** Hand the player over so a click on the notation can drive it. */
  function adoptPlayer(player: HTMLVideoElement | null): void {
    if (!playhead) return;
    playhead.registerSeek(
      player
        ? (seconds) => {
            player.currentTime = seconds;
            playerTime = seconds;
          }
        : null
    );
  }
</script>

<div class="sequence-videos" in:fade={{ duration: 200 }}>
  {#if view === "upload"}
    <VideoUploadFlow
      {sequence}
      {isOwned}
      hasExistingVideos={videos.length > 0}
      {onSaveFirst}
      onUploaded={handleUploaded}
      onCancel={returnToBrowsing}
    />
  {:else if view === "map" && mappingVideo}
    <StepMapEditor
      videoUrl={mappingVideo.videoUrl}
      videoDuration={mappingVideo.duration}
      steps={sequence.steps}
      startPosition={sequence.startPosition ?? sequence.startingPosition}
      initialStepMap={mappingVideo.beatMap}
      {bpm}
      onSave={handleStepMapSave}
      onClose={returnToBrowsing}
    />
  {:else if store.loading}
    <div class="gallery-empty">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Loading videos...</span>
    </div>
  {:else if store.error}
    <div class="gallery-empty error" role="alert">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      <span>{store.error}</span>
      <button type="button" class="upload-btn" onclick={() => store.reload()}>
        <i class="fas fa-rotate-right" aria-hidden="true"></i>
        Try again
      </button>
    </div>
  {:else if videos.length === 0}
    <div class="gallery-empty">
      <i class="fas fa-video" aria-hidden="true"></i>
      <span>No videos yet</span>
      {#if canUpload}
        <button
          type="button"
          class="upload-btn"
          onclick={() => onUploadOpenChange?.(true)}
        >
          <i class="fas fa-upload" aria-hidden="true"></i>
          Upload a performance
        </button>
      {:else if !isLoggedIn}
        <span class="sign-in-hint">Sign in to upload performances</span>
      {/if}
    </div>
  {:else}
    <div class="video-workspace">
      <div class="gallery-header">
        <div class="gallery-heading">
          <span class="gallery-eyebrow">Performances</span>
          <h2>{videos.length} video{videos.length !== 1 ? "s" : ""}</h2>
        </div>
        {#if canUpload}
          <button
            type="button"
            class="upload-btn"
            onclick={() => onUploadOpenChange?.(true)}
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
            Add performance
          </button>
        {/if}
      </div>
      {#if selectedVideo}
        <section
          class="featured-performance"
          aria-labelledby="selected-performance-title"
        >
          <div
            class="player-stage"
            style="--stage-ratio: {selectedVideoAspectRatio}"
          >
            {#key selectedVideo.id}
              <!-- svelte-ignore a11y_media_has_caption -->
              <video
                {@attach (player) => {
                  adoptPlayer(player);
                  return () => adoptPlayer(null);
                }}
                src={selectedVideo.videoUrl}
                class="video-player"
                controls
                playsinline
                preload="auto"
                ontimeupdate={handlePlayerTimeUpdate}
                onseeked={handlePlayerTimeUpdate}
                onloadedmetadata={(event) => {
                  const player = event.currentTarget;
                  rememberVideoAspectRatio(
                    selectedVideo.id,
                    player.videoWidth,
                    player.videoHeight
                  );
                }}
              ></video>
            {/key}
            <span class="duration-badge"
              >{formatDuration(selectedVideo.duration)}</span
            >
            {#if playheadLabel}
              <!-- Where the notation beside this is looking. Sits over the
                   stage like the duration badge, so appearing at the first
                   mark moves nothing. -->
              <span class="playhead-badge">{playheadLabel}</span>
            {/if}
          </div>
          <div class="performance-details">
            <div>
              <span class="detail-eyebrow">Selected performance</span>
              <h3 id="selected-performance-title">
                {getCreatorName(selectedVideo)}
              </h3>
              <p>
                {formatDate(selectedVideo.createdAt)} · {getTimingLabel(
                  selectedVideo
                )}
              </p>
              {#if selectedVideo.description}
                <p class="performance-description">
                  {selectedVideo.description}
                </p>
              {/if}
            </div>
            {#if selectedVideo.creatorId === authState.user?.uid}
              <div class="performance-tools">
                {#if canUpload}
                  <button
                    type="button"
                    class="map-timing"
                    onclick={() => startMapping(selectedVideo.id)}
                  >
                    <i class="fas fa-music" aria-hidden="true"></i>
                    {selectedVideo.beatMap ? "Edit timing" : "Map timing"}
                  </button>
                {/if}
                {#if isOwned}
                  <button
                    type="button"
                    class="delete-performance"
                    onclick={() => {
                      deleteError = "";
                      pendingDeleteId = selectedVideo.id;
                    }}
                  >
                    <i class="fas fa-trash-alt" aria-hidden="true"></i>
                    Delete performance
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        </section>

        <aside class="performance-list" aria-label="All performance videos">
          <div class="performance-list-header">
            <h3>All performances</h3>
            <span>{videos.length}</span>
          </div>
          <div class="performance-list-items">
            {#each videos as video (video.id)}
              <button
                type="button"
                class="performance-option"
                class:selected={video.id === selectedVideo.id}
                onclick={() => {
                  selectedVideoId = video.id;
                }}
                aria-pressed={video.id === selectedVideo.id}
              >
                <div class="option-thumbnail">
                  {#if video.id === selectedVideo.id}
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <video
                      src={video.videoUrl}
                      class="option-video-preview"
                      muted
                      playsinline
                      preload="metadata"
                      onloadedmetadata={seekPreviewToThumbnailFrame}
                    ></video>
                  {:else if video.thumbnailUrl}
                    <img src={video.thumbnailUrl} alt="" />
                  {:else}
                    <i class="fas fa-play" aria-hidden="true"></i>
                  {/if}
                  <span>{formatDuration(video.duration)}</span>
                </div>
                <span class="option-copy">
                  <strong>{getCreatorName(video)}</strong>
                  <small>{getTimingLabel(video)}</small>
                </span>
              </button>
            {/each}
          </div>
        </aside>
      {/if}
    </div>
  {/if}

  {#if pendingDeleteVideo}
    <DeleteConfirmDialog
      {isDeleting}
      positioning="absolute"
      title="Delete performance?"
      body={deleteError ||
        `${getCreatorName(pendingDeleteVideo)}'s performance from ${formatDate(pendingDeleteVideo.createdAt)} will be permanently removed. This cannot be undone.`}
      onConfirm={confirmDelete}
      onCancel={() => {
        pendingDeleteId = null;
        deleteError = "";
      }}
    />
  {/if}
</div>

<style>
  .sequence-videos {
    container-type: inline-size;
    /* Anchors the delete confirmation to the surface, not the whole viewport. */
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: clamp(1rem, 1.6cqw, 2rem);
    background:
      linear-gradient(
        var(--theme-panel-bg, rgba(18, 18, 28, 0.98)),
        var(--theme-panel-bg, rgba(18, 18, 28, 0.98))
      ),
      var(--theme-bg-deep, #0a0a14);
    overflow-y: auto;
  }

  .gallery-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-min, 14px);
  }

  .gallery-empty i {
    font-size: 2rem;
    opacity: 0.5;
  }

  .gallery-empty.error {
    color: var(--semantic-error);
    text-align: center;
  }

  .sign-in-hint {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    font-size: var(--font-size-compact, 12px);
  }

  .upload-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.625rem 1rem;
    border-radius: 0.75rem;
    background: var(--theme-accent, #6366f1);
    border: none;
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    transition:
      filter 120ms ease,
      transform 120ms ease;
  }

  .upload-btn:hover {
    filter: brightness(1.08);
    transform: translateY(-1px);
  }

  /* Spans both tracks so the heading and Add performance sit over the content
     they belong to. Left as a full-width row it stranded the button three
     thousand pixels from the video on a 4K screen. */
  .gallery-header {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: clamp(0.25rem, 0.5cqw, 0.75rem);
  }

  .gallery-heading {
    min-width: 0;
  }

  .gallery-eyebrow,
  .detail-eyebrow {
    display: block;
    color: var(--theme-accent, #818cf8);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .gallery-heading h2,
  .performance-details h3,
  .performance-list-header h3 {
    margin: 0.25rem 0 0;
    color: var(--theme-text, #fff);
  }

  .gallery-heading h2 {
    font-size: clamp(1.375rem, 2cqw, 3rem);
    line-height: 1.1;
  }


  /* The featured card is as wide as the performance it holds - a phone-shot
     vertical video is narrow, a landscape one is wide - so the first track
     takes that width rather than a fraction of the surface. A fractional track
     would strand a narrow card in the middle of an empty column. The pair then
     centres as a unit, which keeps the list beside the video at every width. */
  .video-workspace {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, max-content) minmax(18rem, 24rem);
    /* The header row hugs its own height. Left auto it shares the surface's
       spare height with the content row, which opened a gap the size of the
       header between the two. */
    grid-template-rows: auto minmax(0, 1fr);
    justify-content: center;
    align-content: start;
    gap: clamp(1rem, 1.6cqw, 2rem);
    align-items: start;
  }

  .featured-performance,
  .performance-list {
    min-width: 0;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    overflow: hidden;
  }

  .featured-performance {
    display: flex;
    flex-direction: column;
    justify-self: center;
    inline-size: fit-content;
    max-inline-size: 100%;
  }

  /* The stage takes the source's own ratio, so portrait performance video fills
     the box instead of pillarboxing inside a landscape one. The 16/9 fallback
     reserves the box before metadata arrives, so nothing reflows on load. */
  .player-stage {
    position: relative;
    display: grid;
    place-items: center;
    align-self: center;
    /* Height, then the ratio derives the width - so the second term has to be
       the height at which the width exactly fills the container, which depends
       on the ratio. A fixed 75cqw is only that height for one shape: it
       overflows landscape (saved by max-inline-size) and starves portrait,
       which is what a phone shoots performance footage in. */
    block-size: min(62vh, calc(100cqw / var(--stage-ratio, 1.7778)));
    aspect-ratio: var(--stage-ratio, 16 / 9);
    max-inline-size: 100%;
    background: #050507;
    overflow: hidden;
  }

  .video-player {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    background: #050507;
    object-fit: contain;
  }

  .duration-badge {
    position: absolute;
    right: 1rem;
    bottom: 1rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    background: rgba(0, 0, 0, 0.72);
    color: #fff;
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }

  /* Carries the accent because it is live readout rather than metadata: it is
     the one thing on the stage that changes as the footage runs.

     Top of the stage, not the bottom: the browser paints its own transport
     across the bottom of the video, and a readout down there lands on the play
     button and the scrubber. The duration badge gets away with it only because
     it sits in the far corner. */
  .playhead-badge {
    position: absolute;
    left: 1rem;
    top: 1rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #22b8cf) 55%, transparent);
    background: color-mix(
      in srgb,
      var(--theme-accent, #22b8cf) 26%,
      rgba(0, 0, 0, 0.72)
    );
    color: #fff;
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }

  .performance-details {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: clamp(1rem, 1.4cqw, 1.5rem);
  }

  .performance-details h3 {
    font-size: clamp(1.125rem, 1.5cqw, 1.5rem);
  }

  .performance-details p {
    margin: 0.375rem 0 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
  }

  .performance-details .performance-description {
    color: var(--theme-text, #fff);
  }

  .performance-tools {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .map-timing {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 0.75rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
  }

  .map-timing:hover {
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-accent, #6366f1);
  }

  .delete-performance {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.625rem 0.75rem;
    border: 1px solid
      color-mix(in srgb, var(--semantic-error, #f87171) 55%, transparent);
    border-radius: 0.75rem;
    background: color-mix(
      in srgb,
      var(--semantic-error, #f87171) 9%,
      transparent
    );
    color: var(--semantic-error, #f87171);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
  }

  .delete-performance:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, #f87171) 16%,
      transparent
    );
  }

  .performance-list {
    display: flex;
    flex-direction: column;
    max-height: min(100%, 72rem);
  }

  .performance-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .performance-list-header h3 {
    font-size: var(--font-size-min, 14px);
  }

  .performance-list-header span {
    display: grid;
    width: 1.75rem;
    height: 1.75rem;
    place-items: center;
    border-radius: 999px;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.25));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
  }

  .performance-list-items {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    padding: 0.75rem;
  }

  .performance-option {
    display: grid;
    grid-template-columns: 7.5rem minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 0.5rem;
    border: 1px solid transparent;
    border-radius: 0.75rem;
    background: transparent;
    color: var(--theme-text, #fff);
    cursor: pointer;
    text-align: left;
  }

  .performance-option:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
  }

  .performance-option.selected {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #818cf8) 70%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #818cf8) 12%,
      transparent
    );
  }

  .option-thumbnail {
    position: relative;
    display: grid;
    aspect-ratio: 16 / 9;
    place-items: center;
    border-radius: 0.5rem;
    overflow: hidden;
    background: #050507;
    color: rgba(255, 255, 255, 0.78);
  }

  .option-thumbnail img {
    width: 100%;
    display: block;
    height: 100%;
    object-fit: cover;
  }

  .option-video-preview {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  .option-thumbnail span {
    position: absolute;
    right: 0.375rem;
    bottom: 0.375rem;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
  }

  .option-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.25rem;
  }

  .option-copy strong,
  .option-copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .option-copy strong {
    font-size: var(--font-size-min, 14px);
  }

  .option-copy small {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
  }

  @container (max-width: 62rem) {
    .video-workspace {
      flex: none;
      grid-template-columns: 1fr;
      grid-template-rows: auto;
      align-content: start;
    }

    /* Stacked, the card and the list are the only two blocks on the surface,
       so they share one width. The stage keeps its own ratio inside it. */
    .featured-performance {
      inline-size: 100%;
    }

    .performance-list {
      max-height: none;
    }

    .performance-list-items {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .performance-option {
      grid-template-columns: 6rem minmax(0, 1fr);
    }
  }

  @container (max-width: 34rem) {
    .gallery-header,
    .performance-details {
      align-items: stretch;
      flex-direction: column;
    }

    .upload-btn,
    .map-timing,
    .delete-performance {
      width: 100%;
    }

    .performance-tools {
      flex-direction: column;
    }

    .performance-list-items {
      grid-template-columns: 1fr;
    }
  }

  /* Wide but short - a folded phone held sideways, or a laptop with the viewer
     chrome eating the height. Stacking there pushes the list entirely below the
     fold, so the pair stays side by side and the stage takes the height that is
     actually available. Placed after the container tiers so it wins when both
     match.

     The height half is a viewport question and the width half is a pane
     question, so it takes both at-rules: a short viewport says nothing about
     how much room this surface got. Read as a media query alone it turned a
     320px pane two-column and squeezed the stage to 17px. */
  @container (min-width: 45rem) {
    @media (max-height: 34rem) {
      .video-workspace {
        grid-template-columns: minmax(0, max-content) minmax(14rem, 20rem);
        grid-template-rows: auto minmax(0, 1fr);
      }

      .featured-performance {
        inline-size: fit-content;
      }

      .player-stage {
        block-size: min(58vh, calc(100cqw / var(--stage-ratio, 1.7778)));
      }

      .performance-list-items {
        grid-template-columns: 1fr;
      }
    }
  }

  /* Type reads from the surface's own width rather than a fixed 14px, so the
     copy keeps its proportion on a 4K viewer. On the narrow panes the cqw term
     stays under the floor, so nothing changes there. Last in the sheet because
     it supersedes the fixed sizes each rule above sets. */
  .upload-btn,
  .map-timing,
  .delete-performance,
  .performance-details p,
  .performance-list-header h3,
  .option-copy strong {
    font-size: clamp(var(--font-size-min, 14px), 0.8cqw, 1.0625rem);
  }

  .gallery-eyebrow,
  .detail-eyebrow,
  .option-copy small,
  .duration-badge,
  .option-thumbnail span,
  .performance-list-header span {
    font-size: clamp(var(--font-size-compact, 12px), 0.68cqw, 0.9375rem);
  }
</style>
