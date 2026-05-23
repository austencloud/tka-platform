import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface FramePropState {
  centerPathAngle: number;
  staffRotationAngle: number;
  x?: number;
  y?: number;
}

export interface PrecomputedFrame {
  blue: FramePropState | null;
  red: FramePropState | null;
  stepIndex: number;
  isStartPosition: boolean;
}

export interface VideoRenderConfig {
  fps: number;
  resolution: number;
  speed: number;
  propTypes: { blue: PropType; red: PropType };
  loopCount: number;
  includeStartPosition: boolean;
  includeEndHold: boolean;
  baseUrl: string;
  cacheHash?: string;
}

export interface TransferableAssets {
  gridImage: ImageBitmap;
  bluePropImage: ImageBitmap;
  redPropImage: ImageBitmap;
  bluePropViewBox: { width: number; height: number };
  redPropViewBox: { width: number; height: number };
  letterGlyphs: ImageBitmap[];
}

export interface RenderRequest {
  type: "render";
  sequenceData: SequenceData;
  config: VideoRenderConfig;
  frames: PrecomputedFrame[];
  assets: TransferableAssets;
}

export interface RenderProgress {
  type: "progress";
  phase: "loading-assets" | "rendering" | "encoding" | "finalizing";
  percent: number;
}

export interface RenderComplete {
  type: "complete";
  mp4: ArrayBuffer;
  hash: string;
  durationMs: number;
}

export interface RenderError {
  type: "error";
  message: string;
}

export type WorkerInMessage = RenderRequest;
export type WorkerOutMessage = RenderProgress | RenderComplete | RenderError;

export interface FrameTimingResult {
  playbackPosition: number;
  stepIndex: number;
  isStartPosition: boolean;
  isEndHold: boolean;
}

/**
 * Convert a time position (in duration units) to a beat position (float).
 * Accounts for variable step durations so that longer steps occupy
 * proportionally more frames.
 * Extracted from VideoExportOrchestrator.timeToBeat.
 */
export function timeToBeat(
  timeProgress: number,
  cumulativeDurations: number[],
  stepDurations: number[]
): number {
  const stepCount = stepDurations.length;
  if (stepCount === 0) return 0;

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
 * Calculate frame timing for a given frame index within the export timeline.
 * Pure function - no DOM, no RAF, no state.
 * Extracted from VideoExportOrchestrator.executeExport frame loop.
 */
export function calculateFrameTiming(
  frameIndex: number,
  totalFrames: number,
  totalDurationWithHolds: number,
  startPositionDuration: number,
  motionLoopUnits: number,
  totalDurationUnits: number,
  cumulativeDurations: number[],
  stepDurations: number[],
  stepCount: number
): FrameTimingResult {
  const timeProgress = (frameIndex / totalFrames) * totalDurationWithHolds;

  const motionStart = startPositionDuration;
  const motionEnd = motionStart + motionLoopUnits;

  if (startPositionDuration > 0 && timeProgress < motionStart) {
    return {
      playbackPosition: timeProgress / startPositionDuration,
      stepIndex: -1,
      isStartPosition: true,
      isEndHold: false,
    };
  }

  if (motionLoopUnits > 0 && timeProgress >= motionEnd) {
    return {
      playbackPosition: stepCount + 1,
      stepIndex: stepCount - 1,
      isStartPosition: false,
      isEndHold: true,
    };
  }

  const motionTime = timeProgress - motionStart;
  const wrappedMotionTime =
    totalDurationUnits > 0 ? motionTime % totalDurationUnits : 0;
  const rawStep = timeToBeat(
    wrappedMotionTime,
    cumulativeDurations,
    stepDurations
  );

  return {
    playbackPosition: rawStep + 1,
    stepIndex: Math.floor(rawStep),
    isStartPosition: false,
    isEndHold: false,
  };
}

/**
 * Build the timeline parameters needed for frame-by-frame export.
 * Pure function - no DOM, no state.
 */
export function buildTimelineParams(
  stepDurations: number[],
  speed: number,
  fps: number,
  loopCount: number,
  includeStartPosition: boolean,
  includeEndHold: boolean
) {
  const totalDurationUnits =
    stepDurations.reduce((sum, d) => sum + d, 0) || stepDurations.length;
  const startPositionDuration = includeStartPosition ? 1 : 0;
  const endPositionHoldDuration = includeEndHold ? 1 : 0;
  const motionLoopUnits = totalDurationUnits * loopCount;
  const totalDurationWithHolds =
    startPositionDuration + motionLoopUnits + endPositionHoldDuration;

  const secondsPerBeatUnit = 1.0 / speed;
  const totalTimelineSeconds = totalDurationWithHolds * secondsPerBeatUnit;
  const totalFrames = Math.ceil(totalTimelineSeconds * fps);

  const cumulativeDurations: number[] = [];
  let cumulative = 0;
  for (const d of stepDurations) {
    cumulativeDurations.push(cumulative);
    cumulative += d;
  }

  return {
    totalDurationUnits,
    startPositionDuration,
    endPositionHoldDuration,
    motionLoopUnits,
    totalDurationWithHolds,
    totalFrames,
    cumulativeDurations,
    frameDurationMicros: Math.round(1_000_000 / fps),
  };
}
