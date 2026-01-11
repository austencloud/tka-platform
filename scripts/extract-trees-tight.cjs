/**
 * Tight Tree Extractor
 *
 * Extracts trees with TIGHT cropping - no excess white space.
 * Uses connected components to find each tree, then crops to exact bounding box.
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

  // Visited tracking for flood fill
  const visited = new Uint8Array(width * height);

  function idx(x, y) {
    return y * width + x;
  }

  function isBlack(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const i = (y * width + x) * 4;
    return pixels[i] < 100 && pixels[i + 1] < 100 && pixels[i + 2] < 100;
  }

  // Find connected component and return all pixels in it
  function floodFill(startX, startY) {
    const stack = [[startX, startY]];
    const points = [];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;

    while (stack.length > 0) {
      const [x, y] = stack.pop();

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[idx(x, y)]) continue;
      if (!isBlack(x, y)) continue;

      visited[idx(x, y)] = 1;
      points.push([x, y]);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      // 8-connected neighbors
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      stack.push([x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]);
    }

    return { points, minX, maxX, minY, maxY };
  }

  // Find all connected components
  console.log('Finding trees...');
  const components = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!visited[idx(x, y)] && isBlack(x, y)) {
        const comp = floodFill(x, y);
        const w = comp.maxX - comp.minX + 1;
        const h = comp.maxY - comp.minY + 1;

        // Filter: trees should be substantial (not tiny noise or text)
        if (w > 80 && h > 80 && comp.points.length > 2000) {
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

  // Sort top-to-bottom, left-to-right
  components.sort((a, b) => {
    const rowA = Math.floor(a.centerY / 200);
    const rowB = Math.floor(b.centerY / 200);
    if (rowA !== rowB) return rowA - rowB;
    return a.centerX - b.centerX;
  });

  // Get next available number
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const existing = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.startsWith(`${category}_`))
    .map(f => parseInt(f.match(/_(\d+)\.png/)?.[1] || '0'))
    .filter(n => n > 0);

  let nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;

  // Extract each tree with TIGHT crop
  const extracted = [];

  for (const comp of components) {
    // Add just 5px padding (minimal)
    const pad = 5;
    const x1 = Math.max(0, comp.minX - pad);
    const y1 = Math.max(0, comp.minY - pad);
    const x2 = Math.min(width - 1, comp.maxX + pad);
    const y2 = Math.min(height - 1, comp.maxY + pad);
    const w = x2 - x1 + 1;
    const h = y2 - y1 + 1;

    // Create output canvas - just the tree size
    const outCanvas = createCanvas(w, h);
    const outCtx = outCanvas.getContext('2d');

    // White background
    outCtx.fillStyle = 'white';
    outCtx.fillRect(0, 0, w, h);

    // Copy just the tree region
    const region = ctx.getImageData(x1, y1, w, h);
    outCtx.putImageData(region, 0, 0);

    const filename = `${category}_${String(nextNum).padStart(2, '0')}.png`;
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), outCanvas.toBuffer('image/png'));

    console.log(`  ${filename}: ${w}x${h}`);
    extracted.push(filename);
    nextNum++;
  }

  console.log(`\n✓ Extracted ${extracted.length} trees`);
  return extracted;
}

// CLI
const [,, inputPath, category] = process.argv;

if (!inputPath || !category) {
  console.log('Usage: node extract-trees-tight.cjs <image> <category>');
  console.log('Categories: dead, maple, willow, oak, pine, fir, spruce, poplar');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

extractTrees(inputPath, category).catch(console.error);
