/**
 * Video Export Orchestrator
 *
 * Coordinates frame capture, encoding, and final delivery for MP4/WebM exports.
 */

import {
  VIDEO_EXPORT_FPS,
  VIDEO_INITIAL_CAPTURE_DELAY_MS,
} from "../../shared/domain/constants/timing";
import type { AnimationPanelState } from "../../state/animation-panel-state.svelte";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { ISvgImageConverter } from "$lib/shared/foundation/services/contracts/ISvgImageConverter";
import type { IFileDownloader } from "$lib/shared/foundation/services/contracts/IFileDownloader";
import { getLetterImagePath } from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";
import type { IAnimationPlaybackController } from "../contracts/IAnimationPlaybackController";
import type { ICanvasRenderer } from "../contracts/ICanvasRenderer";
import type {
  VideoExportFormat,
  VideoExportOrchestratorOptions,
  IVideoExportOrchestrator,
  VideoExportProgress,
} from "../contracts/IVideoExportOrchestrator";
import type { IVideoExporter } from "../contracts/IVideoExporter";
import type { ICompositeVideoRenderer } from "../contracts/ICompositeVideoRenderer";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

interface LetterOverlayAssets {
  image: HTMLImageElement | null;
  dimensions: { width: number; height: number };
}

export class VideoExportOrchestrator implements IVideoExportOrchestrator {
  private _isExporting = false;
  private shouldCancel = false;

  // Cache for loaded letter glyphs to avoid re-fetching the same letter multiple times
  private letterGlyphCache = new Map<Letter, LetterOverlayAssets>();

  constructor(
    private readonly VideoExporter: IVideoExporter,
    private readonly canvasRenderer: ICanvasRenderer,
    private readonly svgImageService: ISvgImageConverter,
    private readonly fileDownloadService: IFileDownloader,
    private readonly compositeRenderer: ICompositeVideoRenderer
  ) {}

  async executeExport(
    canvas: HTMLCanvasElement,
    playbackController: IAnimationPlaybackController,
    panelState: AnimationPanelState,
    onProgress: (progress: VideoExportProgress) => void,
    options: VideoExportOrchestratorOptions = {}
  ): Promise<void> {
    if (this._isExporting) {
      throw new Error("Export already in progress");
    }

    this._isExporting = true;
    this.shouldCancel = false;

    // Clear glyph cache for fresh export
    this.letterGlyphCache.clear();

    // MP4 is the default format
    const exportFormat: VideoExportFormat = options.format ?? "mp4";
    const filename = this.resolveFilename(
      options.filename,
      panelState.sequenceWord,
      exportFormat
    );

    // Check visibility settings early to calculate output dimensions
    const visibilityManager = getAnimationVisibilityManager();
    const showWordHeader = visibilityManager.getVisibility("wordHeader");
    const headerHeight = showWordHeader
      ? this.canvasRenderer.getHeaderHeight(canvas.width)
      : 0;

    // Calculate output dimensions (include header height if enabled)
    // Round to integers - headerHeight can be decimal from CSS calculations
    const outputWidth = Math.round(canvas.width);
    const outputHeight = Math.round(canvas.height + headerHeight);

    // Create video exporter with correct output dimensions
    const exporter = await this.VideoExporter.createManualExporter(
      outputWidth,
      outputHeight,
      {
        format: exportFormat as "webm" | "mp4",
        fps: options.fps ?? VIDEO_EXPORT_FPS,
        filename,
        autoDownload: false,
      }
    );

    const captureState = {
      wasPlaying: panelState.isPlaying,
      beat: panelState.currentBeat,
    };

    try {
      onProgress({ progress: 0, stage: "capturing" });

      if (captureState.wasPlaying) {
        playbackController.togglePlayback();
      }
      playbackController.jumpToBeat(0);
      await this.delay(VIDEO_INITIAL_CAPTURE_DELAY_MS);

      // Calculate effective duration at user's BPM/speed
      // At speed=1.0 (60 BPM): 1 second per beat
      // At speed=2.0 (120 BPM): 0.5 seconds per beat
      const secondsPerBeat = 1.0 / panelState.speed;
      const singleLoopDurationSeconds = panelState.totalBeats * secondsPerBeat;

      // Use fixed high frame rate for smooth playback at any BPM
      // This ensures visual quality is consistent regardless of tempo
      const fps = options.fps ?? VIDEO_EXPORT_FPS;
      const framesPerLoop = Math.ceil(singleLoopDurationSeconds * fps);

      // Apply loop count for circular sequences
      const loopCount = panelState.exportLoopCount ?? 1;
      const totalFrames = framesPerLoop * loopCount;

      // Calculate beat progression per frame to match timing
      // beatsPerFrame = totalBeats / framesPerLoop (for single loop)
      const beatsPerFrame = panelState.totalBeats / framesPerLoop;

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
          gridBeatSize: options.gridBeatSize ?? 120,
          includeStartPosition: options.includeStartPosition ?? false,
          showBeatNumbers: options.showBeatNumbers ?? true,
        });
        await this.compositeRenderer.cacheStaticGrid();
      }

      // CRITICAL: Use actual canvas pixel size, not CSS display size
      // The canvas.width is the actual pixel dimension used for rendering
      // getBoundingClientRect().width would give the CSS display size which is different
      const actualCanvasSize = canvas.width;

      // Get additional visibility settings (showWordHeader already checked above)
      const showTkaGlyph = visibilityManager.getVisibility("tkaGlyph");
      const showBeatNumbers = visibilityManager.getVisibility("beatNumbers");
      const isDarkMode = visibilityManager.isDarkMode();

      // Create offscreen canvas for compositing (so we don't touch the visible canvas)
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
        willReadFrequently: false,
      });

      if (!offscreenCtx) {
        throw new Error("Failed to create offscreen canvas context");
      }

      // Track the current letter to avoid reloading the same glyph for consecutive frames
      let currentLetter: Letter | null = null;
      let currentGlyph: LetterOverlayAssets | null = null;
      let currentBeatNumber: number | null = null;

      // Track previous frame's glyph and beat number for crossfade
      let previousGlyph: LetterOverlayAssets | null = null;
      let previousBeatNumber: number | null = null;

      // Crossfade configuration (matches GlyphOverlay.svelte)
      const CROSSFADE_DURATION_MS = 200;
      const crossfadeDurationFrames = Math.ceil(
        (CROSSFADE_DURATION_MS / 1000) * fps
      );
      let framesSinceTransition = 0;

      for (let i = 0; i < totalFrames; i++) {
        if (this.shouldCancel) {
          throw new Error("Export cancelled");
        }

        // Calculate beat position for this frame
        // Uses modulo to loop through the sequence for multiple loops
        const frameInLoop = i % framesPerLoop;
        const beat = frameInLoop * beatsPerFrame;
        playbackController.jumpToBeat(beat);

        // Wait for the UI + canvas to render the new beat
        await this.waitForAnimationFrame();
        await this.waitForAnimationFrame();

        // Render frame based on mode
        if (isCompositeMode) {
          // Composite mode: render animation + grid + beat highlight
          const beatIndex = Math.floor(beat);
          this.compositeRenderer.renderCompositeFrame(
            canvas,
            beatIndex,
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

          // If word header is enabled, fill the header area with appropriate background
          if (showWordHeader && headerHeight > 0) {
            // Draw header background first (will be drawn over with text later)
            // The animation content goes below the header
            offscreenCtx.drawImage(canvas, 0, headerHeight);
          } else {
            offscreenCtx.drawImage(canvas, 0, 0);
          }
        }

        // Get the letter for the current beat
        const beatLetter = this.getLetterForBeat(beat, panelState);

        // Calculate beat number for display (matches AnimatorCanvas logic)
        const beatNumber = this.getBeatNumberForFrame(beat, panelState);

        // Detect transitions (letter or beat number changed)
        const letterChanged = beatLetter !== currentLetter;
        const beatNumberChanged = beatNumber !== currentBeatNumber;
        const transitionDetected = letterChanged || beatNumberChanged;

        if (transitionDetected) {
          // Store previous state for crossfade
          previousGlyph = currentGlyph;
          previousBeatNumber = currentBeatNumber;

          // Update current state
          currentLetter = beatLetter;
          currentBeatNumber = beatNumber;

          // Load new glyph if letter changed
          if (letterChanged) {
            currentGlyph = beatLetter
              ? await this.loadLetterGlyph(beatLetter)
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

        // Render TKA glyph if enabled
        if (showTkaGlyph) {
          // Apply dark mode inversion filter for glyphs
          if (isDarkMode) {
            offscreenCtx.filter = "invert(0.9)";
          }

          // Render fading-out glyph (if in crossfade and previous exists)
          if (inCrossfade && previousGlyph?.image && fadeOutOpacity > 0) {
            this.canvasRenderer.renderLetterToCanvas(
              offscreenCtx,
              actualCanvasSize,
              previousGlyph.image,
              previousGlyph.dimensions,
              fadeOutOpacity
            );
          }

          // Render fading-in glyph (current glyph)
          if (currentGlyph?.image) {
            const opacity = inCrossfade ? fadeInOpacity : 1;
            this.canvasRenderer.renderLetterToCanvas(
              offscreenCtx,
              actualCanvasSize,
              currentGlyph.image,
              currentGlyph.dimensions,
              opacity
            );
          }

          // Reset filter after glyph rendering
          offscreenCtx.filter = "none";
        }

        // Render beat numbers if enabled
        if (showBeatNumbers) {
          // Render fading-out beat number (if in crossfade and previous exists)
          if (inCrossfade && previousBeatNumber !== null && fadeOutOpacity > 0) {
            this.canvasRenderer.renderBeatNumberToCanvas(
              offscreenCtx,
              actualCanvasSize,
              previousBeatNumber,
              fadeOutOpacity,
              isDarkMode
            );
          }

          // Render fading-in beat number (current beat number)
          if (currentBeatNumber !== null) {
            const opacity = inCrossfade ? fadeInOpacity : 1;
            this.canvasRenderer.renderBeatNumberToCanvas(
              offscreenCtx,
              actualCanvasSize,
              currentBeatNumber,
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
        if (showWordHeader) {
          this.canvasRenderer.renderWordHeaderToCanvas(
            offscreenCtx,
            actualCanvasSize,
            panelState.sequenceWord,
            isDarkMode
          );
        }

        // Capture from the offscreen canvas (not the visible one!)
        await exporter.addFrame(offscreenCanvas);

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

      onProgress({ progress: 0, stage: "encoding" });
      const outputBlob = await exporter.finish();

      await this.fileDownloadService.downloadBlob(outputBlob, filename);

      onProgress({ progress: 1, stage: "complete" });
    } catch (error) {
      // Don't log cancellation as an error - it's intentional user action
      if (!this.shouldCancel) {
        console.error("❌ Export failed:", error);
        onProgress({
          progress: 0,
          stage: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      throw error;
    } finally {
      this.restorePlaybackState(playbackController, captureState);
      this._isExporting = false;
      this.shouldCancel = false;

      // Clean up composite renderer if it was used
      if (options.compositeMode && options.compositeMode !== "none") {
        this.compositeRenderer.dispose();
      }
    }
  }

  cancelExport(): void {
    this.shouldCancel = true;
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
    playbackController.jumpToBeat(snapshot.beat);
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
   * Get the letter for a specific beat from the sequence data
   * Matches the logic in AnimationSheetCoordinator.svelte's currentLetter derived
   */
  private getLetterForBeat(
    beat: number,
    panelState: AnimationPanelState
  ): Letter | null {
    if (!panelState.sequenceData) {
      return null;
    }

    // During animation: show beat letters using floor(beat) as index
    // This matches the live canvas behavior where:
    // - beat 0.0-0.99 shows beats[0] (first beat)
    // - beat 1.0-1.99 shows beats[1] (second beat)
    // - etc.
    if (
      panelState.sequenceData.beats &&
      panelState.sequenceData.beats.length > 0
    ) {
      const beatIndex = Math.floor(beat);
      const clampedIndex = Math.max(
        0,
        Math.min(beatIndex, panelState.sequenceData.beats.length - 1)
      );
      const beatData = panelState.sequenceData.beats[clampedIndex];
      return beatData?.letter ? (beatData.letter as Letter) : null;
    }

    return null;
  }

  /**
   * Get the beat number for a specific frame
   * Matches the logic in AnimatorCanvas.svelte's beatNumber derived
   * Beat numbers are 1-indexed (beats[0] = beat 1, beats[1] = beat 2, etc.)
   */
  private getBeatNumberForFrame(
    beat: number,
    panelState: AnimationPanelState
  ): number | null {
    if (!panelState.sequenceData?.beats) {
      return null;
    }

    // Calculate which beat index we're showing
    const beatIndex = Math.floor(beat);
    const clampedIndex = Math.max(
      0,
      Math.min(beatIndex, panelState.sequenceData.beats.length - 1)
    );

    // Beat numbers are 1-indexed
    return clampedIndex + 1;
  }

  /**
   * Load a letter glyph with caching
   */
  private async loadLetterGlyph(letter: Letter): Promise<LetterOverlayAssets> {
    // Check cache first
    if (this.letterGlyphCache.has(letter)) {
      return this.letterGlyphCache.get(letter)!;
    }

    try {
      const imagePath = getLetterImagePath(letter);
      const response = await fetch(imagePath);

      if (!response.ok) {
        const result = { image: null, dimensions: { width: 0, height: 0 } };
        this.letterGlyphCache.set(letter, result);
        return result;
      }

      const svgText = await response.text();
      const viewBoxMatch = svgText.match(
        /viewBox\s*=\s*"[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)"/i
      );
      const width = viewBoxMatch?.[1] ? parseFloat(viewBoxMatch[1]) : 100;
      const height = viewBoxMatch?.[2] ? parseFloat(viewBoxMatch[2]) : 100;
      const image = await this.svgImageService.convertSvgStringToImage(
        svgText,
        width,
        height
      );

      const result = { image, dimensions: { width, height } };
      this.letterGlyphCache.set(letter, result);
      return result;
    } catch {
      const result = { image: null, dimensions: { width: 0, height: 0 } };
      this.letterGlyphCache.set(letter, result);
      return result;
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
