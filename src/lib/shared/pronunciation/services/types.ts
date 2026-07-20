export type PronunciationPlaybackSource =
  | "recorded"
  | "synthetic"
  | "cancelled";

export interface PronunciationPlaybackResult {
  source: PronunciationPlaybackSource;
}

export interface IPronunciationPlayer {
  isSupported(): boolean;
  speak(workspaceLabel: string): Promise<PronunciationPlaybackResult>;
  cancel(): void;
}
