<script lang="ts">
  import { getVideosForSequence } from "$lib/shared/video-collaboration/services/collaborative-video-manager";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import VideoUploadSheet from "$lib/shared/video-collaboration/components/VideoUploadSheet.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface SelectedPerformance {
    url: string;
    duration?: number;
    label: string;
  }

  interface Props {
    open: boolean;
    sequence: SequenceData;
    currentUrl: string | null;
    onClose: () => void;
    onSelect: (selection: SelectedPerformance) => void;
    onChooseFile: (file: File) => Promise<void>;
  }

  let { open, sequence, currentUrl, onClose, onSelect, onChooseFile }: Props =
    $props();

  let videos = $state<CollaborativeVideo[]>([]);
  let loading = $state(false);
  let loadError = $state("");
  let actionError = $state("");
  let uploadOpen = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);
  let requestVersion = 0;

  async function loadVideos(sequenceId = sequence.id): Promise<void> {
    const version = ++requestVersion;
    loading = true;
    loadError = "";
    try {
      const nextVideos = await getVideosForSequence(sequenceId);
      if (version === requestVersion) videos = nextVideos;
    } catch (error) {
      if (version !== requestVersion) return;
      loadError =
        error instanceof Error
          ? error.message
          : "The TKA video library could not be loaded.";
    } finally {
      if (version === requestVersion) loading = false;
    }
  }

  $effect(() => {
    if (!open) return;
    const sequenceId = sequence.id;
    actionError = "";
    void loadVideos(sequenceId);
  });

  $effect(() => {
    if (!open) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !uploadOpen) onClose();
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  function selectVideo(video: CollaborativeVideo): void {
    onSelect({
      url: video.videoUrl,
      duration: video.duration,
      label: video.description?.trim() || "TKA performance video",
    });
  }

  async function chooseFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    actionError = "";
    try {
      await onChooseFile(file);
    } catch (error) {
      actionError =
        error instanceof Error
          ? error.message
          : "That video could not be opened.";
    }
  }

  function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${remainder.toString().padStart(2, "0")}`;
  }

  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const uniqueVideos = $derived(
    videos.filter(
      (video, index, all) =>
        all.findIndex((candidate) => candidate.videoUrl === video.videoUrl) ===
        index
    )
  );
</script>

{#if open}
  <div class="picker-layer">
    <button
      type="button"
      class="picker-backdrop"
      aria-label="Close performance video picker"
      onclick={onClose}
    ></button>
    <div
      class="performance-picker themed-scrollbar"
      role="dialog"
      aria-modal="true"
      aria-labelledby="performance-picker-title"
    >
      <header>
        <div>
          <span class="eyebrow">Performance source</span>
          <h2 id="performance-picker-title">Choose the video for this post</h2>
          <p>
            Use a linked TKA performance or bring in a video from this device.
          </p>
        </div>
        <button
          type="button"
          class="close-button"
          aria-label="Close performance video picker"
          onclick={onClose}
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>

      <div class="picker-actions">
        <button
          type="button"
          class="primary-action"
          onclick={() => fileInput?.click()}
        >
          <i class="fa-solid fa-folder-open" aria-hidden="true"></i>
          Use a video from this device
        </button>
        <button
          type="button"
          class="secondary-action"
          disabled={!sequence.id}
          onclick={() => (uploadOpen = true)}
        >
          <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
          Upload to TKA
        </button>
        <input
          bind:this={fileInput}
          class="file-input"
          type="file"
          accept="video/*"
          onchange={chooseFile}
        />
      </div>

      {#if actionError}
        <p class="error-message" role="alert">{actionError}</p>
      {/if}

      {#if sequence.performanceVideoUrl}
        <section class="linked-video" aria-labelledby="linked-video-title">
          <div class="section-heading">
            <h3 id="linked-video-title">Linked to this sequence</h3>
          </div>
          <button
            type="button"
            class:selected={currentUrl === sequence.performanceVideoUrl}
            class="video-row"
            aria-label="Use the performance video linked to this sequence"
            onclick={() =>
              onSelect({
                url: sequence.performanceVideoUrl!,
                label: "Linked performance video",
              })}
          >
            <span class="video-icon">
              <i class="fa-solid fa-link" aria-hidden="true"></i>
            </span>
            <span>
              <strong>Linked performance video</strong>
              <small>Already attached to this sequence</small>
            </span>
            {#if currentUrl === sequence.performanceVideoUrl}
              <i class="fa-solid fa-check selected-check" aria-hidden="true"
              ></i>
            {/if}
          </button>
        </section>
      {/if}

      <section class="library-section" aria-labelledby="tka-video-library">
        <div class="section-heading">
          <h3 id="tka-video-library">TKA video library</h3>
          {#if !loading}
            <span>{uniqueVideos.length}</span>
          {/if}
        </div>

        {#if loading}
          <div class="state-panel" role="status">
            <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
            Loading performance videos
          </div>
        {:else if loadError}
          <div class="state-panel error-state">
            <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <p>{loadError}</p>
            <button type="button" onclick={() => void loadVideos()}
              >Try again</button
            >
          </div>
        {:else if uniqueVideos.length === 0}
          <div class="state-panel">
            <i class="fa-solid fa-video-slash" aria-hidden="true"></i>
            <p>No performance videos are attached to this sequence yet.</p>
            <button type="button" onclick={() => (uploadOpen = true)}>
              Upload the first one
            </button>
          </div>
        {:else}
          <div class="video-grid">
            {#each uniqueVideos as video (video.id)}
              <button
                type="button"
                class:selected={currentUrl === video.videoUrl}
                class="video-card"
                aria-label={`Use performance video from ${formatDate(video.createdAt)}, ${formatDuration(video.duration)}`}
                onclick={() => selectVideo(video)}
              >
                <span class="thumbnail">
                  {#if video.thumbnailUrl}
                    <img src={video.thumbnailUrl} alt="" />
                  {:else}
                    <i class="fa-solid fa-play" aria-hidden="true"></i>
                  {/if}
                  <span>{formatDuration(video.duration)}</span>
                </span>
                <span class="video-copy">
                  <strong
                    >{video.description?.trim() || "Performance video"}</strong
                  >
                  <small>{formatDate(video.createdAt)}</small>
                </span>
                {#if currentUrl === video.videoUrl}
                  <i class="fa-solid fa-check selected-check" aria-hidden="true"
                  ></i>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </div>
{/if}

<VideoUploadSheet
  show={uploadOpen}
  {sequence}
  onClose={() => (uploadOpen = false)}
  onUploaded={() => void loadVideos()}
/>

<style>
  .picker-layer {
    position: absolute;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: var(--spacing-lg);
  }

  .picker-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: color-mix(in srgb, var(--theme-panel-bg) 78%, transparent);
    cursor: default;
  }

  .performance-picker {
    position: relative;
    display: grid;
    gap: var(--spacing-lg);
    width: min(52rem, 100%);
    max-height: min(48rem, calc(100% - 2rem));
    padding: var(--spacing-lg);
    overflow: auto;
    border: 1px solid var(--theme-stroke-strong);
    border-radius: var(--radius-2026-lg);
    background: var(--theme-panel-bg);
    color: var(--theme-text);
    box-shadow: 0 1.5rem 5rem var(--theme-shadow);
  }

  header,
  .section-heading,
  .picker-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
  }

  header > div {
    display: grid;
    gap: var(--spacing-xs);
  }

  .eyebrow {
    color: var(--theme-accent);
    font-size: var(--font-size-compact);
    font-weight: 750;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: 1.45rem;
  }

  h3 {
    font-size: 1rem;
  }

  header p,
  .state-panel p {
    color: var(--theme-text-dim);
    font-size: var(--font-size-min);
    line-height: 1.4;
  }

  .close-button,
  .primary-action,
  .secondary-action,
  .state-panel button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    min-height: 2.75rem;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--font-size-min);
    font-weight: 700;
    cursor: pointer;
  }

  .close-button {
    width: 2.75rem;
    padding: 0;
  }

  .primary-action {
    border-color: var(--theme-accent);
    background: var(--theme-accent);
  }

  .secondary-action:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  .close-button:focus-visible,
  .primary-action:focus-visible,
  .secondary-action:focus-visible,
  .video-row:focus-visible,
  .video-card:focus-visible,
  .state-panel button:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .file-input {
    display: none;
  }

  .error-message {
    color: var(--semantic-error);
    font-size: var(--font-size-min);
  }

  .linked-video,
  .library-section {
    display: grid;
    gap: 0.75rem;
  }

  .section-heading > span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-variant-numeric: tabular-nums;
  }

  .video-row,
  .video-card {
    position: relative;
    display: grid;
    align-items: center;
    gap: 0.75rem;
    min-height: 4rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .video-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    padding: 0.625rem 0.75rem;
  }

  .video-row > span:nth-child(2),
  .video-copy {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .video-row small,
  .video-copy small {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
  }

  .video-icon {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-2026-sm);
    background: color-mix(
      in srgb,
      var(--theme-accent) 12%,
      var(--theme-card-bg)
    );
    color: var(--theme-accent);
  }

  .video-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .video-card {
    grid-template-columns: 6rem minmax(0, 1fr) auto;
    padding: var(--spacing-sm);
  }

  .thumbnail {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: var(--radius-2026-xs);
    background: color-mix(
      in srgb,
      var(--theme-accent) 8%,
      var(--theme-card-bg)
    );
    color: var(--theme-accent);
  }

  .thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumbnail span {
    position: absolute;
    right: var(--spacing-xs);
    bottom: var(--spacing-xs);
    padding: 0.1rem 0.3rem;
    border-radius: var(--radius-2026-xs);
    background: var(--theme-panel-bg);
    color: var(--theme-text);
    font-size: var(--font-size-compact);
    font-variant-numeric: tabular-nums;
  }

  .video-row.selected,
  .video-card.selected {
    border-color: var(--theme-accent);
  }

  .selected-check {
    color: var(--semantic-success);
  }

  .state-panel {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    padding: var(--spacing-xl);
    border: 1px dashed var(--theme-stroke-strong);
    border-radius: var(--radius-2026-md);
    color: var(--theme-text-dim);
    text-align: center;
  }

  .state-panel > i {
    color: var(--theme-accent);
    font-size: 1.4rem;
  }

  .error-state > i {
    color: var(--semantic-error);
  }

  @media (max-width: 46rem) {
    .picker-layer {
      padding: 0;
    }

    .performance-picker {
      width: 100%;
      max-height: 100%;
      height: 100%;
      border: 0;
      border-radius: 0;
    }

    .picker-actions {
      align-items: stretch;
      flex-direction: column;
    }

    .video-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
