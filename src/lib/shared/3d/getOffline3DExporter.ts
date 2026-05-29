import { Offline3DExporter } from './services/offline-3d-exporter';
import { getBackgroundVideoEncoder } from '$lib/shared/animation-engine/getBackgroundVideoEncoder';
import { getCanvasFrameCapturer } from '$lib/shared/video-export/get-canvas-frame-capturer';

let instance: Offline3DExporter | null = null;
export function getOffline3DExporter(): Offline3DExporter {
  return instance ??= new Offline3DExporter(
    getBackgroundVideoEncoder(),
    getCanvasFrameCapturer()
  );
}
