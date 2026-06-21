import type { StaffPose3D, StaffMotionNotation } from '../domain/notation-3d';
import { segmentBeats3D, accumulateBetween, DEFAULT_SEGMENT_CONFIG } from './beat-segmenter-3d';
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
 */
export function framesToNotation(
  blueFrames: StaffPose3D[],
  redFrames: StaffPose3D[],
  blueConfidence: number[],
  redConfidence: number[],
  segConfig: SegmentConfig = DEFAULT_SEGMENT_CONFIG,
  classConfig: ClassifierConfig = DEFAULT_CLASSIFIER_CONFIG,
): BeatNotation[] {
  const classifier = new TkaPoseClassifier(classConfig);
  const beats = segmentBeats3D(blueFrames, segConfig);

  const beatIndices = beats.map((b) =>
    blueFrames.findIndex((f) => f.gripPos.equals(b.gripPos)),
  );

  const out: BeatNotation[] = [];
  for (let i = 0; i < beatIndices.length - 1; i++) {
    const from = beatIndices[i]!;
    const to = beatIndices[i + 1]!;
    const blueAcc = accumulateBetween(blueFrames, from, to);
    const redAcc = accumulateBetween(redFrames, from, to);

    out.push({
      blue: classifier.classifyMotion(
        'blue', blueFrames[from]!, blueFrames[to]!,
        blueAcc.arcAngle, blueAcc.propNetRotation,
        minSlice(blueConfidence, from, to),
      ),
      red: classifier.classifyMotion(
        'red', redFrames[from]!, redFrames[to]!,
        redAcc.arcAngle, redAcc.propNetRotation,
        minSlice(redConfidence, from, to),
      ),
    });
  }

  if (out.length === 0 && beatIndices.length === 1) {
    const idx = beatIndices[0]!;
    out.push({
      blue: classifier.classifyMotion('blue', blueFrames[idx]!, blueFrames[idx]!, 0, 0, minSlice(blueConfidence, idx, idx)),
      red: classifier.classifyMotion('red', redFrames[idx]!, redFrames[idx]!, 0, 0, minSlice(redConfidence, idx, idx)),
    });
  }
  return out;
}

function minSlice(arr: number[], from: number, to: number): number {
  let m = 1;
  for (let i = from; i <= to; i++) m = Math.min(m, arr[i] ?? 1);
  return m;
}
