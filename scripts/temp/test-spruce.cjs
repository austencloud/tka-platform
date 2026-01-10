/**
 * Spruce Tree - Back to Basics
 *
 * Key insight: A spruce silhouette is built from LAYERS.
 * Each layer extends outward, with small pointed variations at the BOTTOM edge.
 * NOT random chaos everywhere.
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const WIDTH = 1200;
const HEIGHT = 500;

function createSeededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Whorl-based spruce silhouette
 * Built from structured layers with organic variation
 */
function drawSpruceWhorl(ctx, x, baseY, width, height, seed) {
  const rand = createSeededRandom(seed);

  const trunkW = width * 0.06;
  const trunkH = height * 0.04;
  const treeTop = baseY - height;
  const treeBodyStart = baseY - trunkH;
  const bodyHeight = height - trunkH;

  // Draw trunk
  ctx.fillStyle = '#1a1510';
  ctx.beginPath();
  ctx.moveTo(x - trunkW/2, baseY);
  ctx.lineTo(x - trunkW/3, treeBodyStart);
  ctx.lineTo(x + trunkW/3, treeBodyStart);
  ctx.lineTo(x + trunkW/2, baseY);
  ctx.closePath();
  ctx.fill();

  // Number of branch layers (whorls) - varies per tree
  const numLayers = 7 + Math.floor(rand() * 4); // 7-10 layers

  // Overall shape variation - WIDER for proper spruce look
  const widthMultiplier = 0.48 + rand() * 0.1; // 0.48-0.58
  const taperExponent = 1.4 + rand() * 0.4; // 1.4-1.8

  // Droop factor - lower branches droop more
  const droopStrength = 0.15 + rand() * 0.1;

  // Pre-calculate layer positions with slight irregularity
  const layerPositions = [];
  for (let i = 0; i <= numLayers; i++) {
    const baseT = i / numLayers;
    const jitter = i > 0 && i < numLayers ? (rand() - 0.5) * 0.06 : 0;
    layerPositions.push(Math.max(0, Math.min(1, baseT + jitter)));
  }

  // Build the silhouette as a single path
  ctx.fillStyle = '#0d1a12';
  ctx.beginPath();

  // Start at the apex
  ctx.moveTo(x, treeTop);

  // Build RIGHT side going DOWN (top to bottom)
  for (let layer = 0; layer < numLayers; layer++) {
    const t = layerPositions[layer + 1];
    const prevT = layerPositions[layer];

    const layerY = treeTop + bodyHeight * t;
    const prevY = treeTop + bodyHeight * prevT;

    // Width at this layer (increases toward bottom)
    const layerWidth = width * widthMultiplier * Math.pow(t, 1/taperExponent);
    const prevWidth = layer === 0 ? 0 : width * widthMultiplier * Math.pow(prevT, 1/taperExponent);

    // Droop increases toward bottom
    const droop = droopStrength * t * (layerY - prevY);

    // Slight inward curve at start of layer (the "trunk" area between layers)
    const insetFactor = 0.7 + rand() * 0.2;
    const insetX = x + prevWidth * insetFactor + rand() * 3;
    const insetY = prevY + (layerY - prevY) * (0.15 + rand() * 0.1);
    ctx.lineTo(insetX, insetY);

    // Outward to the branch tip - with some variation
    const tipExtend = 1 + (rand() - 0.5) * 0.15; // 0.925-1.075
    const tipX = x + layerWidth * tipExtend + (rand() - 0.5) * 5;
    const tipY = layerY - (layerY - prevY) * (0.25 + rand() * 0.15) + droop;
    ctx.lineTo(tipX, tipY);

    // Small jagged points along the bottom edge of this layer
    // Fewer points at top, more at bottom where branches are wider
    const numPoints = Math.floor(1 + t * 2 + rand() * 1.5); // 1-4 points
    for (let p = 0; p < numPoints; p++) {
      const frac = (p + 1) / (numPoints + 1);
      // Point goes slightly down and inward - softer transition
      const ptX = tipX - (tipX - x) * frac * (0.2 + rand() * 0.08);
      const ptY = tipY + (rand() * 4 + 3) + droop * 0.3;
      ctx.lineTo(ptX, ptY);

      // Small upward spike (needle cluster) - more subtle
      const spikeX = ptX - (rand() * 3 + 1.5);
      const spikeY = ptY - (rand() * 4 + 2);
      ctx.lineTo(spikeX, spikeY);
    }
  }

  // Bottom right corner
  const bottomWidth = width * widthMultiplier;
  ctx.lineTo(x + bottomWidth * 0.85, treeBodyStart);

  // Across bottom (close to trunk)
  ctx.lineTo(x + trunkW * 0.6, treeBodyStart);
  ctx.lineTo(x - trunkW * 0.6, treeBodyStart);

  // Bottom left corner
  ctx.lineTo(x - bottomWidth * 0.85, treeBodyStart);

  // Build LEFT side going UP (bottom to top) - mirror with different randomness
  for (let layer = numLayers - 1; layer >= 0; layer--) {
    const t = layerPositions[layer + 1];
    const prevT = layerPositions[layer];

    const layerY = treeTop + bodyHeight * t;
    const prevY = treeTop + bodyHeight * prevT;

    const layerWidth = width * widthMultiplier * Math.pow(t, 1/taperExponent);
    const prevWidth = layer === 0 ? 0 : width * widthMultiplier * Math.pow(prevT, 1/taperExponent);

    const droop = droopStrength * t * (layerY - prevY);

    // Small jagged points first (going up)
    const numPoints = Math.floor(1 + t * 2 + rand() * 1.5);
    const tipExtend = 1 + (rand() - 0.5) * 0.15;
    const tipX = x - layerWidth * tipExtend - (rand() - 0.5) * 5;
    const tipY = layerY - (layerY - prevY) * (0.25 + rand() * 0.15) + droop;

    for (let p = numPoints - 1; p >= 0; p--) {
      const frac = (p + 1) / (numPoints + 1);
      const ptX = tipX + (x - tipX) * frac * (0.2 + rand() * 0.08);
      const ptY = tipY + (rand() * 4 + 3) + droop * 0.3;

      // Spike then point - more subtle
      const spikeX = ptX + (rand() * 3 + 1.5);
      const spikeY = ptY - (rand() * 4 + 2);
      ctx.lineTo(spikeX, spikeY);
      ctx.lineTo(ptX, ptY);
    }

    // Branch tip
    ctx.lineTo(tipX, tipY);

    // Inward to trunk area
    const insetFactor = 0.7 + rand() * 0.2;
    const insetX = x - prevWidth * insetFactor - rand() * 3;
    const insetY = prevY + (layerY - prevY) * (0.15 + rand() * 0.1);
    ctx.lineTo(insetX, insetY);
  }

  // Back to apex
  ctx.lineTo(x, treeTop);

  ctx.closePath();
  ctx.fill();
}

/**
 * Smooth approach: tapered cone with organic waviness
 * Key: much wider spread, softer taper for proper spruce proportions
 */
function drawSpruceSmooth(ctx, x, baseY, width, height, seed) {
  const rand = createSeededRandom(seed);

  const trunkW = width * 0.06;
  const trunkH = height * 0.04;
  const treeTop = baseY - height;
  const bodyStart = baseY - trunkH;
  const bodyHeight = height - trunkH;

  // Trunk
  ctx.fillStyle = '#1a1510';
  ctx.beginPath();
  ctx.moveTo(x - trunkW/2, baseY);
  ctx.lineTo(x - trunkW/3, bodyStart);
  ctx.lineTo(x + trunkW/3, bodyStart);
  ctx.lineTo(x + trunkW/2, baseY);
  ctx.closePath();
  ctx.fill();

  // Much wider spread for spruce (not cypress!)
  const maxWidth = width * (0.52 + rand() * 0.08); // 0.52-0.60 of width
  const taperPower = 0.55 + rand() * 0.1; // Softer taper (lower = wider at top)
  const numPoints = 30;

  // Waviness parameters
  const waveFreq = 5 + rand() * 3;
  const waveAmp = 4 + rand() * 3;

  ctx.fillStyle = '#0d1a12';
  ctx.beginPath();
  ctx.moveTo(x, treeTop);

  // Right edge (top to bottom)
  for (let i = 1; i <= numPoints; i++) {
    const t = i / numPoints;
    const y = treeTop + bodyHeight * t;

    // Base width at this height (tapered)
    const baseWidth = maxWidth * Math.pow(t, taperPower);

    // Organic waviness - controlled amplitude, decreases toward bottom for stability
    const ampScale = 0.4 + (1 - t) * 0.6; // More variation at top, stable at bottom
    const wave = Math.sin(t * Math.PI * waveFreq + seed) * waveAmp * ampScale;
    const jitter = (rand() - 0.5) * 2 * ampScale;

    ctx.lineTo(x + baseWidth + wave + jitter, y);
  }

  // Bottom
  ctx.lineTo(x, bodyStart);

  // Left edge (bottom to top) - slightly different variation
  for (let i = numPoints; i >= 1; i--) {
    const t = i / numPoints;
    const y = treeTop + bodyHeight * t;
    const baseWidth = maxWidth * Math.pow(t, taperPower);
    const ampScale = 0.4 + (1 - t) * 0.6;
    const wave = Math.sin(t * Math.PI * waveFreq + seed + 2) * waveAmp * ampScale;
    const jitter = (rand() - 0.5) * 2 * ampScale;

    ctx.lineTo(x - baseWidth - wave - jitter, y);
  }

  ctx.closePath();
  ctx.fill();
}

// Render comparison
function render() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#4a5568';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('SMOOTH (tapered + waviness)', 60, 25);
  ctx.fillText('WHORL (structured layers)', 700, 25);

  // Test with variety of seeds
  const seeds = [42, 123, 456, 789, 1000, 2024];

  // Smooth approach
  seeds.forEach((seed, i) => {
    drawSpruceSmooth(ctx, 70 + i * 95, HEIGHT - 50, 75, 340, seed);
  });

  // Whorl approach
  seeds.forEach((seed, i) => {
    drawSpruceWhorl(ctx, 640 + i * 95, HEIGHT - 50, 75, 340, seed);
  });

  const out = path.join(__dirname, 'spruce-test.png');
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  console.log('Saved:', out);
}

render();
