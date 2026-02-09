<!--
  Phase1Panel - Video upload -> hand analysis -> trajectory + beat output

  Orchestrates the Phase 1 pipeline:
  1. User uploads a video file
  2. VideoFrameExtractor pulls frames at 15fps
  3. VideoHandAnalyzer runs MediaPipe on each frame
  4. BeatBoundaryDetector groups stable positions into beats
  5. Results displayed as trajectory chart + beat sequence
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { IVideoFrameExtractor } from "../services/contracts/IVideoFrameExtractor";
  import type { IVideoHandAnalyzer } from "../services/contracts/IVideoHandAnalyzer";
  import type { IBeatBoundaryDetector } from "../services/contracts/IBeatBoundaryDetector";
  import type { Phase1Result } from "../domain/models";
  import VideoUploadDropzone from "./VideoUploadDropzone.svelte";
  import TrajectoryTimeline from "./TrajectoryTimeline.svelte";
  import PositionSequenceOutput from "./PositionSequenceOutput.svelte";

  import type { IImageModeHandLandmarker } from "../services/contracts/IImageModeHandLandmarker";

  type PipelineState =
    | "idle"
    | "initializing"
    | "extracting"
    | "analyzing"
    | "detecting-beats"
    | "complete"
    | "error";

  let pipelineState = $state<PipelineState>("idle");
  let progressCurrent = $state(0);
  let progressTotal = $state(0);
  let progressLabel = $state("");
  let errorMessage = $state("");
  let result = $state<Phase1Result | null>(null);

  const landmarker = container.items.imageModeHandLandmarker as IImageModeHandLandmarker;
  const frameExtractor = container.items.videoFrameExtractor as IVideoFrameExtractor;
  const handAnalyzer = container.items.videoHandAnalyzer as IVideoHandAnalyzer;
  const beatDetector = container.items.beatBoundaryDetector as IBeatBoundaryDetector;

  function onProgress(current: number, total: number, label?: string) {
    progressCurrent = current;
    progressTotal = total;
    if (label) progressLabel = label;
  }

  async function handleFileSelected(file: File) {
    pipelineState = "initializing";
    result = null;
    errorMessage = "";
    progressCurrent = 0;
    progressTotal = 0;
    const startTime = performance.now();

    try {
      // Step 0: Initialize MediaPipe if needed (~9MB download on first use)
      if (!landmarker.isInitialized) {
        progressLabel = "Downloading hand detection model";
        await landmarker.initialize();
      }

      // Step 1: Extract frames
      pipelineState = "extracting";
      progressLabel = "Extracting frames";
      const frames = await frameExtractor.extractFrames(
        file,
        { fps: 15 },
        onProgress
      );

      if (frames.length === 0) {
        throw new Error("No frames could be extracted from the video");
      }

      // Compute duration from last frame timestamp
      const lastFrame = frames[frames.length - 1];
      const duration = lastFrame?.timestamp ?? 0;

      // Step 2: Analyze hands
      pipelineState = "analyzing";
      progressLabel = "Analyzing hands";
      const timeline = await handAnalyzer.analyze(frames, 15, duration, onProgress);

      // Step 3: Detect beats
      pipelineState = "detecting-beats";
      progressLabel = "Detecting beats";
      const beats = beatDetector.detectBeats(timeline);

      const processingTimeMs = performance.now() - startTime;

      result = { timeline, beats, processingTimeMs };
      pipelineState = "complete";
    } catch (err) {
      console.error("[Skel2TKA] Phase 1 error:", err);
      errorMessage = err instanceof Error ? err.message : "Analysis failed";
      pipelineState = "error";
    }
  }

  const isProcessing = $derived(
    pipelineState === "initializing" ||
    pipelineState === "extracting" ||
    pipelineState === "analyzing" ||
    pipelineState === "detecting-beats"
  );

  const progressPercent = $derived(
    progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0
  );
</script>

<div class="phase1-panel">
  <div class="upload-section">
    <VideoUploadDropzone onFileSelected={handleFileSelected} disabled={isProcessing} />
  </div>

  {#if isProcessing}
    <div class="progress-section">
      <div class="progress-header">
        <i class="fas fa-circle-notch fa-spin"></i>
        <span>{progressLabel}...</span>
        {#if progressTotal > 0}
          <span class="progress-count">{progressCurrent} / {progressTotal}</span>
        {/if}
      </div>
      {#if pipelineState === "initializing"}
        <div class="progress-bar indeterminate">
          <div class="progress-fill-indeterminate"></div>
        </div>
      {:else}
        <div class="progress-bar">
          <div class="progress-fill" style="width: {progressPercent}%"></div>
        </div>
      {/if}
    </div>
  {/if}

  {#if pipelineState === "error"}
    <div class="error-section">
      <i class="fas fa-exclamation-triangle"></i>
      <span>{errorMessage}</span>
    </div>
  {/if}

  {#if pipelineState === "complete" && result}
    <div class="results-section">
      <div class="results-header">
        <h3>Results</h3>
        <span class="timing">
          {result.timeline.frames.length} frames analyzed in {(result.processingTimeMs / 1000).toFixed(1)}s
        </span>
      </div>

      <TrajectoryTimeline timeline={result.timeline} />
      <PositionSequenceOutput beats={result.beats} />
    </div>
  {/if}
</div>

<style>
  .phase1-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    overflow-y: auto;
  }

  .upload-section {
    max-width: 480px;
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 480px;
  }

  .progress-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #ffffff);
  }

  .progress-header i {
    color: var(--theme-accent, #3b82f6);
  }

  .progress-count {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-variant-numeric: tabular-nums;
  }

  .progress-bar {
    height: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #3b82f6);
    border-radius: 3px;
    transition: width 0.15s ease-out;
  }

  .progress-fill-indeterminate {
    height: 100%;
    width: 40%;
    background: var(--theme-accent, #3b82f6);
    border-radius: 3px;
    animation: indeterminate 1.5s ease-in-out infinite;
  }

  @keyframes indeterminate {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }

  .error-section {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-min, 14px);
    max-width: 480px;
  }

  .results-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .results-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .results-header h3 {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .timing {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }
</style>
