import type {
  ISequenceModalExporter,
  ExportState,
  ExportCallbacks,
  VideoExportDependencies,
  ImageExportDependencies,
  VideoExportOptions,
  ImageExportOptions,
} from "../contracts/ISequenceModalExporter";
import type { VideoExportProgress, IVideoExportOrchestrator } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
import { container } from "$lib/shared/di";

/**
 * Orchestrates sequence exports (image, video).
 * Combined exports (animation + choreo card) are handled by Compose module.
 */
export class SequenceModalExporter implements ISequenceModalExporter {
  private _isExporting = $state(false);
  private _progress = $state<VideoExportProgress | null>(null);
  private _error = $state<string | null>(null);
  private _previewBlobUrl = $state<string | null>(null);

  // Lazy-loaded services
  private _videoExportOrchestrator: IVideoExportOrchestrator | null = null;
  private _sequenceRenderer: ISequenceRenderer | null = null;

  private get videoExportOrchestrator(): IVideoExportOrchestrator | null {
    if (!this._videoExportOrchestrator) {
      this._videoExportOrchestrator = container.items.videoExportOrchestrator;
    }
    return this._videoExportOrchestrator;
  }

  private get sequenceRenderer(): ISequenceRenderer | null {
    if (!this._sequenceRenderer) {
      this._sequenceRenderer = container.items.sequenceRenderer;
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
    // Revoke any previous preview URL
    this.revokePreviewUrl();

    try {
      const blob = await this.videoExportOrchestrator.executeExport(
        deps.canvas,
        deps.playbackController,
        deps.panelState,
        (progress) => {
          this._progress = progress;
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
        }
      );

      // Create preview URL from the exported blob
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
        visibilityOverrides: {
          darkMode: options.darkMode,
        },
      });

      // Download the image
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${deps.sequence.word || "sequence"}.png`;
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

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sequenceModalExporter = new SequenceModalExporter();
