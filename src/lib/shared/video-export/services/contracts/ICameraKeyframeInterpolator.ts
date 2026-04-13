import type { CameraKeyframe } from "$lib/shared/video-export/domain/CameraKeyframe";

export interface InterpolatedCamera {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  fov: number;
}

export interface ICameraKeyframeInterpolator {
  interpolate(
    keyframes: readonly CameraKeyframe[],
    t: number
  ): InterpolatedCamera;
}
