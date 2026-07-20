import type {
  PronunciationManifest,
  PronunciationRecordingSet,
} from "$lib/shared/pronunciation/pronunciation-plan";
import type { PronunciationRecordingJob } from "./recording-jobs";

export function buildPronunciationRecordingManifest(
  includedJobIds: ReadonlySet<string>,
  jobs: readonly PronunciationRecordingJob[]
): PronunciationManifest {
  const recordings: Record<string, PronunciationRecordingSet> = {};
  for (const job of jobs) {
    if (!includedJobIds.has(job.id)) continue;
    const recordingSet = recordings[job.assetKey] ?? {};
    recordingSet[job.position] = job.outputPath;
    recordings[job.assetKey] = recordingSet;
  }
  return { version: 1, recordings };
}
