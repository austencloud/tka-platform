import type { StripPattern, StripFrame } from "./strip-pattern";

/**
 * Convert a StripPattern (ledCount × frameCount, RGB-interleaved frames)
 * into an ImageData for POV-style rendering: width = frameCount, height =
 * ledCount, so each column is one frame and each row is one LED.
 */
export function stripPatternToImageData(pattern: StripPattern): ImageData {
  const { ledCount, frameCount, frames } = pattern;
  const data = new Uint8ClampedArray(frameCount * ledCount * 4);

  for (let col = 0; col < frameCount; col++) {
    const frame = frames[col]!;
    for (let row = 0; row < ledCount; row++) {
      const srcIdx = row * 3;
      const dstIdx = (row * frameCount + col) * 4;
      data[dstIdx] = frame.colors[srcIdx]!;     // R
      data[dstIdx + 1] = frame.colors[srcIdx + 1]!; // G
      data[dstIdx + 2] = frame.colors[srcIdx + 2]!; // B
      data[dstIdx + 3] = 255;                        // A
    }
  }

  return new ImageData(data, frameCount, ledCount);
}

/**
 * The inverse: read a POV strip image (width = time, height = the LED axis)
 * into a StripPattern of an exact `ledCount × frameCount`, bilinearly
 * resampling both axes. Pure — no canvas — so it runs in a worker, a test,
 * or the render loop's config-change path.
 */
export function imageDataToStripPattern(
  image: ImageData,
  ledCount: number,
  frameCount: number,
  name = "Image Pattern"
): StripPattern {
  const { width: imgW, height: imgH, data } = image;
  const frames: StripFrame[] = [];

  const sampleAxis = (t: number, size: number): { i0: number; i1: number; f: number } => {
    const pos = size > 1 ? t * (size - 1) : 0;
    const i0 = Math.floor(pos);
    return { i0, i1: Math.min(i0 + 1, size - 1), f: pos - i0 };
  };

  for (let col = 0; col < frameCount; col++) {
    const colors = new Uint8Array(ledCount * 3);
    // Sample at pixel centers so a 1:1 image resamples to itself.
    const { i0: x0, i1: x1, f: fx } = sampleAxis(
      frameCount > 1 ? col / (frameCount - 1) : 0,
      imgW
    );

    for (let led = 0; led < ledCount; led++) {
      const { i0: y0, i1: y1, f: fy } = sampleAxis(
        ledCount > 1 ? led / (ledCount - 1) : 0,
        imgH
      );

      const i00 = (y0 * imgW + x0) * 4;
      const i10 = (y0 * imgW + x1) * 4;
      const i01 = (y1 * imgW + x0) * 4;
      const i11 = (y1 * imgW + x1) * 4;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const offset = led * 3;
      for (let channel = 0; channel < 3; channel++) {
        colors[offset + channel] = Math.round(
          data[i00 + channel]! * w00 +
            data[i10 + channel]! * w10 +
            data[i01 + channel]! * w01 +
            data[i11 + channel]! * w11
        );
      }
    }

    frames.push({ colors });
  }

  return {
    ledCount,
    frameCount,
    frames,
    metadata: { name, source: "image-upload", createdAt: Date.now() },
  };
}
