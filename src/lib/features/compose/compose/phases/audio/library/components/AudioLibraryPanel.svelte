<!--
  AudioLibraryPanel.svelte

  Displays user's audio library with upload functionality.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { IAudioLibrary } from "../services/contracts/IAudioLibrary";
  import { AudioLibrary } from "../services/implementations/AudioLibraryService";
  import { AudioStorageManager } from "../services/implementations/AudioStorageManager";
  import type { AudioTrackLocal } from "../domain/models/AudioTrack";

  let {
    onAudioSelected,
    onClose,
  }: {
    onAudioSelected: (
      audioBlob: Blob,
      metadata: { title: string; duration: number }
    ) => void;
    onClose: () => void;
  } = $props();

  // Create audio library instance directly (not in main DI container)
  const audioStorageManager = new AudioStorageManager();
  const audioLibrary: IAudioLibrary = new AudioLibrary(audioStorageManager);

  let tracks = $state<AudioTrackLocal[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let isUploading = $state(false);
  let uploadProgress = $state("");
  let downloadingTrackId = $state<string | null>(null);
  let downloadProgress = $state("");

  let fileInput: HTMLInputElement;

  onMount(async () => {
    await loadLibrary();
  });

  async function loadLibrary() {
    try {
      isLoading = true;
      error = null;
      tracks = await audioLibrary.getLibrary();
    } catch (err) {
      console.error("Failed to load library:", err);
      error = "Failed to load your library. Please try again.";
    } finally {
      isLoading = false;
    }
  }

  async function handleTrackSelect(track: AudioTrackLocal) {
    try {
      error = null;

      // If available locally, load immediately
      if (track.isLocallyAvailable) {
        const audioBlob = await audioLibrary.loadLocalAudio(track.trackId);
        if (audioBlob) {
          onAudioSelected(audioBlob, {
            title: track.title,
            duration: track.duration,
          });
          return;
        }
      }

      // If not available locally but has cloudUrl, download from cloud
      if (!track.isLocallyAvailable && track.cloudUrl) {
        downloadingTrackId = track.trackId;
        downloadProgress = "Starting download...";

        const audioBlob = await audioLibrary.downloadFromCloud(
          track.trackId,
          track.cloudUrl,
          {
            title: track.title,
            duration: track.duration,
          },
          (progress) => {
            downloadProgress =
              progress.message || `${Math.round(progress.progress)}%`;
          }
        );

        downloadingTrackId = null;
        downloadProgress = "";

        if (audioBlob) {
          // Update local track availability
          track.isLocallyAvailable = true;
          onAudioSelected(audioBlob, {
            title: track.title,
            duration: track.duration,
          });
        } else {
          error = "Failed to download audio from cloud.";
        }
        return;
      }

      // No local copy and no cloud URL
      error = "This track is not available. Please upload it again.";
    } catch (err) {
      console.error("Failed to load track:", err);
      error = "Failed to load audio file.";
      downloadingTrackId = null;
      downloadProgress = "";
    }
  }

  async function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      isUploading = true;
      uploadProgress = "Uploading...";
      error = null;

      const result = await audioLibrary.uploadAudioFile(file);

      if (result.success && result.track) {
        uploadProgress = "Upload complete!";
        tracks = [result.track, ...tracks];

        // Auto-select the uploaded track
        setTimeout(() => {
          if (result.track) {
            handleTrackSelect(result.track);
          }
        }, 500);
      } else {
        error = result.error || "Upload failed";
      }
    } catch (err) {
      console.error("Upload error:", err);
      error = "Upload failed. Please try again.";
    } finally {
      isUploading = false;
      uploadProgress = "";
      input.value = ""; // Reset input
    }
  }

  function openFilePicker() {
    fileInput?.click();
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function formatFileSize(bytes?: number): string {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
  }
</script>

<div class="library-panel">
  <div class="panel-header">
    <h2>Audio Library</h2>
    <button class="close-btn" onclick={onClose} aria-label="Close">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>

  <div class="upload-section">
    <input
      bind:this={fileInput}
      type="file"
      accept="audio/*"
      onchange={handleFileUpload}
      aria-label="Upload audio file"
      class="sr-only"
    />
    <button
      class="upload-btn"
      onclick={openFilePicker}
      disabled={isUploading}
      aria-busy={isUploading}
    >
      {#if isUploading}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {uploadProgress}
      {:else}
        <i class="fas fa-upload" aria-hidden="true"></i>
        Upload New Audio
      {/if}
    </button>
  </div>

  {#if error}
    <div class="error-message" role="alert" aria-live="assertive">
      <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
      {error}
    </div>
  {/if}

  {#if downloadingTrackId}
    <div class="download-progress" role="status" aria-live="polite">
      <i class="fas fa-cloud-download-alt fa-spin" aria-hidden="true"></i>
      {downloadProgress}
    </div>
  {/if}

  <div class="tracks-container">
    {#if isLoading}
      <div class="loading" role="status" aria-live="polite">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Loading your library...
      </div>
    {:else if tracks.length === 0}
      <div class="empty-state">
        <i class="fas fa-music" aria-hidden="true"></i>
        <p>Your library is empty</p>
        <p class="hint">Upload audio files to get started</p>
      </div>
    {:else}
      <div class="tracks-list">
        {#each tracks as track (track.trackId)}
          <button
            class="track-item"
            class:downloading={downloadingTrackId === track.trackId}
            class:cloud-only={!track.isLocallyAvailable && track.cloudUrl}
            class:unavailable={!track.isLocallyAvailable && !track.cloudUrl}
            onclick={() => handleTrackSelect(track)}
            disabled={downloadingTrackId === track.trackId ||
              (!track.isLocallyAvailable && !track.cloudUrl)}
          >
            <div class="track-icon">
              {#if downloadingTrackId === track.trackId}
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              {:else}
                <i class="fas fa-file-audio" aria-hidden="true"></i>
              {/if}
            </div>
            <div class="track-info">
              <div class="track-title">{track.title}</div>
              <div class="track-meta">
                {track.artist} · {formatDuration(track.duration)}
                {#if track.fileSize}
                  · {formatFileSize(track.fileSize)}
                {/if}
              </div>
            </div>
            {#if downloadingTrackId === track.trackId}
              <div class="status-badge downloading">
                <i class="fas fa-cloud-download-alt" aria-hidden="true"></i>
                Downloading...
              </div>
            {:else if track.isLocallyAvailable}
              <div class="status-badge local">
                <i class="fas fa-check-circle" aria-hidden="true"></i>
                Available
              </div>
            {:else if track.cloudUrl}
              <div class="status-badge cloud">
                <i class="fas fa-cloud-download-alt" aria-hidden="true"></i>
                Click to download
              </div>
            {:else}
              <div class="status-badge unavailable">
                <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
                Unavailable
              </div>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .library-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .close-btn {
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 6px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: var(--theme-text);
  }

  .upload-section {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .upload-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 8px;
    color: rgba(167, 139, 250, 0.95);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .upload-btn:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.4);
  }

  .upload-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 1rem 1.5rem 0;
    padding: 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 6px;
    color: rgba(248, 113, 113, 0.9);
    font-size: 0.85rem;
  }

  .download-progress {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 1rem 1.5rem 0;
    padding: 0.75rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 6px;
    color: rgba(96, 165, 250, 0.9);
    font-size: 0.85rem;
  }

  .tracks-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .loading,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
    color: var(--theme-text-dim);
    text-align: center;
  }

  .loading i,
  .empty-state i {
    font-size: 2rem;
    margin-bottom: 0.75rem;
    color: rgba(139, 92, 246, 0.5);
  }

  .empty-state p {
    margin: 0.25rem 0;
    font-size: 0.9rem;
  }

  .empty-state .hint {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim); /* Improved contrast for WCAG AAA */
  }

  .tracks-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .track-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }

  .track-item:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(139, 92, 246, 0.3);
  }

  .track-item.downloading {
    opacity: 0.7;
    cursor: wait;
  }

  .track-item.cloud-only {
    border-color: rgba(59, 130, 246, 0.2);
  }

  .track-item.cloud-only:hover:not(:disabled) {
    border-color: rgba(59, 130, 246, 0.4);
    background: rgba(59, 130, 246, 0.05);
  }

  .track-item.unavailable {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .track-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 6px;
    color: rgba(167, 139, 250, 0.8);
  }

  .track-info {
    flex: 1;
    min-width: 0;
  }

  .track-title {
    font-size: 0.9rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.95);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-meta {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
    margin-top: 0.25rem;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    white-space: nowrap;
  }

  .status-badge.local {
    background: rgba(34, 197, 94, 0.15);
    color: rgba(74, 222, 128, 0.9);
  }

  .status-badge.cloud {
    background: rgba(59, 130, 246, 0.15);
    color: rgba(96, 165, 250, 0.9);
  }

  .status-badge.downloading {
    background: rgba(139, 92, 246, 0.15);
    color: rgba(167, 139, 250, 0.9);
  }

  .status-badge.unavailable {
    background: rgba(239, 68, 68, 0.15);
    color: rgba(248, 113, 113, 0.9);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
