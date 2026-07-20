export interface MicrophoneOption {
  deviceId: string;
  label: string;
}

export interface MicrophoneSettings {
  label: string;
  sampleRate?: number;
  sampleSize?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface ConnectedMicrophone {
  stream: MediaStream;
  devices: MicrophoneOption[];
  settings: MicrophoneSettings;
}

export interface RawPronunciationTake {
  blob: Blob;
  audioBuffer: AudioBuffer;
  durationSeconds: number;
}

export interface DeliveryRange {
  startSeconds: number;
  endSeconds: number;
}

export interface IPronunciationRecorder {
  isSupported(): boolean;
  listMicrophones(): Promise<MicrophoneOption[]>;
  connect(deviceId?: string): Promise<ConnectedMicrophone>;
  startTake(): Promise<void>;
  finishTake(): Promise<RawPronunciationTake>;
  discardTake(): Promise<void>;
  renderDelivery(audioBuffer: AudioBuffer, range: DeliveryRange): Promise<Blob>;
  dispose(): Promise<void>;
}
