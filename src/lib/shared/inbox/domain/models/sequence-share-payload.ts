export interface SequenceSharePayload {
  sequenceId: string;
  sequenceWord: string;
  /** The raw word used as the cloud thumbnail storage key (sequence.word) */
  sequenceCloudWord?: string;
  sequenceName?: string;
  sequenceThumbnail?: string;
  sequenceAuthor?: string;
  sequenceStepCount?: number;
}
