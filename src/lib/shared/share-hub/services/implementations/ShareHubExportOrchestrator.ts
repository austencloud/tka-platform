/**
 * ShareHubExportOrchestrator
 *
 * Orchestrates export operations from the Share Hub panel.
 * Handles static image, animation video, and performance video exports.
 *
 * Domain: Share Hub - Export Orchestration
 */

import { injectable, inject } from "inversify";
import { TYPES } from "$lib/shared/inversify/types";
import type { ISharer } from "$lib/shared/share/services/contracts/ISharer";
import type {
  IVideoExportOrchestrator,
  VideoExportProgress,
} from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ExportSettings } from "../../domain/models/ExportSettings";
import type {
  IShareHubExportOrchestrator,
  ExportResult,
  AnimationExportDependencies,
  ExportUserInfo,
} from "../contracts/IShareHubExportOrchestrator";
import type { ShareOptions } from "$lib/shared/share/domain/models/ShareOptions";
import { DEFAULT_SHARE_OPTIONS } from "$lib/shared/share/domain/models/ShareOptions";
import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
import { VIDEO_EXPORT_SUCCESS_DELAY_MS } from "$lib/features/compose/shared/domain/constants/timing";

@injectable()
export class ShareHubExportOrchestrator implements IShareHubExportOrchestrator {
  private exporting = false;
  private videoOrchestrator: IVideoExportOrchestrator | null = null;

  constructor(
    @inject(TYPES.ISharer)
    private readonly sharer: ISharer
  ) {}

  /**
   * Set the video export orchestrator (lazy-loaded from compose module)
   */
  setVideoOrchestrator(orchestrator: IVideoExportOrchestrator): void {
    this.videoOrchestrator = orchestrator;
  }

  async export(
    sequence: SequenceData,
    settings: ExportSettings,
    options?: {
      animationDependencies?: AnimationExportDependencies;
      userInfo?: ExportUserInfo;
      isMobile?: boolean;
      onProgress?: (progress: VideoExportProgress) => void;
    }
  ): Promise<ExportResult> {
    if (this.exporting) {
      return { success: false, error: "Export already in progress" };
    }

    this.exporting = true;

    try {
      switch (settings.format) {
        case "static":
          await this.exportStatic(sequence, options?.userInfo, options?.isMobile);
          break;

        case "animation":
          if (!options?.animationDependencies) {
            throw new Error("Animation dependencies required for video export");
          }
          await this.exportAnimation(
            sequence,
            options.animationDependencies,
            options.onProgress
          );
          break;

        case "performance":
          await this.exportPerformance();
          break;

        default:
          throw new Error(`Unknown export format: ${settings.format}`);
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed";
      return { success: false, error: message };
    } finally {
      this.exporting = false;
    }
  }

  cancelExport(): void {
    if (this.videoOrchestrator?.isExporting()) {
      this.videoOrchestrator.cancelExport();
    }
    this.exporting = false;
  }

  isExporting(): boolean {
    return this.exporting;
  }

  /**
   * Export sequence as static image
   */
  private async exportStatic(
    sequence: SequenceData,
    userInfo?: ExportUserInfo,
    isMobile?: boolean
  ): Promise<void> {
    // Get user's saved image composition settings
    const imageSettings = getImageCompositionManager();
    const compositionSettings = imageSettings.getSettings();

    // Build share options from user settings
    const shareOptions: ShareOptions = {
      ...DEFAULT_SHARE_OPTIONS,
      format: "PNG",
      quality: 1.0,
      backgroundColor: "#FFFFFF",
      includeStartPosition: compositionSettings.includeStartPosition,
      addBeatNumbers: compositionSettings.addBeatNumbers,
      addWord: compositionSettings.addWord,
      addUserInfo: compositionSettings.addUserInfo,
      addDifficultyLevel: compositionSettings.addDifficultyLevel,
      userName: userInfo?.displayName ?? "",
    };

    // Use native share on mobile, download on desktop
    if (isMobile) {
      await this.sharer.shareViaDevice(sequence, shareOptions);
    } else {
      await this.sharer.downloadImage(sequence, shareOptions);
    }
  }

  /**
   * Export sequence as animation video
   */
  private async exportAnimation(
    sequence: SequenceData,
    dependencies: AnimationExportDependencies,
    onProgress?: (progress: VideoExportProgress) => void
  ): Promise<void> {
    if (!this.videoOrchestrator) {
      throw new Error(
        "Video export orchestrator not available. Please wait for animation services to load."
      );
    }

    const { canvas, playbackController, animationState } = dependencies;

    // Pause playback during export
    if (animationState.isPlaying) {
      playbackController.togglePlayback();
    }

    await this.videoOrchestrator.executeExport(
      canvas,
      playbackController,
      animationState,
      (progress) => {
        onProgress?.(progress);
        if (progress.stage === "error") {
          throw new Error(progress.error || "Export failed");
        }
      },
      {
        filename: sequence.word || sequence.name || "sequence",
        fps: 50,
        format: "mp4",
      }
    );

    // Short delay before completing for success feedback
    await new Promise((resolve) =>
      setTimeout(resolve, VIDEO_EXPORT_SUCCESS_DELAY_MS)
    );
  }

  /**
   * Export performance video
   * Note: Performance recording/upload happens in PerformancePreview component
   */
  private async exportPerformance(): Promise<void> {
    // Performance video is already recorded/uploaded in the PerformancePreview
    // This just confirms the upload is complete
  }
}
