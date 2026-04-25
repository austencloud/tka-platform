import type { ICameraKeyframeInterpolator } from './services/contracts/ICameraKeyframeInterpolator';
import { CameraKeyframeInterpolator } from './services/implementations/CameraKeyframeInterpolator';

let instance: ICameraKeyframeInterpolator | null = null;
export function getCameraKeyframeInterpolator(): ICameraKeyframeInterpolator {
  return instance ??= new CameraKeyframeInterpolator();
}
