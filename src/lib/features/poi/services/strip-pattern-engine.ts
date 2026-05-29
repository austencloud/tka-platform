import { fromImageData } from "../image-pattern-loader";
import type { StripPattern, PatternParams, StripFrame } from "$lib/shared/poi/domain/StripPattern";
import type { IPatternPreset } from "../domain/pattern-preset";
import { BUILT_IN_PRESETS } from "../domain/pattern-preset";

/**
 * Orchestrates pattern generation from presets and image loading.
 * Also handles brightness limiting for hardware upload.
 */
export class StripPatternEngine {
  private presets: Map<string, IPatternPreset>;

  constructor() {
    this.presets = new Map();
    for (const preset of BUILT_IN_PRESETS) {
      this.presets.set(preset.id, preset);
    }
  }

  generate(
    presetId: string,
    ledCount: number,
    frameCount: number,
    params: PatternParams
  ): StripPattern {
    const preset = this.presets.get(presetId);
    if (!preset) {
      throw new Error(`Unknown preset: ${presetId}. Available: ${[...this.presets.keys()].join(", ")}`);
    }
    return preset.generate(ledCount, frameCount, params);
  }

  fromImage(imageData: ImageData, ledCount: number): StripPattern {
    return fromImageData(imageData, ledCount);
  }

  toImageData(pattern: StripPattern): ImageData {
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

  getPresets(): IPatternPreset[] {
    return [...this.presets.values()];
  }

  applyBrightnessLimit(
    pattern: StripPattern,
    maxBright: number,
    maxPower: number,
    _groupSize: number
  ): StripPattern {
    const { ledCount, frameCount, frames } = pattern;
    const limitedFrames: StripFrame[] = [];

    for (let f = 0; f < frameCount; f++) {
      const srcFrame = frames[f]!;
      const dstColors = new Uint8Array(srcFrame.colors.length);

      // Compute average brightness for this column
      let totalBrightness = 0;
      for (let led = 0; led < ledCount; led++) {
        const offset = led * 3;
        const r = srcFrame.colors[offset]!;
        const g = srcFrame.colors[offset + 1]!;
        const b = srcFrame.colors[offset + 2]!;
        totalBrightness += (r + g + b) / (3 * 255);
      }
      const avgBright = totalBrightness / ledCount;

      // Ignis brightness formula: ledBright = min(maxBright, floor(maxPower / avgBright))
      const ledBright =
        avgBright > 0
          ? Math.min(maxBright, Math.floor(maxPower / avgBright))
          : maxBright;

      // Scale all colors by ledBright / maxBright ratio
      const scale = ledBright / maxBright;
      for (let i = 0; i < srcFrame.colors.length; i++) {
        dstColors[i] = Math.round(srcFrame.colors[i]! * scale);
      }

      limitedFrames.push({ colors: dstColors });
    }

    return {
      ledCount,
      frameCount,
      frames: limitedFrames,
      metadata: { ...pattern.metadata },
    };
  }
}
