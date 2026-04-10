import type { StripPattern } from "../../domain/StripPattern";

export interface IImagePatternLoader {
  /** Convert raw ImageData to a StripPattern, resizing height to targetLedCount */
  fromImageData(imageData: ImageData, targetLedCount: number): StripPattern;

  /** Load a File (PNG/BMP/JPG), decode, and convert to StripPattern */
  fromFile(file: File, targetLedCount: number): Promise<StripPattern>;
}
