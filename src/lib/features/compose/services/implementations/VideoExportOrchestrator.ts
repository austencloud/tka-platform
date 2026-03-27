/**
 * Video Export Orchestrator
 *
 * Coordinates frame capture, encoding, and final delivery for MP4/WebM exports.
 *
 * Supports two encoding paths:
 *   1. Background encoder (preferred) — uses a Web Worker with WebCodecs + mp4-muxer
 *      for off-main-thread encoding. Captures ImageData per frame, transfers zero-copy
 *      to the worker, and receives the finished MP4 blob.
 *   2. Inline encoder (fallback) — uses the legacy VideoExporter on the main thread.
 *      Retained for browsers without WebCodecs or when the background encoder is
 *      unavailable.
 */

import {
  VIDEO_EXPORT_FPS,
  VIDEO_INITIAL_CAPTURE_DELAY_MS,
} from "../../shared/domain/constants/timing";
import type { AnimationPanelState } from "../../state/animation-panel-state.svelte";
import type { IFileDownloader } from "$lib/shared/foundation/services/contracts/IFileDownloader";
import type { IAnimationPlaybackController } from "../contracts/IAnimationPlaybackController";
import type { ICanvasRenderer } from "../contracts/ICanvasRenderer";
import type {
  VideoExportFormat,
  VideoExportOrchestratorOptions,
  IVideoExportOrchestrator,
  VideoExportProgress,
  VideoResolution,
  VideoEffectOverrides,
} from "../contracts/IVideoExportOrchestrator";
import type { IVideoExporter } from "../contracts/IVideoExporter";
import type { ICompositeVideoRenderer } from "../contracts/ICompositeVideoRenderer";
import type {
  GlyphAsset,
  IExportGlyphPrerenderer,
} from "../contracts/IExportGlyphPrerenderer";
import type { IBackgroundVideoEncoder } from "../contracts/IBackgroundVideoEncoder";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { fireCacheInvalidation } from "$lib/shared/animation-engine/state/fire-invalidation-signal.svelte";

// ---------------------------------------------------------------------------
// Export dimension & bitrate helpers
// ---------------------------------------------------------------------------

/**
 * Map a target resolution + aspect ratio to concrete pixel dimensions.
 * Ensures both width and height are even (H.264 requirement).
 */
function getExportDimensions(
  resolution: VideoResolution,
  aspectRatio: number
): { width: number; height: number } {
  const heightMap: Record<number, number> = { 720: 720, 1080: 1080, 2160: 2160, 4320: 4320 };
  const height = heightMap[resolution] ?? 1080;
  let width = Math.round(height * aspectRatio);
  // H.264 requires even dimensions
  width = width % 2 === 0 ? width : width + 1;
  return { width, height };
}

/**
 * Auto-scale bitrate based on pixel count and frame rate.
 *
 * Base rates:
 *   - 720p  (921 600 px): 4 Mbps
 *   - 1080p (2 073 600 px): 6 Mbps
 *
 * FPS multipliers:
 *   - <= 30 fps: 1x
 *   - 31-60 fps: 1.33x
 *   - > 60 fps:  2.5x
 */
function calculateBitrate(width: number, height: number, fps: number): number {
  const pixels = width * height;
  const base =
    pixels <= 1280 * 720 ? 4_000_000 :
    pixels <= 1920 * 1080 ? 6_000_000 :
    pixels <= 3840 * 2160 ? 20_000_000 :
    50_000_000;
  const fpsMultiplier = fps <= 30 ? 1 : fps <= 60 ? 1.33 : 2.5;
  return Math.round(base * fpsMultiplier);
}

export class VideoExportOrchestrator implements IVideoExportOrchestrator {
  private _isExporting = false;
  private shouldCancel = false;

  constructor(
    private readonly VideoExporter: IVideoExporter,
    private readonly canvasRenderer: ICanvasRenderer,
    private readonly fileDownloadService: IFileDownloader,
    private readonly compositeRenderer: ICompositeVideoRenderer,
    private readonly glyphPrerenderer: IExportGlyphPrerenderer,
    private readonly backgroundEncoder: IBackgroundVideoEncoder
  ) {}

  async executeExport(
    canvas: HTMLCanvasElement,
    playbackController: IAnimationPlaybackController,
    panelState: AnimationPanelState,
    onProgress: (progress: VideoExportProgress) => void,
    options: VideoExportOrchestratorOptions = {}
  ): Promise<Blob> {
    if (this._isExporting) {
      throw new Error("Export already in progress");
    }

    this._isExporting = true;
    this.shouldCancel = false;

    // MP4 is the default format
    const exportFormat: VideoExportFormat = options.format ?? "mp4";
    const useBackgroundEncoder = exportFormat === "mp4";
    const filename = this.resolveFilename(
      options.filename,
      panelState.sequenceWord,
      exportFormat
    );

    // Check visibility settings early to calculate output dimensions
    const visibilityManager = getAnimationVisibilityManager();
    const showWordHeader = visibilityManager.getVisibility("wordHeader");
    const showProgressBar = visibilityManager.getVisibility("progressBar");
    const headerHeight = showWordHeader
      ? this.canvasRenderer.getHeaderHeight(canvas.width)
      : 0;
    const progressBarHeight = showProgressBar
      ? this.canvasRenderer.getProgressBarHeight(canvas.width)
      : 0;

    // Resolve FPS early — used by both encoder paths and frame calculations
    const fps = options.fps ?? VIDEO_EXPORT_FPS;

    // Calculate source dimensions from the live canvas (includes header + progress bar)
    const sourceWidth = Math.round(canvas.width);
    const sourceHeight = Math.round(
      canvas.height + headerHeight + progressBarHeight
    );

    if (sourceWidth === 0 || sourceHeight === 0) {
      throw new Error(
        `Cannot export: canvas has zero dimensions (${canvas.width}x${canvas.height}). ` +
        "Wait for the animation to load before exporting."
      );
    }

    // Determine final encode dimensions. When a resolution is specified,
    // scale to the target height while preserving the aspect ratio of the
    // source canvas. Otherwise, encode at source size.
    let outputWidth: number;
    let outputHeight: number;

    if (options.resolution) {
      const aspectRatio = sourceWidth / sourceHeight;
      const dims = getExportDimensions(options.resolution, aspectRatio);
      outputWidth = dims.width;
      outputHeight = dims.height;
    } else {
      outputWidth = sourceWidth;
      outputHeight = sourceHeight;
    }

    // ---------------------------------------------------------------------------
    // Encoder setup — background (MP4) vs inline (WebM fallback)
    // ---------------------------------------------------------------------------
    let inlineExporter: {
      addFrame: (c: HTMLCanvasElement) => Promise<void>;
      finish: () => Promise<Blob>;
      cancel: () => void;
    } | null = null;

    if (useBackgroundEncoder) {
      const bitrate = calculateBitrate(outputWidth, outputHeight, fps);

      // Calculate total frames early so the worker can allocate its muxer.
      // Must match the capture loop: optional start position + steps + optional end hold.
      const earlySteps = panelState.sequenceData?.steps ?? [];
      const earlyStepDuration = earlySteps.length > 0
        ? earlySteps.reduce((sum, s) => sum + (s.duration ?? 1), 0)
        : panelState.totalSteps;
      const earlyStartDur = (options.includeAnimationStartPosition ?? true) ? 1 : 0;
      const earlyIsLoopable = playbackController.isSeamlesslyLoopable;
      const earlyEndDur = (options.includeEndHold ?? !earlyIsLoopable) ? 1 : 0;
      const earlyTotalDuration = earlyStartDur + earlyStepDuration + earlyEndDur;
      const secondsPerBeat = 1.0 / panelState.speed;
      const singleLoopDurationSeconds = earlyTotalDuration * secondsPerBeat;
      const framesPerLoop = Math.ceil(singleLoopDurationSeconds * fps);
      const loopCount = options.loopCount ?? panelState.exportLoopCount ?? 1;
      const totalFramesEstimate = framesPerLoop * loopCount;

      // Wire progress from worker — only used during the finalize phase.
      // During capture, the main loop reports its own progress; the worker
      // encodes frames concurrently but we don't surface that to the UI
      // to avoid rapid "capturing"/"encoding" flicker.
      this.backgroundEncoder.onProgress = () => {
        // Progress is reported by the capture loop during capture phase.
        // After capture completes, the finalize section below sets stage
        // to "encoding" once and the worker's "complete" message ends it.
      };

      await this.backgroundEncoder.initialize({
        width: outputWidth,
        height: outputHeight,
        fps,
        bitrate,
        totalFrames: totalFramesEstimate,
      });
    } else {
      // Legacy inline exporter for WebM
      inlineExporter = await this.VideoExporter.createManualExporter(
        outputWidth,
        outputHeight,
        {
          format: exportFormat as "webm" | "mp4",
          fps,
          filename,
          autoDownload: false,
        }
      );
    }

    const captureState = {
      wasPlaying: panelState.isPlaying,
      beat: panelState.currentStep,
    };

    // Save and apply effect overrides for export
    const savedEffectState = this.applyEffectOverrides(
      visibilityManager,
      options.effectOverrides
    );

    try {
      onProgress({ progress: 0, stage: "capturing" });

      if (captureState.wasPlaying) {
        playbackController.togglePlayback();
      }
      playbackController.jumpToStep(0);

      // Invalidate the fire frame cache BEFORE clearing canvases. The cache
      // may be "warm" from normal playback and would blit stale fire frames
      // during frame-by-frame export instead of running fresh simulation.
      fireCacheInvalidation.trigger();

      // Clear all overlay canvases (trails, fire, charcoal, LED) so residual
      // effects from the user's previous playback don't bleed into frame 1.
      const container = canvas.parentElement;
      if (container) {
        for (const overlay of container.querySelectorAll("canvas")) {
          if (overlay === canvas) continue;
          const ctx = overlay.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, overlay.width, overlay.height);
          } else {
            // WebGL canvas — resize trick forces clear
            const w = overlay.width;
            overlay.width = 0;
            overlay.width = w;
          }
        }
      }

      await this.delay(VIDEO_INITIAL_CAPTURE_DELAY_MS);

      // If effect overrides were applied, wait for the DOM to stabilize.
      // Toggling fire/LED/trails can trigger Svelte re-renders that
      // temporarily destroy and recreate canvas elements.
      if (savedEffectState) {
        await this.waitForAnimationFrame();
        await this.waitForAnimationFrame();
        await this.waitForAnimationFrame();
      }

      // Build step durations array — each step's relative duration (default 1)
      const steps = panelState.sequenceData?.steps ?? [];
      const stepDurations = steps.map((s) => s.duration ?? 1);
      const totalDurationUnits = stepDurations.reduce((sum, d) => sum + d, 0) || panelState.totalSteps;

      // Include optional start position (1 beat) and end hold for non-looping sequences.
      // The animation engine uses beat 0 = start position, beat 1+ = motion steps.
      // Without accounting for this, the exported glyph overlay is one beat ahead
      // of the animation, and the end position is cut off abruptly.
      const startPositionDuration = (options.includeAnimationStartPosition ?? true) ? 1 : 0;
      const isLoopable = playbackController.isSeamlesslyLoopable;
      const endPositionHoldDuration = (options.includeEndHold ?? !isLoopable) ? 1 : 0;
      const totalDurationWithHolds = startPositionDuration + totalDurationUnits + endPositionHoldDuration;

      // Calculate effective duration at user's BPM/speed
      // At speed=1.0 (60 BPM): 1 second per beat unit
      // At speed=2.0 (120 BPM): 0.5 seconds per beat unit
      const secondsPerBeatUnit = 1.0 / panelState.speed;
      const singleLoopDurationSeconds = totalDurationWithHolds * secondsPerBeatUnit;

      const framesPerLoop = Math.ceil(singleLoopDurationSeconds * fps);

      // Apply loop count for circular sequences
      // Prefer options.loopCount if provided, otherwise use panelState.exportLoopCount
      const loopCount = options.loopCount ?? panelState.exportLoopCount ?? 1;
      const totalFrames = framesPerLoop * loopCount;

      // Build cumulative duration breakpoints for time-to-beat mapping
      // This allows steps with different durations to occupy proportional time
      const cumulativeDurations: number[] = [];
      let cumulative = 0;
      for (const d of stepDurations) {
        cumulativeDurations.push(cumulative);
        cumulative += d;
      }

      // Keyframe interval — emit a keyframe every 2 seconds for seekability
      const keyframeInterval = fps * 2;

      // Check if composite mode is enabled
      const isCompositeMode =
        options.compositeMode && options.compositeMode !== "none";

      // Initialize composite renderer if in composite mode
      if (isCompositeMode) {
        if (!panelState.sequenceData) {
          throw new Error("Sequence data is required for composite mode");
        }
        await this.compositeRenderer.initialize(panelState.sequenceData, {
          orientation: options.compositeMode as "horizontal" | "vertical",
          gridStepSize: options.gridStepSize ?? 120,
          includeStartPosition: options.includeStartPosition ?? false,
          showStepNumbers: options.showStepNumbers ?? true,
        });
        await this.compositeRenderer.cacheStaticGrid();
      }

      // Use the source dimensions captured at export start, NOT live canvas.width.
      // On mobile, the canvas can resize mid-export when UI layout shifts (e.g.,
      // export panel appearing). Using the snapshot avoids size mismatches.
      const actualCanvasSize = sourceWidth;

      // Get additional visibility settings (showWordHeader already checked above)
      const showTkaGlyph = visibilityManager.getVisibility("tkaGlyph");
      const showStepNumbers = visibilityManager.getVisibility("stepNumbers");
      const isDarkMode = visibilityManager.isDarkMode();

      // Pre-render complete glyphs (letter + dash + turns column) before the frame loop
      if (showTkaGlyph && steps.length > 0) {
        await this.glyphPrerenderer.prerenderGlyphs(steps, isDarkMode);
      }

      // Create offscreen canvas for compositing (so we don't touch the visible canvas).
      // For the background encoder we render at source resolution here, then scale
      // down to export resolution when extracting ImageData for the worker.
      const offscreenCanvas = document.createElement("canvas");

      // Set canvas dimensions based on mode
      if (isCompositeMode) {
        const compositeDims = this.compositeRenderer.getCompositeDimensions();
        offscreenCanvas.width = compositeDims.width;
        offscreenCanvas.height = compositeDims.height;
      } else {
        offscreenCanvas.width = sourceWidth;
        offscreenCanvas.height = sourceHeight;
      }
      const offscreenCtx = offscreenCanvas.getContext("2d", {
        willReadFrequently: useBackgroundEncoder,
      });

      if (!offscreenCtx) {
        throw new Error("Failed to create offscreen canvas context");
      }

      // When the export resolution differs from the source, create a second
      // canvas to downscale/upscale before extracting the frame.
      const needsResize =
        offscreenCanvas.width !== outputWidth ||
        offscreenCanvas.height !== outputHeight;
      let resizeCanvas: HTMLCanvasElement | null = null;
      let resizeCtx: CanvasRenderingContext2D | null = null;

      if (needsResize) {
        resizeCanvas = document.createElement("canvas");
        resizeCanvas.width = outputWidth;
        resizeCanvas.height = outputHeight;
        resizeCtx = resizeCanvas.getContext("2d", {
          willReadFrequently: useBackgroundEncoder,
        });
      }

      // Track the current glyph cache key for crossfade detection
      let currentCacheKey = "";
      let currentGlyph: GlyphAsset | null = null;
      let currentStepNumber: number | null = null;

      // Track previous frame's glyph and beat number for crossfade
      let previousGlyph: GlyphAsset | null = null;
      let previousStepNumber: number | null = null;

      // Crossfade configuration (matches GlyphOverlay.svelte)
      const CROSSFADE_DURATION_MS = 200;
      const crossfadeDurationFrames = Math.ceil(
        (CROSSFADE_DURATION_MS / 1000) * fps
      );
      let framesSinceTransition = 0;

      // Frame duration in microseconds for WebCodecs timestamps
      const frameDurationMicros = Math.round(1_000_000 / fps);

      for (let i = 0; i < totalFrames; i++) {
        if (this.shouldCancel) {
          throw new Error("Export cancelled");
        }

        // Calculate beat position for this frame using duration-weighted mapping.
        // The timeline includes: optional start position + motion steps + optional end hold.
        // The animation engine uses beat 0 = start position, beat 1+ = motion steps.
        // Using calculateStateForBeat instead of jumpToStep because jumpToStep
        // clamps at totalSteps, which truncates the last step's fractional progress.
        const frameInLoop = i % framesPerLoop;
        const timeProgress = (frameInLoop / framesPerLoop) * totalDurationWithHolds;

        let beat: number;
        let stepIndex: number;
        let isInStartPosition = false;
        let isInEndHold = false;

        if (startPositionDuration > 0 && timeProgress < startPositionDuration) {
          // Start position phase — show initial pose, no glyph
          beat = timeProgress / startPositionDuration;
          stepIndex = -1;
          isInStartPosition = true;
          playbackController.calculateStateForBeat(beat);
        } else if (endPositionHoldDuration > 0 && timeProgress >= startPositionDuration + totalDurationUnits) {
          // End position hold — freeze on the completed last motion step
          beat = steps.length + 1;
          stepIndex = steps.length - 1;
          isInEndHold = true;
          playbackController.calculateStateForBeat(beat);
        } else {
          // Motion steps phase — map time to step index, offset by +1 for the
          // animation engine's beat convention (beat 0 = start, 1+ = motion)
          const motionTime = timeProgress - startPositionDuration;
          const rawBeat = this.timeToBeat(motionTime, cumulativeDurations, stepDurations);
          stepIndex = Math.floor(rawBeat);
          beat = rawBeat + 1;
          playbackController.calculateStateForBeat(beat);
        }

        // Wait for the UI + canvas to render the new beat
        await this.waitForAnimationFrame();
        await this.waitForAnimationFrame();

        // Guard: if the live canvas temporarily lost dimensions (Svelte re-render
        // or PixiJS resize), wait for recovery. If it doesn't recover, skip
        // rendering this frame — the offscreen canvas still holds the previous
        // frame's content, so the encoder will duplicate it (brief freeze in
        // the video, much better than aborting the entire export).
        let canvasAvailable = canvas.width > 0 && canvas.height > 0;
        if (!canvasAvailable) {
          for (let retry = 0; retry < 30; retry++) {
            await this.waitForAnimationFrame();
            if (canvas.width > 0 && canvas.height > 0) {
              canvasAvailable = true;
              break;
            }
          }
        }

        // Render frame to offscreen canvas (only if live canvas is available).
        // When the canvas is temporarily unavailable, the offscreen canvas keeps
        // its previous content, producing a duplicated frame in the video.
        if (canvasAvailable) {
          if (isCompositeMode) {
            // Composite mode: render animation + grid + beat highlight
            const compositeStepIndex = isInStartPosition ? 0 : Math.max(0, stepIndex);
            this.compositeRenderer.renderCompositeFrame(
              canvas,
              compositeStepIndex,
              offscreenCanvas
            );
          } else {
            // Normal mode: copy the live canvas to the offscreen canvas (preserves visible animation)
            offscreenCtx.clearRect(
              0,
              0,
              offscreenCanvas.width,
              offscreenCanvas.height
            );

            // Animation content goes below header (and above progress bar)
            const canvasY = headerHeight > 0 ? headerHeight : 0;

            // Use 9-arg drawImage to handle canvas resize during export.
            // On mobile, UI layout shifts (export panel appearing) can shrink the
            // canvas container mid-export. The 9-arg form scales the current canvas
            // content to fill the expected area regardless of its current backing size.
            offscreenCtx.drawImage(
              canvas,
              0, 0, canvas.width, canvas.height,          // source: full current canvas
              0, canvasY, sourceWidth, sourceWidth          // dest: fill expected square area
            );

            // Composite WebGL overlay canvases (fire, charcoal sparks, LED effects)
            // These are sibling canvases in the same container, layered via z-index
            const container = canvas.parentElement;
            if (container) {
              const overlayCanvases = container.querySelectorAll("canvas");
              for (const overlay of overlayCanvases) {
                if (overlay === canvas) continue; // Skip the main canvas
                if (overlay.width === 0 || overlay.height === 0) continue; // Skip uninitialized
                offscreenCtx.drawImage(
                  overlay,
                  0, 0, overlay.width, overlay.height,    // source: full overlay
                  0, canvasY, sourceWidth, sourceWidth      // dest: same target area
                );
              }
            }
          }

          // Use the stepIndex calculated above (already accounts for start position offset).
          // During start position, stepIndex is -1 so no glyph or beat number is shown.
          const clampedStepIndex = Math.max(
            0,
            Math.min(stepIndex, steps.length - 1)
          );

          // Calculate beat number for display (1-indexed, null during start position)
          const stepNumber = isInStartPosition ? null : clampedStepIndex + 1;

          // Use cache key for glyph transition detection (includes letter + turns + colors).
          // During start position (stepIndex === -1), no glyph should be shown.
          const cacheKey = isInStartPosition
            ? ""
            : this.glyphPrerenderer.getCacheKeyForStep(clampedStepIndex);

          // Detect transitions (cache key or beat number changed)
          const glyphChanged = cacheKey !== currentCacheKey;
          const beatNumberChanged = stepNumber !== currentStepNumber;
          const transitionDetected = glyphChanged || beatNumberChanged;

          if (transitionDetected) {
            // Store previous state for crossfade
            previousGlyph = currentGlyph;
            previousStepNumber = currentStepNumber;

            // Update current state
            currentCacheKey = cacheKey;
            currentStepNumber = stepNumber;

            if (glyphChanged) {
              currentGlyph = cacheKey
                ? this.glyphPrerenderer.getGlyph(cacheKey)
                : null;
            }

            // Reset crossfade counter
            framesSinceTransition = 0;
          }

          // Calculate crossfade opacities (linear fade over 200ms)
          const inCrossfade = framesSinceTransition < crossfadeDurationFrames;
          const fadeProgress = inCrossfade
            ? framesSinceTransition / crossfadeDurationFrames
            : 1;

          const fadeOutOpacity = Math.max(0, 1 - fadeProgress); // 1 → 0
          const fadeInOpacity = Math.min(1, fadeProgress); // 0 → 1

          // Apply translation offset for header when rendering overlays
          if (headerHeight > 0 && !isCompositeMode) {
            offscreenCtx.save();
            offscreenCtx.translate(0, headerHeight);
          }

          // Render TKA glyph if enabled (pre-rendered includes letter + dash + turns)
          // Dark mode is already baked into the pre-rendered image — no ctx.filter needed
          if (showTkaGlyph) {
            // Render fading-out glyph (if in crossfade and previous exists)
            if (inCrossfade && previousGlyph?.image && fadeOutOpacity > 0) {
              this.drawPrerenderedGlyph(
                offscreenCtx,
                actualCanvasSize,
                previousGlyph,
                fadeOutOpacity
              );
            }

            // Render fading-in glyph (current glyph)
            if (currentGlyph?.image) {
              const opacity = inCrossfade ? fadeInOpacity : 1;
              this.drawPrerenderedGlyph(
                offscreenCtx,
                actualCanvasSize,
                currentGlyph,
                opacity
              );
            }
          }

          // Render beat numbers if enabled
          if (showStepNumbers) {
            // Render fading-out beat number (if in crossfade and previous exists)
            if (
              inCrossfade &&
              previousStepNumber !== null &&
              fadeOutOpacity > 0
            ) {
              this.canvasRenderer.renderStepNumberToCanvas(
                offscreenCtx,
                actualCanvasSize,
                previousStepNumber,
                fadeOutOpacity,
                isDarkMode
              );
            }

            // Render fading-in beat number (current beat number)
            if (currentStepNumber !== null) {
              const opacity = inCrossfade ? fadeInOpacity : 1;
              this.canvasRenderer.renderStepNumberToCanvas(
                offscreenCtx,
                actualCanvasSize,
                currentStepNumber,
                opacity,
                isDarkMode
              );
            }
          }

          // Restore context if we applied header offset
          if (headerHeight > 0 && !isCompositeMode) {
            offscreenCtx.restore();
          }

          // Render word header if enabled (at top of canvas, no offset)
          // Pass activeStepNumber for letter highlighting
          if (showWordHeader) {
            const activeStepNumber = stepNumber;
            this.canvasRenderer.renderWordHeaderToCanvas(
              offscreenCtx,
              actualCanvasSize,
              panelState.sequenceWord,
              isDarkMode,
              activeStepNumber
            );
          }

          // Render progress bar if enabled (below canvas area).
          // The progress bar expects a 0-based step index float.
          if (showProgressBar && !isCompositeMode) {
            const progressBarY = headerHeight + canvas.height;
            const progressBeat = isInStartPosition
              ? 0
              : isInEndHold
                ? steps.length
                : (beat - 1); // Undo the +1 offset to get 0-based step index
            this.canvasRenderer.renderProgressBarToCanvas(
              offscreenCtx,
              actualCanvasSize,
              progressBarY,
              steps.length,
              progressBeat,
              stepDurations,
              isDarkMode
            );
          }
        }

        // -----------------------------------------------------------------------
        // Capture frame — background encoder vs inline exporter
        // -----------------------------------------------------------------------
        if (useBackgroundEncoder) {
          // Extract ImageData, optionally resizing to export resolution first
          let frameData: ImageData;

          if (needsResize && resizeCtx && resizeCanvas) {
            resizeCtx.clearRect(0, 0, outputWidth, outputHeight);
            resizeCtx.drawImage(
              offscreenCanvas,
              0,
              0,
              outputWidth,
              outputHeight
            );
            frameData = resizeCtx.getImageData(0, 0, outputWidth, outputHeight);
          } else {
            frameData = offscreenCtx.getImageData(
              0,
              0,
              offscreenCanvas.width,
              offscreenCanvas.height
            );
          }

          const timestampMicros = i * frameDurationMicros;
          const isKeyframe = i % keyframeInterval === 0;

          // Transfer the buffer zero-copy to the worker
          this.backgroundEncoder.addFrame(
            frameData,
            i,
            timestampMicros,
            isKeyframe
          );
        } else if (inlineExporter) {
          // Legacy path: capture from the (possibly resized) canvas
          if (needsResize && resizeCtx && resizeCanvas) {
            resizeCtx.clearRect(0, 0, outputWidth, outputHeight);
            resizeCtx.drawImage(
              offscreenCanvas,
              0,
              0,
              outputWidth,
              outputHeight
            );
            await inlineExporter.addFrame(resizeCanvas);
          } else {
            await inlineExporter.addFrame(offscreenCanvas);
          }
        }

        // Increment crossfade frame counter
        framesSinceTransition++;

        onProgress({
          progress: (i + 1) / totalFrames,
          stage: "capturing",
          currentFrame: i + 1,
          totalFrames,
        });
      }

      if (this.shouldCancel) {
        throw new Error("Export cancelled");
      }

      // -----------------------------------------------------------------------
      // Finalize — flush encoder and download
      // -----------------------------------------------------------------------
      onProgress({ progress: 0, stage: "encoding" });

      let outputBlob: Blob;

      if (useBackgroundEncoder) {
        outputBlob = await this.backgroundEncoder.finish();
      } else if (inlineExporter) {
        outputBlob = await inlineExporter.finish();
      } else {
        throw new Error("No encoder was initialized");
      }

      await this.fileDownloadService.downloadBlob(outputBlob, filename);

      onProgress({ progress: 1, stage: "complete" });

      return outputBlob;
    } catch (error) {
      // Don't log cancellation as an error - it's intentional user action
      if (!this.shouldCancel) {
        console.error("Export failed:", error);
        onProgress({
          progress: 0,
          stage: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      throw error;
    } finally {
      this.restoreEffectState(visibilityManager, savedEffectState);
      this.restorePlaybackState(playbackController, captureState);
      this._isExporting = false;
      this.shouldCancel = false;
      this.glyphPrerenderer.clear();
      this.backgroundEncoder.onProgress = null;

      // Clean up composite renderer if it was used
      if (options.compositeMode && options.compositeMode !== "none") {
        this.compositeRenderer.dispose();
      }

      // Invalidate fire frame cache — the frame-by-frame jumpToStep capture
      // desyncs the cached fire simulation from the actual animation position.
      fireCacheInvalidation.trigger();

      // Let callers reset additional transient state if needed.
      options.onCleanup?.();
    }
  }

  cancelExport(): void {
    this.shouldCancel = true;
    this.backgroundEncoder.cancel();
    this.VideoExporter.cancelExport();
    this._isExporting = false;
  }

  isExporting(): boolean {
    return this._isExporting;
  }

  private restorePlaybackState(
    playbackController: IAnimationPlaybackController,
    snapshot: { wasPlaying: boolean; beat: number }
  ): void {
    playbackController.jumpToStep(snapshot.beat);
    if (snapshot.wasPlaying) {
      playbackController.togglePlayback();
    }
  }

  private resolveFilename(
    explicitFilename: string | undefined,
    sequenceWord: string | null,
    format: VideoExportFormat
  ): string {
    if (explicitFilename) {
      return explicitFilename;
    }

    const baseName = sequenceWord || "animation";
    // Map format to file extension
    const extensionMap: Record<VideoExportFormat, string> = {
      webm: "webm",
      mp4: "mp4",
    };
    const extension = extensionMap[format] || "mp4";
    return this.fileDownloadService.generateTimestampedFilename(
      baseName,
      extension
    );
  }

  /**
   * Get the beat number for a specific frame
   * Matches the logic in AnimatorCanvas.svelte's stepNumber derived
   * Beat numbers are 1-indexed (steps[0] = beat 1, steps[1] = beat 2, etc.)
   */
  private getStepNumberForFrame(
    beat: number,
    panelState: AnimationPanelState
  ): number | null {
    if (!panelState.sequenceData?.steps) {
      return null;
    }

    // Calculate which beat index we're showing
    const stepIndex = Math.floor(beat);
    const clampedIndex = Math.max(
      0,
      Math.min(stepIndex, panelState.sequenceData.steps.length - 1)
    );

    // Beat numbers are 1-indexed
    return clampedIndex + 1;
  }

  /**
   * Draw a pre-rendered composite glyph (letter + dash + turns column) onto the canvas.
   * Position matches the standard glyph origin: x=50, y=800 in 950px viewBox,
   * adjusted upward by yOffset to accommodate top turn numbers.
   */
  private drawPrerenderedGlyph(
    ctx: CanvasRenderingContext2D,
    canvasSize: number,
    glyph: GlyphAsset,
    opacity: number
  ): void {
    const gridScaleFactor = canvasSize / 950;

    // Position at standard glyph origin, shifted up by yOffset for turn numbers
    const x = 50 * gridScaleFactor;
    const y = (800 - glyph.yOffset) * gridScaleFactor;

    const scaledWidth = glyph.dimensions.width * gridScaleFactor;
    const scaledHeight = glyph.dimensions.height * gridScaleFactor;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(glyph.image, x, y, scaledWidth, scaledHeight);
    ctx.restore();
  }

  /**
   * Convert a time position (in duration units) to a beat position (float).
   * Accounts for variable step durations so that longer steps occupy
   * proportionally more frames in the exported video.
   */
  private timeToBeat(
    timeProgress: number,
    cumulativeDurations: number[],
    stepDurations: number[]
  ): number {
    const stepCount = stepDurations.length;
    if (stepCount === 0) return 0;

    // Find which step the time position falls within
    for (let i = stepCount - 1; i >= 0; i--) {
      if (timeProgress >= cumulativeDurations[i]!) {
        const elapsed = timeProgress - cumulativeDurations[i]!;
        const stepDur = stepDurations[i]!;
        const fraction = stepDur > 0 ? Math.min(1, elapsed / stepDur) : 0;
        return i + fraction;
      }
    }

    return 0;
  }

  /**
   * Save current effect state and apply overrides for export.
   * Returns the saved state for restoration after export.
   */
  private applyEffectOverrides(
    visibilityManager: ReturnType<typeof getAnimationVisibilityManager>,
    overrides?: VideoEffectOverrides
  ): { fire: boolean; led: boolean; trails: boolean; charcoal: boolean } | null {
    if (!overrides) return null;

    const saved = {
      fire: visibilityManager.isFireEffectEnabled(),
      led: visibilityManager.isLedEffectEnabled(),
      trails: visibilityManager.isTrailsVisible(),
      charcoal: visibilityManager.isCharcoalEffectEnabled(),
    };

    if (overrides.fire !== undefined) {
      visibilityManager.setFireEffect(overrides.fire);
    }
    if (overrides.led !== undefined) {
      visibilityManager.setLedEffect(overrides.led);
    }
    if (overrides.trails !== undefined) {
      visibilityManager.setTrailStyle(overrides.trails ? "on" : "off");
    }
    if (overrides.charcoal !== undefined) {
      visibilityManager.setCharcoalEffect(overrides.charcoal);
    }

    return saved;
  }

  /**
   * Restore effect state after export completes.
   */
  private restoreEffectState(
    visibilityManager: ReturnType<typeof getAnimationVisibilityManager>,
    saved: { fire: boolean; led: boolean; trails: boolean; charcoal: boolean } | null
  ): void {
    if (!saved) return;

    visibilityManager.setFireEffect(saved.fire);
    visibilityManager.setLedEffect(saved.led);
    visibilityManager.setTrailStyle(saved.trails ? "on" : "off");
    visibilityManager.setCharcoalEffect(saved.charcoal);
  }

  private waitForAnimationFrame(): Promise<void> {
    if (typeof window === "undefined") {
      return Promise.resolve();
    }

    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
