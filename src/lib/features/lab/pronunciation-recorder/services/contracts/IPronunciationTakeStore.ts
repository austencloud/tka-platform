import type { PronunciationRecordingJob } from "../../domain/recording-jobs";

export interface ConnectedRecordingFolder {
  name: string;
  existingJobIds: string[];
}

export interface IPronunciationTakeStore {
  supportsDirectSave(): boolean;
  connectFolder(
    jobs: readonly PronunciationRecordingJob[]
  ): Promise<ConnectedRecordingFolder>;
  saveTake(
    job: PronunciationRecordingJob,
    wav: Blob,
    jobs: readonly PronunciationRecordingJob[]
  ): Promise<void>;
  exportSessionZip(
    takes: ReadonlyMap<string, Blob>,
    jobs: readonly PronunciationRecordingJob[]
  ): Promise<number>;
  disconnect(): void;
}
