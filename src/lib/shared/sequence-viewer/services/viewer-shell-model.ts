import type { ScanAnalyticsValue } from "$lib/shared/analytics/scan-analytics";
import { scanPropProperties } from "$lib/shared/analytics/scan-prop-attribution";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { ShareActionMenuItem } from "$lib/shared/share/domain/models/share-action-menu";
import type { TempoPracticeConfig } from "./tempo-practice-orchestrator";

const DEFAULT_RAIL_WIDTH = 180;
const MIN_RAIL_WIDTH = 72;
const MAX_RAIL_WIDTH = 300;
const EXPORT_SIDEBAR_WIDTH = 560;
const EXPORT_HERO_MIN_WIDTH = 600;

export function resolveExportSidebarMinWidth(
  persistedRailWidth: string | null
): number {
  let railWidth = DEFAULT_RAIL_WIDTH;
  if (persistedRailWidth) {
    const parsed = Number.parseInt(persistedRailWidth, 10);
    if (parsed >= MIN_RAIL_WIDTH && parsed <= MAX_RAIL_WIDTH) {
      railWidth = parsed;
    }
  }

  return railWidth + EXPORT_SIDEBAR_WIDTH + EXPORT_HERO_MIN_WIDTH;
}

export function buildViewerShareActions(
  linkCopied: boolean
): ShareActionMenuItem[] {
  return [
    {
      id: "share-sequence",
      label: "Share Sequence…",
      icon: "fa-share-nodes",
      section: "share",
    },
    {
      id: "send-sequence",
      label: "Send in TKA",
      icon: "fa-paper-plane",
      section: "share",
    },
    {
      id: "copy-link",
      label: linkCopied ? "Copied" : "Copy Link",
      icon: linkCopied ? "fa-check" : "fa-link",
      section: "share",
      tone: linkCopied ? "success" : "default",
      closeOnSelect: false,
    },
  ];
}

export interface VideoExportAnalyticsInput {
  fps: number;
  loopCount: number;
  resolution: string | number;
  includeStartPosition: boolean;
  includeEndHold: boolean;
  renderMode: string;
  playbackMode: string;
  leftPropType: PropType | undefined;
  rightPropType: PropType | undefined;
}

export function buildVideoExportAnalyticsConfig(
  input: VideoExportAnalyticsInput
): Record<string, ScanAnalyticsValue> {
  return {
    fps: input.fps,
    loop_count: input.loopCount,
    resolution: String(input.resolution),
    include_start_position: input.includeStartPosition,
    include_end_hold: input.includeEndHold,
    render_mode: input.renderMode,
    playback_mode: input.playbackMode,
    ...scanPropProperties(input.leftPropType, input.rightPropType),
  };
}

export interface CardExportAnalyticsInput {
  stepCount: number;
  darkMode: boolean;
  includeStartPosition: boolean;
  handPath: boolean;
  leftPropType: PropType | undefined;
  rightPropType: PropType | undefined;
}

export function buildCardExportAnalyticsConfig(
  input: CardExportAnalyticsInput
): Record<string, ScanAnalyticsValue> {
  return {
    step_count: input.stepCount,
    dark_mode: input.darkMode,
    include_start_position: input.includeStartPosition,
    hand_path: input.handPath,
    ...scanPropProperties(input.leftPropType, input.rightPropType),
  };
}

export function buildPracticeConfigProperties(
  config: Partial<TempoPracticeConfig>
): Record<string, ScanAnalyticsValue> {
  return {
    start_bpm: config.startBpm ?? null,
    max_bpm: config.maxBpm ?? null,
    increment: config.increment ?? null,
    rounds_per_level: config.roundsPerLevel ?? null,
    target_enabled: config.targetEnabled ?? null,
    target_bpm: config.targetBpm ?? null,
  };
}
