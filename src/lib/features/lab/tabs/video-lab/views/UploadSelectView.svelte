<!--
  UploadSelectView.svelte

  First view in Video Lab. Pick a local video file and select a sequence
  using the existing SequencePickerModal.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";

  interface Props {
    onStartMapping: (
      videoUrl: string,
      duration: number,
      fileSize: number,
      sequence: SequenceData,
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

  // ---- Sequence selection ----
  let selectedSequence = $state<SequenceData | null>(null);
  let pickerOpen = $state(false);

  const canStart = $derived(!!videoUrl && !!selectedSequence && videoDuration > 0);
  const beatCount = $derived(
    selectedSequence?.steps?.length || selectedSequence?.word?.length || 0
  );

  // ---- Video file handling ----
  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    cleanupVideo();
    videoUrl = URL.createObjectURL(file);
    videoFileName = file.name;
    videoFileSize = file.size;
  }

  function handlePasteLoad() {
    const url = pasteUrl.trim();
    if (!url) return;
    cleanupVideo();
    videoUrl = url;
    videoFileName = url.split("/").pop() ?? "video";
    videoFileSize = 0;
  }

  function handleVideoLoaded() {
    if (videoEl) videoDuration = videoEl.duration;
  }

  function cleanupVideo() {
    if (videoUrl?.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
    videoUrl = null;
    videoDuration = 0;
    videoFileSize = 0;
    videoFileName = "";
  }

  function clearVideo() {
    cleanupVideo();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (input) input.value = "";
  }

  function handleStart() {
    if (!videoUrl || !selectedSequence || videoDuration <= 0) return;
    onStartMapping(videoUrl, videoDuration, videoFileSize, selectedSequence);
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
</script>

<div class="upload-select-view">
  <div class="two-up">
    <!-- Left: Video Source -->
    <section class="section">
      <h3 class="section-title">
        <i class="fas fa-video" aria-hidden="true"></i>
        Video Source
      </h3>

      {#if !videoUrl}
        <label class="file-picker">
          <input type="file" accept="video/*" onchange={handleFileSelect} hidden />
          <i class="fas fa-cloud-upload-alt" aria-hidden="true"></i>
          <span>Choose a video file</span>
        </label>

        <div class="or-divider">or</div>

        <div class="paste-row">
          <input
            type="text"
            placeholder="Paste a video URL..."
            bind:value={pasteUrl}
            class="paste-input"
          />
          <button type="button" class="paste-btn" onclick={handlePasteLoad} disabled={!pasteUrl.trim()}>
            Load
          </button>
        </div>
      {:else}
        <div class="video-preview">
          <!-- svelte-ignore a11y_media_has_caption -->
          <video bind:this={videoEl} src={videoUrl} onloadedmetadata={handleVideoLoaded} controls preload="metadata"></video>
          <div class="video-info">
            <span class="video-name">{videoFileName}</span>
            <span class="video-meta">
              {#if videoFileSize > 0}{formatFileSize(videoFileSize)} · {/if}
              {#if videoDuration > 0}{formatDuration(videoDuration)}{/if}
            </span>
          </div>
          <button type="button" class="clear-btn" onclick={clearVideo}>
            <i class="fas fa-times" aria-hidden="true"></i> Change
          </button>
        </div>
      {/if}
    </section>

    <!-- Right: Sequence Selection -->
    <section class="section">
      <h3 class="section-title">
        <i class="fas fa-list" aria-hidden="true"></i>
        Sequence
      </h3>

      {#if selectedSequence}
        <div class="selected-sequence">
          <div class="selected-info">
            <span class="selected-word">{selectedSequence.word ?? selectedSequence.name}</span>
            <span class="selected-beats">{beatCount} beats</span>
          </div>
          <button type="button" class="change-btn" onclick={() => (pickerOpen = true)}>Change</button>
        </div>
      {:else}
        <button type="button" class="pick-btn" onclick={() => (pickerOpen = true)}>
          <i class="fas fa-th" aria-hidden="true"></i>
          Choose a sequence
        </button>
      {/if}
    </section>
  </div>

  <!-- Start -->
  <div class="start-row">
    <button type="button" class="start-btn" onclick={handleStart} disabled={!canStart}>
      <i class="fas fa-play" aria-hidden="true"></i>
      Start Mapping
    </button>
  </div>
</div>

<SequencePickerModal
  bind:open={pickerOpen}
  onClose={() => (pickerOpen = false)}
  onSelect={(seq) => { selectedSequence = seq; pickerOpen = false; }}
  title="Select Sequence for Beat Mapping"
/>

<style>
  .upload-select-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 20px;
    height: 100%;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }

  .two-up {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    width: 100%;
  }

  @media (max-width: 640px) {
    .two-up {
      grid-template-columns: 1fr;
    }
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .start-row {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .file-picker {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px;
    border: 2px dashed var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    cursor: pointer;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-min, 14px);
    transition: border-color 0.15s, color 0.15s;
  }

  .file-picker:hover {
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #fff);
  }

  .or-divider {
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    font-size: var(--font-size-compact, 12px);
  }

  .paste-row {
    display: flex;
    gap: 8px;
  }

  .paste-input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
  }

  .paste-input::placeholder {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  .paste-btn {
    padding: 10px 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
  }

  .paste-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .video-preview {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .video-preview video {
    width: 100%;
    max-height: 240px;
    border-radius: 8px;
    background: #000;
  }

  .video-info { display: flex; flex-direction: column; gap: 2px; }

  .video-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, #fff);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .video-meta {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .clear-btn {
    align-self: flex-start;
    padding: 6px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
  }

  .pick-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    border: 2px dashed var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    background: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    transition: border-color 0.15s, color 0.15s;
  }

  .pick-btn:hover {
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #fff);
  }

  .selected-sequence {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border: 1.5px solid var(--theme-accent, #6366f1);
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .selected-info { display: flex; flex-direction: column; gap: 2px; }

  .selected-word {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-accent, #6366f1);
  }

  .selected-beats {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .change-btn {
    padding: 6px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
  }

  .start-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 40px;
    border: none;
    border-radius: 10px;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
  }

  .start-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  @media (prefers-reduced-motion: reduce) {
    .file-picker, .pick-btn, .start-btn { transition: none; }
  }
</style>
