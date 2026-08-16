<script lang="ts">
  import { fade } from "svelte/transition";
  import {
    getVideosForSequence,
    deleteVideo,
  } from "$lib/shared/video-collaboration/services/collaborative-video-manager";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import DeleteConfirmDialog from "./DeleteConfirmDialog.svelte";

  interface Props {
    sequence: SequenceData;
    isOwned: boolean;
    isLoggedIn?: boolean;
    onUpload?: () => void;
    /** Opens the timing editor for one performance. The editor lives in the
     *  upload pane, so the gallery hands the id up rather than mounting it. */
    onMapTiming?: (videoId: string) => void;
  }

  let {
    sequence,
    isOwned,
    isLoggedIn = false,
    onUpload,
    onMapTiming,
  }: Props = $props();

  let videos = $state<CollaborativeVideo[]>([]);
  let loading = $state(true);
  let loadError = $state("");
  let selectedVideoId = $state<string | null>(null);
  let pendingDeleteId = $state<string | null>(null);
  let isDeleting = $state(false);
  let deleteError = $state("");
  let reloadToken = $state(0);
  let videoAspectRatios = $state<Record<string, number>>({});

  /** Get creator display name from the collaborators list */
  function getCreatorName(video: CollaborativeVideo): string {
    const creator = video.collaborators.find((c) => c.role === "creator");
    return creator?.displayName || "Anonymous";
  }

  $effect(() => {
    const seqId = sequence?.id;
    // Re-runs when a retry bumps the token.
    void reloadToken;
    if (!seqId) {
      videos = [];
      loading = false;
      return;
    }
    loading = true;
    loadError = "";
    getVideosForSequence(seqId)
      .then((v) => {
        videos = v;
        selectedVideoId = v[0]?.id ?? null;
      })
      .catch((error) => {
        // A failed load is not an empty gallery. Say which one it was so a
        // person knows whether to retry or to record something.
        videos = [];
        loadError =
          error instanceof Error
            ? error.message
            : "Performance videos could not be loaded.";
      })
      .finally(() => {
        loading = false;
      });
  });

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
      await deleteVideo(id);
      const remainingVideos = videos.filter((video) => video.id !== id);
      videos = remainingVideos;
      if (selectedVideoId === id) {
        selectedVideoId = remainingVideos[0]?.id ?? null;
      }
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

  const selectedVideo = $derived(
    videos.find((video) => video.id === selectedVideoId) ?? null
  );
  const pendingDeleteVideo = $derived(
    videos.find((video) => video.id === pendingDeleteId) ?? null
  );
  const selectedVideoAspectRatio = $derived(
    selectedVideo ? (videoAspectRatios[selectedVideo.id] ?? 16 / 9) : 16 / 9
  );
</script>

<div class="video-gallery" in:fade={{ duration: 200 }}>
  {#if loading}
    <div class="gallery-empty">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Loading videos...</span>
    </div>
  {:else if loadError}
    <div class="gallery-empty error" role="alert">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      <span>{loadError}</span>
      <button
        type="button"
        class="upload-btn"
        onclick={() => {
          reloadToken += 1;
        }}
      >
        <i class="fas fa-rotate-right" aria-hidden="true"></i>
        Try again
      </button>
    </div>
  {:else if videos.length === 0}
    <div class="gallery-empty">
      <i class="fas fa-video" aria-hidden="true"></i>
      <span>No videos yet</span>
      {#if isLoggedIn && onUpload}
        <button type="button" class="upload-btn" onclick={onUpload}>
          <i class="fas fa-upload" aria-hidden="true"></i>
          Upload a performance
        </button>
      {:else if !isLoggedIn}
        <span class="sign-in-hint">Sign in to upload performances</span>
      {/if}
    </div>
  {:else}
    <div class="gallery-header">
      <div class="gallery-heading">
        <span class="gallery-eyebrow">Performances</span>
        <h2>{videos.length} video{videos.length !== 1 ? "s" : ""}</h2>
      </div>
      {#if onUpload}
        <button type="button" class="upload-btn" onclick={onUpload}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          Add performance
        </button>
      {/if}
    </div>
    {#if selectedVideo}
      <div class="video-workspace">
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
                src={selectedVideo.videoUrl}
                class="video-player"
                controls
                playsinline
                preload="auto"
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
                {#if onMapTiming}
                  <button
                    type="button"
                    class="map-timing"
                    onclick={() => onMapTiming(selectedVideo.id)}
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
      </div>
    {/if}
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
  .video-gallery {
    container-type: inline-size;
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

  .gallery-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: clamp(1rem, 1.5cqw, 1.75rem);
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
    font-size: clamp(1.375rem, 2cqw, 2.25rem);
    line-height: 1.1;
  }

  .video-workspace {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1.75fr) minmax(18rem, 0.75fr);
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
    block-size: min(62vh, 75cqw);
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
      align-content: start;
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
</style>
