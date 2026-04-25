import type { IOffline3DExporter } from './services/contracts/IOffline3DExporter';
import { Offline3DExporter } from './services/implementations/Offline3DExporter';
import { getBackgroundVideoEncoder } from '$lib/features/compose/getBackgroundVideoEncoder';
import { getCanvasFrameCapturer } from '$lib/shared/video-export/getCanvasFrameCapturer';
import { getCameraKeyframeInterpolator } from '$lib/shared/video-export/getCameraKeyframeInterpolator';

let instance: IOffline3DExporter | null = null;
export function getOffline3DExporter(): IOffline3DExporter {
  return instance ??= new Offline3DExporter(
    getBackgroundVideoEncoder(),
    getCanvasFrameCapturer(),
    getCameraKeyframeInterpolator()
  );
}
