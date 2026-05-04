/**
 * Core data types for the LED strip pattern engine.
 * StripPattern is the universal currency: every renderer, exporter,
 * and uploader consumes it, every pattern source produces it.
 */

export interface RGBColor {
  r: number; // 0-255
  g: number;
  b: number;
}

/**
 * A single frame of the strip pattern - one color per LED.
 * In POV terms, this is one column of the image.
 */
export interface StripFrame {
  /** RGB interleaved: [R0, G0, B0, R1, G1, B1, ...], length = ledCount * 3 */
  colors: Uint8Array;
}

/**
 * A complete strip pattern: array of frames forming the POV image.
 * Height = ledCount (LEDs along the strip), Width = frameCount (columns).
 */
export interface StripPattern {
  /** Number of LEDs (height of the POV image) */
  ledCount: number;
  /** Number of frames (width of the POV image) */
  frameCount: number;
  /** One StripFrame per column */
  frames: StripFrame[];
  metadata: PatternMetadata;
}

export interface PatternMetadata {
  name: string;
  source: "algorithmic" | "image-upload";
  presetId?: string;
  sourceImagePath?: string;
  createdAt: number;
}

/**
 * Parameters for algorithmic pattern generation.
 */
export interface PatternParams {
  primaryColor: RGBColor;
  secondaryColor?: RGBColor;
  /** Pattern animation speed multiplier (0.1–5.0) */
  speed: number;
  /** Global brightness (0–1) */
  brightness: number;
}

/**
 * Create an empty StripPattern filled with black.
 */
export function createEmptyPattern(
  ledCount: number,
  frameCount: number,
  name: string
): StripPattern {
  const frames: StripFrame[] = [];
  for (let f = 0; f < frameCount; f++) {
    frames.push({ colors: new Uint8Array(ledCount * 3) });
  }
  return {
    ledCount,
    frameCount,
    frames,
    metadata: {
      name,
      source: "algorithmic",
      createdAt: Date.now(),
    },
  };
}

/**
 * Read the RGB color for a specific LED in a specific frame.
 */
export function getPixel(
  pattern: StripPattern,
  frameIndex: number,
  ledIndex: number
): RGBColor {
  const frame = pattern.frames[frameIndex % pattern.frameCount]!;
  const offset = ledIndex * 3;
  return {
    r: frame.colors[offset]!,
    g: frame.colors[offset + 1]!,
    b: frame.colors[offset + 2]!,
  };
}

/**
 * Set the RGB color for a specific LED in a specific frame.
 */
export function setPixel(
  pattern: StripPattern,
  frameIndex: number,
  ledIndex: number,
  color: RGBColor
): void {
  const frame = pattern.frames[frameIndex % pattern.frameCount]!;
  const offset = ledIndex * 3;
  frame.colors[offset] = color.r;
  frame.colors[offset + 1] = color.g;
  frame.colors[offset + 2] = color.b;
}
