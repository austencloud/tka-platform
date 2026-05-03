// --- From CameraKeyframeInterpolator ---
import type { CameraKeyframe } from "$lib/shared/video-export/domain/CameraKeyframe";

export interface InterpolatedCamera {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  fov: number;
}

