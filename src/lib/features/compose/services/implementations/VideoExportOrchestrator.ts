/**
 * Video Export Orchestrator
 *
 * Coordinates frame capture, encoding, and final delivery for MP4/WebM exports.
 *
 * Supports two encoding paths:
 *   1. Background encoder (preferred) - uses a Web Worker with WebCodecs + mp4-muxer
 *      for off-main-thread encoding. Captures ImageData per frame, transfers zero-copy
 *      to the worker, and receives the finished MP4 blob.
 *   2. Inline encoder (fallback) - uses the legacy VideoExporter on the main thread.
 *      Retained for browsers without WebCodecs or when the background encoder is
 *      unavailable.
 */

import {
  VIDEO_EXPORT_FPS,
  VIDEO_INITIAL_CAPTURE_DELAY_MS,
} from "../../shared/domain/constants/timing";
import type { AnimationPanelState } from "../../state/animation-panel-state.svelte";
import type { FileDownloader } from "$lib/shared/foundation/services/implementations/FileDownloader";
import type { AnimationPlaybackController } from "../implementations/AnimationPlaybackController";
import type { CanvasRenderer } from "./CanvasRenderer";
import type {
  VideoExportFormat,
  VideoExportOrchestratorOptions,
  VideoExportProgress,
  VideoResolution,
  VideoEffectOverrides,
} from "../contracts/types";
import type { VideoExporter } from "../implementations/VideoExporter";
import type { CompositeVideoRenderer } from "../implementations/CompositeVideoRenderer";
import type { ExportGlyphPrerenderer } from "../implementations/ExportGlyphPrerenderer";
import type { GlyphAsset } from "../contracts/types";
import type { BackgroundVideoEncoder } from "../implementations/BackgroundVideoEncoder";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { fireCacheInvalidation } from "$lib/shared/animation-engine/state/fire-invalidation-signal.svelte";
import { getExportDimensions, calculateBitrate } from "../../shared/domain/video-export-calculations";
import { SequenceDifficultyCalculator } from "$lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator";
import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";
import { Period } from "$lib/features/create/generate/circular/domain/models/circular-models";
import { greekToAscii } from "$lib/features/create/spell/domain/constants/spell-constants";
import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";

export class VideoExportOrchestrator {
  private _isExporting = false;
  private shouldCancel = false;

  constructor(
    private readonly VideoExporter: VideoExporter,
    private readonly canvasRenderer: CanvasRenderer,
    private readonly fileDownloadService: FileDownloader,
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
      ? this.canvasRenderer.getHeaderHeight(canvas.width)
      : 0;
    const srcProgressBarHeight = showProgressBar
      ? this.canvasRenderer.getProgressBarHeight(canvas.width)
      : 0;

    // Compute header overlays (difficulty badge + LOOP icon strip) once per export.
    // Matches AnimatorCanvas.svelte:330-358 derivation so the exported video's
    // word header mirrors the live canvas.
    const difficultyLevel = panelState.sequenceData
      ? new SequenceDifficultyCalculator().calculateDifficultyLevel([
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

    try {
      onProgress({ progress: 0, stage: "capturing" });

      if (captureState.wasPlaying) {
        playbackController.togglePlayback();
      }
      playbackController.jumpToStep(0);

      // --- EXPORT DIAGNOSTIC: flat strings only (Objects collapse in console paste) ---
      const diagContainer = canvas.parentElement;
      console.log(`[export-diag] === EXPORT START === main=${canvas.width}x${canvas.height} output=${outputWidth}x${outputHeight} scale=${(outputWidth / sourceWidth).toFixed(3)}`);
      if (diagContainer) {
        const overlays = diagContainer.querySelectorAll("canvas");
        overlays.forEach((ov, idx) => {
          if (ov === canvas) return;
          const el = ov as HTMLCanvasElement;
          const isWebGL = !!el.getContext('webgl2');
          console.log(`[export-diag] overlay[${idx}]: ${el.width}x${el.height} webgl=${isWebGL} z=${el.style.zIndex} data-type=${el.dataset?.overlayType ?? 'NONE'}`);
        });
      }

      // Enable fire renderer diagnostics
      if (typeof window !== 'undefined' && (window as any).__tka_fire_diag) {
        (window as any).__tka_fire_diag.enable();
        console.log('[export-diag] fire diagnostics enabled');
      }

      // Clear fire/charcoal simulation FBOs, display canvas, and frame cache.
      fireCacheInvalidation.trigger();
      await this.waitForAnimationFrame();
      await this.waitForAnimationFrame();

      // Navier-Stokes fluid simulation needs ~60 frames to converge from
      // zeroed state. Without warmup, the pressure field is unresolved and
      // produces concentric ring artifacts. Run a short warmup at step 0
      // so the simulation reaches steady state before capture begins.
      const needsFluidWarmup =
        visibilityManager.hasEffect("fire") ||
        visibilityManager.hasEffect("charcoal");
      if (needsFluidWarmup) {
        const WARMUP_FRAMES = 60;
        for (let w = 0; w < WARMUP_FRAMES; w++) {
          playbackController.calculateStateForStep(0);
          await this.waitForAnimationFrame();
        }
        // Drop any cached warmup frames but keep the converged simulation FBOs
        fireCacheInvalidation.triggerCacheOnly();
        await this.waitForAnimationFrame();
        // Reset fire diagnostic counter so export frames get logged (warmup consumed the first 5)
        if (typeof window !== 'undefined' && (window as any).__tka_fire_diag) {
          (window as any).__tka_fire_diag.reset();
          console.log('[export-diag] fire diag counter reset after warmup');
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

      // Scale factor from source canvas to output resolution.
      const scaleFactor = isCompositeMode ? 1 : outputWidth / sourceWidth;

      // Header/progress bar heights at OUTPUT resolution
      const headerHeight = Math.round(srcHeaderHeight * scaleFactor);
      const progressBarHeight = Math.round(srcProgressBarHeight * scaleFactor);
      // The square animation area in the output
      const outputCanvasSize = isCompositeMode ? sourceWidth : outputWidth;
      const actualCanvasSize = outputCanvasSize;

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

        // Wait for the UI + canvas to render the new beat
        await this.waitForAnimationFrame();
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
          if (isCompositeMode) {
            // Composite mode: render animation + grid + beat highlight
            const compositeStepIndex = isInStartPosition ? 0 : Math.max(0, stepIndex);
            this.compositeRenderer.renderCompositeFrame(
              canvas,
              compositeStepIndex,
              offscreenCanvas
            );
          } else {
            // Normal mode: scale each source layer up to output resolution individually.
            // High-quality (Lanczos) interpolation is set on offscreenCtx above.
            offscreenCtx.clearRect(
              0,
              0,
              offscreenCanvas.width,
              offscreenCanvas.height
            );

            // Animation content goes below header (and above progress bar), at output scale
            const canvasY = headerHeight > 0 ? headerHeight : 0;

            // Scale the live canvas to output resolution. The 9-arg drawImage
            // handles canvas resize mid-export (mobile layout shifts) and scales
            // from source to output in a single step.
            offscreenCtx.drawImage(
              canvas,
              0, 0, canvas.width, canvas.height,                       // source: full current canvas
              0, canvasY, outputCanvasSize, outputCanvasSize             // dest: fill output square area
            );

            // Composite overlay canvases (trails, fire, charcoal sparks, LED effects).
            // Each overlay is scaled from its source size to output resolution
            // individually, preserving detail in transparent layers (trails, glow).
            const container = canvas.parentElement;
            if (container) {
              const overlayCanvases = container.querySelectorAll("canvas");
              for (const overlay of overlayCanvases) {
                if (overlay === canvas) continue; // Skip the main canvas
                if (overlay.width === 0 || overlay.height === 0) continue; // Skip uninitialized

                // --- EXPORT DIAGNOSTIC: flat strings ---
                if (i < 3) {
                  const el = overlay as HTMLCanvasElement;
                  const isWebGL = !!el.getContext("webgl2");
                  const oType = el.dataset?.overlayType ?? "NONE";
                  const blend = oType === "emissive" ? "lighter" : "source-over";
                  console.log(`[export-comp] f${i} overlay ${el.width}x${el.height} type=${oType} blend=${blend} webgl=${isWebGL}`);

                  if (isWebGL) {
                    const glCtx = el.getContext("webgl2") as WebGL2RenderingContext;
                    if (glCtx) {
                      const px = new Uint8Array(4);
                      const w = el.width, h = el.height;
                      glCtx.readPixels(Math.floor(w/2), Math.floor(h/2), 1, 1, glCtx.RGBA, glCtx.UNSIGNED_BYTE, px);
                      const center = `rgba(${px[0]},${px[1]},${px[2]},${px[3]})`;
                      glCtx.readPixels(Math.floor(w/2), Math.floor(h*0.25), 1, 1, glCtx.RGBA, glCtx.UNSIGNED_BYTE, px);
                      const quarter = `rgba(${px[0]},${px[1]},${px[2]},${px[3]})`;
                      glCtx.readPixels(5, 5, 1, 1, glCtx.RGBA, glCtx.UNSIGNED_BYTE, px);
                      const corner = `rgba(${px[0]},${px[1]},${px[2]},${px[3]})`;
                      console.log(`[export-comp] f${i} pixels: center=${center} quarter=${quarter} corner=${corner}`);
                    }
                  }
                }

                const isEmissive = (overlay as HTMLCanvasElement).dataset?.overlayType === "emissive";
                if (isEmissive) {
                  offscreenCtx.globalCompositeOperation = "lighter";
                }
                offscreenCtx.drawImage(
                  overlay,
                  0, 0, overlay.width, overlay.height,                  // source: full overlay
                  0, canvasY, outputCanvasSize, outputCanvasSize          // dest: scaled to output
                );
                if (isEmissive) {
                  offscreenCtx.globalCompositeOperation = "source-over";
                }
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
          const stepNumberChanged = stepNumber !== currentStepNumber;
          const transitionDetected = glyphChanged || stepNumberChanged;

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
          // Dark mode is already baked into the pre-rendered image - no ctx.filter needed
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
              activeStepNumber,
              difficultyLevel,
              loopComponents,
              rotationPeriod,
              inversionPeriod,
              loopPeriod
            );
          }

          // Render progress bar if enabled (below canvas area).
          // The progress bar expects a 0-based step index float.
          if (showProgressBar && !isCompositeMode) {
            const progressBarY = headerHeight + outputCanvasSize;
            const progressBeat = isInStartPosition
              ? 0
              : isInEndHold
                ? steps.length
                : (playbackPosition - 1); // Undo the +1 offset to get 0-based step index
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
      // --- EXPORT DIAGNOSTIC cleanup ---
      if (typeof window !== 'undefined' && (window as any).__tka_fire_diag) {
        (window as any).__tka_fire_diag.disable();
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
    return this.fileDownloadService.generateTimestampedFilename(
      baseName,
      extension
    );
  }

  /**
   * Get the step number for a specific frame
   * Matches the logic in AnimatorCanvas.svelte's stepNumber derived
   * Step numbers are 1-indexed (steps[0] = step 1, steps[1] = step 2, etc.)
   */
  private getStepNumberForFrame(
    stepPosition: number,
    panelState: AnimationPanelState
  ): number | null {
    if (!panelState.sequenceData?.steps) {
      return null;
    }

    // Calculate which step index we're showing
    const stepIndex = Math.floor(stepPosition);
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
   * Returns the saved tipEffectMap for restoration after export.
   */
  private applyEffectOverrides(
    visibilityManager: ReturnType<typeof getAnimationVisibilityManager>,
    overrides?: VideoEffectOverrides
  ): import("$lib/shared/animation-engine/domain/types/TipEffectTypes").TipEffectMap | null {
    if (!overrides) return null;

    const saved = { ...visibilityManager.getTipEffectMap() };

    // Determine which single effect (if any) should be active for the export.
    // Priority: fire > charcoal > led > trails > none.
    if (overrides.fire) {
      visibilityManager.setActiveEffect("fire");
    } else if (overrides.charcoal) {
      visibilityManager.setActiveEffect("charcoal");
    } else if (overrides.led) {
      visibilityManager.setActiveEffect("led");
    } else if (overrides.trails) {
      visibilityManager.setActiveEffect("trails");
    } else {
      visibilityManager.setActiveEffect("none");
    }

    return saved;
  }

  /**
   * Restore effect state after export completes.
   */
  private restoreEffectState(
    visibilityManager: ReturnType<typeof getAnimationVisibilityManager>,
    saved: import("$lib/shared/animation-engine/domain/types/TipEffectTypes").TipEffectMap | null
  ): void {
    if (!saved) return;
    visibilityManager.setTipEffectMap(saved);
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
