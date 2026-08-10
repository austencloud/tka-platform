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

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import sharp from "sharp";

const OUTPUT_DIRECTORY = resolve("static/textures/autumn-floor");
const QA_DIRECTORY = resolve(tmpdir(), "tka-autumn-evidence");
const SOURCE_PATH = resolve(OUTPUT_DIRECTORY, "albedo-source.png");
const FOREST_FLOOR_PATH = resolve("static/textures/forest-floor/diffuse.jpg");
const DIRT_PATH = resolve("static/textures/terrain/dirt/diffuse.jpg");
const GROUND_LAYOUT_PATH = resolve("scripts/autumn-ground-layout.json");
const ZONED_OUTPUT_PATH = resolve(OUTPUT_DIRECTORY, "autumn-ground-zoned.jpg");
const DETAIL_MODULATION_PATH = resolve(
  OUTPUT_DIRECTORY,
  "ground-detail-modulation.png"
);
const DETAIL_MODULATION_KTX2_PATH = resolve(
  OUTPUT_DIRECTORY,
  "ground-detail-modulation.ktx2"
);
const SIZE = 2048;
const DERIVED_SIZE = 1024;
const DETAIL_SIZE = 1024;
const SEAM_BAND = 128;
const ZONED_SIZE = 4096;
const MACRO_SIZE = 512;
const SAMPLE_TILE_SIZE = 256;
const groundLayout = JSON.parse(await readFile(GROUND_LAYOUT_PATH, "utf8"));
const TOKTX_PATH = [
  resolve(".tools/ktx/toktx.exe"),
  resolve(".tools/ktx/toktx"),
].find(existsSync);

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

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function srgbToLinear(value) {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function linearToSrgb(value) {
  const channel = clamp(value);
  const encoded =
    channel <= 0.0031308
      ? channel * 12.92
      : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

async function buildGroundDetailModulation(albedo) {
  if (!TOKTX_PATH) {
    throw new Error("KTX-Software is required to build Autumn ground detail.");
  }

  const detail = await sharp(albedo, {
    raw: { width: SIZE, height: SIZE, channels: 3 },
  })
    .resize(DETAIL_SIZE, DETAIL_SIZE, { kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer();
  const localAverage = await sharp(detail, {
    raw: { width: DETAIL_SIZE, height: DETAIL_SIZE, channels: 3 },
  })
    .blur(14)
    .raw()
    .toBuffer();
  const modulation = new Uint8Array(detail.length);

  for (let index = 0; index < detail.length; index += 3) {
    const sourceLinear = [
      srgbToLinear(detail[index]),
      srgbToLinear(detail[index + 1]),
      srgbToLinear(detail[index + 2]),
    ];
    const averageLinear = [
      srgbToLinear(localAverage[index]),
      srgbToLinear(localAverage[index + 1]),
      srgbToLinear(localAverage[index + 2]),
    ];
    const luminance =
      sourceLinear[0] * 0.2126 +
      sourceLinear[1] * 0.7152 +
      sourceLinear[2] * 0.0722;

    for (let channel = 0; channel < 3; channel += 1) {
      // The runtime multiplies this texture over the world-space atlas. A
      // neutral 0.5 linear value therefore means "leave the macro colour
      // alone". Local leaf edges and veins move above or below that midpoint,
      // while a restrained amount of warm chroma survives the high-pass.
      const highFrequency =
        (sourceLinear[channel] - averageLinear[channel]) * 1.65;
      const chroma = (sourceLinear[channel] - luminance) * 0.22;
      modulation[index + channel] = linearToSrgb(
        clamp(0.5 + highFrequency + chroma, 0.22, 0.78)
      );
    }
  }

  await sharp(modulation, {
    raw: { width: DETAIL_SIZE, height: DETAIL_SIZE, channels: 3 },
  })
    .png({ compressionLevel: 9 })
    .toFile(DETAIL_MODULATION_PATH);

  execFileSync(
    TOKTX_PATH,
    [
      "--encode",
      "uastc",
      "--uastc_quality",
      "2",
      "--uastc_rdo_l",
      "0.55",
      "--zcmp",
      "18",
      "--genmipmap",
      "--assign_oetf",
      "srgb",
      "--target_type",
      "RGB",
      "--",
      DETAIL_MODULATION_KTX2_PATH,
      DETAIL_MODULATION_PATH,
    ],
    { stdio: "inherit" }
  );
}

function smoothstepRange(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
}

function zoneNoise(x, y) {
  return (
    0.49 * Math.sin(x * 0.111 + y * 0.073) +
    0.31 * Math.cos(x * 0.067 - y * 0.129) +
    0.20 * Math.sin((x + y) * 0.193)
  );
}

function materialBreakup(x, y) {
  return (
    0.46 * Math.sin(x * 0.43 + y * 0.31) +
    0.31 * Math.cos(x * 0.91 - y * 0.57) +
    0.23 * Math.sin(x * 1.73 + y * 1.19)
  );
}

function ellipseMetric(x, y, region) {
  const [centerX, centerY] = region.center;
  const [radiusX, radiusY] = region.radii;
  const cosine = Math.cos(region.rotation ?? 0);
  const sine = Math.sin(region.rotation ?? 0);
  const localX = (x - centerX) * cosine + (y - centerY) * sine;
  const localY = -(x - centerX) * sine + (y - centerY) * cosine;
  return Math.hypot(localX / radiusX, localY / radiusY);
}

function ellipseInfluence(x, y, region, noise, inner = 0.62, outer = 1.28) {
  const edgeNoise = noise * 0.10 + 0.04 * Math.sin(x * 0.71 - y * 0.53);
  return (
    (1 - smoothstepRange(inner + edgeNoise, outer + edgeNoise, ellipseMetric(x, y, region))) *
    (region.strength ?? 1)
  );
}

function chaikinPath(points, iterations = 2) {
  let smoothed = points.map((point) => [...point]);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = [smoothed[0]];
    for (let index = 0; index < smoothed.length - 1; index += 1) {
      const first = smoothed[index];
      const second = smoothed[index + 1];
      next.push(
        first.map((value, axis) => value * 0.75 + second[axis] * 0.25),
        first.map((value, axis) => value * 0.25 + second[axis] * 0.75)
      );
    }
    next.push(smoothed.at(-1));
    smoothed = next;
  }
  return smoothed;
}

const bakedPaths = groundLayout.paths.map((path) => ({
  ...path,
  points: chaikinPath(path.points),
}));

function nearestPathSample(x, y, path) {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestWidth = path.points[0][2];
  for (let index = 0; index < path.points.length - 1; index += 1) {
    const first = path.points[index];
    const second = path.points[index + 1];
    const segmentX = second[0] - first[0];
    const segmentY = second[1] - first[1];
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    const amount =
      lengthSquared <= 0.000001
        ? 0
        : clamp(
            ((x - first[0]) * segmentX + (y - first[1]) * segmentY) /
              lengthSquared
          );
    const distance = Math.hypot(
      x - (first[0] + segmentX * amount),
      y - (first[1] + segmentY * amount)
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestWidth = first[2] + (second[2] - first[2]) * amount;
    }
  }
  return { distance: nearestDistance, halfWidth: nearestWidth };
}

function pathInfluence(x, y, path, noise) {
  const { distance, halfWidth } = nearestPathSample(x, y, path);
  const edge = halfWidth + noise * 0.10;
  const shoulder = path.shoulderWidth + noise * 0.08;
  const core = 1 - smoothstepRange(edge * 0.48, edge, distance);
  const feather = 1 - smoothstepRange(edge, edge + shoulder, distance);
  const strength = path.id === "cabin_lane" ? 0.94 : 0.72;
  return Math.max(core * strength, feather * strength * 0.44);
}

async function tiledSource(path) {
  return sharp(path)
    .resize(SAMPLE_TILE_SIZE, SAMPLE_TILE_SIZE, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .removeAlpha()
    .raw()
    .toBuffer();
}

async function buildZonedGroundAlbedo() {
  const worldExtent = Number(groundLayout.worldExtent);
  const detailMetres = Number(groundLayout.detailMetres);
  const clearingRadius = Number(groundLayout.clearingRadius);
  const [pondX, pondY] = groundLayout.pond.center;
  const [pondRadiusX, pondRadiusY] = groundLayout.pond.radii;
  const sources = await Promise.all(
    ["soil", "packed", "golden", "cool", "moss"].map(async (name) => ({
      name,
      pixels: await tiledSource(resolve(OUTPUT_DIRECTORY, `${name}-albedo.jpg`)),
    }))
  );
  const source = Object.fromEntries(sources.map(({ name, pixels }) => [name, pixels]));

  // RGBA stores packed-earth, leaf-duff, cool-root, and moss weights. These
  // broad fields are generated at macro resolution, then cubic interpolation
  // turns every ecological boundary into a soft transition before the detail
  // textures are sampled.
  const weights = Buffer.allocUnsafe(MACRO_SIZE * MACRO_SIZE * 4);
  for (let pixelY = 0; pixelY < MACRO_SIZE; pixelY += 1) {
    const worldY = worldExtent - (pixelY / (MACRO_SIZE - 1)) * worldExtent * 2;
    for (let pixelX = 0; pixelX < MACRO_SIZE; pixelX += 1) {
      const worldX = -worldExtent + (pixelX / (MACRO_SIZE - 1)) * worldExtent * 2;
      const noise = zoneNoise(worldX, worldY);
      const radius = Math.hypot(worldX, worldY);
      const ecologicalGate = smoothstepRange(
        clearingRadius - 0.3 + noise * 0.18,
        clearingRadius + 2.0 + noise * 0.34,
        radius
      );

      const clearingPacked =
        (1 -
          smoothstepRange(
            clearingRadius - 1.9 + noise * 0.28,
            clearingRadius + 2.0 + noise * 0.42,
            radius
          )) *
        0.42;
      const pathPacked = Math.max(
        ...bakedPaths.map((path) => pathInfluence(worldX, worldY, path, noise))
      );
      const yardPacked = Math.max(
        ...groundLayout.yards.map((yard) =>
          ellipseInfluence(worldX, worldY, { ...yard, strength: 0.70 }, noise, 0.62, 1.34)
        )
      );
      const packedWeight = Math.max(clearingPacked, pathPacked, yardPacked);

      const duffWeight =
        Math.max(
          0,
          ...groundLayout.duffBeds.map((region) =>
            ellipseInfluence(worldX, worldY, region, noise, 0.54, 1.34)
          )
        ) * ecologicalGate;
      const rootWeight =
        Math.max(
          0,
          ...groundLayout.rootShadows.map((region) =>
            ellipseInfluence(worldX, worldY, region, noise, 0.50, 1.32)
          )
        ) * ecologicalGate;
      const pondMetric = Math.hypot(
        (worldX - pondX) / pondRadiusX,
        (worldY - pondY) / pondRadiusY
      );
      const pondBankWeight =
        (1 - smoothstepRange(0.72 + noise * 0.05, 1.62 + noise * 0.08, pondMetric)) *
        0.72;
      const coolWeight = Math.max(rootWeight, pondBankWeight);
      const mossWeight =
        Math.max(
          0,
          ...groundLayout.mossSeeps.map((region) =>
            ellipseInfluence(worldX, worldY, region, noise, 0.48, 1.38)
          )
        ) * ecologicalGate;

      const index = (pixelY * MACRO_SIZE + pixelX) * 4;
      weights[index] = Math.round(clamp(packedWeight) * 255);
      weights[index + 1] = Math.round(clamp(duffWeight) * 255);
      weights[index + 2] = Math.round(clamp(coolWeight) * 255);
      weights[index + 3] = Math.round(clamp(mossWeight) * 255);
    }
  }

  const expandedWeights = await sharp(weights, {
    raw: { width: MACRO_SIZE, height: MACRO_SIZE, channels: 4 },
  })
    .resize(ZONED_SIZE, ZONED_SIZE, { kernel: sharp.kernel.cubic })
    .raw()
    .toBuffer();
  const output = Buffer.allocUnsafe(ZONED_SIZE * ZONED_SIZE * 3);

  for (let pixelY = 0; pixelY < ZONED_SIZE; pixelY += 1) {
    const worldY = worldExtent - (pixelY / (ZONED_SIZE - 1)) * worldExtent * 2;
    for (let pixelX = 0; pixelX < ZONED_SIZE; pixelX += 1) {
      const worldX = -worldExtent + (pixelX / (ZONED_SIZE - 1)) * worldExtent * 2;
      const warpedX =
        worldX +
        0.39 * Math.sin(worldY * 0.29) +
        0.17 * Math.sin(worldX * 0.73 + worldY * 0.18);
      const warpedY =
        worldY +
        0.35 * Math.cos(worldX * 0.31) +
        0.15 * Math.sin(worldY * 0.67 - worldX * 0.16);
      const sourceX = Math.min(
        SAMPLE_TILE_SIZE - 1,
        Math.floor(
          ((warpedX / detailMetres - Math.floor(warpedX / detailMetres)) + 1) % 1 *
            SAMPLE_TILE_SIZE
        )
      );
      const sourceY = Math.min(
        SAMPLE_TILE_SIZE - 1,
        Math.floor(
          (1 - (((warpedY / detailMetres - Math.floor(warpedY / detailMetres)) + 1) % 1)) *
            (SAMPLE_TILE_SIZE - 1)
        )
      );
      const sourceIndex = (sourceY * SAMPLE_TILE_SIZE + sourceX) * 3;
      const outputIndex = (pixelY * ZONED_SIZE + pixelX) * 3;
      const weightIndex = (pixelY * ZONED_SIZE + pixelX) * 4;

      let red = source.soil[sourceIndex];
      let green = source.soil[sourceIndex + 1];
      let blue = source.soil[sourceIndex + 2];
      // Ecological regions should alter the forest floor without becoming
      // giant colored islands. Their source textures now share one value
      // family, and these caps keep the broad masks subordinate to the route.
      const duffWeight = Math.min(0.42, expandedWeights[weightIndex + 1] / 255);
      const coolWeight = Math.min(0.34, expandedWeights[weightIndex + 2] / 255);
      const mossWeight = Math.min(0.30, expandedWeights[weightIndex + 3] / 255);
      const packedWeight = expandedWeights[weightIndex] / 255;

      red += (source.golden[sourceIndex] - red) * duffWeight;
      green += (source.golden[sourceIndex + 1] - green) * duffWeight;
      blue += (source.golden[sourceIndex + 2] - blue) * duffWeight;
      red += (source.cool[sourceIndex] - red) * coolWeight;
      green += (source.cool[sourceIndex + 1] - green) * coolWeight;
      blue += (source.cool[sourceIndex + 2] - blue) * coolWeight;
      red += (source.moss[sourceIndex] - red) * mossWeight;
      green += (source.moss[sourceIndex + 1] - green) * mossWeight;
      blue += (source.moss[sourceIndex + 2] - blue) * mossWeight;
      // Maintained ground wins last so the cabin lane never disappears under
      // duff, roots, or the 31-metre terrain/apron boundary.
      red += (source.packed[sourceIndex] - red) * packedWeight;
      green += (source.packed[sourceIndex + 1] - green) * packedWeight;
      blue += (source.packed[sourceIndex + 2] - blue) * packedWeight;

      // A walked lane is not merely a second leaf texture. Foot traffic
      // compresses away most of the high-contrast litter, leaving a quieter,
      // warmer soil ribbon. The old path blended another noisy source tile,
      // so its signal disappeared inside the forest floor even at full atlas
      // resolution. Re-evaluate the spline here and collapse its local value
      // range around compacted ochre-brown; the soft spline shoulders keep the
      // route organic while this lower variance lets it survive fog and mip
      // reduction all the way from the stage to the shack.
      const routeWeight = Math.max(
        ...bakedPaths.map((path) =>
          pathInfluence(worldX, worldY, path, zoneNoise(worldX, worldY))
        )
      );
      const compactedRed = 78 + (source.packed[sourceIndex] - 103) * 0.18;
      const compactedGreen = 51 + (source.packed[sourceIndex + 1] - 95) * 0.16;
      const compactedBlue = 32 + (source.packed[sourceIndex + 2] - 67) * 0.14;
      red += (compactedRed - red) * routeWeight;
      green += (compactedGreen - green) * routeWeight;
      blue += (compactedBlue - blue) * routeWeight;

      // The atlas resolves paths and habitat zones, but without a middle
      // scale the camera averages every leaf tile into one flat value. These
      // overlapping fields create metre-scale damp, warm, and compressed
      // pockets. Their amplitude stays below eight percent, so they break up
      // the floor without becoming visible painted islands.
      const breakup = materialBreakup(worldX, worldY);
      const valueShift = 1 + breakup * 0.075;
      const warmth = 0.026 * Math.sin(worldX * 0.37 - worldY * 0.23 + breakup);
      red *= valueShift + warmth;
      green *= valueShift + warmth * 0.32;
      blue *= valueShift - warmth * 0.44;

      output[outputIndex] = Math.round(clamp(red, 0, 255));
      output[outputIndex + 1] = Math.round(clamp(green, 0, 255));
      output[outputIndex + 2] = Math.round(clamp(blue, 0, 255));
    }
  }

  await sharp(output, {
    raw: { width: ZONED_SIZE, height: ZONED_SIZE, channels: 3 },
  })
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(ZONED_OUTPUT_PATH);
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

await buildGroundDetailModulation(albedo);

// The periodic Autumn albedo must be on disk before its warm and cool grades
// are derived. This keeps first-run builds deterministic instead of depending
// on which parallel image write happens to finish first.
await Promise.all([
  writeColorGrade(resolve(OUTPUT_DIRECTORY, "albedo.png"), "soil-albedo.jpg", {
    brightness: 0.86,
    saturation: 0.62,
    tint: [128, 82, 52],
    tintStrength: 0.20,
  }),
  writeColorGrade(DIRT_PATH, "packed-albedo.jpg", {
    brightness: 0.78,
    saturation: 0.62,
    tint: [150, 103, 62],
    tintStrength: 0.28,
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
    brightness: 1.10,
    saturation: 0.78,
    tint: [190, 120, 62],
    tintStrength: 0.12,
  }),
  writeColorGrade(resolve(OUTPUT_DIRECTORY, "albedo.png"), "cool-albedo.jpg", {
    brightness: 0.78,
    saturation: 0.58,
    tint: [92, 78, 104],
    tintStrength: 0.24,
  }),
]);

await buildZonedGroundAlbedo();

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
        "autumn-ground-zoned.jpg",
        "ground-detail-modulation.png",
        "ground-detail-modulation.ktx2",
      ],
      groundLayoutVersion: groundLayout.version,
      zonedSize: `${ZONED_SIZE}x${ZONED_SIZE}`,
    },
    null,
    2
  )
);
