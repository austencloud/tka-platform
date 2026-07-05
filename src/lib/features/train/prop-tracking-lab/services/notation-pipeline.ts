import type { StaffMotionNotation, StaffPose3D, TrackConfidence } from '../domain/notation-3d';
import { segmentBeatIndices3D, accumulateBetween, DEFAULT_SEGMENT_CONFIG } from './beat-segmenter-3d';
import type { SegmentConfig } from './beat-segmenter-3d';
import { TkaPoseClassifier, DEFAULT_CLASSIFIER_CONFIG } from './tka-pose-classifier';
import type { ClassifierConfig } from './tka-pose-classifier';

export interface BeatNotation {
  blue: StaffMotionNotation;
  red: StaffMotionNotation;
}

/**
 * Full notation pass: per-staff beat segmentation + inter-beat accumulation +
 * classification, paired into one BeatNotation per consecutive beat pair.
 * Beat boundaries are taken from the blue staff (the leader); red is sampled at
 * the same frame indices so the two strands stay aligned.
 *
 * Optional per-frame TrackConfidence streams flow into per-beat
 * `confidenceDetail` (component-wise minimum over the beat span) so the review
 * UI can name the weakest link, not just the weakest number.
 */
export function framesToNotation(
  blueFrames: StaffPose3D[],
  redFrames: StaffPose3D[],
  blueConfidence: number[],
  redConfidence: number[],
  segConfig: SegmentConfig = DEFAULT_SEGMENT_CONFIG,
  classConfig: ClassifierConfig = DEFAULT_CLASSIFIER_CONFIG,
  blueDetail?: TrackConfidence[],
  redDetail?: TrackConfidence[],
): BeatNotation[] {
  const classifier = new TkaPoseClassifier(classConfig);
  // Segment on the blue (leader) stream, gated by its confidence so dropout
  // frames (which hold the last pose upstream) can't fabricate a hold.
  const beatIndices = segmentBeatIndices3D(blueFrames, segConfig, blueConfidence);

  const classify = (
    staff: 'blue' | 'red',
    frames: StaffPose3D[],
    confidence: number[],
    detail: TrackConfidence[] | undefined,
    from: number,
    to: number,
  ): StaffMotionNotation => {
    const acc = from === to ? { arcAngle: 0, propNetRotation: 0 } : accumulateBetween(frames, from, to);
    const notation = classifier.classifyMotion(
      staff,
      frames[from]!,
      frames[to]!,
      acc.arcAngle,
      acc.propNetRotation,
      minSlice(confidence, from, to),
    );
    const confidenceDetail = detail ? minDetailSlice(detail, from, to) : undefined;
    return confidenceDetail ? { ...notation, confidenceDetail } : notation;
  };

  const out: BeatNotation[] = [];
  for (let i = 0; i < beatIndices.length - 1; i++) {
    const from = beatIndices[i]!;
    const to = beatIndices[i + 1]!;
    out.push({
      blue: classify('blue', blueFrames, blueConfidence, blueDetail, from, to),
      red: classify('red', redFrames, redConfidence, redDetail, from, to),
    });
  }

  if (out.length === 0 && beatIndices.length === 1) {
    const idx = beatIndices[0]!;
    out.push({
      blue: classify('blue', blueFrames, blueConfidence, blueDetail, idx, idx),
      red: classify('red', redFrames, redConfidence, redDetail, idx, idx),
    });
  }
  return out;
}

function minSlice(arr: number[], from: number, to: number): number {
  let m = 1;
  for (let i = from; i <= to; i++) m = Math.min(m, arr[i] ?? 1);
  return m;
}

/** Component-wise minimum of TrackConfidence over [from, to]. */
function minDetailSlice(arr: TrackConfidence[], from: number, to: number): TrackConfidence {
  const out: TrackConfidence = { overall: 1, blob: 1, correspondence: 1, orientation: 1 };
  for (let i = from; i <= to; i++) {
    const d = arr[i];
    if (!d) continue;
    out.overall = Math.min(out.overall, d.overall);
    out.blob = Math.min(out.blob, d.blob);
    out.correspondence = Math.min(out.correspondence, d.correspondence);
    out.orientation = Math.min(out.orientation, d.orientation);
  }
  return out;
}
