/**
 * IShareHubExportOrchestrator
 *
 * Contract for orchestrating exports from the Share Hub panel.
 * Handles static, animation, and performance exports with progress tracking.
 *
 * Domain: Share Hub - Export Orchestration
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ExportSettings } from "../../domain/models/ExportSettings";
import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";

/** Result of an export operation */
export interface ExportResult {
  success: boolean;
  error?: string;
}

/** Dependencies needed for animation export */
export interface AnimationExportDependencies {
  canvas: HTMLCanvasElement;
  playbackController: IAnimationPlaybackController;
  animationState: AnimationPanelState;
}

/** User info for image export metadata */
export interface ExportUserInfo {
  displayName: string | null;
}

export interface IShareHubExportOrchestrator {
  /**
   * Export a sequence in the specified format.
   * Handles static, animation, and performance exports.
   */
  export(
    sequence: SequenceData,
    settings: ExportSettings,
    options?: {
      animationDependencies?: AnimationExportDependencies;
      userInfo?: ExportUserInfo;
      isMobile?: boolean;
      onProgress?: (progress: VideoExportProgress) => void;
    }
  ): Promise<ExportResult>;

  /**
   * Cancel an ongoing export operation.
   */
  cancelExport(): void;

  /**
   * Check if an export is currently in progress.
   */
  isExporting(): boolean;
}
