import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export type SequenceShareSource = SequenceData & {
  thumbnailUrl?: string;
};

export interface SequenceSharePayload {
  sequence: SequenceShareSource;
  sequenceId: string;
  sequenceWord: string;
  /** The raw word used as the cloud thumbnail storage key (sequence.word) */
  sequenceCloudWord?: string;
  sequenceName?: string;
  sequenceThumbnail?: string;
  sequenceAuthor?: string;
  sequenceStepCount?: number;
}
