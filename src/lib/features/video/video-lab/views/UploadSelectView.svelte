<!--
  UploadSelectView.svelte

  Setup screen for Video Lab. Pick a video + sequence, then start mapping.
  Persists selected sequence to localStorage across refreshes.
-->
<script lang="ts">

import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
  import { onMount } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { hydrate } from "$lib/shared/foundation/services/sequence-hydrator";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import PropAwareThumbnail from "$lib/shared/browse/components/PropAwareThumbnail.svelte";
import type { LibraryRepository } from "$lib/shared/library/services/library-repository";

  const STORAGE_KEY = "video-lab-sequence";

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
  let videoEl: HTMLVideoElement | undefined = $state();

  let selectedSequence = $state<SequenceData | null>(null);
  let pickerOpen = $state(false);

  const canStart = $derived(!!videoUrl && !!selectedSequence && videoDuration > 0);
  const stepCount = $derived(
    selectedSequence?.steps?.length || selectedSequence?.word?.length || 0
  );

  // ---- Persistence: restore sequence on mount ----
  onMount(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const { sequenceId } = JSON.parse(saved);
      if (!sequenceId) return;

      // Load the full sequence from library
      const repo = getLibraryRepository() as LibraryRepository;
      repo.getSequence(sequenceId).then((seq) => {
        if (seq) {
          try {
            selectedSequence = hydrate(seq);
          } catch {
            selectedSequence = seq;
          }
        }
      }).catch(() => {
        localStorage.removeItem(STORAGE_KEY);
      });
    } catch {
      // ignore
    }
  });

  function selectSequence(seq: SequenceData) {
    selectedSequence = seq;
    pickerOpen = false;
    // Persist sequence ID
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sequenceId: seq.id }));
    } catch { /* ignore */ }
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    cleanupVideo();
    videoUrl = URL.createObjectURL(file);
    videoFileName = file.name;
    videoFileSize = file.size;
  }

  function handleVideoLoaded() {
    if (!videoEl) return;
    videoDuration = videoEl.duration;
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
    <div class="panel">
      <h3 class="panel-title">
        <i class="fas fa-video" aria-hidden="true"></i>
        Video
      </h3>

      {#if videoUrl}
        <div class="card">
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            bind:this={videoEl}
            src={videoUrl}
            onloadedmetadata={handleVideoLoaded}
            controls
            preload="auto"
            class="video-player"
          ></video>
          <div class="card-footer">
            <div class="card-info">
              <span class="card-name">{videoFileName}</span>
              <span class="card-sub">
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
      {/if}
    </div>

    <!-- Right: Sequence -->
    <div class="panel">
      <h3 class="panel-title">
        <i class="fas fa-th" aria-hidden="true"></i>
        Sequence
      </h3>

      {#if selectedSequence}
        <div class="card">
          {#if selectedSequence.steps && selectedSequence.steps.length > 0}
            <div class="choreo-preview">
              <PropAwareThumbnail sequence={selectedSequence} variant="gallery" eager />
            </div>
          {/if}
          <div class="card-footer">
            <div class="card-info">
              <span class="card-name">{selectedSequence.word ?? selectedSequence.name}</span>
              <span class="card-sub">{stepCount} beats</span>
            </div>
            <button type="button" class="text-btn" onclick={() => (pickerOpen = true)}>Change</button>
          </div>
        </div>
      {:else}
        <button type="button" class="drop-zone" onclick={() => (pickerOpen = true)}>
          <i class="fas fa-th-large drop-icon" aria-hidden="true"></i>
          <span class="drop-label">Choose a sequence</span>
          <span class="drop-hint">Pick the sequence this video performs</span>
        </button>
      {/if}
    </div>
  </div>

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
  onSelect={selectSequence}
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
    align-items: start;
  }

  @media (max-width: 768px) {
    .setup-content { grid-template-columns: 1fr; }
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
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

  .panel-title i { color: var(--theme-accent, #6366f1); }

  /* ---- Drop zones ---- */

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

  .drop-icon { font-size: 28px; color: var(--theme-text-muted, rgba(255, 255, 255, 0.3)); }
  .drop-label { font-size: var(--font-size-min, 14px); color: var(--theme-text-muted, rgba(255, 255, 255, 0.5)); }
  .drop-hint { font-size: var(--font-size-compact, 12px); color: var(--theme-text-muted, rgba(255, 255, 255, 0.3)); }

  /* ---- Loaded card ---- */

  .card {
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    overflow: hidden;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
  }

  .video-player {
    width: 100%;
    display: block;
    background: #000;
  }

  .choreo-preview {
    width: 100%;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
  }

  .card-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

  .card-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-sub {
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

  /* ---- Start ---- */

  .start-area { display: flex; justify-content: center; }

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

  .start-btn:active { transform: translateY(0); }

  @media (prefers-reduced-motion: reduce) {
    .drop-zone, .start-btn, .text-btn { transition: none; }
    .start-btn:hover { transform: none; }
  }
</style>
