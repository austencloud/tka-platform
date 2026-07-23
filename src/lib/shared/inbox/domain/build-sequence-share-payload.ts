import type {
  SequenceSharePayload,
  SequenceShareSource,
} from "./models/sequence-share-payload";

export function buildSequenceSharePayload(
  seq: SequenceShareSource
): SequenceSharePayload {
  return {
    sequence: seq,
    sequenceId: seq.id,
    sequenceWord: seq.displayName || seq.intendedWord || seq.word || "",
    sequenceCloudWord: seq.word || undefined,
    sequenceName: seq.name || undefined,
    sequenceThumbnail: seq.thumbnails?.[0] || seq.thumbnailUrl || undefined,
    sequenceAuthor: seq.ownerDisplayName || seq.author || undefined,
    sequenceStepCount: seq.steps?.length || undefined,
  };
}
