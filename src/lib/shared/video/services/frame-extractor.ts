import type { ExtractedFrame, FrameExtractionConfig } from "./types";

function seekTo(
  videoElement: HTMLVideoElement,
  timeSeconds: number,
): Promise<void> {
  if (Math.abs(videoElement.currentTime - timeSeconds) < 0.001) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const onSeeked = () => {
      videoElement.removeEventListener("seeked", onSeeked);
      resolve();
    };
    videoElement.addEventListener("seeked", onSeeked);
    videoElement.currentTime = timeSeconds;
  });
}

export async function* extractFrames(
  videoElement: HTMLVideoElement,
  config: FrameExtractionConfig,
  onProgress: (progress: number) => void,
): AsyncGenerator<ExtractedFrame> {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Failed to create 2D context for frame extraction");
  }

  const totalFrames = Math.ceil(
    (config.endFrame - config.startFrame) / config.stepSize,
  );
  let extracted = 0;

  for (
    let frame = config.startFrame;
    frame <= config.endFrame;
    frame += config.stepSize
  ) {
    await seekTo(videoElement, frame / config.fps);

    ctx.drawImage(videoElement, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    extracted++;
    onProgress(totalFrames > 0 ? extracted / totalFrames : 1);

    yield {
      index: frame,
      timestamp: frame / config.fps,
      imageData,
      width: canvas.width,
      height: canvas.height,
    };
  }
}

export async function extractSingleFrame(
  videoElement: HTMLVideoElement,
  frameIndex: number,
  fps: number,
): Promise<ExtractedFrame> {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Failed to create 2D context for frame extraction");
  }

  await seekTo(videoElement, frameIndex / fps);

  ctx.drawImage(videoElement, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return {
    index: frameIndex,
    timestamp: frameIndex / fps,
    imageData,
    width: canvas.width,
    height: canvas.height,
  };
}
