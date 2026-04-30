import type { StripPattern } from "../../domain/StripPattern";

export interface IImagePatternLoader {
  /** Default mode: polar sampling. Uploaded artwork appears undistorted on disc. */
  fromImageData(imageData: ImageData, targetLedCount: number): StripPattern;

  /** Polar sampling - treats image as desired disc appearance. */
  fromDiscImage(imageData: ImageData, targetLedCount: number): StripPattern;

  /** Strip mode - each column = one frame, each row = one LED. For POV-formatted images. */
  fromStripImage(imageData: ImageData, targetLedCount: number): StripPattern;

  /** Load a File (PNG/BMP/JPG), decode, and convert to StripPattern */
  fromFile(file: File, targetLedCount: number): Promise<StripPattern>;
}
