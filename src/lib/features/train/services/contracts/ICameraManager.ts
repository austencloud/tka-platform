export interface CameraConfig {
  facingMode: "user" | "environment";
  width: number;
  height: number;
  frameRate: number;
}

export interface ICameraManager {
  initialize(config?: Partial<CameraConfig>): Promise<void>;
  start(): Promise<MediaStream>;
  stop(): void;
  switchCamera(): Promise<void>;
  getVideoElement(): HTMLVideoElement | null;
  captureFrame(): ImageData | null;
  readonly isActive: boolean;
  readonly currentConfig: CameraConfig;
  readonly availableCameras: MediaDeviceInfo[];
}
