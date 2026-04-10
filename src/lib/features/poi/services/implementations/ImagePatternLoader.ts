import type { IImagePatternLoader } from "../contracts/IImagePatternLoader";
import type { StripPattern, StripFrame } from "../../domain/StripPattern";

/**
 * Converts raster images into StripPattern data.
 * Image height maps to ledCount, image width maps to frameCount.
 * Uses OffscreenCanvas for resizing when the source height differs
 * from the target LED count.
 */
export class ImagePatternLoader implements IImagePatternLoader {
  fromImageData(imageData: ImageData, targetLedCount: number): StripPattern {
    const sourceHeight = imageData.height;
    const sourceWidth = imageData.width;

    // Resize if source height doesn't match target LED count
    let pixelData: Uint8ClampedArray;
    let width: number;
    let height: number;

    if (sourceHeight !== targetLedCount) {
      const canvas = new OffscreenCanvas(sourceWidth, targetLedCount);
      const ctx = canvas.getContext("2d")!;
      // Draw source image scaled to target height
      const tempCanvas = new OffscreenCanvas(sourceWidth, sourceHeight);
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, sourceWidth, sourceHeight, 0, 0, sourceWidth, targetLedCount);
      const resized = ctx.getImageData(0, 0, sourceWidth, targetLedCount);
      pixelData = resized.data;
      width = sourceWidth;
      height = targetLedCount;
    } else {
      pixelData = imageData.data;
      width = sourceWidth;
      height = sourceHeight;
    }

    // Each column of the image = one frame
    const frames: StripFrame[] = [];
    for (let col = 0; col < width; col++) {
      const colors = new Uint8Array(height * 3);
      for (let row = 0; row < height; row++) {
        const srcIdx = (row * width + col) * 4; // RGBA
        const dstIdx = row * 3;
        colors[dstIdx] = pixelData[srcIdx]!;     // R
        colors[dstIdx + 1] = pixelData[srcIdx + 1]!; // G
        colors[dstIdx + 2] = pixelData[srcIdx + 2]!; // B
        // Alpha channel is ignored — fully transparent pixels become black
      }
      frames.push({ colors });
    }

    return {
      ledCount: height,
      frameCount: width,
      frames,
      metadata: {
        name: "Image Upload",
        source: "image-upload",
        createdAt: Date.now(),
      },
    };
  }

  async fromFile(file: File, targetLedCount: number): Promise<StripPattern> {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();

    const pattern = this.fromImageData(imageData, targetLedCount);
    pattern.metadata.sourceImagePath = file.name;
    pattern.metadata.name = file.name.replace(/\.[^.]+$/, "");
    return pattern;
  }
}
