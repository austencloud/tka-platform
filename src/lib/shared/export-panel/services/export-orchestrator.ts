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
import type { ExportResult, AnimationExportDependencies } from "./types";
import type { ShareOptions } from "$lib/shared/share/domain/models/share-options";
import { DEFAULT_SHARE_OPTIONS } from "$lib/shared/share/domain/models/share-options";
import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
import { VIDEO_EXPORT_SUCCESS_DELAY_MS } from "$lib/shared/animation-engine/domain/constants/timing";
import { getExportOptionsState } from "$lib/shared/animation-panel/state/export-options-state.svelte";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import { hashString } from "$lib/shared/foundation/services/content-hasher";
import { shareBlobNatively } from "$lib/shared/foundation/services/file-downloader";

interface PreparedStaticShare {
  key: string;
  blob: Blob;
  filename: string;
}

type StaticExportOutcome = "completed" | "canceled";

export class ExportOrchestrator {
  private exporting = false;
  private videoOrchestrator: IVideoExportOrchestrator | null = null;
  private preparedStaticShare: PreparedStaticShare | null = null;
  private staticShareInFlight: {
    key: string;
    token: object;
    promise: Promise<PreparedStaticShare>;
  } | null = null;

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
        case "static": {
          const outcome = await this.exportStatic(
            sequence,
            options?.isMobile
          );
          if (outcome === "canceled") {
            return { success: true, canceled: true };
          }
          break;
        }

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
   * Prepare the exact static image before the user taps Share.
   *
   * WebKit requires navigator.share() to run during the initiating gesture.
   * Rendering after the tap can consume that activation, so the export panel
   * warms this entry while its static preview is visible.
   */
  prepareStaticShare(sequence: SequenceData): Promise<PreparedStaticShare> {
    const shareOptions = this.buildStaticShareOptions();
    const key = this.getStaticShareKey(sequence, shareOptions);

    if (this.preparedStaticShare?.key === key) {
      return Promise.resolve(this.preparedStaticShare);
    }
    if (this.staticShareInFlight?.key === key) {
      return this.staticShareInFlight.promise;
    }

    const token = {};
    const promise = this.sharer
      .getImageBlob(sequence, shareOptions)
      .then((blob) => {
        const prepared: PreparedStaticShare = {
          key,
          blob,
          filename: this.sharer.generateFilename(sequence, shareOptions),
        };
        if (this.staticShareInFlight?.token === token) {
          this.preparedStaticShare = prepared;
        }
        return prepared;
      })
      .finally(() => {
        if (this.staticShareInFlight?.token === token) {
          this.staticShareInFlight = null;
        }
      });

    this.staticShareInFlight = { key, token, promise };
    return promise;
  }

  private buildStaticShareOptions(): ShareOptions {
    const imageSettings = getImageCompositionManager();
    const compositionSettings = imageSettings.getSettings();

    return {
      ...DEFAULT_SHARE_OPTIONS,
      format: "PNG",
      quality: 1.0,
      // Use dark mode setting to determine background color
      backgroundColor: compositionSettings.darkMode ? "#0a0a0f" : "#FFFFFF",
      darkMode: compositionSettings.darkMode,
      includeStartPosition: compositionSettings.includeStartPosition,
      addStepNumbers: compositionSettings.addStepNumbers,
      addWord: compositionSettings.addWord,
      addUserInfo: compositionSettings.showNotes,
      addDifficultyLevel: compositionSettings.addDifficultyLevel,
      showNotes: compositionSettings.showNotes,
      customNotesText: compositionSettings.customNotesText,
    };
  }

  private getStaticShareKey(
    sequence: SequenceData,
    shareOptions: ShareOptions
  ): string {
    return hashString(
      `${JSON.stringify(sequence)}\n${JSON.stringify(shareOptions)}`
    );
  }

  /**
   * Export sequence as a static image.
   *
   * On mobile, the native share promise is created before the first await so
   * the browser still sees the current tap as its transient activation.
   */
  private async exportStatic(
    sequence: SequenceData,
    isMobile?: boolean
  ): Promise<StaticExportOutcome> {
    const shareOptions = this.buildStaticShareOptions();

    if (!isMobile) {
      await this.sharer.downloadImage(sequence, shareOptions);
      return "completed";
    }

    const key = this.getStaticShareKey(sequence, shareOptions);
    const prepared =
      this.preparedStaticShare?.key === key ? this.preparedStaticShare : null;

    if (!prepared) {
      void this.prepareStaticShare(sequence);
      throw new Error("Image is still preparing. Tap Share Image again.");
    }

    const shareOperation = shareBlobNatively(prepared.blob, prepared.filename, {
      title: sequence.name || sequence.word || "TKA Sequence",
      text: `TKA sequence: ${sequence.name || sequence.word || "Untitled"}`,
    });
    const result = await shareOperation;

    if (result.status === "shared") return "completed";
    if (result.status === "canceled") return "canceled";
    if (result.status === "unavailable") {
      throw new Error(
        "Image sharing isn't available here. Use Download Card from the workspace share menu."
      );
    }

    throw result.error;
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
        leftPropType: settingsService.settings.leftPropType ?? settingsService.settings.propType ?? "staff",
        rightPropType: settingsService.settings.rightPropType ?? settingsService.settings.propType ?? "staff",
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
