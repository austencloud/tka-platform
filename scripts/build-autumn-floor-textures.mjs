/**
 * Build the runtime texture set for the Autumn forest floor.
 *
 * The generated source image supplies the woodland detail. This pass removes
 * the small border discontinuity left by image generation, then derives a
 * restrained normal map and material roughness from the same periodic pixels.
 * Keeping the maps aligned prevents leaves from looking embossed in places
 * where the color map shows bare soil.
 *
 * Usage:
 *   node scripts/build-autumn-floor-textures.mjs
 */

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import sharp from "sharp";

const OUTPUT_DIRECTORY = resolve("static/textures/autumn-floor");
const QA_DIRECTORY = resolve(tmpdir(), "tka-autumn-evidence");
const SOURCE_PATH = resolve(OUTPUT_DIRECTORY, "albedo-source.png");
const FOREST_FLOOR_PATH = resolve("static/textures/forest-floor/diffuse.jpg");
const DIRT_PATH = resolve("static/textures/terrain/dirt/diffuse.jpg");
const SIZE = 2048;
const DERIVED_SIZE = 1024;
const SEAM_BAND = 128;

function smoothstep(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function matchHorizontalEdges(pixels, width, height, channels, band) {
  for (let y = 0; y < height; y += 1) {
    for (let offset = 0; offset < band; offset += 1) {
      const leftX = offset;
      const rightX = width - 1 - offset;
      const strength = smoothstep(1 - offset / band);
      for (let channel = 0; channel < channels; channel += 1) {
        const leftIndex = (y * width + leftX) * channels + channel;
        const rightIndex = (y * width + rightX) * channels + channel;
        const left = pixels[leftIndex];
        const right = pixels[rightIndex];
        const mean = (left + right) * 0.5;
        pixels[leftIndex] = Math.round(left + (mean - left) * strength);
        pixels[rightIndex] = Math.round(right + (mean - right) * strength);
      }
    }
  }
}

function matchVerticalEdges(pixels, width, height, channels, band) {
  for (let x = 0; x < width; x += 1) {
    for (let offset = 0; offset < band; offset += 1) {
      const topY = offset;
      const bottomY = height - 1 - offset;
      const strength = smoothstep(1 - offset / band);
      for (let channel = 0; channel < channels; channel += 1) {
        const topIndex = (topY * width + x) * channels + channel;
        const bottomIndex = (bottomY * width + x) * channels + channel;
        const top = pixels[topIndex];
        const bottom = pixels[bottomIndex];
        const mean = (top + bottom) * 0.5;
        pixels[topIndex] = Math.round(top + (mean - top) * strength);
        pixels[bottomIndex] = Math.round(bottom + (mean - bottom) * strength);
      }
    }
  }
}

function makePeriodic(pixels, width, height, channels) {
  matchHorizontalEdges(pixels, width, height, channels, SEAM_BAND);
  matchVerticalEdges(pixels, width, height, channels, SEAM_BAND);
}

function luminanceAt(pixels, width, height, x, y) {
  const wrappedX = (x + width) % width;
  const wrappedY = (y + height) % height;
  const index = (wrappedY * width + wrappedX) * 3;
  return (
    pixels[index] * 0.2126 +
    pixels[index + 1] * 0.7152 +
    pixels[index + 2] * 0.0722
  );
}

function deriveRoughness(albedo, width, height) {
  const roughness = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const center = luminanceAt(albedo, width, height, x, y);
      const neighborhood =
        (luminanceAt(albedo, width, height, x - 1, y) +
          luminanceAt(albedo, width, height, x + 1, y) +
          luminanceAt(albedo, width, height, x, y - 1) +
          luminanceAt(albedo, width, height, x, y + 1)) /
        4;
      const microVariation = Math.min(
        0.055,
        (Math.abs(center - neighborhood) / 255) * 0.32
      );
      const value = Math.max(
        0.66,
        Math.min(0.98, 0.68 + (center / 255) * 0.25 + microVariation)
      );
      roughness[y * width + x] = Math.round(value * 255);
    }
  }
  matchHorizontalEdges(roughness, width, height, 1, SEAM_BAND);
  matchVerticalEdges(roughness, width, height, 1, SEAM_BAND);
  return roughness;
}

function deriveNormal(albedo, width, height) {
  const normal = new Uint8Array(width * height * 3);
  const zStrength = 520;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const leftTop = luminanceAt(albedo, width, height, x - 1, y - 1);
      const left = luminanceAt(albedo, width, height, x - 1, y);
      const leftBottom = luminanceAt(albedo, width, height, x - 1, y + 1);
      const rightTop = luminanceAt(albedo, width, height, x + 1, y - 1);
      const right = luminanceAt(albedo, width, height, x + 1, y);
      const rightBottom = luminanceAt(albedo, width, height, x + 1, y + 1);
      const top = luminanceAt(albedo, width, height, x, y - 1);
      const bottom = luminanceAt(albedo, width, height, x, y + 1);

      const gradientX =
        rightTop + right * 2 + rightBottom - (leftTop + left * 2 + leftBottom);
      const gradientY =
        leftBottom + bottom * 2 + rightBottom - (leftTop + top * 2 + rightTop);

      const nx = -gradientX;
      const ny = gradientY;
      const length = Math.hypot(nx, ny, zStrength);
      const index = (y * width + x) * 3;
      normal[index] = Math.round((nx / length) * 127.5 + 127.5);
      normal[index + 1] = Math.round((ny / length) * 127.5 + 127.5);
      normal[index + 2] = Math.round((zStrength / length) * 127.5 + 127.5);
    }
  }

  matchHorizontalEdges(normal, width, height, 3, SEAM_BAND);
  matchVerticalEdges(normal, width, height, 3, SEAM_BAND);
  return normal;
}

function edgeMeanDifference(pixels, width, height, channels) {
  let horizontal = 0;
  let vertical = 0;
  for (let y = 0; y < height; y += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const left = y * width * channels + channel;
      const right = (y * width + width - 1) * channels + channel;
      horizontal += Math.abs(pixels[left] - pixels[right]);
    }
  }
  for (let x = 0; x < width; x += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const top = x * channels + channel;
      const bottom = ((height - 1) * width + x) * channels + channel;
      vertical += Math.abs(pixels[top] - pixels[bottom]);
    }
  }
  return {
    leftRight: horizontal / (height * channels),
    topBottom: vertical / (width * channels),
  };
}

async function writeColorGrade(
  sourcePath,
  outputName,
  { brightness, saturation, tint, tintStrength }
) {
  const resizedSource = await sharp(sourcePath)
    .resize(DERIVED_SIZE, DERIVED_SIZE, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .removeAlpha()
    .raw()
    .toBuffer();

  const pixels = new Uint8Array(resizedSource);
  const tintScale = tint.map((channel) => channel / 255);
  for (let index = 0; index < pixels.length; index += 3) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const channels = [red, green, blue];
    for (let channel = 0; channel < 3; channel += 1) {
      const desaturated =
        luminance + (channels[channel] - luminance) * saturation;
      const multiplier =
        1 - tintStrength + tintScale[channel] * tintStrength;
      pixels[index + channel] = Math.round(
        Math.max(0, Math.min(255, desaturated * multiplier * brightness))
      );
    }
  }

  await sharp(pixels, {
    raw: { width: DERIVED_SIZE, height: DERIVED_SIZE, channels: 3 },
  })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(resolve(OUTPUT_DIRECTORY, outputName));
}

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
await mkdir(QA_DIRECTORY, { recursive: true });

const resized = await sharp(SOURCE_PATH)
  .resize(SIZE, SIZE, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const albedo = new Uint8Array(resized.data);
makePeriodic(albedo, SIZE, SIZE, 3);
const roughness = deriveRoughness(albedo, SIZE, SIZE);
const normal = deriveNormal(albedo, SIZE, SIZE);

await Promise.all([
  sharp(albedo, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUTPUT_DIRECTORY, "albedo.png")),
  sharp(roughness, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUTPUT_DIRECTORY, "roughness.png")),
  sharp(normal, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUTPUT_DIRECTORY, "normal.png")),
  sharp(albedo, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .extend({
      top: 0,
      bottom: SIZE,
      left: 0,
      right: SIZE,
      extendWith: "repeat",
    })
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toFile(resolve(QA_DIRECTORY, "autumn-floor-tile-preview-2x2.jpg")),
]);

// The periodic Autumn albedo must be on disk before its warm and cool grades
// are derived. This keeps first-run builds deterministic instead of depending
// on which parallel image write happens to finish first.
await Promise.all([
  writeColorGrade(FOREST_FLOOR_PATH, "soil-albedo.jpg", {
    brightness: 0.65,
    saturation: 0.65,
    tint: [110, 70, 45],
    tintStrength: 0.42,
  }),
  writeColorGrade(DIRT_PATH, "packed-albedo.jpg", {
    brightness: 0.52,
    saturation: 0.4,
    tint: [105, 65, 40],
    tintStrength: 0.55,
  }),
  writeColorGrade(DIRT_PATH, "moss-albedo.jpg", {
    brightness: 0.55,
    saturation: 0.7,
    tint: [80, 105, 45],
    tintStrength: 0.42,
  }),
  writeColorGrade(FOREST_FLOOR_PATH, "shadow-albedo.jpg", {
    brightness: 0.45,
    saturation: 0.4,
    tint: [65, 40, 45],
    tintStrength: 0.58,
  }),
  writeColorGrade(resolve(OUTPUT_DIRECTORY, "albedo.png"), "golden-albedo.jpg", {
    brightness: 0.92,
    saturation: 0.85,
    tint: [235, 130, 45],
    tintStrength: 0.25,
  }),
  writeColorGrade(resolve(OUTPUT_DIRECTORY, "albedo.png"), "cool-albedo.jpg", {
    brightness: 0.7,
    saturation: 0.55,
    tint: [80, 55, 90],
    tintStrength: 0.5,
  }),
]);

const albedoEdges = edgeMeanDifference(albedo, SIZE, SIZE, 3);
const normalEdges = edgeMeanDifference(normal, SIZE, SIZE, 3);
const roughnessEdges = edgeMeanDifference(roughness, SIZE, SIZE, 1);

if (
  Math.max(
    ...Object.values(albedoEdges),
    ...Object.values(normalEdges),
    ...Object.values(roughnessEdges)
  ) > 0.01
) {
  throw new Error("Autumn floor texture build left a measurable tile seam.");
}

console.log(
  JSON.stringify(
    {
      size: `${SIZE}x${SIZE}`,
      albedoEdges,
      normalEdges,
      roughnessEdges,
      outputs: [
        "albedo.png",
        "normal.png",
        "roughness.png",
        "soil-albedo.jpg",
        "packed-albedo.jpg",
        "moss-albedo.jpg",
        "shadow-albedo.jpg",
        "golden-albedo.jpg",
        "cool-albedo.jpg",
      ],
    },
    null,
    2
  )
);
