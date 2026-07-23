import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { generateSequenceRoutePath } from "$lib/shared/navigation/services/sequence-encoder";
import type { MessageAttachment } from "$lib/shared/messaging/domain/models/message-models";
import { buildSequenceSharePayload } from "./build-sequence-share-payload";

export function buildSequenceMessageAttachment(
  sequence: SequenceData
): MessageAttachment {
  const payload = buildSequenceSharePayload(sequence);
  const metadata: NonNullable<MessageAttachment["metadata"]> = {
    sequenceId: payload.sequenceId,
    sequenceWord: payload.sequenceWord,
  };

  if (payload.sequenceCloudWord) {
    metadata.sequenceCloudWord = payload.sequenceCloudWord;
  }
  if (payload.sequenceName) metadata.sequenceName = payload.sequenceName;
  if (payload.sequenceThumbnail) {
    metadata.sequenceThumbnail = payload.sequenceThumbnail;
  }
  if (payload.sequenceAuthor) metadata.sequenceAuthor = payload.sequenceAuthor;
  if (payload.sequenceStepCount) {
    metadata.sequenceStepCount = payload.sequenceStepCount;
  }

  const attachment: MessageAttachment = {
    type: "sequence",
    url: generateSequenceRoutePath(sequence),
    name: payload.sequenceWord,
    metadata,
  };

  if (payload.sequenceThumbnail) {
    attachment.thumbnailUrl = payload.sequenceThumbnail;
  }

  return attachment;
}
