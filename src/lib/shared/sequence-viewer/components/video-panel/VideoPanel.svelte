<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import { fade } from "svelte/transition";
  import { getVideoUploader } from "$lib/shared/share/get-video-uploader";
  import { getVideosForSequence, saveVideo, deleteVideo, updateStepMap } from "$lib/shared/video-collaboration/services/collaborative-video-manager";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/implementations/HapticFeedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import type { StepMap } from "$lib/shared/video-collaboration/domain/CollaborativeVideo";
  import { getAuthSync } from "$lib/shared/auth/firebase";
  import {
    createVideoFromUpload,
    getVideoFileMetadata,
  } from "$lib/shared/video-collaboration/helpers/create-video-from-upload";
  import {
    extractVideoThumbnail,
    type ThumbnailResult,
  } from "$lib/shared/video-collaboration/utils/thumbnail-extractor";
  import StepMapEditor from "../step-mapping/StepMapEditor.svelte";

  interface Props {
    sequence: SequenceData;
    isOwned: boolean;
    bpm: number;
    onSaveFirst: () => Promise<void>;
    onClose: () => void;
  }

  let { sequence, isOwned, bpm, onSaveFirst, onClose }: Props = $props();

  type PanelState =
    | "loading"
    | "save-first"
    | "empty"
    | "upload"
    | "uploading"
    | "gallery"
    | "step-mapping";

  let panelState = $state<PanelState>("loading");
  let videos = $state<CollaborativeVideo[]>([]);

  let isSaving = $state(false);

  let selectedFile = $state<File | null>(null);
  let videoPreviewUrl = $state<string | null>(null);
  let videoDuration = $state<number>(0);
  let thumbnail = $state<ThumbnailResult | null>(null);

  let isUploading = $state(false);
  let uploadProgress = $state(0);
  let uploadError = $state<string | null>(null);

  let isDragOver = $state(false);

  let fileInputEl: HTMLInputElement;

  let playingVideoId = $state<string | null>(null);

  let beatMappingVideo = $state<CollaborativeVideo | null>(null);

  const uploadService = getVideoUploader();
  const hapticService = getHapticFeedback() as
    | HapticFeedback
    | undefined;

  const currentUser = $derived(getAuthSync().currentUser);
  const canUpload = $derived(!!selectedFile && !isUploading && !!currentUser);

  $effect(() => {
    if (!isOwned) {
      panelState = "save-first";
      return;
    }

    loadVideos();
  });

  async function loadVideos() {
    panelState = "loading";
    try {
      const result = await getVideosForSequence(sequence.id);
      videos = result;
      panelState = videos.length > 0 ? "gallery" : "empty";
    } catch {
      videos = [];
      panelState = "empty";
    }
  }

  async function handleSaveFirst() {
    isSaving = true;
    try {
      await onSaveFirst();
      await loadVideos();
    } catch {
      // Handled by parent
    } finally {
      isSaving = false;
    }
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) processFile(file);
  }

  function processFile(file: File) {
    if (!file.type.startsWith("video/")) {
      uploadError = "Please select a video file";
      return;
    }

    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      uploadError = "Video must be under 500MB";
      return;
    }

    selectedFile = file;
    uploadError = null;

    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    videoPreviewUrl = URL.createObjectURL(file);

    getVideoFileMetadata(file)
      .then((meta) => {
        videoDuration = meta.duration;
      })
      .catch(() => {
        videoDuration = 0;
      });

    extractVideoThumbnail(file)
      .then((result) => {
        thumbnail = result;
      })
      .catch(() => {
        thumbnail = null;
      });

    hapticService?.trigger("selection");
    panelState = "upload";
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file) processFile(file);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  function handleBrowseClick() {
    fileInputEl?.click();
  }

  function handleChangeFile() {
    fileInputEl?.click();
  }

  async function handleUpload() {
    if (!selectedFile || !currentUser) return;

    isUploading = true;
    panelState = "uploading";
    uploadProgress = 0;
    uploadError = null;
    hapticService?.trigger("selection");

    try {
      const uploadResult = await uploadService.uploadPerformanceVideo(
        sequence.id,
        selectedFile,
        {
          onProgress: (progress: number) => {
            uploadProgress = Math.round(progress * 0.9);
          },
        },
      );

      let thumbnailUrl: string | undefined;
      if (thumbnail) {
        try {
          const videoTimestamp = parseInt(
            uploadResult.key.split("/").pop()?.split(".")[0] || "0",
          );
          const thumbnailResult = await uploadService.uploadVideoThumbnail(
            sequence.id,
            thumbnail.blob,
            videoTimestamp,
          );
          thumbnailUrl = thumbnailResult.url;
          uploadProgress = 100;
        } catch {
          // Optional
        }
      }

      const metadata = await getVideoFileMetadata(selectedFile);

      const video = createVideoFromUpload({
        uploadResult,
        sequence,
        duration: metadata.duration || videoDuration,
        fileSize: metadata.fileSize,
        mimeType: metadata.mimeType,
        creatorId: currentUser.uid,
        creatorDisplayName: currentUser.displayName ?? undefined,
        creatorAvatarUrl: currentUser.photoURL ?? undefined,
        visibility: "public",
        thumbnailUrl,
      });

      await saveVideo(video);

      hapticService?.trigger("success");
      toast.success("Video uploaded");

      cleanupFileState();
      await loadVideos();
    } catch (e) {
      console.error("Upload failed:", e);
      uploadError = e instanceof Error ? e.message : "Upload failed";
      toast.error("Video upload failed. Please try again.");
      hapticService?.trigger("error");
      panelState = "upload";
    } finally {
      isUploading = false;
    }
  }

  function handleAddVideo() {
    cleanupFileState();
    panelState = "empty";
  }

  function handlePlayVideo(videoId: string) {
    playingVideoId = playingVideoId === videoId ? null : videoId;
  }

  async function handleDeleteVideo(videoId: string) {
    try {
      await deleteVideo(videoId);
      hapticService?.trigger("selection");
      await loadVideos();
    } catch (e) {
      console.error("Delete failed:", e);
      toast.error("Failed to delete video");
    }
  }

  async function handleStepMapSave(beatMap: StepMap) {
    if (!beatMappingVideo) return;

    await updateStepMap(beatMappingVideo.id, beatMap);

    videos = videos.map((v) =>
      v.id === beatMappingVideo!.id ? { ...v, beatMap, updatedAt: new Date() } : v,
    );

    toast.success("Beat map saved");
    hapticService?.trigger("success");

    beatMappingVideo = null;
    panelState = "gallery";
  }

  function handleStepMapClose() {
    beatMappingVideo = null;
    panelState = "gallery";
  }

  function cleanupFileState() {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    selectedFile = null;
    videoPreviewUrl = null;
    videoDuration = 0;
    uploadProgress = 0;
    uploadError = null;
    thumbnail = null;
  }

  function handleBack() {
    if (panelState === "step-mapping") {
      handleStepMapClose();
      return;
    }
    if (
      (panelState === "empty" || panelState === "upload") &&
      videos.length > 0
    ) {
      cleanupFileState();
      panelState = "gallery";
      return;
    }
    cleanupFileState();
    onClose();
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<div
  class="video-panel"
  transition:fade={{ duration: 200 }}
  role="region"
  aria-label="Video panel"
>
  <input
    bind:this={fileInputEl}
    type="file"
    accept="video/*"
    onchange={handleFileSelect}
    hidden
  />

  <div class="panel-content">
    {#if panelState === "loading"}
      <div class="center-state">
        <i class="fas fa-spinner fa-spin loading-spinner" aria-hidden="true"></i>
        <span class="state-label">Loading videos...</span>
      </div>

    {:else if panelState === "save-first"}
      <div class="center-state">
        <div class="state-icon">
          <i class="fas fa-bookmark" aria-hidden="true"></i>
        </div>
        <span class="state-title">Save to library first</span>
        <span class="state-hint"
          >Videos are attached to saved sequences. Save this one to your
          library, then you can upload a performance video.</span
        >
        <div class="state-actions">
          <button
            type="button"
            class="primary-btn"
            onclick={handleSaveFirst}
            disabled={isSaving}
          >
            {#if isSaving}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              Saving...
            {:else}
              <i class="fas fa-bookmark" aria-hidden="true"></i>
              Save to Library
            {/if}
          </button>
        </div>
      </div>

    {:else if panelState === "empty"}
      {#if videos.length > 0}
        <button
          type="button"
          class="back-to-gallery"
          onclick={() => { panelState = "gallery"; }}
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          Back to gallery
        </button>
      {/if}
      <button
        class="drop-zone"
        class:drag-over={isDragOver}
        onclick={handleBrowseClick}
        ondrop={handleDrop}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        type="button"
      >
        <i class="fas fa-cloud-upload-alt drop-icon" aria-hidden="true"></i>
        <span class="drop-title">
          {videos.length > 0 ? "Add Another Video" : "Upload Your First Video"}
        </span>
        <span class="drop-hint">MP4, WebM, MOV up to 500MB</span>
      </button>

    {:else if panelState === "upload"}
      <div class="preview-section">
        {#if videoPreviewUrl}
          <div class="video-wrapper">
            <video src={videoPreviewUrl} controls playsinline>
              <track kind="captions" />
            </video>
          </div>
        {/if}

        <div class="file-info">
          <span class="file-name">{selectedFile?.name}</span>
          <span class="file-details">
            {selectedFile ? formatFileSize(selectedFile.size) : ""}
            {#if videoDuration > 0}
              &middot; {formatDuration(videoDuration)}
            {/if}
          </span>
        </div>

        <button
          class="change-file-btn"
          onclick={handleChangeFile}
          type="button"
        >
          <i class="fas fa-exchange-alt" aria-hidden="true"></i>
          Change
        </button>
      </div>

      <button
        class="primary-btn upload-btn"
        onclick={handleUpload}
        disabled={!canUpload}
        type="button"
      >
        <i class="fas fa-upload" aria-hidden="true"></i>
        Upload Video
      </button>

    {:else if panelState === "uploading"}
      <div class="center-state">
        <div class="progress-section">
          <div class="progress-info">
            <span class="progress-label">Uploading...</span>
            <span class="progress-pct">{uploadProgress}%</span>
          </div>
          <div
            class="progress-bar"
            role="progressbar"
            aria-valuenow={uploadProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          >
            <div
              class="progress-fill"
              style="width: {uploadProgress}%"
            ></div>
          </div>
        </div>
      </div>

    {:else if panelState === "gallery"}
      <div class="gallery">
        {#each videos as video (video.id)}
          <div class="gallery-card">
            <button
              type="button"
              class="gallery-thumb"
              onclick={() => handlePlayVideo(video.id)}
              aria-label={playingVideoId === video.id ? "Pause video" : "Play video"}
            >
              {#if playingVideoId === video.id}
                <video
                  src={video.videoUrl}
                  autoplay
                  controls
                  playsinline
                  class="gallery-video"
                >
                  <track kind="captions" />
                </video>
              {:else if video.thumbnailUrl}
                <img
                  src={video.thumbnailUrl}
                  alt="Video thumbnail"
                  class="gallery-thumb-img"
                />
                <div class="play-overlay">
                  <i class="fas fa-play" aria-hidden="true"></i>
                </div>
              {:else}
                <div class="thumb-placeholder">
                  <i class="fas fa-video" aria-hidden="true"></i>
                </div>
                <div class="play-overlay">
                  <i class="fas fa-play" aria-hidden="true"></i>
                </div>
              {/if}
            </button>

            <div class="gallery-info">
              <div class="gallery-info-row">
                <span class="gallery-duration"
                  >{formatDuration(video.duration)}</span
                >
                <span class="gallery-size"
                  >{formatFileSize(video.fileSize)}</span
                >
                {#if video.beatMap}
                  <span
                    class="beat-map-indicator"
                    title="Beat map available"
                  >
                    <i class="fas fa-music" aria-hidden="true"></i>
                  </span>
                {/if}
              </div>

              <div class="gallery-actions">
                <button
                  type="button"
                  class="gallery-action-btn map-beats"
                  onclick={() => { beatMappingVideo = video; panelState = "step-mapping"; }}
                  title="Map beats"
                >
                  <i class="fas fa-music" aria-hidden="true"></i>
                  Map Beats
                </button>
                <button
                  type="button"
                  class="gallery-action-btn delete-video"
                  onclick={() => handleDeleteVideo(video.id)}
                  title="Delete video"
                >
                  <i class="fas fa-trash" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </div>
        {/each}

        <button
          type="button"
          class="add-video-btn"
          onclick={handleAddVideo}
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
          Add Video
        </button>
      </div>

    {:else if panelState === "step-mapping" && beatMappingVideo}
      <StepMapEditor
        videoUrl={beatMappingVideo.videoUrl}
        videoDuration={beatMappingVideo.duration}
        stepCount={sequence.steps.length}
        initialStepMap={beatMappingVideo.beatMap}
        {bpm}
        onSave={handleStepMapSave}
        onClose={handleStepMapClose}
      />
    {/if}

    {#if uploadError}
      <div class="error-banner" role="alert">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <span>{uploadError}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .video-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px 16px;
    overflow-y: auto;
  }

  .center-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex: 1;
    min-height: 200px;
    padding: 24px;
    text-align: center;
  }

  .loading-spinner {
    font-size: 28px;
    color: var(--theme-accent, #6366f1);
    opacity: 0.7;
  }

  .state-label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .state-icon {
    font-size: 36px;
    color: var(--theme-accent, #6366f1);
    opacity: 0.7;
  }

  .state-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .state-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    max-width: 280px;
    line-height: 1.4;
  }

  .state-actions {
    margin-top: 8px;
  }

  .primary-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 24px;
    border-radius: 12px;
    border: none;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    min-height: var(--min-touch-target);
  }

  .primary-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .primary-btn:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .upload-btn {
    width: 100%;
    flex-shrink: 0;
  }

  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex: 1;
    min-height: 200px;
    padding: 32px 24px;
    background: rgba(255, 255, 255, 0.02);
    border: 2px dashed var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .drop-zone:hover,
  .drop-zone.drag-over {
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--theme-accent, #6366f1);
  }

  .drop-zone:active {
    transform: scale(0.99);
    transition-duration: 50ms;
  }

  .drop-icon {
    font-size: 40px;
    color: var(--theme-accent, #6366f1);
    opacity: 0.7;
  }

  .drop-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .drop-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
  }

  .preview-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-height: 0;
  }

  .video-wrapper {
    flex: 1;
    min-height: 0;
    border-radius: 12px;
    overflow: hidden;
    background: black;
  }

  .video-wrapper video {
    width: 100%;
    height: 100%;
    max-height: 300px;
    object-fit: contain;
  }

  .file-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 4px;
  }

  .file-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, white);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-details {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .change-file-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    align-self: flex-start;
  }

  .change-file-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 300px;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .progress-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .progress-pct {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    border-radius: 3px;
    transition: width 0.2s ease;
  }

  .gallery {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gallery-card {
    display: flex;
    gap: 12px;
    padding: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    transition: border-color 0.15s ease;
  }

  .gallery-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .gallery-thumb {
    position: relative;
    width: 96px;
    height: 72px;
    flex-shrink: 0;
    border-radius: 6px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
    border: none;
    padding: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .gallery-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .gallery-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .thumb-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: 24px;
  }

  .play-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.35);
    color: white;
    font-size: 18px;
    opacity: 0.8;
    transition: opacity 0.15s ease;
  }

  .gallery-thumb:hover .play-overlay {
    opacity: 1;
  }

  .gallery-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 6px;
  }

  .gallery-info-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .gallery-duration {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .gallery-size {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .beat-map-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 15%,
      transparent
    );
    color: var(--semantic-success, #22c55e);
    font-size: 10px;
  }

  .gallery-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .gallery-action-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    min-height: 32px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .gallery-action-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .gallery-action-btn.map-beats {
    color: var(--semantic-success, #22c55e);
    border-color: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 25%,
      transparent
    );
  }

  .gallery-action-btn.map-beats:hover {
    background: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 10%,
      transparent
    );
  }

  .gallery-action-btn.delete-video {
    color: var(--semantic-error, #ef4444);
    border-color: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 25%,
      transparent
    );
  }

  .gallery-action-btn.delete-video:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 10%,
      transparent
    );
  }

  .add-video-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    min-height: var(--min-touch-target);
    border: 2px dashed var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .add-video-btn:hover {
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-accent, #6366f1);
    background: rgba(255, 255, 255, 0.02);
  }

  .back-to-gallery {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: none;
    border: none;
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    align-self: flex-start;
    border-radius: 6px;
    transition: background 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .back-to-gallery:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 10%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    border-radius: 10px;
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-min, 14px);
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .drop-zone,
    .primary-btn,
    .change-file-btn,
    .progress-fill,
    .gallery-card,
    .gallery-action-btn,
    .add-video-btn,
    .play-overlay {
      transition: none !important;
    }

    .drop-zone:active,
    .primary-btn:active {
      transform: none !important;
    }
  }
</style>
