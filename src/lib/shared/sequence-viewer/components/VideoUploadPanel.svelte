<!--
  VideoUploadPanel.svelte

  Inline panel for uploading performance videos to a sequence.
  Renders in the viewer content area (same space as ExportVideoDrawer),
  not as a separate drawer/sheet overlay.

  Flow: pick file -> preview -> upload -> done (auto-exit)
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import { fade } from "svelte/transition";
  import { getVideoUploader } from "$lib/shared/share/get-video-uploader";
  import { saveVideo } from "$lib/shared/video-collaboration/services/collaborative-video-manager";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/implementations/HapticFeedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { getAuthSync } from "$lib/shared/auth/firebase";
  import {
    createVideoFromUpload,
    getVideoFileMetadata,
  } from "$lib/shared/video-collaboration/helpers/create-video-from-upload";
  import {
    extractVideoThumbnail,
    type ThumbnailResult,
  } from "$lib/shared/video-collaboration/utils/thumbnail-extractor";

  interface Props {
    sequence: SequenceData;
    isOwned: boolean;
    onSaveFirst: () => Promise<void>;
    onClose: () => void;
  }

  let { sequence, onClose, isOwned, onSaveFirst }: Props = $props();

  // Save-first state: shown when sequence isn't saved to library yet
  let isSaving = $state(false);

  async function handleSaveFirst() {
    isSaving = true;
    try {
      await onSaveFirst();
    } catch {
      // Parent handles the error toast
    } finally {
      isSaving = false;
    }
  }

  // Services
  const uploadService = getVideoUploader();
  const hapticService = getHapticFeedback() as HapticFeedback | undefined;

  // File state
  let selectedFile = $state<File | null>(null);
  let videoPreviewUrl = $state<string | null>(null);
  let videoDuration = $state<number>(0);
  let thumbnail = $state<ThumbnailResult | null>(null);

  // Upload state
  let isUploading = $state(false);
  let uploadProgress = $state(0);
  let uploadError = $state<string | null>(null);
  let uploadSuccess = $state(false);

  // Drag state
  let isDragOver = $state(false);

  // File input ref
  let fileInputEl: HTMLInputElement;

  const currentUser = $derived(getAuthSync().currentUser);
  const canUpload = $derived(!!selectedFile && !isUploading && !!currentUser);

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
      .then((meta) => { videoDuration = meta.duration; })
      .catch(() => { videoDuration = 0; });

    extractVideoThumbnail(file)
      .then((result) => { thumbnail = result; })
      .catch(() => { thumbnail = null; });

    hapticService?.trigger("selection");
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
        }
      );

      let thumbnailUrl: string | undefined;
      if (thumbnail) {
        try {
          const videoTimestamp = parseInt(
            uploadResult.key.split("/").pop()?.split(".")[0] || "0"
          );
          const thumbnailResult = await uploadService.uploadVideoThumbnail(
            sequence.id,
            thumbnail.blob,
            videoTimestamp
          );
          thumbnailUrl = thumbnailResult.url;
          uploadProgress = 100;
        } catch {
          // Thumbnail upload is optional
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
      uploadSuccess = true;

      // Auto-close after showing success
      setTimeout(() => {
        cleanup();
        onClose();
      }, 2000);
    } catch (e) {
      console.error("Upload failed:", e);
      uploadError = e instanceof Error ? e.message : "Upload failed";
      toast.error("Video upload failed. Please try again.");
      hapticService?.trigger("error");
    } finally {
      isUploading = false;
    }
  }

  function cleanup() {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    selectedFile = null;
    videoPreviewUrl = null;
    videoDuration = 0;
    uploadProgress = 0;
    uploadError = null;
    thumbnail = null;
    uploadSuccess = false;
  }

  function handleBack() {
    cleanup();
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
  class="upload-panel"
  transition:fade={{ duration: 200 }}
  role="region"
  aria-label="Upload video"
>
  <div class="panel-content">
    <!-- Hidden file input -->
    <input
      bind:this={fileInputEl}
      type="file"
      accept="video/*"
      onchange={handleFileSelect}
      hidden
    />

    {#if !isOwned}
      <!-- Save-first prompt: sequence needs to be in the user's library before attaching videos -->
      <div class="save-first-state">
        <div class="save-first-icon">
          <i class="fas fa-bookmark" aria-hidden="true"></i>
        </div>
        <span class="save-first-title">Save to library first</span>
        <span class="save-first-hint">Videos are attached to saved sequences. Save this one to your library, then you can upload a performance video.</span>
        <div class="save-first-actions">
          <button
            type="button"
            class="save-first-btn"
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
    {:else if uploadSuccess}
      <!-- Success state -->
      <div class="success-state">
        <div class="success-icon">
          <i class="fas fa-check-circle" aria-hidden="true"></i>
        </div>
        <span class="success-text">Uploaded!</span>
      </div>
    {:else if !selectedFile}
      <!-- File picker -->
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
        <span class="drop-title">Select Video</span>
        <span class="drop-hint">MP4, WebM, MOV up to 500MB</span>
      </button>
    {:else}
      <!-- Video preview + info -->
      <div class="preview-section">
        {#if videoPreviewUrl}
          <div class="video-wrapper">
            <video src={videoPreviewUrl} controls playsinline>
              <track kind="captions" />
            </video>
          </div>
        {/if}

        <div class="file-info">
          <span class="file-name">{selectedFile.name}</span>
          <span class="file-details">
            {formatFileSize(selectedFile.size)}
            {#if videoDuration > 0}
              · {formatDuration(videoDuration)}
            {/if}
          </span>
        </div>

        {#if !isUploading}
          <button class="change-file-btn" onclick={handleChangeFile} type="button">
            <i class="fas fa-exchange-alt" aria-hidden="true"></i>
            Change
          </button>
        {/if}
      </div>

      <!-- Upload progress or button -->
      {#if isUploading}
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
            <div class="progress-fill" style="width: {uploadProgress}%"></div>
          </div>
        </div>
      {:else}
        <button
          class="upload-btn"
          onclick={handleUpload}
          disabled={!canUpload}
          type="button"
        >
          <i class="fas fa-upload" aria-hidden="true"></i>
          Upload Video
        </button>
      {/if}
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
  .upload-panel {
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

  /* ============================================================
   * DROP ZONE
   * ============================================================ */

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

  /* ============================================================
   * VIDEO PREVIEW
   * ============================================================ */

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

  /* ============================================================
   * UPLOAD BUTTON
   * ============================================================ */

  .upload-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .upload-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .upload-btn:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ============================================================
   * PROGRESS
   * ============================================================ */

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
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

  /* ============================================================
   * SUCCESS STATE
   * ============================================================ */

  .save-first-state {
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

  .save-first-icon {
    font-size: 36px;
    color: var(--theme-accent, #6366f1);
    opacity: 0.7;
  }

  .save-first-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .save-first-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    max-width: 280px;
    line-height: 1.4;
  }

  .save-first-actions {
    margin-top: 8px;
  }

  .save-first-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    border-radius: 8px;
    border: none;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .save-first-btn:hover {
    opacity: 0.9;
  }

  .save-first-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .success-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex: 1;
    min-height: 200px;
  }

  .success-icon {
    font-size: 48px;
    color: var(--semantic-success, #22c55e);
  }

  .success-text {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--semantic-success, #22c55e);
  }

  /* ============================================================
   * ERROR
   * ============================================================ */

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    border-radius: 10px;
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-min, 14px);
    flex-shrink: 0;
  }

  /* ============================================================
   * REDUCED MOTION
   * ============================================================ */

  @media (prefers-reduced-motion: reduce) {
    .drop-zone,
    .upload-btn,
    .change-file-btn,
    .progress-fill {
      transition: none !important;
    }

    .drop-zone:active,
    .upload-btn:active {
      transform: none !important;
    }
  }
</style>
