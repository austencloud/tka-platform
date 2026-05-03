import { CameraKeyframeInterpolator } from './services/implementations/CameraKeyframeInterpolator';

let instance: CameraKeyframeInterpolator | null = null;
export function getCameraKeyframeInterpolator(): CameraKeyframeInterpolator {
  return instance ??= new CameraKeyframeInterpolator();
}
