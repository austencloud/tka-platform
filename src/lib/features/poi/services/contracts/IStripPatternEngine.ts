import type { StripPattern, PatternParams } from "../../domain/StripPattern";
import type { IPatternPreset } from "../../domain/PatternPreset";

export interface IStripPatternEngine {
  /** Generate a pattern from a registered preset */
  generate(presetId: string, ledCount: number, frameCount: number, params: PatternParams): StripPattern;

  /** Create a StripPattern from raw image pixel data */
  fromImage(imageData: ImageData, ledCount: number): StripPattern;

  /** Convert a StripPattern back to ImageData (for PNG export / preview) */
  toImageData(pattern: StripPattern): ImageData;

  /** List all available presets */
  getPresets(): IPatternPreset[];

  /**
   * Apply Ignis-style brightness power limiting.
   * Returns a new pattern with per-column brightness capped.
   * Original pattern is not mutated.
   */
  applyBrightnessLimit(
    pattern: StripPattern,
    maxBright: number,
    maxPower: number,
    groupSize: number
  ): StripPattern;
}
