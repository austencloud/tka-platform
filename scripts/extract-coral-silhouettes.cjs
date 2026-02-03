/**
 * Coral Silhouette Extractor
 *
 * Takes batch images of black coral silhouettes on white backgrounds,
 * finds each isolated shape via connected component labeling with
 * morphological erosion to separate touching shapes, then crops them
 * individually and saves as PNGs with transparent backgrounds.
 *
 * Usage: node scripts/extract-coral-silhouettes.cjs
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const RAW_DIR = path.join(__dirname, "..", "static", "images", "coral", "raw");
const OUTPUT_DIR = path.join(
  __dirname,
  "..",
  "static",
  "images",
  "coral",
  "curated"
);

// Minimum area in pixels to consider a shape (filters out noise/specks)
const MIN_AREA = 800;
// Maximum area - shapes larger than this are likely merged blobs
const MAX_AREA = 35000;
// Padding around each cropped shape
const PADDING = 10;
// Threshold: pixels darker than this are "shape", lighter are "background"
const THRESHOLD = 180;
// Erosion iterations to separate touching shapes
const EROSION_ITERATIONS = 3;

/**
 * Morphological erosion: removes border pixels from shapes.
 * A pixel survives only if all 4 neighbors are also shape pixels.
 */
function erodeMask(mask, width, height, iterations) {
  let current = new Uint8Array(mask);
  let next = new Uint8Array(width * height);

  for (let iter = 0; iter < iterations; iter++) {
    next.fill(0);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        // Pixel survives erosion only if it AND all 4 neighbors are shape
        if (
          current[idx] === 1 &&
          current[idx - 1] === 1 &&
          current[idx + 1] === 1 &&
          current[idx - width] === 1 &&
          current[idx + width] === 1
        ) {
          next[idx] = 1;
        }
      }
    }
    // Swap buffers
    const tmp = current;
    current = next;
    next = tmp;
  }

  return current;
}

/**
 * Connected component labeling via BFS flood fill.
 */
function labelComponents(mask, width, height) {
  const labels = new Int32Array(width * height).fill(-1);
  const components = [];
  let nextLabel = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 1 && labels[idx] === -1) {
        const label = nextLabel++;
        const queue = [idx];
        let head = 0; // Use index instead of shift() for performance
        labels[idx] = label;
        let minX = x,
          maxX = x,
          minY = y,
          maxY = y;
        let area = 0;

        while (head < queue.length) {
          const current = queue[head++];
          const cx = current % width;
          const cy = Math.floor(current / width);
          area++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          // 4-connected neighbors
          if (cy > 0 && mask[current - width] === 1 && labels[current - width] === -1) {
            labels[current - width] = label;
            queue.push(current - width);
          }
          if (cy < height - 1 && mask[current + width] === 1 && labels[current + width] === -1) {
            labels[current + width] = label;
            queue.push(current + width);
          }
          if (cx > 0 && mask[current - 1] === 1 && labels[current - 1] === -1) {
            labels[current - 1] = label;
            queue.push(current - 1);
          }
          if (cx < width - 1 && mask[current + 1] === 1 && labels[current + 1] === -1) {
            labels[current + 1] = label;
            queue.push(current + 1);
          }
        }

        components.push({ label, minX, minY, maxX, maxY, area });
      }
    }
  }

  return { labels, components };
}

/**
 * For each eroded component, expand the label assignment back to the
 * original (un-eroded) mask. This recovers the original shape edges
 * that erosion trimmed, while keeping the separation that erosion created.
 *
 * Strategy: BFS outward from each eroded component's pixels, claiming
 * original-mask pixels that aren't yet assigned.
 */
function expandLabelsToOriginalMask(erodedLabels, originalMask, components, width, height) {
  const expandedLabels = new Int32Array(width * height).fill(-1);

  // Seed: copy eroded labels
  for (let i = 0; i < width * height; i++) {
    if (erodedLabels[i] >= 0) {
      expandedLabels[i] = erodedLabels[i];
    }
  }

  // BFS expansion: each labeled pixel tries to claim unlabeled original-mask neighbors
  const queue = [];
  for (let i = 0; i < width * height; i++) {
    if (expandedLabels[i] >= 0) {
      queue.push(i);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const cx = current % width;
    const cy = Math.floor(current / width);
    const label = expandedLabels[current];

    const neighbors = [];
    if (cy > 0) neighbors.push(current - width);
    if (cy < height - 1) neighbors.push(current + width);
    if (cx > 0) neighbors.push(current - 1);
    if (cx < width - 1) neighbors.push(current + 1);

    for (const n of neighbors) {
      if (originalMask[n] === 1 && expandedLabels[n] === -1) {
        expandedLabels[n] = label;
        queue.push(n);
      }
    }
  }

  // Recompute bounding boxes on expanded labels
  const expandedComponents = components.map((c) => ({
    ...c,
    minX: width,
    minY: height,
    maxX: 0,
    maxY: 0,
    area: 0,
  }));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const label = expandedLabels[y * width + x];
      if (label >= 0) {
        const comp = expandedComponents.find((c) => c.label === label);
        if (comp) {
          if (x < comp.minX) comp.minX = x;
          if (x > comp.maxX) comp.maxX = x;
          if (y < comp.minY) comp.minY = y;
          if (y > comp.maxY) comp.maxY = y;
          comp.area++;
        }
      }
    }
  }

  return { expandedLabels, expandedComponents };
}

async function extractShapes(inputPath, batchPrefix) {
  console.log(`\nProcessing: ${path.basename(inputPath)}`);

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  console.log(`  Dimensions: ${width}x${height}`);

  // Get raw grayscale pixel data
  const { data: grayData } = await image
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Get raw RGBA pixel data for output
  const { data: rgbaData } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Create binary mask: 1 = shape (dark pixel), 0 = background (light pixel)
  const originalMask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    originalMask[i] = grayData[i] < THRESHOLD ? 1 : 0;
  }

  // Erode to separate touching shapes
  console.log(`  Applying ${EROSION_ITERATIONS} erosion iterations...`);
  const erodedMask = erodeMask(originalMask, width, height, EROSION_ITERATIONS);

  // Label connected components on eroded mask
  const { labels: erodedLabels, components } = labelComponents(
    erodedMask,
    width,
    height
  );

  console.log(
    `  Found ${components.length} components on eroded mask (before filtering)`
  );

  // Filter by area on eroded mask
  const validComponents = components.filter(
    (c) => c.area >= MIN_AREA / 2 // Eroded area is smaller, so use half threshold
  );
  console.log(
    `  After area filter: ${validComponents.length} components`
  );

  // Expand labels back to original mask edges
  console.log(`  Expanding labels to original mask...`);
  const { expandedLabels, expandedComponents } = expandLabelsToOriginalMask(
    erodedLabels,
    originalMask,
    validComponents,
    width,
    height
  );

  // Filter expanded components by area
  const finalComponents = expandedComponents.filter(
    (c) => c.area >= MIN_AREA && c.area <= MAX_AREA
  );
  console.log(
    `  After final area filter (${MIN_AREA}-${MAX_AREA}px): ${finalComponents.length} shapes`
  );

  // Sort by position: top-to-bottom, left-to-right
  finalComponents.sort((a, b) => {
    const rowA = Math.floor(a.minY / 100);
    const rowB = Math.floor(b.minY / 100);
    if (rowA !== rowB) return rowA - rowB;
    return a.minX - b.minX;
  });

  // Extract and save each shape
  let savedCount = 0;
  for (let i = 0; i < finalComponents.length; i++) {
    const comp = finalComponents[i];

    // Apply padding
    const cropX = Math.max(0, comp.minX - PADDING);
    const cropY = Math.max(0, comp.minY - PADDING);
    const cropW = Math.min(
      width - cropX,
      comp.maxX - comp.minX + 1 + PADDING * 2
    );
    const cropH = Math.min(
      height - cropY,
      comp.maxY - comp.minY + 1 + PADDING * 2
    );

    // Skip shapes that are too small in either dimension
    if (cropW < 25 || cropH < 25) {
      continue;
    }

    // Create output RGBA buffer for this crop
    const outBuffer = Buffer.alloc(cropW * cropH * 4);

    for (let cy = 0; cy < cropH; cy++) {
      for (let cx = 0; cx < cropW; cx++) {
        const srcX = cropX + cx;
        const srcY = cropY + cy;
        const srcIdx = srcY * width + srcX;
        const dstIdx = (cy * cropW + cx) * 4;

        if (
          srcX >= 0 &&
          srcX < width &&
          srcY >= 0 &&
          srcY < height &&
          expandedLabels[srcIdx] === comp.label
        ) {
          // This pixel belongs to this shape
          const rgbaIdx = srcIdx * 4;
          outBuffer[dstIdx] = rgbaData[rgbaIdx];
          outBuffer[dstIdx + 1] = rgbaData[rgbaIdx + 1];
          outBuffer[dstIdx + 2] = rgbaData[rgbaIdx + 2];
          outBuffer[dstIdx + 3] = 255;
        } else {
          // Transparent
          outBuffer[dstIdx] = 0;
          outBuffer[dstIdx + 1] = 0;
          outBuffer[dstIdx + 2] = 0;
          outBuffer[dstIdx + 3] = 0;
        }
      }
    }

    const index = String(savedCount + 1).padStart(2, "0");
    const outputPath = path.join(OUTPUT_DIR, `${batchPrefix}_${index}.png`);

    await sharp(outBuffer, {
      raw: { width: cropW, height: cropH, channels: 4 },
    })
      .png()
      .toFile(outputPath);

    savedCount++;
    const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
    console.log(
      `  Saved: ${path.basename(outputPath)} (${cropW}x${cropH}, ${comp.area}px area, ${sizeKB}KB)`
    );
  }

  console.log(
    `  Total saved: ${savedCount} shapes from ${path.basename(inputPath)}`
  );
  return savedCount;
}

async function main() {
  // Clean output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const existing = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".png"));
  for (const f of existing) {
    fs.unlinkSync(path.join(OUTPUT_DIR, f));
  }
  console.log(`Cleaned ${existing.length} existing files from output`);

  const batchFiles = fs
    .readdirSync(RAW_DIR)
    .filter((f) => f.endsWith(".png"))
    .sort();

  if (batchFiles.length === 0) {
    console.log("No PNG files found in", RAW_DIR);
    process.exit(1);
  }

  console.log(`Found ${batchFiles.length} batch files to process`);

  let totalShapes = 0;
  const categoryMap = {
    coral_batch_01: "fan",
    coral_batch_02: "reef",
    coral_batch_03: "rock",
  };

  for (const file of batchFiles) {
    const baseName = path.basename(file, ".png");
    const prefix = categoryMap[baseName] || baseName;
    const inputPath = path.join(RAW_DIR, file);
    const count = await extractShapes(inputPath, prefix);
    totalShapes += count;
  }

  console.log(
    `\nDone! Extracted ${totalShapes} total coral silhouettes to ${OUTPUT_DIR}`
  );
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
