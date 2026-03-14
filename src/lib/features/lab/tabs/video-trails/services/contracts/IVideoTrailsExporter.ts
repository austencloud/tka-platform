import type { ExportConfig, ExportState } from "../../domain/types";

export interface IVideoTrailsExporter {
  export(
    videoElement: HTMLVideoElement,
    canvases: HTMLCanvasElement[],
    config: ExportConfig,
    onProgress: (state: ExportState) => void,
  ): Promise<Blob>;
  cancel(): void;
}
