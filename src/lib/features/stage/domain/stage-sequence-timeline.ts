import type { Performer, StageSequenceClip } from "./stage-types";
import {
  sampleSequencePlayback,
  type SequencePlaybackSample,
} from "./stage-performance-sampler";

const BEAT_EPSILON = 0.000_001;

export interface ActiveStageSequenceSample extends SequencePlaybackSample {
  clip: StageSequenceClip;
  sourceBeat: number;
}

export function getStageSequenceClipEnd(clip: StageSequenceClip): number {
  return clip.startBeat + clip.durationBeats;
}

export function getPerformerSequenceEndBeat(performer: Performer): number {
  return performer.sequenceClips.reduce(
    (latest, clip) => Math.max(latest, getStageSequenceClipEnd(clip)),
    0
  );
}

export function sortStageSequenceClips(
  clips: readonly StageSequenceClip[]
): StageSequenceClip[] {
  return [...clips].sort(
    (a, b) => a.startBeat - b.startBeat || a.id.localeCompare(b.id)
  );
}

/**
 * Resolve the clip that owns a beat. Boundaries belong to the clip beginning
 * at that beat, which makes adjacent edits switch without a one-frame flash.
 */
export function getActiveStageSequenceClip(
  performer: Performer,
  beat: number
): StageSequenceClip | null {
  const clips = sortStageSequenceClips(performer.sequenceClips);
  for (let index = clips.length - 1; index >= 0; index -= 1) {
    const clip = clips[index]!;
    const end = getStageSequenceClipEnd(clip);
    if (beat + BEAT_EPSILON >= clip.startBeat && beat < end - BEAT_EPSILON) {
      return clip;
    }
    if (index === clips.length - 1 && Math.abs(beat - end) <= BEAT_EPSILON) {
      return clip;
    }
  }
  return null;
}

export function sampleStageSequenceClip(
  clip: StageSequenceClip,
  beat: number
): ActiveStageSequenceSample {
  const timelineProgress = Math.max(
    0,
    Math.min(1, (beat - clip.startBeat) / Math.max(clip.durationBeats, 0.25))
  );
  const sourceBeat = timelineProgress * Math.max(1, clip.sourceBeatCount);
  const playback = sampleSequencePlayback(
    sourceBeat,
    Math.max(1, clip.sourceBeatCount),
    clip.loop
  );

  return { clip, sourceBeat, ...playback };
}

export function samplePerformerSequenceAtBeat(
  performer: Performer,
  beat: number
): ActiveStageSequenceSample | null {
  const clip = getActiveStageSequenceClip(performer, beat);
  return clip ? sampleStageSequenceClip(clip, beat) : null;
}
