import type {
  SequenceSharePayload,
  SequenceShareSource,
} from "./models/sequence-share-payload";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

export function buildSequenceSharePayload(
  seq: SequenceShareSource
): SequenceSharePayload {
  const sequenceWord = simplifyRepeatedWord(
    seq.displayName || seq.intendedWord || seq.word || ""
  );

  return {
    sequence: seq,
    sequenceId: seq.id,
    sequenceWord,
    sequenceCloudWord: seq.word || undefined,
    sequenceName: seq.name || undefined,
    sequenceThumbnail: seq.thumbnails?.[0] || seq.thumbnailUrl || undefined,
    sequenceAuthor: seq.ownerDisplayName || seq.author || undefined,
    sequenceStepCount: seq.steps?.length || undefined,
  };
}
