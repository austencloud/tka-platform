import type { SequenceSharePayload } from "./models/sequence-share-payload";

export function buildSequenceSharePayload(seq: {
  id: string;
  displayName?: string;
  intendedWord?: string;
  word?: string;
  name?: string;
  thumbnails?: readonly string[];
  thumbnailUrl?: string;
  ownerDisplayName?: string;
  author?: string;
  steps?: readonly unknown[];
}): SequenceSharePayload {
  return {
    sequenceId: seq.id,
    sequenceWord: seq.displayName || seq.intendedWord || seq.word || "",
    sequenceCloudWord: seq.word || undefined,
    sequenceName: seq.name || undefined,
    sequenceThumbnail: seq.thumbnails?.[0] || seq.thumbnailUrl || undefined,
    sequenceAuthor: seq.ownerDisplayName || seq.author || undefined,
    sequenceStepCount: seq.steps?.length || undefined,
  };
}
