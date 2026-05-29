import type { ExportConfig, ExportState } from "../domain/types";

export class VideoTrailsExporter {
  private cancelled = false;

  async export(
    videoElement: HTMLVideoElement,
    canvases: HTMLCanvasElement[],
    config: ExportConfig,
    onProgress: (state: ExportState) => void,
  ): Promise<Blob> {
    this.cancelled = false;
    onProgress({ phase: "preparing" });

    const { width, height } = config.resolution;
    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = width;
    compositeCanvas.height = height;
    const compositeCtx = compositeCanvas.getContext("2d")!;

    return this.exportWithMediaRecorder(videoElement, canvases, compositeCanvas, compositeCtx, config, onProgress);
  }

  cancel(): void {
    this.cancelled = true;
  }

  private async exportWithMediaRecorder(
    videoElement: HTMLVideoElement,
    canvases: HTMLCanvasElement[],
    compositeCanvas: HTMLCanvasElement,
    compositeCtx: CanvasRenderingContext2D,
    config: ExportConfig,
    onProgress: (state: ExportState) => void,
  ): Promise<Blob> {
    onProgress({ phase: "recording", progress: 0 });

    const stream = compositeCanvas.captureStream(config.fps);
    const mimeType = config.format === "webm" ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: config.bitrate });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      recorder.onerror = (e) => reject(e);
    });

    recorder.start();

    const duration = videoElement.duration;
    const totalFrames = Math.ceil(duration * config.fps);
    const frameDuration = 1 / config.fps;

    for (let frame = 0; frame < totalFrames; frame++) {
      if (this.cancelled) {
        recorder.stop();
        throw new Error("Export cancelled");
      }

      videoElement.currentTime = frame * frameDuration;
      await new Promise((r) => {
        videoElement.onseeked = r;
      });

      compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
      compositeCtx.drawImage(videoElement, 0, 0, compositeCanvas.width, compositeCanvas.height);
      for (const canvas of canvases) {
        compositeCtx.drawImage(canvas, 0, 0, compositeCanvas.width, compositeCanvas.height);
      }

      onProgress({ phase: "recording", progress: frame / totalFrames });
      await new Promise((r) => setTimeout(r, 1000 / config.fps));
    }

    recorder.stop();
    const blob = await done;
    onProgress({ phase: "complete", blob });
    return blob;
  }
}
