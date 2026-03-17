<!--
  UploadSelectView.svelte

  Setup screen for Video Lab. Pick a video + sequence, then start mapping.
  Desktop-first: two columns, video left, sequence right.
  Mobile: stacks vertically.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import PropAwareThumbnail from "$lib/features/browse/sequences/display/components/PropAwareThumbnail.svelte";

  interface Props {
    onStartMapping: (
      videoUrl: string,
      duration: number,
      fileSize: number,
      sequence: SequenceData,
    ) => void;
  }

  const { onStartMapping }: Props = $props();

  let videoUrl = $state<string | null>(null);
  let videoDuration = $state(0);
  let videoFileSize = $state(0);
  let videoFileName = $state("");
  let pasteUrl = $state("");
  let videoEl: HTMLVideoElement | undefined = $state();

  let selectedSequence = $state<SequenceData | null>(null);
  let pickerOpen = $state(false);

  const canStart = $derived(!!videoUrl && !!selectedSequence && videoDuration > 0);
  const beatCount = $derived(
    selectedSequence?.steps?.length || selectedSequence?.word?.length || 0
  );

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
    if (!videoEl) return;
    videoDuration = videoEl.duration;
    // Seek slightly in to show a real frame instead of a black screen
    if (videoEl.currentTime === 0) videoEl.currentTime = 0.1;
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

<div class="setup-page">
  <div class="setup-content">
    <!-- Left: Video -->
    <div class="panel video-panel">
      <h3 class="panel-title">
        <i class="fas fa-video" aria-hidden="true"></i>
        Video
      </h3>

      {#if videoUrl}
        <div class="video-loaded">
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            bind:this={videoEl}
            src={videoUrl}
            onloadedmetadata={handleVideoLoaded}
            controls
            preload="auto"
            class="video-player"
          ></video>
          <div class="video-meta-row">
            <div class="video-details">
              <span class="meta-name">{videoFileName}</span>
              <span class="meta-sub">
                {#if videoFileSize > 0}{formatFileSize(videoFileSize)}{/if}
                {#if videoDuration > 0} · {formatDuration(videoDuration)}{/if}
              </span>
            </div>
            <button type="button" class="text-btn" onclick={clearVideo}>Change</button>
          </div>
        </div>
      {:else}
        <label class="drop-zone">
          <input type="file" accept="video/*" onchange={handleFileSelect} hidden />
          <i class="fas fa-film drop-icon" aria-hidden="true"></i>
          <span class="drop-label">Drop a video here or click to browse</span>
          <span class="drop-hint">MP4, WebM, MOV</span>
        </label>
        <div class="or-line"><span>or</span></div>
        <div class="url-row">
          <input type="text" placeholder="Paste a video URL..." bind:value={pasteUrl} class="url-input" />
          <button type="button" class="url-btn" onclick={handlePasteLoad} disabled={!pasteUrl.trim()}>Load</button>
        </div>
      {/if}
    </div>

    <!-- Right: Sequence -->
    <div class="panel sequence-panel">
      <h3 class="panel-title">
        <i class="fas fa-th" aria-hidden="true"></i>
        Sequence
      </h3>

      {#if selectedSequence}
        <div class="sequence-loaded">
          <!-- Choreo card thumbnail -->
          {#if selectedSequence.steps && selectedSequence.steps.length > 0}
            <div class="choreo-preview">
              <PropAwareThumbnail sequence={selectedSequence} variant="browse" eager suppressContextMenu />
            </div>
          {/if}
          <div class="sequence-meta-row">
            <div class="sequence-details">
              <span class="meta-name">{selectedSequence.word ?? selectedSequence.name}</span>
              <span class="meta-sub">{beatCount} beats</span>
            </div>
            <button type="button" class="text-btn" onclick={() => (pickerOpen = true)}>Change</button>
          </div>
        </div>
      {:else}
        <button type="button" class="drop-zone" onclick={() => (pickerOpen = true)}>
          <i class="fas fa-th-large drop-icon" aria-hidden="true"></i>
          <span class="drop-label">Choose a sequence from your library</span>
          <span class="drop-hint">Pick the sequence this video performs</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- Start button - only prominent when both are selected -->
  {#if canStart}
    <div class="start-area">
      <button type="button" class="start-btn" onclick={handleStart}>
        <i class="fas fa-play" aria-hidden="true"></i>
        Start Mapping
      </button>
    </div>
  {/if}
</div>

<SequencePickerModal
  bind:open={pickerOpen}
  onClose={() => (pickerOpen = false)}
  onSelect={(seq) => { selectedSequence = seq; pickerOpen = false; }}
  title="Select Sequence"
/>

<style>
  .setup-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
    padding: 24px;
    height: 100%;
    overflow-y: auto;
  }

  .setup-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    width: 100%;
    max-width: 1100px;
    flex: 1;
  }

  @media (max-width: 768px) {
    .setup-content {
      grid-template-columns: 1fr;
    }
  }

  /* ---- Panels ---- */

  .panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .panel-title i {
    color: var(--theme-accent, #6366f1);
  }

  /* ---- Drop zones (empty state) ---- */

  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 48px 24px;
    border: 2px dashed var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    min-height: 200px;
  }

  .drop-zone:hover {
    border-color: var(--theme-accent, #6366f1);
    background: rgba(99, 102, 241, 0.04);
  }

  .drop-icon {
    font-size: 28px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  .drop-label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .drop-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  /* ---- URL paste ---- */

  .or-line {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.25));
    font-size: var(--font-size-compact, 12px);
  }

  .or-line::before, .or-line::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .url-row {
    display: flex;
    gap: 8px;
  }

  .url-input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
  }

  .url-input::placeholder {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
  }

  .url-btn {
    padding: 10px 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
  }

  .url-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ---- Loaded states ---- */

  .video-loaded, .sequence-loaded {
    display: flex;
    flex-direction: column;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    overflow: hidden;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    flex: 1;
  }

  .video-player {
    width: 100%;
    flex: 1;
    min-height: 200px;
    background: #000;
    display: block;
    object-fit: contain;
  }

  .choreo-preview {
    width: 100%;
    flex: 1;
    min-height: 200px;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .video-meta-row, .sequence-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
  }

  .video-details, .sequence-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .meta-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta-sub {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .text-btn {
    padding: 6px 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 6px;
    background: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
    flex-shrink: 0;
  }

  .text-btn:hover {
    color: var(--theme-text, #fff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  /* ---- Start button ---- */

  .start-area {
    display: flex;
    justify-content: center;
  }

  .start-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 48px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.15s;
  }

  .start-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent);
  }

  .start-btn:active {
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .drop-zone, .start-btn, .text-btn { transition: none; }
    .start-btn:hover { transform: none; }
  }
</style>
