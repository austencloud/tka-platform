/**
 * ITimelineSnapper - Contract for timeline snapping functionality
 *
 * Provides snap calculations for clip positioning:
 * - Snap to beats (from audio BPM)
 * - Snap to other clip edges
 * - Snap to grid intervals
 * - Snap to playhead position
 */

import type {
  TimeSeconds,
  TimelineClip,
  SnapSettings,
} from "../../domain/timeline-types";

export type SnapType = "beat" | "clip-start" | "clip-end" | "grid" | "playhead";

export interface SnapPoint {
  time: TimeSeconds;
  type: SnapType;
  label?: string;
}

export interface SnapResult {
  /** The snapped time value */
  time: TimeSeconds;
  /** Whether a snap occurred */
  didSnap: boolean;
  /** The type of snap point that was hit */
  snapType: SnapType | null;
  /** Distance from the original position */
  distance: number;
}

export interface SnapContext {
  /** All clips in the timeline */
  clips: TimelineClip[];
  /** Clip IDs to exclude from snap points (e.g., the clip being dragged) */
  excludeClipIds: string[];
  /** Audio BPM for beat markers */
  audioBpm: number | null;
  /** Audio duration for beat marker generation */
  audioDuration: number;
  /** Current playhead position */
  playheadPosition: TimeSeconds;
  /** Snap settings */
  settings: SnapSettings;
}

export interface ITimelineSnapper {
  // State
  readonly activeSnapResult: SnapResult | null;
  readonly activeSnapTime: TimeSeconds | null;
  readonly activeSnapType: SnapType | null;
  readonly isSnapping: boolean;
  readonly draggingClipIds: string[];
  readonly isSnapEnabled: boolean;

  // Snap calculations
  snapTime(time: TimeSeconds, excludeClipIds?: string[]): TimeSeconds;
  previewSnap(time: TimeSeconds, excludeClipIds?: string[]): SnapResult;
  getSnapPoints(excludeClipIds?: string[]): SnapPoint[];

  // Drag state management
  startDrag(clipIds: string[]): void;
  endDrag(): void;
  clearActiveSnap(): void;

  // Settings
  toggleSnap(): void;
}
