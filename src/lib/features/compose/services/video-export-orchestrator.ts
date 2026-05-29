/**
 * Video Export Orchestrator
 *
 * Coordinates frame capture, encoding, and final delivery for MP4/WebM exports.
 *
 * Supports two encoding paths:
 *   1. Background encoder (preferred) - uses a Web Worker with WebCodecs + mediabunny
 *      for off-main-thread encoding. Captures ImageData per frame, transfers zero-copy
 *      to the worker, and receives the finished MP4 blob.
 *   2. Inline encoder (fallback) - uses the legacy VideoExporter on the main thread.
 *      Retained for browsers without WebCodecs or when the background encoder is
 *      unavailable.
 */

import {
  VIDEO_EXPORT_FPS,
  VIDEO_INITIAL_CAPTURE_DELAY_MS,
} from "$lib/shared/animation-engine/domain/constants/timing";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import {
  downloadBlob,
  generateTimestampedFilename,
} from "$lib/shared/foundation/services/file-downloader";
import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
import {
  getHeaderHeight,
  getProgressBarHeight,
} from "./canvas-renderer";
import type { VideoExporter } from "$lib/shared/animation-engine/services/video-exporter";
import type { CompositeVideoRenderer } from "$lib/shared/animation-engine/services/composite-video-renderer";
import type { ExportGlyphPrerenderer } from "$lib/shared/animation-engine/services/export-glyph-prerenderer";
import { ExportFrameCompositor, type FrameCompositorConfig } from "./export-frame-compositor";
import { getRenderContextRegistry } from "$lib/shared/animation-engine/getRenderContextRegistry";
import type { RenderContext } from "$lib/shared/animation-engine/services/render-context-registry";

import type { VideoExportFormat, VideoExportProgress, VideoEffectOverrides, IVideoExportOrchestrator, VideoExportOrchestratorOptions } from "$lib/shared/compose/domain/video-export-types";
export type { VideoExportFormat, VideoExportProgress, VideoResolution, VideoEffectOverrides, VideoExportOrchestratorOptions } from "$lib/shared/compose/domain/video-export-types";
import type { BackgroundVideoEncoder } from "$lib/shared/animation-engine/services/background-video-encoder";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { fireCacheInvalidation } from "$lib/shared/animation-engine/state/fire-invalidation-signal.svelte";
import { getExportDimensions, calculateBitrate } from "$lib/shared/animation-engine/domain/video-export-calculations";
import { calculateDifficultyLevel as calculateSequenceDifficultyLevel } from "$lib/shared/browse/services/sequence-difficulty-calculator";
import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";
import type { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { greekToAscii } from "$lib/shared/create/domain/spell-constants";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import type { TipEffectMap } from '$lib/shared/animation-engine/domain/types/TipEffectTypes';

export class VideoExportOrchestrator implements IVideoExportOrchestrator {
  private _isExporting = false;
  private shouldCancel = false;

  constructor(
    private readonly VideoExporter: VideoExporter,
    private readonly compositeRenderer: CompositeVideoRenderer,
    private readonly glyphPrerenderer: ExportGlyphPrerenderer,
    private readonly backgroundEncoder: BackgroundVideoEncoder
  ) {}

  async executeExport(
    canvas: HTMLCanvasElement,
    playbackController: AnimationPlaybackController,
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
      panelState,
      exportFormat
    );

    // Check visibility settings early to calculate output dimensions
    const visibilityManager = getAnimationVisibilityManager();
    const showWordHeader = visibilityManager.getVisibility("wordHeader");
    const showProgressBar = visibilityManager.getVisibility("progressBar");
    // Header/progress bar heights at SOURCE resolution - used only for
    // aspect ratio calculation so the output dimensions stay correct.
    const srcHeaderHeight = showWordHeader
      ? getHeaderHeight(canvas.width)
      : 0;
    const srcProgressBarHeight = showProgressBar
      ? getProgressBarHeight(canvas.width)
      : 0;

    // Compute header overlays (difficulty badge + LOOP icon strip) once per export.
    // Matches AnimatorCanvas.svelte:330-358 derivation so the exported video's
    // word header mirrors the live canvas.
    const difficultyLevel = panelState.sequenceData
      ? calculateSequenceDifficultyLevel([
          ...(panelState.sequenceData.steps ?? []),
        ])
      : null;

    // Resolve once per export: both the component set (for the icon strip)
    // and the rotation slice size (so quartered LOOPs render with fa-arrows-spin
    // in the exported video header, matching the live preview).
    const loopDisplayForExport = (() => {
      const seq = panelState.sequenceData;
      if (!seq) return null;
      try {
        return resolveLoopDisplay(seq);
      } catch {
        return null;
      }
    })();

    const loopComponents: Set<string> | null =
      loopDisplayForExport && loopDisplayForExport.components.size > 0
        ? (loopDisplayForExport.components as unknown as Set<string>)
        : null;

    const rotationPeriod: Period | undefined =
      loopDisplayForExport?.rotationPeriod;
    const inversionPeriod: Period | undefined =
      loopDisplayForExport?.inversionPeriod;
    const loopPeriod: number | undefined =
      loopDisplayForExport?.period;

    // Resolve FPS early - used by both encoder paths and frame calculations
    const fps = options.fps ?? VIDEO_EXPORT_FPS;

    // Calculate source dimensions from the live canvas (includes header + progress bar)
    const sourceWidth = Math.round(canvas.width);
    const sourceHeight = Math.round(
      canvas.width + srcHeaderHeight + srcProgressBarHeight
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
    // Encoder setup - background (MP4) vs inline (WebM fallback)
    // ---------------------------------------------------------------------------
    let inlineExporter: {
      addFrame: (c: HTMLCanvasElement) => Promise<void>;
      finish: () => Promise<Blob>;
      cancel: () => void;
    } | null = null;

    if (useBackgroundEncoder) {
      const bitrate = calculateBitrate(outputWidth, outputHeight, fps);

      // Calculate total frames early so the worker can allocate its muxer.
      // Must match the capture loop: one start position + (motion × loopCount) + one end hold.
      // The start position plays once at the very beginning and the end hold plays once
      // at the very end; only the motion steps repeat for each additional loop.
      const earlySteps = panelState.sequenceData?.steps ?? [];
      const earlyStepDuration = earlySteps.length > 0
        ? earlySteps.reduce((sum, s) => sum + (s.duration ?? 1), 0)
        : panelState.totalSteps;
      const earlyStartDur = (options.includeAnimationStartPosition ?? true) ? 1 : 0;
      const earlyIsLoopable = playbackController.isSeamlesslyLoopable;
      const earlyEndDur = (options.includeEndHold ?? !earlyIsLoopable) ? 1 : 0;
      const earlyLoopCount = options.loopCount ?? panelState.exportLoopCount ?? 1;
      const earlyTotalDuration =
        earlyStartDur + earlyStepDuration * earlyLoopCount + earlyEndDur;
      const secondsPerBeat = 1.0 / panelState.speed;
      const totalTimelineSeconds = earlyTotalDuration * secondsPerBeat;
      const totalFramesEstimate = Math.ceil(totalTimelineSeconds * fps);

      // Wire progress from worker - only used during the finalize phase.
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
      step: panelState.currentStep,
    };

    // Save and apply effect overrides for export
    const savedEffectState = this.applyEffectOverrides(
      visibilityManager,
      options.effectOverrides
    );

    // Non-composite export captures the LIVE rendering context (the warm engine
    // that produces the on-screen preview). Resized to output res for the
    // duration of the export, restored in finally. Declared at method scope so
    // the finally block can restore it.
    let liveContext: RenderContext | null = null;

    try {
      onProgress({ progress: 0, stage: "capturing" });

      if (captureState.wasPlaying) {
        playbackController.togglePlayback();
      }
      playbackController.jumpToStep(0);

      // Enable fire renderer diagnostics
      const fireDiag = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>).__tka_fire_diag as { enable(): void; reset(): void; disable(): void } | undefined : undefined;
      if (fireDiag) {
        fireDiag.enable();
      }

      // Clear fire/charcoal simulation FBOs, display canvas, and frame cache.
      fireCacheInvalidation.trigger();
      await this.waitForAnimationFrame();
      await this.waitForAnimationFrame();

      // Navier-Stokes fluid simulation needs ~60 frames to converge from
      // zeroed state. Without warmup, the pressure field is unresolved and
      // produces concentric ring artifacts. Run a short warmup at step 0
      // so the simulation reaches steady state before capture begins.
      const ecs = visibilityManager.effectsConfigState;
      const tipMap = ecs?.tipEffectMap ?? {};
      const hasEffectInMap = (effect: string) => Object.values(tipMap).some(a => a.effect === effect);
      const needsFluidWarmup =
        hasEffectInMap("fire") ||
        hasEffectInMap("charcoal");
      if (needsFluidWarmup) {
        const WARMUP_FRAMES = 60;
        for (let w = 0; w < WARMUP_FRAMES; w++) {
          playbackController.calculateStateForStep(0);
          await this.waitForAnimationFrame();
        }
        // Clear accumulated thermal energy from warmup (60 frames of fuel at
        // stationary tips). Preserves converged pressure field. Without this,
        // concentrated thermal buildup produces bloom halos absent from live preview.
        fireCacheInvalidation.triggerThermalClear();
        await this.waitForAnimationFrame();
        // Reset fire diagnostic counter so export frames get logged (warmup consumed the first 5)
        if (fireDiag) {
          fireDiag.reset();
        }
      }

      // Clear all overlay canvases: 2D (trails, LED) and WebGL display
      // surfaces (fire, charcoal). Simulation FBOs stay warm — only the
      // visible display canvas pixels are cleared so warmup frames don't
      // bleed into the first captured frame.
      const container = canvas.parentElement;
      if (container) {
        for (const overlay of container.querySelectorAll("canvas")) {
          if (overlay === canvas) continue;
          const ctx2d = overlay.getContext("2d");
          if (ctx2d) {
            ctx2d.clearRect(0, 0, overlay.width, overlay.height);
          } else {
            const glCtx = overlay.getContext("webgl2") as WebGL2RenderingContext | null;
            if (glCtx) {
              glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, null);
              glCtx.clearColor(0, 0, 0, 0);
              glCtx.clear(glCtx.COLOR_BUFFER_BIT);
            }
          }
        }
      }

      await this.delay(VIDEO_INITIAL_CAPTURE_DELAY_MS);

      if (savedEffectState) {
        await this.waitForAnimationFrame();
        await this.waitForAnimationFrame();
        await this.waitForAnimationFrame();
      }

      // Build step durations array - each step's relative duration (default 1)
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

      // Apply loop count for repeating the motion portion back-to-back.
      // Prefer options.loopCount if provided, otherwise use panelState.exportLoopCount.
      // The timeline is: one start position → motion × loopCount → one end hold.
      // The start position and end hold each play exactly once, regardless of loopCount.
      const loopCount = options.loopCount ?? panelState.exportLoopCount ?? 1;
      const motionLoopUnits = totalDurationUnits * loopCount;
      const totalDurationWithHolds =
        startPositionDuration + motionLoopUnits + endPositionHoldDuration;

      // Calculate effective duration at user's BPM/speed
      // At speed=1.0 (60 BPM): 1 second per beat unit
      // At speed=2.0 (120 BPM): 0.5 seconds per beat unit
      const secondsPerBeatUnit = 1.0 / panelState.speed;
      const totalTimelineSeconds = totalDurationWithHolds * secondsPerBeatUnit;

      const totalFrames = Math.ceil(totalTimelineSeconds * fps);

      // Build cumulative duration breakpoints for time-to-beat mapping
      // This allows steps with different durations to occupy proportional time
      const cumulativeDurations: number[] = [];
      let cumulative = 0;
      for (const d of stepDurations) {
        cumulativeDurations.push(cumulative);
        cumulative += d;
      }

      // Keyframe interval - emit a keyframe every 2 seconds for seekability
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

      // Get additional visibility settings (showWordHeader already checked above)
      const showTkaGlyph = visibilityManager.getVisibility("tkaGlyph");
      const showStepNumbers = visibilityManager.getVisibility("stepNumbers");
      const showPathLines = visibilityManager.getVisibility("pathLines");
      const isDarkMode = visibilityManager.isDarkMode();

      // Pre-render complete glyphs (letter + dash + turns column) before the frame loop
      if (showTkaGlyph && steps.length > 0) {
        await this.glyphPrerenderer.prerenderGlyphs(steps, isDarkMode);
      }

      // Create offscreen canvas for compositing at OUTPUT resolution directly.
      // Each source layer (main canvas, overlays) is scaled up individually
      // with high-quality interpolation, producing sharper trails and effects
      // than the previous approach of compositing at source size then resizing.
      const offscreenCanvas = document.createElement("canvas");

      // Scale factor from source canvas to output resolution.
      const scaleFactor = isCompositeMode ? 1 : outputWidth / sourceWidth;

      // Header/progress bar heights at OUTPUT resolution
      const headerHeight = Math.round(srcHeaderHeight * scaleFactor);
      const progressBarHeight = Math.round(srcProgressBarHeight * scaleFactor);
      // The square animation area in the output
      const outputCanvasSize = isCompositeMode ? sourceWidth : outputWidth;

      // Resize the LIVE rendering context to output resolution so trail/effect
      // overlays render natively at export size instead of being upscaled from
      // viewport resolution via drawImage (which softens glow/shadowBlur). The
      // live engine is the same warm renderer that produces the on-screen
      // preview — its free-running rAF accumulates dense, smooth trail stamps,
      // so the exported trails match the preview exactly (a fresh offscreen
      // engine renders ~1 stamp per frame → sparse/blobby trails by comparison).
      if (!isCompositeMode) {
        const contexts = getRenderContextRegistry().getAll();
        liveContext = contexts.find((c) => c.canvas === canvas) ?? null;
        if (liveContext) {
          liveContext.resizer.pauseObservation();
          liveContext.resize(outputCanvasSize);
          await this.waitForAnimationFrame();
        }
      }

      // Set canvas dimensions based on mode
      if (isCompositeMode) {
        const compositeDims = this.compositeRenderer.getCompositeDimensions();
        offscreenCanvas.width = compositeDims.width;
        offscreenCanvas.height = compositeDims.height;
      } else {
        offscreenCanvas.width = outputWidth;
        offscreenCanvas.height = outputHeight;
      }
      const offscreenCtx = offscreenCanvas.getContext("2d", {
        willReadFrequently: useBackgroundEncoder,
      });

      if (!offscreenCtx) {
        throw new Error("Failed to create offscreen canvas context");
      }

      // Use Lanczos (high) interpolation when scaling source layers up
      offscreenCtx.imageSmoothingEnabled = true;
      offscreenCtx.imageSmoothingQuality = "high";

      // Build frame compositor for overlay rendering
      const compositorConfig: FrameCompositorConfig = {
        outputWidth,
        outputHeight,
        sourceWidth,
        headerHeight,
        progressBarHeight,
        outputCanvasSize,
        scaleFactor,
        fps,
        showTkaGlyph,
        showStepNumbers,
        showWordHeader,
        showProgressBar,
        isDarkMode,
        isCompositeMode: !!isCompositeMode,
        sequenceWord: panelState.sequenceWord,
        difficultyLevel,
        loopComponents,
        rotationPeriod,
        inversionPeriod,
        loopPeriod,
        showPathLines,
        sequenceSteps: steps,
      };
      const frameCompositor = new ExportFrameCompositor(
        compositorConfig,
        this.glyphPrerenderer,
        this.compositeRenderer
      );

      // Frame duration in microseconds for WebCodecs timestamps
      const frameDurationMicros = Math.round(1_000_000 / fps);

      // Trail-fidelity diagnostic. When enabled via window.__tka_trail_diag.enable(),
      // log the actual accumulator stamp count per captured frame. Expected: 1 per
      // active color (1 or 2). A higher value proves the leading edge is being
      // re-stamped multiple times at the same virtualTime — the "doubly opaque" bug.
      const trailDiag = typeof window !== "undefined"
        ? ((window as unknown as Record<string, unknown>).__tka_trail_diag as
            | { read(): { stamps: number; lastDt: number; lastFade: number }; enable(): void }
            | undefined)
        : undefined;
      // Auto-enable in DEV so the per-frame stamp/dt/fade log prints without a
      // manual console step. The hook exists once the offscreen engine's trail
      // overlay has initialized (above).
      if (import.meta.env.DEV) trailDiag?.enable();

      for (let i = 0; i < totalFrames; i++) {
        if (this.shouldCancel) {
          throw new Error("Export cancelled");
        }

        // Calculate beat position for this frame using duration-weighted mapping.
        // Timeline: one start position → motion × loopCount → one end hold.
        // Start and end hold each appear exactly once; motion wraps per loop iteration.
        // The animation engine uses beat 0 = start position, beat 1+ = motion steps.
        // Using calculateStateForStep instead of jumpToStep because jumpToStep
        // clamps at totalSteps, which truncates the last step's fractional progress.
        const timeProgress = (i / totalFrames) * totalDurationWithHolds;

        // Calculate deterministic virtual time for this frame (in ms)
        const virtualTimeMs = (i / fps) * 1000;
        panelState.setVirtualTime(virtualTimeMs);

        let playbackPosition: number;
        let stepIndex: number;
        let isInStartPosition = false;
        let isInEndHold = false;

        const motionStart = startPositionDuration;
        const motionEnd = motionStart + motionLoopUnits;

        if (startPositionDuration > 0 && timeProgress < motionStart) {
          // Start position phase - show initial pose, no glyph (once, at the beginning)
          playbackPosition = timeProgress / startPositionDuration;
          stepIndex = -1;
          isInStartPosition = true;
          playbackController.calculateStateForStep(playbackPosition);
        } else if (endPositionHoldDuration > 0 && timeProgress >= motionEnd) {
          // End position hold - freeze on the completed last motion step (once, at the end)
          playbackPosition = steps.length + 1;
          stepIndex = steps.length - 1;
          isInEndHold = true;
          playbackController.calculateStateForStep(playbackPosition);
        } else {
          // Motion steps phase - wrap time modulo one loop so N iterations play
          // back-to-back with no inter-iteration hold. Offset by +1 for the
          // animation engine's step convention (step 0 = start, 1+ = motion).
          const motionTime = timeProgress - motionStart;
          const wrappedMotionTime =
            totalDurationUnits > 0 ? motionTime % totalDurationUnits : 0;
          const rawStep = this.timeToBeat(wrappedMotionTime, cumulativeDurations, stepDurations);
          stepIndex = Math.floor(rawStep);
          playbackPosition = rawStep + 1;
          playbackController.calculateStateForStep(playbackPosition);
        }

        // The live engine renders itself: calculateStateForStep (above) updated
        // panelState, the live AnimatorCanvas reacts and calls engine.update,
        // and the engine's free-running rAF paints the new beat on the next tick.
        // Wait for the render loop to paint the new beat.
        // Single rAF: calculateStateForStep is synchronous, so the render
        // loop picks up the new prop state on the very next frame.
        // Two rAFs would cause the trail overlay to fade+stamp twice at
        // the same tip position, boosting opacity above the live preview.
        await this.waitForAnimationFrame();

        // Guard: if the live canvas temporarily lost dimensions (Svelte re-render
        // or PixiJS resize), wait for recovery. If it doesn't recover, skip
        // rendering this frame - the offscreen canvas still holds the previous
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
          const compositeStepIndex = isInStartPosition ? 0 : Math.max(0, stepIndex);
          frameCompositor.renderCanvasLayers(
            offscreenCtx,
            canvas,
            !!isCompositeMode,
            compositeStepIndex,
            offscreenCanvas,
            i
          );

          frameCompositor.renderOverlays(
            offscreenCtx,
            canvas,
            stepIndex,
            isInStartPosition,
            isInEndHold,
            playbackPosition,
            steps,
            stepDurations,
            i
          );
        }

        // -----------------------------------------------------------------------
        // Capture frame - offscreen canvas is already at output resolution
        // -----------------------------------------------------------------------
        if (useBackgroundEncoder) {
          const frameData = offscreenCtx.getImageData(
            0,
            0,
            offscreenCanvas.width,
            offscreenCanvas.height
          );

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
          await inlineExporter.addFrame(offscreenCanvas);
        }

        if (trailDiag) {
          const d = trailDiag.read();
          console.log(
            `[trail-diag] frame=${i} stamps=${d.stamps} dt=${d.lastDt.toFixed(5)}s fade=${d.lastFade.toFixed(5)} (expected stamps: 1 per active color)`
          );
        }

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
      // Finalize - flush encoder and download
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

      await downloadBlob(outputBlob, filename);

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
      // --- EXPORT DIAGNOSTIC cleanup ---
      const fireDiagCleanup = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>).__tka_fire_diag as { disable(): void } | undefined : undefined;
      if (fireDiagCleanup) {
        fireDiagCleanup.disable();
      }

      // Restore the live rendering context to viewport resolution.
      if (liveContext) {
        liveContext.restoreSize();
        liveContext.resizer.resumeObservation();
      }

      this.restoreEffectState(visibilityManager, savedEffectState);
      this.restorePlaybackState(playbackController, captureState);
      this._isExporting = false;
      this.shouldCancel = false;
      this.glyphPrerenderer.clear();
      this.backgroundEncoder.onProgress = null;
      panelState.setVirtualTime(undefined);

      // Clean up composite renderer if it was used
      if (options.compositeMode && options.compositeMode !== "none") {
        this.compositeRenderer.dispose();
      }

      // Invalidate fire frame cache - the frame-by-frame jumpToStep capture
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
    playbackController: AnimationPlaybackController,
    snapshot: { wasPlaying: boolean; step: number }
  ): void {
    playbackController.jumpToStep(snapshot.step);
    if (snapshot.wasPlaying) {
      playbackController.togglePlayback();
    }
  }

  private resolveFilename(
    explicitFilename: string | undefined,
    panelState: AnimationPanelState,
    format: VideoExportFormat
  ): string {
    if (explicitFilename) {
      return explicitFilename;
    }

    const seq = panelState.sequenceData;
    const rawName =
      seq?.displayName ||
      seq?.intendedWord ||
      seq?.word ||
      panelState.sequenceWord ||
      "animation";
    // Collapse repeated kernels ("VΛ-VΛ-VΛ-VΛ-" → "VΛ-") so the filename matches
    // what WordHeader/WordLabel show on screen, then map Greek → ASCII shorthand.
    const baseName = greekToAscii(simplifyRepeatedWord(rawName));
    const extensionMap: Record<VideoExportFormat, string> = {
      webm: "webm",
      mp4: "mp4",
    };
    const extension = extensionMap[format] || "mp4";
    return generateTimestampedFilename(
      baseName,
      extension
    );
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
   * Returns the saved tipEffectMap for restoration after export.
   */
  private applyEffectOverrides(
    visibilityManager: ReturnType<typeof getAnimationVisibilityManager>,
    overrides?: VideoEffectOverrides
  ): TipEffectMap | null {
    if (!overrides) return null;

    const ecs = visibilityManager.effectsConfigState;
    const saved = { ...(ecs?.tipEffectMap ?? {}) };

    // Determine which single effect (if any) should be active for the export.
    // Priority: fire > charcoal > led > trails > none.
    const effect = overrides.fire ? "fire"
      : overrides.charcoal ? "charcoal"
      : overrides.led ? "led"
      : overrides.trails ? "trails"
      : "none";

    ecs?.setActiveEffect(effect);

    return saved;
  }

  /**
   * Restore effect state after export completes.
   */
  private restoreEffectState(
    visibilityManager: ReturnType<typeof getAnimationVisibilityManager>,
    saved: TipEffectMap | null
  ): void {
    if (!saved) return;
    const ecs = visibilityManager.effectsConfigState;
    if (ecs) {
      ecs.setTipEffectMap(saved);
    }
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
