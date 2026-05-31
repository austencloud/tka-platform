<!--
  VideoLab.svelte

  Experimental workspace for beat mapping, BPM-synced playback, and
  video-to-notation alignment. Three views:
    1. Upload & Select - pick a local video + library sequence
    2. Beat Mapping - annotate beat timestamps using StepMapEditor
    3. Synced Playback - side-by-side video + choreo card preview
-->
<script lang="ts">
  import type { StepMap } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  import UploadSelectView from "./views/UploadSelectView.svelte";
  import StepMappingView from "./views/StepMappingView.svelte";
  import SyncedPlaybackView from "./views/SyncedPlaybackView.svelte";

  // ---- Shared state across views ----
  type VideoLabView = "upload" | "mapping" | "preview";
  let activeView = $state<VideoLabView>("upload");

  // Video source (local file blob URL or pasted URL)
  let videoUrl = $state<string | null>(null);
  let videoDuration = $state(0);
  let videoFileSize = $state(0);

  // Selected sequence from library
  let selectedSequence = $state<SequenceData | null>(null);

  // Beat map produced by the mapping view
  let beatMap = $state<StepMap | null>(null);

  // ---- View transitions ----

  function handleStartMapping(url: string, duration: number, fileSize: number, sequence: SequenceData) {
    videoUrl = url;
    videoDuration = duration;
    videoFileSize = fileSize;
    selectedSequence = sequence;
    activeView = "mapping";
  }

  function handleStepMapSaved(saved: StepMap) {
    beatMap = saved;
    activeView = "preview";
  }

  function handleBackToUpload() {
    activeView = "upload";
  }

  function handleBackToMapping() {
    activeView = "mapping";
  }
</script>

<div class="video-lab-root">
  <header class="lab-header">
    <i class="fas fa-film" aria-hidden="true"></i>
    <h2>Video Lab</h2>
    <span class="lab-badge">Experimental</span>
  </header>

  <div class="view-container">
    {#if activeView === "upload"}
      <UploadSelectView onStartMapping={handleStartMapping} />
    {:else if activeView === "mapping" && videoUrl && selectedSequence}
      <StepMappingView
        {videoUrl}
        {videoDuration}
        stepCount={selectedSequence.steps?.length || selectedSequence.word?.length || 8}
        sequence={selectedSequence}
        existingStepMap={beatMap}
        onSave={handleStepMapSaved}
        onBack={handleBackToUpload}
      />
    {:else if activeView === "preview" && videoUrl && selectedSequence && beatMap}
      <SyncedPlaybackView
        {videoUrl}
        {videoDuration}
        sequence={selectedSequence}
        {beatMap}
        onBackToMapping={handleBackToMapping}
      />
    {:else}
      <div class="fallback">
        <p>Missing required data. Returning to upload.</p>
        <button class="back-btn" onclick={handleBackToUpload} type="button">
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          Back
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .video-lab-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
  }

  .lab-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .lab-header i {
    font-size: 18px;
    color: var(--theme-accent, #6366f1);
  }

  .lab-header h2 {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .lab-badge {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    color: var(--theme-accent, #6366f1);
  }

  .view-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
  }

  .back-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  @media (prefers-reduced-motion: reduce) {
    .back-btn {
      transition: none !important;
    }
  }
</style>
