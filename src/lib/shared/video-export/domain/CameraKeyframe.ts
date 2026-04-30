/**
 * A single camera state sample captured during pass 1 (live directing).
 */
export interface CameraKeyframe {
  /** Seconds since recording started */
  timestamp: number;
  /** Camera world position [x, y, z] */
  position: [number, number, number];
  /** Camera orientation as quaternion [x, y, z, w] */
  quaternion: [number, number, number, number];
  /** Field of view in degrees */
  fov: number;
}

/** Minimal camera-like object we read during recording */
interface CameraLike {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
  fov: number;
}

/** Sampling rate in Hz - independent of render frame rate */
const SAMPLE_RATE_HZ = 60;
const SAMPLE_INTERVAL_MS = 1000 / SAMPLE_RATE_HZ;

/**
 * Camera Keyframe Buffer
 *
 * Records camera transforms at 60Hz during live playback (pass 1).
 * The buffer is consumed by CameraKeyframeInterpolator during the
 * deterministic render pass (pass 2).
 */
export class CameraKeyframeBuffer {
  private _keyframes: CameraKeyframe[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startTimeMs = 0;

  get keyframes(): readonly CameraKeyframe[] {
    return this._keyframes;
  }

  /** Duration in seconds from first to last keyframe */
  get duration(): number {
    if (this._keyframes.length < 2) return 0;
    return this._keyframes[this._keyframes.length - 1]!.timestamp - this._keyframes[0]!.timestamp;
  }

  /**
   * Begin sampling the camera at 60Hz.
   * Sampling uses setInterval, not RAF, so it captures smooth input
   * even when the scene renders at low FPS.
   */
  startRecording(camera: CameraLike): void {
    this.stopRecording();
    this._keyframes = [];
    this.startTimeMs = performance.now();

    // Capture the first sample immediately
    this.sample(camera);

    this.intervalId = setInterval(() => {
      this.sample(camera);
    }, SAMPLE_INTERVAL_MS);
  }

  /** Stop recording and finalize the buffer. */
  stopRecording(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Capture a single keyframe from the current camera state.
   * Used for "quick export" - the user wants the current angle, no recording.
   */
  captureStatic(camera: CameraLike): void {
    this._keyframes = [
      {
        timestamp: 0,
        position: [camera.position.x, camera.position.y, camera.position.z],
        quaternion: [
          camera.quaternion.x,
          camera.quaternion.y,
          camera.quaternion.z,
          camera.quaternion.w,
        ],
        fov: camera.fov,
      },
    ];
  }

  private sample(camera: CameraLike): void {
    const timestamp = (performance.now() - this.startTimeMs) / 1000;
    this._keyframes.push({
      timestamp,
      position: [camera.position.x, camera.position.y, camera.position.z],
      quaternion: [
        camera.quaternion.x,
        camera.quaternion.y,
        camera.quaternion.z,
        camera.quaternion.w,
      ],
      fov: camera.fov,
    });
  }
}
