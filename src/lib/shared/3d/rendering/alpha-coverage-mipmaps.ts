import { LinearMipmapLinearFilter, type Texture } from "three";

/**
 * Coverage-preserving alpha mipmaps for alpha-tested foliage.
 *
 * A box-filtered mip chain averages a leaf's alpha with the transparent
 * texels around it, so every level's alpha sits lower than the one before.
 * Against a fixed cutoff that reads as leaves thinning with distance: a crown
 * that is dense at 10 m is a handful of clumps on bare twigs at 60 m, and the
 * rest of the tree is discarded by the alpha test. The fix (Castaño, 2010;
 * the "preserve alpha coverage" import option in the major engines) is to
 * rescale each level's alpha so that the fraction of texels passing the cutoff
 * matches level 0. The silhouette then holds its coverage at every distance.
 *
 * RGB is averaged with alpha weighting so half-covered texels do not drift
 * toward the transparent texels' (usually black) colour and fringe the leaves.
 *
 * Holding level 0's coverage is necessary but not sufficient for a tree. Up
 * close, a leaf card's 35% texel coverage reads as leaves with air between
 * them because dozens of cards overlap in depth. At distance the crown is a
 * handful of cards a few pixels wide, so the same 35% reads as bare twigs. The
 * live A/B on the Flow Fest ride camera (2026-09-01) showed exactly that: the
 * coverage-matched chain still rendered twiggy crowns, while lifting deep
 * levels to ~80% coverage filled them without changing anything near the
 * camera. So the target coverage ramps from level 0's value at
 * `rampStartLevel` to `distantCoverage` at `rampEndLevel`, the way SpeedTree's
 * per-LOD alpha scalar does.
 */

export interface CoverageRampOptions {
  /** Coverage the deepest levels converge to. Default 0.8. */
  readonly distantCoverage?: number;
  /** First level whose target rises above level 0's coverage. Default 2. */
  readonly rampStartLevel?: number;
  /** Level at which the target reaches `distantCoverage`. Default 7. */
  readonly rampEndLevel?: number;
}

const DEFAULT_RAMP: Required<CoverageRampOptions> = {
  distantCoverage: 0.8,
  rampStartLevel: 2,
  rampEndLevel: 7,
};

export interface RgbaLevel {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

const MAXIMUM_ALPHA_SCALE = 16;
const BISECTION_STEPS = 10;

/** Fraction of texels whose alpha passes `cutoff` (0-255 scale). */
export function alphaCoverage(level: RgbaLevel, cutoff: number): number {
  const { data } = level;
  const texels = data.length / 4;
  if (texels === 0) return 0;
  let passing = 0;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index]! >= cutoff) passing += 1;
  }
  return passing / texels;
}

function downsample(source: RgbaLevel): RgbaLevel {
  const width = Math.max(1, source.width >> 1);
  const height = Math.max(1, source.height >> 1);
  const data = new Uint8ClampedArray(width * height * 4);
  const columnStep = source.width > 1 ? 2 : 1;
  const rowStep = source.height > 1 ? 2 : 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alphaSum = 0;
      let samples = 0;
      for (let dy = 0; dy < rowStep; dy += 1) {
        for (let dx = 0; dx < columnStep; dx += 1) {
          const sourceIndex =
            ((y * rowStep + dy) * source.width + (x * columnStep + dx)) * 4;
          const alpha = source.data[sourceIndex + 3]!;
          red += source.data[sourceIndex]! * alpha;
          green += source.data[sourceIndex + 1]! * alpha;
          blue += source.data[sourceIndex + 2]! * alpha;
          alphaSum += alpha;
          samples += 1;
        }
      }
      const targetIndex = (y * width + x) * 4;
      if (alphaSum > 0) {
        data[targetIndex] = red / alphaSum;
        data[targetIndex + 1] = green / alphaSum;
        data[targetIndex + 2] = blue / alphaSum;
      } else {
        // Fully transparent block: keep a plain average so the colour is
        // still sensible if a later scale lifts it above the cutoff.
        let plainRed = 0;
        let plainGreen = 0;
        let plainBlue = 0;
        for (let dy = 0; dy < rowStep; dy += 1) {
          for (let dx = 0; dx < columnStep; dx += 1) {
            const sourceIndex =
              ((y * rowStep + dy) * source.width + (x * columnStep + dx)) * 4;
            plainRed += source.data[sourceIndex]!;
            plainGreen += source.data[sourceIndex + 1]!;
            plainBlue += source.data[sourceIndex + 2]!;
          }
        }
        data[targetIndex] = plainRed / samples;
        data[targetIndex + 1] = plainGreen / samples;
        data[targetIndex + 2] = plainBlue / samples;
      }
      data[targetIndex + 3] = alphaSum / samples;
    }
  }
  return { data, width, height };
}

function scaledCoverage(
  level: RgbaLevel,
  cutoff: number,
  scale: number
): number {
  const { data } = level;
  const texels = data.length / 4;
  let passing = 0;
  for (let index = 3; index < data.length; index += 4) {
    if (Math.min(255, data[index]! * scale) >= cutoff) passing += 1;
  }
  return passing / texels;
}

/**
 * The smallest alpha multiplier in `[1, MAXIMUM_ALPHA_SCALE]` whose coverage
 * reaches `targetCoverage`. Coverage is monotonic in the scale, so bisection
 * lands within a fraction of a percent in ten steps.
 */
export function solveAlphaScale(
  level: RgbaLevel,
  cutoff: number,
  targetCoverage: number
): number {
  if (scaledCoverage(level, cutoff, 1) >= targetCoverage) return 1;
  let low = 1;
  let high = MAXIMUM_ALPHA_SCALE;
  if (scaledCoverage(level, cutoff, high) < targetCoverage) return high;
  for (let step = 0; step < BISECTION_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (scaledCoverage(level, cutoff, middle) >= targetCoverage) high = middle;
    else low = middle;
  }
  return high;
}

function applyAlphaScale(level: RgbaLevel, scale: number): RgbaLevel {
  if (scale === 1) return level;
  const data = new Uint8ClampedArray(level.data);
  for (let index = 3; index < data.length; index += 4) {
    data[index] = Math.min(255, data[index]! * scale);
  }
  return { data, width: level.width, height: level.height };
}

/** Target coverage for `level`, ramping from `baseCoverage` to the distant value. */
export function rampedCoverageTarget(
  level: number,
  baseCoverage: number,
  ramp: Required<CoverageRampOptions>
): number {
  const span = Math.max(1, ramp.rampEndLevel - ramp.rampStartLevel);
  const progress = Math.min(
    1,
    Math.max(0, (level - ramp.rampStartLevel) / span)
  );
  const distant = Math.max(ramp.distantCoverage, baseCoverage);
  return baseCoverage + (distant - baseCoverage) * progress;
}

/**
 * Builds the full chain from `level0` down to 1×1. Level 0 is returned
 * untouched; every later level carries the alpha scale that lifts its
 * coverage against `alphaTest` (0-1, as on a three.js material) to the ramped
 * target: level 0's own coverage near the camera, `distantCoverage` far away.
 */
export function buildCoveragePreservingMipChain(
  level0: RgbaLevel,
  alphaTest: number,
  options: CoverageRampOptions = {}
): RgbaLevel[] {
  const ramp = { ...DEFAULT_RAMP, ...options };
  const cutoff = Math.round(alphaTest * 255);
  const baseCoverage = alphaCoverage(level0, cutoff);
  const chain: RgbaLevel[] = [level0];
  let previous = level0;
  let levelIndex = 0;
  while (previous.width > 1 || previous.height > 1) {
    levelIndex += 1;
    const next = downsample(previous);
    const targetCoverage = rampedCoverageTarget(levelIndex, baseCoverage, ramp);
    const scale = solveAlphaScale(next, cutoff, targetCoverage);
    const level = applyAlphaScale(next, scale);
    chain.push(level);
    // The next level averages the *scaled* alpha, so each level only has to
    // correct its own halving rather than the accumulated loss.
    previous = level;
  }
  return chain;
}

const preparedTextures = new WeakSet<Texture>();

function readLevel0(image: unknown): RgbaLevel | null {
  if (typeof document === "undefined" && typeof OffscreenCanvas === "undefined")
    return null;
  const source = image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | OffscreenCanvas
    | null;
  if (!source || !("width" in source) || !source.width || !source.height) {
    return null;
  }
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(source.width, source.height)
      : Object.assign(document.createElement("canvas"), {
          width: source.width,
          height: source.height,
        });
  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!context) return null;
  context.drawImage(source as CanvasImageSource, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height);
  return { data: pixels.data, width: pixels.width, height: pixels.height };
}

/**
 * Replaces `texture`'s GPU mip chain with a coverage-preserving one. Runs
 * once per texture; later calls are no-ops. Returns whether the texture was
 * prepared on this call.
 */
export function prepareCoveragePreservingAlphaMipmaps(
  texture: Texture,
  alphaTest: number,
  options: CoverageRampOptions = {}
): boolean {
  if (preparedTextures.has(texture) || alphaTest <= 0) return false;
  const level0 = readLevel0(texture.image);
  if (!level0) return false;
  preparedTextures.add(texture);
  const chain = buildCoveragePreservingMipChain(level0, alphaTest, options);
  texture.mipmaps = chain.map(
    (level) =>
      new ImageData(
        Uint8ClampedArray.from(level.data),
        level.width,
        level.height
      )
  );
  texture.generateMipmaps = false;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return true;
}
