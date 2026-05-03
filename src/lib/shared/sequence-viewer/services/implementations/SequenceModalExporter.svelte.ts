import type {
  ExportState,
  ExportCallbacks,
  VideoExportDependencies,
  Video3DExportDependencies,
  ImageExportDependencies,
  VideoExportOptions,
  ImageExportOptions,
} from "../contracts/types";
import type { VideoExportOrchestrator } from "$lib/features/compose/services/implementations/VideoExportOrchestrator";
import type { VideoExportProgress } from "$lib/features/compose/services/contracts/types";
import type { Offline3DExporter } from "$lib/shared/3d/services/implementations/Offline3DExporter";
import type { SequenceRenderer } from "$lib/shared/render/services/implementations/SequenceRenderer";
import { getSequenceRenderer } from "$lib/shared/render/getSequenceRenderer";
import { fileDownloader } from "$lib/shared/foundation/services/implementations/FileDownloader";
import { greekToAscii } from "$lib/features/create/spell/domain/constants/spell-constants";
import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";
import { recordExportThroughput } from "../../state/export-timing-tracker";

import { getVideoExportOrchestrator } from "$lib/features/compose/getVideoExportOrchestrator";
import { getOffline3DExporter } from "$lib/shared/3d/getOffline3DExporter";

export class SequenceModalExporter {
  private _isExporting = $state(false);
  private _progress = $state<VideoExportProgress | null>(null);
  private _error = $state<string | null>(null);
  private _previewBlobUrl = $state<string | null>(null);

  private _videoExportOrchestrator: VideoExportOrchestrator | null = null;
  private _sequenceRenderer: SequenceRenderer | null = null;
  private _activeExporter: Offline3DExporter | null = null;

  private get videoExportOrchestrator(): VideoExportOrchestrator | null {
    if (!this._videoExportOrchestrator) {
      this._videoExportOrchestrator = getVideoExportOrchestrator();
    }
    return this._videoExportOrchestrator;
  }

  private get sequenceRenderer(): SequenceRenderer | null {
    if (!this._sequenceRenderer) {
      this._sequenceRenderer = getSequenceRenderer();
    }
    return this._sequenceRenderer;
  }

  get state(): ExportState {
    return {
      isExporting: this._isExporting,
      progress: this._progress,
      error: this._error,
      previewBlobUrl: this._previewBlobUrl,
    };
  }

  async exportAnimation(
    options: VideoExportOptions,
    deps: VideoExportDependencies,
    callbacks: ExportCallbacks
  ): Promise<void> {
    if (!this.videoExportOrchestrator) {
      this._error = "Export services not ready. Please try again.";
      return;
    }

    this._isExporting = true;
    this._error = null;
    this._progress = { progress: 0, stage: "capturing" };
    this.revokePreviewUrl();

    const exportStartTime = performance.now();
    let capturedFrameCount = 0;

    try {
      const blob = await this.videoExportOrchestrator.executeExport(
        deps.canvas,
        deps.playbackController,
        deps.panelState,
        (progress) => {
          this._progress = progress;
          if (progress.totalFrames) {
            capturedFrameCount = progress.totalFrames;
          }
          if (progress.stage === "complete") {
            callbacks.onHaptic("success");
            callbacks.onSuccess("Video exported!");
          } else if (progress.stage === "error") {
            callbacks.onHaptic("error");
            this._error = progress.error || "Export failed. Please try again.";
            callbacks.onError(this._error);
          }
        },
        {
          compositeMode: "none",
          fps: options.fps,
          loopCount: options.loopCount,
          resolution: options.resolution,
          effectOverrides: options.effectOverrides,
          includeAnimationStartPosition: options.includeStartPosition,
          includeEndHold: options.includeEndHold,
        }
      );

      const exportDurationMs = performance.now() - exportStartTime;
      if (capturedFrameCount > 0 && exportDurationMs > 0) {
        recordExportThroughput(options.resolution, capturedFrameCount, exportDurationMs);
      }

      this._previewBlobUrl = URL.createObjectURL(blob);
    } catch (error) {
      if ((error as Error).message !== "Export cancelled") {
        console.error("[SequenceModalExporter] Animation export failed:", error);
        this._error = "Export failed. Please try again.";
        callbacks.onError(this._error);
      }
    } finally {
      this._isExporting = false;
      this._progress = null;
    }
  }

  async export3DAnimation(
    options: VideoExportOptions,
    deps: Video3DExportDependencies,
    callbacks: ExportCallbacks
  ): Promise<void> {
    const exporter = getOffline3DExporter() as Offline3DExporter;
    if (!exporter) {
      this._error = "3D export services not ready.";
      return;
    }

    this._activeExporter = exporter;
    this._isExporting = true;
    this._error = null;
    this._progress = { progress: 0, stage: "capturing" };
    this.revokePreviewUrl();

    try {
      const blob = await exporter.exportOffline(
        {
          webglCanvas: deps.webglCanvas,
          camera: deps.camera,
          beatsPerSecond: deps.beatsPerSecond,
          totalDurationSeconds: deps.totalDurationSeconds,
          cameraKeyframes: deps.cameraKeyframes,
          renderer: deps.renderer,
          runFrame: deps.runFrame,
          pauseAutoLoop: deps.pauseAutoLoop,
          resumeAutoLoop: deps.resumeAutoLoop,
          setExporting: deps.setExporting,
          setExportCurrentStep: deps.setExportCurrentStep,
        },
        (progress) => {
          this._progress = progress;
          if (progress.stage === "complete") {
            callbacks.onHaptic("success");
            callbacks.onSuccess("3D video exported!");
          }
        },
        {
          fps: options.fps,
          resolution: options.resolution,
          loopCount: options.loopCount,
          includeStartPosition: options.includeStartPosition ?? true,
          includeEndHold: options.includeEndHold ?? false,
          quality: options.quality ?? "standard",
        }
      );

      this._previewBlobUrl = URL.createObjectURL(blob);
    } catch (error) {
      if ((error as Error).message !== "Export cancelled") {
        console.error("[SequenceModalExporter] 3D export failed:", error);
        this._error = "3D export failed. Please try again.";
        callbacks.onError(this._error);
      }
    } finally {
      this._activeExporter = null;
      this._isExporting = false;
      this._progress = null;
    }
  }

  async exportImage(
    options: ImageExportOptions,
    deps: ImageExportDependencies,
    callbacks: ExportCallbacks
  ): Promise<void> {
    if (!this.sequenceRenderer) {
      this._error = "Export services not ready. Please try again.";
      return;
    }

    this._isExporting = true;
    this._error = null;

    try {
      const blob = await this.sequenceRenderer.renderSequenceToBlob(deps.sequence, {
        stepSize: 240,
        format: "PNG",
        quality: 1.0,
        includeStartPosition: options.includeStartPosition,
        addStepNumbers: options.showStepNumbers,
        addWord: options.showWord,
        addDifficultyLevel: options.showDifficulty,
        addUserInfo: options.showCreatorName || options.showNotes,
        userName: deps.userName,
        showCreatorName: options.showCreatorName,
        showNotes: options.showNotes,
        showBirthday: true,
        addReversalSymbols: true,
        columnCount: options.columnCount != null
          ? options.columnCount + (options.includeStartPosition ? 1 : 0)
          : undefined,
        visibilityOverrides: {
          darkMode: options.darkMode,
          showQRCode: options.showQRCode,
        },
      });

      const seq = deps.sequence;
      const rawName =
        seq.displayName || seq.intendedWord || seq.word || "sequence";
      const simplified = greekToAscii(simplifyRepeatedWord(rawName));
      const safeName = fileDownloader.sanitizeFilename(simplified) || "sequence";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      callbacks.onHaptic("success");
      callbacks.onSuccess("Image exported!");
    } catch (error) {
      console.error("[SequenceModalExporter] Image export failed:", error);
      callbacks.onHaptic("error");
      this._error = "Export failed. Please try again.";
      callbacks.onError(this._error);
    } finally {
      this._isExporting = false;
    }
  }

  cancel(): void {
    this.videoExportOrchestrator?.cancelExport();
    this._activeExporter?.cancel();
    this._activeExporter = null;
    this._isExporting = false;
    this._progress = null;
  }

  dismissPreview(): void {
    this.revokePreviewUrl();
  }

  clearError(): void {
    this._error = null;
  }

  dispose(): void {
    this.cancel();
    this.revokePreviewUrl();
    this._error = null;
  }

  private revokePreviewUrl(): void {
    if (this._previewBlobUrl) {
      URL.revokeObjectURL(this._previewBlobUrl);
      this._previewBlobUrl = null;
    }
  }
}

export const sequenceModalExporter = new SequenceModalExporter();
