/**
 * Transparent Tree Extractor
 *
 * Extracts trees with TRANSPARENT backgrounds.
 * Only keeps the dark tree pixels, everything else becomes transparent.
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = 'static/images/trees/curated';

async function extractTrees(inputPath, category) {
  console.log(`\nExtracting ${category} trees from: ${inputPath}`);

  const img = await loadImage(inputPath);
  const width = img.width;
  const height = img.height;
  console.log(`Image size: ${width}x${height}`);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const visited = new Uint8Array(width * height);

  function idx(x, y) { return y * width + x; }

  // Check if pixel is dark enough to be part of tree
  function isTree(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const i = (y * width + x) * 4;
    const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
    // Tree pixels are dark (black/near-black)
    return r < 120 && g < 120 && b < 120;
  }

  // Flood fill to find connected tree component
  function floodFill(startX, startY) {
    const stack = [[startX, startY]];
    const treePixels = [];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[idx(x, y)]) continue;
      if (!isTree(x, y)) continue;

      visited[idx(x, y)] = 1;
      treePixels.push([x, y]);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
      stack.push([x+1, y+1], [x-1, y-1], [x+1, y-1], [x-1, y+1]);
    }

    return { treePixels, minX, maxX, minY, maxY };
  }

  console.log('Finding trees...');
  const components = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!visited[idx(x, y)] && isTree(x, y)) {
        const comp = floodFill(x, y);
        const w = comp.maxX - comp.minX + 1;
        const h = comp.maxY - comp.minY + 1;

        // Filter out small noise - trees need substantial size
        if (w > 100 && h > 100 && comp.treePixels.length > 3000) {
          components.push({
            ...comp,
            width: w,
            height: h,
            centerX: (comp.minX + comp.maxX) / 2,
            centerY: (comp.minY + comp.maxY) / 2
          });
        }
      }
    }
  }

  console.log(`Found ${components.length} trees`);

  // Sort by position
  components.sort((a, b) => {
    const rowA = Math.floor(a.centerY / 200);
    const rowB = Math.floor(b.centerY / 200);
    if (rowA !== rowB) return rowA - rowB;
    return a.centerX - b.centerX;
  });

  // Get next number
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const existing = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.startsWith(`${category}_`))
    .map(f => parseInt(f.match(/_(\d+)\.png/)?.[1] || '0'))
    .filter(n => n > 0);

  let nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;

  const extracted = [];

  for (const comp of components) {
    const pad = 5;
    const x1 = Math.max(0, comp.minX - pad);
    const y1 = Math.max(0, comp.minY - pad);
    const w = comp.maxX - comp.minX + 1 + pad * 2;
    const h = comp.maxY - comp.minY + 1 + pad * 2;

    // Create transparent canvas
    const outCanvas = createCanvas(w, h);
    const outCtx = outCanvas.getContext('2d');

    // Start fully transparent
    outCtx.clearRect(0, 0, w, h);

    // Get image data to write pixels
    const outData = outCtx.createImageData(w, h);
    const outPixels = outData.data;

    // Copy ONLY the tree pixels (make them black, rest stays transparent)
    for (const [px, py] of comp.treePixels) {
      const outX = px - x1;
      const outY = py - y1;
      if (outX >= 0 && outX < w && outY >= 0 && outY < h) {
        const srcIdx = (py * width + px) * 4;
        const dstIdx = (outY * w + outX) * 4;

        // Copy the dark pixel color (or just use black)
        outPixels[dstIdx] = pixels[srcIdx];       // R
        outPixels[dstIdx + 1] = pixels[srcIdx + 1]; // G
        outPixels[dstIdx + 2] = pixels[srcIdx + 2]; // B
        outPixels[dstIdx + 3] = 255;               // Fully opaque
      }
    }

    outCtx.putImageData(outData, 0, 0);

    const filename = `${category}_${String(nextNum).padStart(2, '0')}.png`;
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), outCanvas.toBuffer('image/png'));
    console.log(`  ${filename}: ${w}x${h} (${comp.treePixels.length} pixels)`);
    extracted.push(filename);
    nextNum++;
  }

  console.log(`\n✓ Extracted ${extracted.length} trees with transparent backgrounds`);
  return extracted;
}

const [,, inputPath, category] = process.argv;
if (!inputPath || !category) {
  console.log('Usage: node extract-trees-transparent.cjs <image> <category>');
  process.exit(1);
}
if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

extractTrees(inputPath, category).catch(console.error);
