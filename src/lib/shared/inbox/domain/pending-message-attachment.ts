import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export type PendingMessageAttachment =
  | {
      type: "image";
      file: File;
      messageId: string;
      attachmentId: string;
    }
  | {
      type: "sequence";
      sequence: SequenceData;
    };
