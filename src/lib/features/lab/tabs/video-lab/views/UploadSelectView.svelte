<!--
  UploadSelectView.svelte

  First view in Video Lab. Lets the user pick a local video file (or paste a URL)
  and select a library sequence to map beats against. Shows video preview with
  basic info after selection.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
  import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
  import { buildThumbnailUrl } from "$lib/shared/inbox/state/send-sequence-state.svelte";

  interface Props {
    onStartMapping: (
      videoUrl: string,
      duration: number,
      fileSize: number,
      sequence: LibrarySequence,
    ) => void;
  }

  const { onStartMapping }: Props = $props();

  // ---- Video source ----
  let videoUrl = $state<string | null>(null);
  let videoDuration = $state(0);
  let videoFileSize = $state(0);
  let videoFileName = $state("");
  let pasteUrl = $state("");
  let videoEl: HTMLVideoElement | undefined = $state();

  // ---- Library sequences ----
  let sequences = $state<LibrarySequence[]>([]);
  let selectedSequence = $state<LibrarySequence | null>(null);
  let isLoadingSequences = $state(false);
  let searchQuery = $state("");

  const filteredSequences = $derived(
    searchQuery.trim()
      ? sequences.filter((s) => {
          const q = searchQuery.toLowerCase();
          const word = (s.word ?? "").toLowerCase();
          const name = (s.name ?? "").toLowerCase();
          return word.includes(q) || name.includes(q);
        })
      : sequences,
  );

  const canStart = $derived(!!videoUrl && !!selectedSequence && videoDuration > 0);

  // Load user's library sequences on mount
  $effect(() => {
    loadSequences();
  });

  async function loadSequences() {
    isLoadingSequences = true;
    try {
      const repo = container.items.libraryRepository as ILibraryRepository;
      sequences = await repo.getSequences({ sortBy: "updatedAt", sortDirection: "desc" });
    } catch (err) {
      console.error("Failed to load library sequences:", err);
    } finally {
      isLoadingSequences = false;
    }
  }

  // ---- File handling ----

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Revoke previous blob URL if any
    if (videoUrl?.startsWith("blob:")) URL.revokeObjectURL(videoUrl);

    videoUrl = URL.createObjectURL(file);
    videoFileName = file.name;
    videoFileSize = file.size;
    videoDuration = 0; // Will be set by loadedmetadata
  }

  function handlePasteUrl() {
    const url = pasteUrl.trim();
    if (!url) return;

    if (videoUrl?.startsWith("blob:")) URL.revokeObjectURL(videoUrl);

    videoUrl = url;
    videoFileName = url.split("/").pop() ?? "Video";
    videoFileSize = 0; // Unknown for remote URLs
    videoDuration = 0;
  }

  function handleLoadedMetadata() {
    if (videoEl) {
      videoDuration = videoEl.duration;
    }
  }

  function clearVideo() {
    if (videoUrl?.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
    videoUrl = null;
    videoFileName = "";
    videoFileSize = 0;
    videoDuration = 0;
  }

  function handleStart() {
    if (videoUrl && selectedSequence && videoDuration > 0) {
      onStartMapping(videoUrl, videoDuration, videoFileSize, selectedSequence);
    }
  }

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "Unknown";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<div class="upload-select-view">
  <!-- Video source section -->
  <section class="section">
    <h3 class="section-title">
      <i class="fas fa-video" aria-hidden="true"></i>
      Video Source
    </h3>

    {#if videoUrl}
      <!-- Video preview -->
      <div class="video-preview">
        <video
          bind:this={videoEl}
          src={videoUrl}
          playsinline
          controls
          onloadedmetadata={handleLoadedMetadata}
        >
          <track kind="captions" />
        </video>

        <div class="video-info">
          <span class="video-name">{videoFileName}</span>
          <div class="video-meta">
            {#if videoDuration > 0}
              <span>{formatDuration(videoDuration)}</span>
            {/if}
            {#if videoFileSize > 0}
              <span>{formatFileSize(videoFileSize)}</span>
            {/if}
          </div>
        </div>

        <button class="clear-btn" onclick={clearVideo} type="button" aria-label="Remove video">
          <i class="fas fa-times" aria-hidden="true"></i>
          Remove
        </button>
      </div>
    {:else}
      <!-- Upload options -->
      <div class="upload-options">
        <label class="file-picker">
          <input type="file" accept="video/*" onchange={handleFileSelect} />
          <i class="fas fa-upload" aria-hidden="true"></i>
          <span>Choose a video file</span>
        </label>

        <div class="divider">
          <span>or</span>
        </div>

        <div class="url-input-row">
          <input
            type="url"
            placeholder="Paste a video URL..."
            bind:value={pasteUrl}
            class="url-input"
          />
          <button
            class="paste-btn"
            onclick={handlePasteUrl}
            disabled={!pasteUrl.trim()}
            type="button"
          >
            Load
          </button>
        </div>
      </div>
    {/if}
  </section>

  <!-- Sequence selector section -->
  <section class="section">
    <h3 class="section-title">
      <i class="fas fa-list-ol" aria-hidden="true"></i>
      Sequence
    </h3>

    <input
      type="text"
      placeholder="Search by word or name..."
      bind:value={searchQuery}
      class="search-input"
    />

    <div class="sequence-grid themed-scrollbar">
      {#if isLoadingSequences}
        <div class="grid-status">
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          Loading library...
        </div>
      {:else if filteredSequences.length === 0}
        <div class="grid-status">
          {searchQuery.trim() ? "No matching sequences" : "No sequences in library"}
        </div>
      {:else}
        {#each filteredSequences as seq (seq.id)}
          <button
            class="sequence-card"
            class:selected={selectedSequence?.id === seq.id}
            onclick={() => { selectedSequence = seq; }}
            type="button"
          >
            <div class="card-preview">
              {#if seq.word}
                <img
                  src={buildThumbnailUrl(seq.word, seq.intendedProp?.bluePropType ?? "staff", false)}
                  alt={seq.word}
                  class="card-thumbnail"
                  onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              {/if}
              <span class="card-word-fallback">{seq.word ?? seq.name ?? "?"}</span>
            </div>
            <div class="card-label">
              <span class="card-beats">{seq.steps?.length || seq.word?.length || 0} beats</span>
            </div>
          </button>
        {/each}
      {/if}
    </div>

    {#if selectedSequence}
      <div class="selected-info">
        Selected: <strong>{selectedSequence.word ?? selectedSequence.name}</strong>
        ({selectedSequence.steps?.length || selectedSequence.word?.length || 0} beats)
      </div>
    {/if}
  </section>

  <!-- Start mapping -->
  <div class="action-bar">
    <button
      class="start-btn"
      disabled={!canStart}
      onclick={handleStart}
      type="button"
    >
      <i class="fas fa-play" aria-hidden="true"></i>
      Start Mapping
    </button>
  </div>
</div>

<style>
  .upload-select-view {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 16px;
    height: 100%;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .section-title i {
    color: var(--theme-accent, #6366f1);
    font-size: 14px;
  }

  /* ---- Video preview ---- */

  .video-preview {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    padding: 10px;
  }

  .video-preview video {
    width: 100%;
    max-height: 220px;
    border-radius: 8px;
    background: #000;
    object-fit: contain;
  }

  .video-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .video-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60%;
  }

  .video-meta {
    display: flex;
    gap: 12px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .clear-btn {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
  }

  .clear-btn:hover {
    border-color: var(--semantic-error, #ef4444);
    color: var(--semantic-error, #ef4444);
  }

  /* ---- Upload options ---- */

  .upload-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .file-picker {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
    border: 2px dashed var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .file-picker:hover {
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #ffffff);
  }

  .file-picker input {
    display: none;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    font-size: var(--font-size-compact, 12px);
  }

  .divider::before,
  .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .url-input-row {
    display: flex;
    gap: 8px;
  }

  .url-input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
  }

  .url-input::placeholder {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  .paste-btn {
    padding: 10px 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
  }

  .paste-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .paste-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  /* ---- Sequence grid ---- */

  .search-input {
    padding: 10px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
  }

  .search-input::placeholder {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  .sequence-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
    max-height: 360px;
    overflow-y: auto;
    padding: 4px;
  }

  .grid-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-min, 14px);
    grid-column: 1 / -1;
  }

  .sequence-card {
    display: flex;
    flex-direction: column;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    padding: 0;
    overflow: hidden;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .sequence-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .sequence-card.selected {
    border-color: var(--theme-accent, #6366f1);
    border-width: 2px;
    box-shadow: 0 0 12px color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  .sequence-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .card-preview {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
  }

  .card-thumbnail {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .card-word-fallback {
    position: relative;
    z-index: 1;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-align: center;
    word-break: break-all;
    line-height: 1.3;
    padding: 4px;
    opacity: 0.5;
  }

  /* Hide the word fallback when the image loads successfully */
  .card-thumbnail + .card-word-fallback {
    position: absolute;
    bottom: 4px;
    left: 0;
    right: 0;
    font-size: 10px;
    opacity: 0.6;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  }

  .card-label {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 4px;
  }

  .card-beats {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .selected-info {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .selected-info strong {
    color: var(--theme-accent, #6366f1);
  }

  /* ---- Action bar ---- */

  .action-bar {
    margin-top: auto;
    padding-top: 12px;
  }

  .start-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 12px 24px;
    border: none;
    border-radius: 10px;
    background: var(--theme-accent, #6366f1);
    color: #ffffff;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.15s, box-shadow 0.15s;
  }

  .start-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .start-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .file-picker,
    .start-btn,
    .sequence-card,
    .clear-btn,
    .paste-btn {
      transition: none !important;
    }
  }
</style>
