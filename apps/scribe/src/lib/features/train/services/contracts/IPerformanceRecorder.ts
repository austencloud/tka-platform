import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { DetectionFrame } from "../../domain/models/DetectionFrame";
import type { PerformanceData } from "../../domain/models/PerformanceData";

export interface RecordingConfig {
  bpm: number;
  recordVideo: boolean;
}

export interface IPerformanceRecorder {
  startRecording(sequence: SequenceData, config: RecordingConfig): void;
  recordFrame(frame: DetectionFrame): void;
  stopRecording(): Promise<PerformanceData>;
  cancelRecording(): void;
  readonly isRecording: boolean;
  readonly currentSequence: SequenceData | null;
  readonly frameCount: number;
}
