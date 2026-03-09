/**
 * Vectorize PNG glyphs to SVG using imagetracerjs.
 * Produces clean, color-accurate SVGs suitable for use in pictographs.
 */
const ImageTracer = require('imagetracerjs');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const INPUT_DIR = process.argv[2] || 'F:/Downloads/split-glyphs';
const OUTPUT_DIR = path.join(INPUT_DIR, 'svg');

const FILES = [
  'SS-water.png',
  'SO-fire.png',
  'TS-earth.png',
  'TO-air.png',
  'QS-sun.png',
  'QO-moon.png',
];

// High-quality tracing options for detailed colored icons
const TRACE_OPTIONS = {
  // Color quantization
  colorsampling: 2,       // 0=disabled, 1=random, 2=deterministic
  numberofcolors: 24,     // Enough for gradients in these icons
  mincolorratio: 0,       // Keep all colors
  colorquantcycles: 3,    // More cycles = better color accuracy

  // Tracing
  corsenabled: false,     // No corner enhancement (smoother curves)
  ltres: 0.5,             // Line threshold - lower = more detail
  qtres: 0.5,             // Quadratic spline threshold - lower = smoother
  pathomit: 4,            // Skip tiny paths (noise removal)

  // SVG rendering
  scale: 1,
  roundcoords: 2,         // Decimal places for coordinates
  desc: false,            // No description metadata
  viewbox: true,          // Use viewBox instead of width/height

  // Blur for smoother tracing
  blurradius: 0,
  blurdelta: 20,
};

async function vectorize(filename) {
  const inputPath = path.join(INPUT_DIR, filename);
  const outputFilename = filename.replace('.png', '.svg');
  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  // Load image and get raw RGBA pixel data
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  const rawBuffer = await image
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Build ImageData-like object that imagetracerjs expects
  const imageData = {
    width: metadata.width,
    height: metadata.height,
    data: new Uint8ClampedArray(rawBuffer),
  };

  // Trace to SVG
  const svgString = ImageTracer.imagedataToSVG(imageData, TRACE_OPTIONS);

  fs.writeFileSync(outputPath, svgString);
  const sizeKB = (Buffer.byteLength(svgString) / 1024).toFixed(1);
  console.log(`  ${outputFilename} (${sizeKB} KB)`);
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Vectorizing glyphs...\n');

  for (const file of FILES) {
    if (!fs.existsSync(path.join(INPUT_DIR, file))) {
      console.warn(`  SKIP: ${file} not found`);
      continue;
    }
    await vectorize(file);
  }

  console.log(`\nDone! SVGs saved to: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
