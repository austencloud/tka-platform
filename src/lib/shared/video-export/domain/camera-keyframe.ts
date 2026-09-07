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

  /**
   * Rebuild a buffer from keyframes saved earlier, so a film recipe can be
   * re-rendered later without re-recording the camera.
   */
  static fromKeyframes(keyframes: readonly CameraKeyframe[]): CameraKeyframeBuffer {
    const buffer = new CameraKeyframeBuffer();
    buffer._keyframes = keyframes.map((frame) => ({
      timestamp: frame.timestamp,
      position: [...frame.position] as [number, number, number],
      quaternion: [...frame.quaternion] as [number, number, number, number],
      fov: frame.fov,
    }));
    return buffer;
  }

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

/** Hard ceiling on a saved recipe's keyframes. A Firestore document is capped
 *  at 1 MB; a keyframe costs roughly 80 bytes of JSON once rounded, so 6000
 *  frames leaves comfortable room for the rest of the scene snapshot. */
export const MAX_SAVED_KEYFRAMES = 6000;

export interface CompactCameraKeyframeOptions {
  /** Frames per second to keep. Pass 1 samples at 60; half of that is plenty
   *  for a camera path the render pass interpolates anyway. */
  sampleHz?: number;
  /** Decimal places kept on every number. */
  precision?: number;
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function roundKeyframe(frame: CameraKeyframe, precision: number): CameraKeyframe {
  return {
    timestamp: roundTo(frame.timestamp, precision),
    position: [
      roundTo(frame.position[0], precision),
      roundTo(frame.position[1], precision),
      roundTo(frame.position[2], precision),
    ],
    quaternion: [
      roundTo(frame.quaternion[0], precision),
      roundTo(frame.quaternion[1], precision),
      roundTo(frame.quaternion[2], precision),
      roundTo(frame.quaternion[3], precision),
    ],
    fov: roundTo(frame.fov, precision),
  };
}

/**
 * Shrink a recorded camera path so it can be saved alongside the scene without
 * bloating the document. Keeps the first and last samples — those two decide
 * where the film starts, ends, and how long it runs — and thins everything
 * between them down to `sampleHz`. If that still leaves more frames than a
 * document can hold, it thins again by an even stride.
 */
export function compactCameraKeyframes(
  keyframes: readonly CameraKeyframe[],
  options: CompactCameraKeyframeOptions = {}
): CameraKeyframe[] {
  const sampleHz = options.sampleHz ?? 30;
  const precision = options.precision ?? 4;
  if (keyframes.length === 0) return [];
  if (keyframes.length <= 2) return keyframes.map((f) => roundKeyframe(f, precision));

  // The epsilon matters: sample timestamps are floating point, so a gap that
  // is exactly one interval can measure a hair under it and drop the frame,
  // which silently halves the effective rate.
  const minInterval = sampleHz > 0 ? 1 / sampleHz - 1e-6 : 0;
  const first = keyframes[0]!;
  const last = keyframes[keyframes.length - 1]!;

  const thinned: CameraKeyframe[] = [first];
  let lastKeptTime = first.timestamp;
  for (let i = 1; i < keyframes.length - 1; i++) {
    const frame = keyframes[i]!;
    if (frame.timestamp - lastKeptTime >= minInterval) {
      thinned.push(frame);
      lastKeptTime = frame.timestamp;
    }
  }
  thinned.push(last);

  if (thinned.length <= MAX_SAVED_KEYFRAMES) {
    return thinned.map((f) => roundKeyframe(f, precision));
  }

  // Still too many: keep an evenly spaced subset, with the endpoints intact.
  const interior = thinned.slice(1, -1);
  const keepInterior = MAX_SAVED_KEYFRAMES - 2;
  const stride = interior.length / keepInterior;
  const capped: CameraKeyframe[] = [thinned[0]!];
  for (let i = 0; i < keepInterior; i++) {
    capped.push(interior[Math.floor(i * stride)]!);
  }
  capped.push(thinned[thinned.length - 1]!);
  return capped.map((f) => roundKeyframe(f, precision));
}
