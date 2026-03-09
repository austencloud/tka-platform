/**
 * Split a horizontal row of glyphs into individual images.
 * Auto-detects glyph boundaries by finding vertical gaps in non-white pixels.
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const INPUT = process.argv[2];
if (!INPUT) {
  console.error('Usage: node split-glyphs.cjs <image-path>');
  process.exit(1);
}

const OUTPUT_DIR = path.join(path.dirname(INPUT), 'split-glyphs');

const LABELS = ['SS-water', 'SO-fire', 'TS-earth', 'TO-air', 'QS-sun', 'QO-moon'];

// Threshold: pixel is "content" if any channel < this value (not near-white)
const WHITE_THRESHOLD = 240;
// Minimum gap width (pixels) between glyphs
const MIN_GAP = 10;

async function main() {
  const image = sharp(INPUT);
  const metadata = await image.metadata();
  const { width, height, channels } = metadata;

  console.log(`Image: ${width}x${height}, ${channels} channels`);

  // Extract raw pixel data
  const raw = await image.raw().toBuffer();

  // Build column occupancy: does this column have any non-white pixel?
  const colHasContent = new Array(width).fill(false);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * channels;
      const r = raw[idx];
      const g = raw[idx + 1];
      const b = raw[idx + 2];
      if (r < WHITE_THRESHOLD || g < WHITE_THRESHOLD || b < WHITE_THRESHOLD) {
        colHasContent[x] = true;
        break;
      }
    }
  }

  // Find contiguous content regions
  const regions = [];
  let inRegion = false;
  let start = 0;

  for (let x = 0; x < width; x++) {
    if (colHasContent[x] && !inRegion) {
      inRegion = true;
      start = x;
    } else if (!colHasContent[x] && inRegion) {
      regions.push({ left: start, right: x - 1 });
      inRegion = false;
    }
  }
  if (inRegion) {
    regions.push({ left: start, right: width - 1 });
  }

  // Merge regions that are too close (less than MIN_GAP apart)
  const merged = [regions[0]];
  for (let i = 1; i < regions.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = regions[i];
    if (curr.left - prev.right < MIN_GAP) {
      prev.right = curr.right;
    } else {
      merged.push(curr);
    }
  }

  console.log(`Found ${merged.length} glyph regions:`);
  merged.forEach((r, i) => {
    console.log(`  ${i}: cols ${r.left}-${r.right} (width: ${r.right - r.left + 1})`);
  });

  if (merged.length !== 6) {
    console.warn(`\nExpected 6 glyphs, found ${merged.length}. Proceeding anyway.`);
  }

  // Also find vertical bounds per region (trim top/bottom whitespace)
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (let i = 0; i < merged.length; i++) {
    const region = merged[i];
    const label = LABELS[i] || `glyph-${i}`;

    // Find vertical content bounds within this region
    let top = height, bottom = 0;
    for (let y = 0; y < height; y++) {
      for (let x = region.left; x <= region.right; x++) {
        const idx = (y * width + x) * channels;
        const r = raw[idx];
        const g = raw[idx + 1];
        const b = raw[idx + 2];
        if (r < WHITE_THRESHOLD || g < WHITE_THRESHOLD || b < WHITE_THRESHOLD) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          break;
        }
      }
    }

    // Add small padding
    const pad = 8;
    const cropLeft = Math.max(0, region.left - pad);
    const cropTop = Math.max(0, top - pad);
    const cropWidth = Math.min(width - cropLeft, region.right - region.left + 1 + pad * 2);
    const cropHeight = Math.min(height - cropTop, bottom - top + 1 + pad * 2);

    const outPath = path.join(OUTPUT_DIR, `${label}.png`);
    await sharp(INPUT)
      .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
      .toFile(outPath);

    console.log(`  Saved: ${outPath} (${cropWidth}x${cropHeight})`);
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
