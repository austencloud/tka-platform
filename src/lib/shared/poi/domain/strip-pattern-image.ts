import type { StripPattern } from "./strip-pattern";

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
