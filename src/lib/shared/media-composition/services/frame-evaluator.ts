import type {
  MediaCompositionPreset,
  PresetTimePoint,
} from "$lib/shared/media-composition/domain/media-composition-preset-schema";
import type { ClipTransform } from "$lib/shared/media-composition/domain/media-layout-schema";
import type { SequenceTimeMap } from "$lib/shared/media-composition/domain/sequence-time-map";
import { mediaTimeToSequencePosition } from "$lib/shared/media-composition/domain/sequence-time-map";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  clampDisplayedBeatNumber,
  displayedBeatNumber,
  sequencePositionToAnimationTime,
  wrapSequencePosition,
} from "$lib/shared/animation-engine/services/step-calculator";

export interface SequenceFrameAlignment {
  timeMap: SequenceTimeMap;
  steps: readonly StepData[];
  startPositionDuration: number;
  dwellOnCompletedBeat?: boolean;
}

export interface EvaluatedFrameLayer {
  clipId: string;
  regionId: string;
  sourceRole: string;
  opacity: number;
  sourceTimeSeconds: number;
  projectProgress: number;
  transform: ClipTransform;
  sequencePosition?: number;
  animationTimeSeconds?: number;
  displayedBeatNumber?: number;
}

export function resolvePresetTimePoint(
  point: PresetTimePoint,
  durationSeconds: number
): number {
  return point.unit === "seconds" ? point.value : point.value * durationSeconds;
}

function easeInOut(progress: number): number {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Evaluates every visible visual layer from one project timestamp. Preview and
 * export consume this same result so transition opacity cannot drift later.
 */
export function evaluatePresetFrame(
  preset: MediaCompositionPreset,
  durationSeconds: number,
  timeSeconds: number,
  alignment?: SequenceFrameAlignment | null
): EvaluatedFrameLayer[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError("durationSeconds must be a positive finite number");
  }

  const clampedTime = Math.min(durationSeconds, Math.max(0, timeSeconds));
  // A take that runs the sequence several times through arrives with positions
  // counting past the sequence's length, so it is folded back into one pass
  // here - before anything derives from it, so the card, the animation clock,
  // and the animation layer all cycle together.
  const continuousPosition = alignment
    ? wrapSequencePosition(
        mediaTimeToSequencePosition(alignment.timeMap, clampedTime),
        alignment.steps.length
      )
    : undefined;
  // Step mode holds the completed pose for the beat instead of interpolating
  // toward the next one. Flooring the position is what "hold" means to every
  // downstream consumer at once — the animation layer, the animation clock,
  // and the card's beat number all read from this one value.
  const sequencePosition =
    continuousPosition !== undefined && preset.animationPlaybackMode === "step"
      ? Math.floor(continuousPosition)
      : continuousPosition;
  const animationTimeSeconds =
    alignment && sequencePosition !== undefined
      ? sequencePositionToAnimationTime(
          sequencePosition,
          alignment.steps,
          alignment.startPositionDuration
        )
      : undefined;
  const cardBeatNumber =
    alignment && sequencePosition !== undefined
      ? clampDisplayedBeatNumber(
          displayedBeatNumber(
            sequencePosition,
            alignment.dwellOnCompletedBeat ?? false
          ),
          alignment.steps.length
        )
      : undefined;
  const layers = preset.clips.flatMap((clip): EvaluatedFrameLayer[] => {
    if (clip.kind !== "visual") return [];

    const start = resolvePresetTimePoint(clip.start, durationSeconds);
    const end = resolvePresetTimePoint(clip.end, durationSeconds);
    if (clampedTime < start || clampedTime > end) return [];

    const projectProgress = clamp01((clampedTime - start) / (end - start));
    const sourceIn = resolvePresetTimePoint(clip.sourceIn, durationSeconds);
    const sourceOut = resolvePresetTimePoint(clip.sourceOut, durationSeconds);
    const sourceTimeSeconds =
      sourceIn + (sourceOut - sourceIn) * projectProgress * clip.playbackRate;

    return [
      {
        clipId: clip.id,
        regionId: clip.regionId,
        sourceRole: clip.sourceRole,
        opacity: clip.opacity,
        sourceTimeSeconds,
        projectProgress,
        transform: clip.transform,
        ...(clip.useResolvedTimeMap && sequencePosition !== undefined
          ? {
              sequencePosition,
              animationTimeSeconds,
              displayedBeatNumber: cardBeatNumber,
            }
          : {}),
      },
    ];
  });

  const byId = new Map(layers.map((layer) => [layer.clipId, layer]));
  for (const transition of preset.transitions) {
    const start = resolvePresetTimePoint(transition.start, durationSeconds);
    const end = resolvePresetTimePoint(transition.end, durationSeconds);
    if (clampedTime < start || clampedTime > end) continue;

    const rawProgress = clamp01((clampedTime - start) / (end - start));
    const progress =
      transition.curve === "ease-in-out" ? easeInOut(rawProgress) : rawProgress;
    const outgoing = byId.get(transition.outgoingClipId);
    const incoming = byId.get(transition.incomingClipId);
    if (outgoing) outgoing.opacity *= 1 - progress;
    if (incoming) incoming.opacity *= progress;
  }

  return layers.filter((layer) => layer.opacity > 0.0001);
}
