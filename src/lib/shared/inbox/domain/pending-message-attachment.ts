import type { SequenceSharePayload } from "./models/sequence-share-payload";

/**
 * What is staged to send with a message.
 *
 * The sequence arm carries the full SequenceSharePayload, not a bare
 * SequenceData: the share sheet renders sequenceWord / sequenceThumbnail /
 * sequenceAuthor / sequenceStepCount, none of which exist on SequenceData.
 * The field is named `payload` rather than `sequence` so consumers reach the
 * raw sequence as `attachment.payload.sequence` instead of the
 * `attachment.sequence.sequence` trap.
 */
export type PendingMessageAttachment =
  | {
      type: "image";
      file: File;
      messageId: string;
      attachmentId: string;
    }
  | {
      type: "sequence";
      payload: SequenceSharePayload;
    };
