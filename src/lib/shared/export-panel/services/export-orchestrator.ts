/**
 * ExportOrchestrator
 *
 * Orchestrates export operations from the export panel.
 * Handles static image, animation video, and performance video exports.
 *
 * Domain: Export Panel - Export Orchestration
 */

import type { Sharer } from "$lib/shared/share/services/sharer";
import type { IVideoExportOrchestrator, VideoExportProgress } from "$lib/shared/compose/domain/video-export-types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { ExportSettings } from "../domain/models/export-settings";
import type { ExportResult, AnimationExportDependencies, ExportUserInfo } from "./types";
import type { ShareOptions } from "$lib/shared/share/domain/models/share-options";
import { DEFAULT_SHARE_OPTIONS } from "$lib/shared/share/domain/models/share-options";
import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
import { buildCardRenderOptions } from "$lib/shared/share/services/card-render-options";
import { VIDEO_EXPORT_SUCCESS_DELAY_MS } from "$lib/shared/animation-engine/domain/constants/timing";
import { getExportOptionsState } from "$lib/shared/animation-panel/state/export-options-state.svelte";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";

export class ExportOrchestrator {
  private exporting = false;
  private videoOrchestrator: IVideoExportOrchestrator | null = null;

  constructor(private readonly sharer: Sharer) {}

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
      // Use dark mode setting to determine background color
      backgroundColor: compositionSettings.darkMode ? "#0a0a0f" : "#FFFFFF",
      darkMode: compositionSettings.darkMode,
      includeStartPosition: compositionSettings.includeStartPosition,
      addStepNumbers: compositionSettings.addStepNumbers,
      addWord: compositionSettings.addWord,
      addUserInfo: compositionSettings.addUserInfo,
      addDifficultyLevel: compositionSettings.addDifficultyLevel,
      userName: userInfo?.displayName ?? "",
      // Granular footer controls
      showCreatorName: compositionSettings.showCreatorName,
      showNotes: compositionSettings.showNotes,
      showBirthday: compositionSettings.showBirthday,
      customNotesText: compositionSettings.customNotesText,
      // ShareOptions can't carry the LOOP/mandala/QR/grid/columns/start-layout
      // toggles, so funnel them through the canonical builder. Without this the
      // create-module static export silently dropped all six.
      renderOverrides: buildCardRenderOptions(sequence, {
        darkMode: compositionSettings.darkMode,
        userName: userInfo?.displayName ?? "",
      }),
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

    const exportOpts = getExportOptionsState().getVideoOptions();
    const orchestrator = this.videoOrchestrator;

    await orchestrator.executeExport(
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
        fps: exportOpts.fps,
        resolution: exportOpts.resolution,
        loopCount: exportOpts.loopCount,
        includeAnimationStartPosition: exportOpts.includeStartPosition,
        includeEndHold: exportOpts.includeEndHold,
        effectOverrides: exportOpts.effectOverrides ?? undefined,
        format: "mp4",
        // App mode: thread the user's chosen prop so the offscreen export engine
        // loads the matching textures instead of falling back to default "staff".
        bluePropType: settingsService.settings.bluePropType ?? settingsService.settings.propType ?? "staff",
        redPropType: settingsService.settings.redPropType ?? settingsService.settings.propType ?? "staff",
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
