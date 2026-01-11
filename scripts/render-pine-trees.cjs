/**
 * Pine Tree Renderer CLI
 * Renders pine tree silhouettes to PNG for visual iteration
 *
 * Usage: node scripts/render-pine-trees.cjs [algorithm] [--seeds=n1,n2,n3]
 *
 * Examples:
 *   node scripts/render-pine-trees.cjs tiered
 *   node scripts/render-pine-trees.cjs windswept --seeds=123,456,789
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 300;
const GRID_COLS = 4;
const GRID_ROWS = 3;
const OUTPUT_DIR = path.join(__dirname, '..', '.pine-iterations');

// Default parameters (matching FireflyForestLab.svelte defaults)
const DEFAULT_TIERED_PARAMS = {
  tierCount: 7,
  tierSpacing: 1.0,
  spread: 0.45,
  uplift: 0.15,
  gapVisibility: 0.25,
};

const DEFAULT_WINDSWEPT_PARAMS = {
  windAngle: 0.4,
  windStrength: 0.3,
  tierCount: 6,
  asymmetry: 0.4,
  branchCurve: 0.25,
};

const DEFAULT_COLORS = {
  foliage: { r: 6, g: 12, b: 10 },
  trunk: { r: 10, g: 8, b: 6 },
};

const SAMPLE_BACKGROUND = '#4a5568';

// ============================================================================
// SEEDED RANDOM
// ============================================================================

function createSeededRandom(seed) {
  let localSeed = seed;
  return () => {
    localSeed = (localSeed * 1103515245 + 12345) & 0x7fffffff;
    return localSeed / 0x7fffffff;
  };
}

// ============================================================================
// RENDERING HELPERS
// ============================================================================

function rgbToString(c) {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

function createFoliageGradient(ctx, x, baseY, height) {
  const foliageCenterY = baseY - height * 0.5;
  const gradient = ctx.createRadialGradient(x, foliageCenterY, 0, x, foliageCenterY, height * 0.6);

  const lighter = {
    r: Math.min(255, DEFAULT_COLORS.foliage.r * 1.15),
    g: Math.min(255, DEFAULT_COLORS.foliage.g * 1.15),
    b: Math.min(255, DEFAULT_COLORS.foliage.b * 1.15),
  };
  const darker = {
    r: DEFAULT_COLORS.foliage.r * 0.85,
    g: DEFAULT_COLORS.foliage.g * 0.85,
    b: DEFAULT_COLORS.foliage.b * 0.85,
  };

  gradient.addColorStop(0, rgbToString(lighter));
  gradient.addColorStop(0.6, rgbToString(DEFAULT_COLORS.foliage));
  gradient.addColorStop(1, rgbToString(darker));

  return gradient;
}

function drawTrunk(ctx, x, baseY, trunkW, trunkH) {
  ctx.fillStyle = rgbToString(DEFAULT_COLORS.trunk);
  ctx.beginPath();
  ctx.moveTo(x - trunkW / 2, baseY);
  ctx.lineTo(x - trunkW / 3, baseY - trunkH);
  ctx.lineTo(x + trunkW / 3, baseY - trunkH);
  ctx.lineTo(x + trunkW / 2, baseY);
  ctx.closePath();
  ctx.fill();
}

// ============================================================================
// PINE TIERED ALGORITHM
// ============================================================================

function drawPineTiered(ctx, x, baseY, width, height, gradient, seed, params) {
  const trunkW = width * 0.1;
  const trunkH = height * 0.12;
  const treeTop = baseY - height;
  const bodyStart = baseY - trunkH;
  const bodyHeight = height - trunkH;

  const rand = createSeededRandom(seed);

  // Draw trunk first
  drawTrunk(ctx, x, baseY, trunkW, trunkH);

  // Apply parameters with per-tree variation
  const numTiers = Math.round(params.tierCount + (rand() - 0.5) * 2);
  const spacingFactor = params.tierSpacing + (rand() - 0.5) * 0.15;
  const maxSpread = params.spread + (rand() - 0.5) * 0.06;
  const droopStrength = params.uplift; // repurposed: higher = more droop
  const overlapAmount = 1 - params.gapVisibility; // more overlap when gapVisibility is low

  // Calculate tier positions (bottom to top)
  const tierPositions = [];
  for (let i = 0; i <= numTiers; i++) {
    const baseT = i / numTiers;
    const adjustedT = Math.pow(baseT, spacingFactor);
    tierPositions.push(adjustedT);
  }

  ctx.fillStyle = gradient;

  // Draw tiers from bottom to top (so upper tiers overlap lower)
  for (let tier = numTiers - 1; tier >= 0; tier--) {
    const t = tierPositions[tier + 1]; // bottom of this tier's foliage
    const prevT = tierPositions[tier]; // where next tier up starts

    // Y positions
    const tierBottomY = treeTop + bodyHeight * t;
    const tierTopY = treeTop + bodyHeight * prevT;
    const tierMidY = (tierBottomY + tierTopY) / 2;

    // Width at this tier (wider at bottom)
    const tierWidth = width * maxSpread * Math.pow(t, 0.5);

    // Asymmetric variation
    const leftExtend = 1 + (rand() - 0.5) * 0.25;
    const rightExtend = 1 + (rand() - 0.5) * 0.25;

    // Droop at tips (branches sag under weight)
    const droop = droopStrength * (tierBottomY - tierTopY) * 0.3;
    const leftDroop = droop * (0.7 + rand() * 0.6);
    const rightDroop = droop * (0.7 + rand() * 0.6);

    ctx.beginPath();

    // Start at apex of this tier (centered, near top)
    const apexY = tierTopY + (tierBottomY - tierTopY) * 0.15;
    ctx.moveTo(x, apexY);

    // LEFT SIDE: apex -> tip -> bottom
    const leftTipX = x - tierWidth * leftExtend;
    const leftTipY = tierMidY + leftDroop;

    // Curve from apex to left tip (slightly drooping arc)
    const leftCtrlX = x - tierWidth * 0.5;
    const leftCtrlY = apexY + (leftTipY - apexY) * 0.3;
    ctx.quadraticCurveTo(leftCtrlX, leftCtrlY, leftTipX, leftTipY);

    // Irregular bottom edge from left tip back toward center
    const numLeftJags = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < numLeftJags; j++) {
      const frac = (j + 1) / (numLeftJags + 1);
      // Jagged point hangs down
      const jagX = leftTipX + (x - leftTipX) * frac;
      const jagY = tierBottomY + rand() * 4 - 2;
      ctx.lineTo(jagX, jagY);

      // Small upward notch (needle cluster gap)
      if (j < numLeftJags - 1) {
        const notchX = jagX + (rand() * 6 + 4);
        const notchY = jagY - (rand() * 6 + 4);
        ctx.lineTo(notchX, notchY);
      }
    }

    // Center bottom (close to trunk, allows overlap)
    const bottomCenterY = tierBottomY + (tierBottomY - tierTopY) * overlapAmount * 0.3;
    ctx.lineTo(x, bottomCenterY);

    // RIGHT SIDE: bottom -> tip -> apex (mirror)
    const rightTipX = x + tierWidth * rightExtend;
    const rightTipY = tierMidY + rightDroop;

    // Irregular bottom edge from center to right tip
    const numRightJags = 3 + Math.floor(rand() * 3);
    for (let j = numRightJags - 1; j >= 0; j--) {
      const frac = (j + 1) / (numRightJags + 1);
      // Small upward notch first
      if (j < numRightJags - 1) {
        const notchX = x + (rightTipX - x) * frac - (rand() * 6 + 4);
        const notchY = tierBottomY - (rand() * 6 + 4);
        ctx.lineTo(notchX, notchY);
      }
      // Jagged point
      const jagX = x + (rightTipX - x) * frac;
      const jagY = tierBottomY + rand() * 4 - 2;
      ctx.lineTo(jagX, jagY);
    }

    // Curve from right tip back to apex
    const rightCtrlX = x + tierWidth * 0.5;
    const rightCtrlY = apexY + (rightTipY - apexY) * 0.3;
    ctx.lineTo(rightTipX, rightTipY);
    ctx.quadraticCurveTo(rightCtrlX, rightCtrlY, x, apexY);

    ctx.closePath();
    ctx.fill();
  }

  // Top apex (small pointed top)
  const topApexHeight = bodyHeight * tierPositions[1] * 0.6;
  const topApexWidth = width * maxSpread * 0.15;
  ctx.beginPath();
  ctx.moveTo(x, treeTop);
  ctx.lineTo(x + topApexWidth, treeTop + topApexHeight * 0.8);
  ctx.lineTo(x, treeTop + topApexHeight);
  ctx.lineTo(x - topApexWidth, treeTop + topApexHeight * 0.8);
  ctx.closePath();
  ctx.fill();
}

// ============================================================================
// PINE WINDSWEPT ALGORITHM
// ============================================================================

function drawPineWindswept(ctx, x, baseY, width, height, gradient, seed, params) {
  const trunkW = width * 0.1;
  const trunkH = height * 0.12;
  const treeTop = baseY - height;
  const bodyStart = baseY - trunkH;
  const bodyHeight = height - trunkH;

  const rand = createSeededRandom(seed);

  const numTiers = Math.round(params.tierCount + (rand() - 0.5) * 1.5);
  const windDir = params.windAngle + (rand() - 0.5) * 0.15; // positive = wind from left (pushes right)
  const windPower = params.windStrength + (rand() - 0.5) * 0.08;
  const asymmetryFactor = params.asymmetry + (rand() - 0.5) * 0.1;
  const curveFactor = params.branchCurve + (rand() - 0.5) * 0.08;

  // Curved trunk bent by wind
  const trunkCurve = windDir * windPower * width * 0.2;
  ctx.fillStyle = rgbToString(DEFAULT_COLORS.trunk);
  ctx.beginPath();
  ctx.moveTo(x - trunkW / 2, baseY);
  ctx.quadraticCurveTo(x - trunkW / 3 + trunkCurve * 0.5, baseY - trunkH * 0.5, x - trunkW / 3 + trunkCurve, bodyStart);
  ctx.lineTo(x + trunkW / 3 + trunkCurve, bodyStart);
  ctx.quadraticCurveTo(x + trunkW / 3 + trunkCurve * 0.5, baseY - trunkH * 0.5, x + trunkW / 2, baseY);
  ctx.closePath();
  ctx.fill();

  // Calculate tier positions
  const tierPositions = [];
  for (let i = 0; i <= numTiers; i++) {
    const baseT = i / numTiers;
    tierPositions.push(baseT);
  }

  ctx.fillStyle = gradient;

  // Draw tiers from bottom to top
  for (let tier = numTiers - 1; tier >= 0; tier--) {
    const t = tierPositions[tier + 1];
    const prevT = tierPositions[tier];

    // Progressive wind bend (stronger toward top)
    const windBend = windDir * windPower * width * (1 - t) * 0.3;
    const tierCenterX = x + trunkCurve * t + windBend;

    const tierBottomY = treeTop + bodyHeight * t;
    const tierTopY = treeTop + bodyHeight * prevT;
    const tierMidY = (tierBottomY + tierTopY) / 2;

    // Base width tapers toward top
    const baseWidth = width * 0.5 * Math.pow(t, 0.5);

    // Windward side (into wind) is shorter, leeward (away from wind) is longer
    const windwardMult = 1 - asymmetryFactor * 0.6;
    const leewardMult = 1 + asymmetryFactor * 0.4;

    // Left side: if wind pushes right (windDir > 0), left is windward (shorter)
    const leftWidth = windDir > 0 ? baseWidth * windwardMult : baseWidth * leewardMult;
    const rightWidth = windDir > 0 ? baseWidth * leewardMult : baseWidth * windwardMult;

    // Droop + wind curve on tips
    const baseDroop = curveFactor * (tierBottomY - tierTopY) * 0.4;
    const leftDroop = baseDroop * (windDir > 0 ? 1.3 : 0.7);
    const rightDroop = baseDroop * (windDir > 0 ? 0.7 : 1.3);

    // Extra horizontal push from wind
    const leftPush = windDir * windPower * leftWidth * 0.3;
    const rightPush = windDir * windPower * rightWidth * 0.3;

    ctx.beginPath();

    // Start at apex of this tier
    const apexY = tierTopY + (tierBottomY - tierTopY) * 0.15;
    ctx.moveTo(tierCenterX, apexY);

    // LEFT SIDE
    const leftTipX = tierCenterX - leftWidth + leftPush;
    const leftTipY = tierMidY + leftDroop;

    // Curved arc to left tip
    const leftCtrlX = tierCenterX - leftWidth * 0.5 + leftPush * 0.5;
    const leftCtrlY = apexY + (leftTipY - apexY) * 0.35;
    ctx.quadraticCurveTo(leftCtrlX, leftCtrlY, leftTipX, leftTipY);

    // Irregular bottom edge
    const numLeftJags = 2 + Math.floor(rand() * 2);
    for (let j = 0; j < numLeftJags; j++) {
      const frac = (j + 1) / (numLeftJags + 1);
      const jagX = leftTipX + (tierCenterX - leftTipX) * frac + windDir * windPower * 3;
      const jagY = tierBottomY + rand() * 3 - 1;
      ctx.lineTo(jagX, jagY);

      if (j < numLeftJags - 1) {
        const notchX = jagX + (rand() * 5 + 3);
        const notchY = jagY - (rand() * 5 + 3);
        ctx.lineTo(notchX, notchY);
      }
    }

    // Center bottom
    const bottomCenterY = tierBottomY + (tierBottomY - tierTopY) * 0.2;
    ctx.lineTo(tierCenterX, bottomCenterY);

    // RIGHT SIDE (mirror with wind asymmetry)
    const rightTipX = tierCenterX + rightWidth + rightPush;
    const rightTipY = tierMidY + rightDroop;

    const numRightJags = 2 + Math.floor(rand() * 2);
    for (let j = numRightJags - 1; j >= 0; j--) {
      const frac = (j + 1) / (numRightJags + 1);
      if (j < numRightJags - 1) {
        const notchX = tierCenterX + (rightTipX - tierCenterX) * frac - (rand() * 5 + 3);
        const notchY = tierBottomY - (rand() * 5 + 3);
        ctx.lineTo(notchX, notchY);
      }
      const jagX = tierCenterX + (rightTipX - tierCenterX) * frac + windDir * windPower * 3;
      const jagY = tierBottomY + rand() * 3 - 1;
      ctx.lineTo(jagX, jagY);
    }

    // Curve to right tip and back to apex
    ctx.lineTo(rightTipX, rightTipY);
    const rightCtrlX = tierCenterX + rightWidth * 0.5 + rightPush * 0.5;
    const rightCtrlY = apexY + (rightTipY - apexY) * 0.35;
    ctx.quadraticCurveTo(rightCtrlX, rightCtrlY, tierCenterX, apexY);

    ctx.closePath();
    ctx.fill();
  }

  // Windswept apex (leans in wind direction)
  const apexBend = windDir * windPower * width * 0.15;
  const topApexHeight = bodyHeight * tierPositions[1] * 0.5;
  const topApexWidth = width * 0.12;

  ctx.beginPath();
  ctx.moveTo(x + trunkCurve + apexBend, treeTop);
  ctx.lineTo(x + trunkCurve + topApexWidth * (windDir > 0 ? 1.2 : 0.8) + apexBend, treeTop + topApexHeight * 0.7);
  ctx.lineTo(x + trunkCurve + apexBend * 0.5, treeTop + topApexHeight);
  ctx.lineTo(x + trunkCurve - topApexWidth * (windDir > 0 ? 0.8 : 1.2) + apexBend, treeTop + topApexHeight * 0.7);
  ctx.closePath();
  ctx.fill();
}

// ============================================================================
// MAIN RENDERING
// ============================================================================

function renderTreeGrid(algorithm, seeds, params, outputPath) {
  const gridWidth = GRID_COLS * CANVAS_WIDTH;
  const gridHeight = GRID_ROWS * CANVAS_HEIGHT;
  const canvas = createCanvas(gridWidth, gridHeight);
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, gridWidth, gridHeight);

  // Render each tree
  seeds.forEach((seed, i) => {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    const offsetX = col * CANVAS_WIDTH;
    const offsetY = row * CANVAS_HEIGHT;

    // Draw tree background
    ctx.fillStyle = SAMPLE_BACKGROUND;
    ctx.fillRect(offsetX + 4, offsetY + 4, CANVAS_WIDTH - 8, CANVAS_HEIGHT - 8);

    // Calculate tree dimensions
    const treeWidth = CANVAS_WIDTH * 0.6;
    const treeHeight = CANVAS_HEIGHT * 0.85;
    const x = offsetX + CANVAS_WIDTH / 2;
    const baseY = offsetY + CANVAS_HEIGHT * 0.95;

    // Create gradient
    const gradient = createFoliageGradient(ctx, x, baseY, treeHeight);

    // Draw tree based on algorithm
    if (algorithm === 'tiered') {
      drawPineTiered(ctx, x, baseY, treeWidth, treeHeight, gradient, seed, params);
    } else {
      drawPineWindswept(ctx, x, baseY, treeWidth, treeHeight, gradient, seed, params);
    }

    // Draw seed label
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px monospace';
    ctx.fillText(`#${seed}`, offsetX + 8, offsetY + CANVAS_HEIGHT - 8);
  });

  // Add title
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`Pine - ${algorithm.toUpperCase()}`, 10, 20);

  // Add parameter info
  ctx.fillStyle = '#6b7280';
  ctx.font = '10px monospace';
  const paramStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(' | ');
  ctx.fillText(paramStr, 10, gridHeight - 10);

  // Save to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Saved: ${outputPath}`);
}

// ============================================================================
// CLI
// ============================================================================

function parseParams(args, defaults) {
  const params = { ...defaults };
  args.forEach(arg => {
    if (arg.startsWith('--') && arg.includes('=') && !arg.startsWith('--seeds')) {
      const [key, value] = arg.slice(2).split('=');
      if (key in params) {
        params[key] = parseFloat(value);
      }
    }
  });
  return params;
}

function main() {
  const args = process.argv.slice(2);
  const algorithm = args[0] || 'tiered';

  // Parse seeds from args or generate random
  let seeds = [];
  const seedsArg = args.find(a => a.startsWith('--seeds='));
  if (seedsArg) {
    seeds = seedsArg.replace('--seeds=', '').split(',').map(Number);
  } else {
    // Generate 12 random seeds
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      seeds.push(Math.floor(Math.random() * 1000000));
    }
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Parse parameter overrides
  const defaults = algorithm === 'tiered' ? DEFAULT_TIERED_PARAMS : DEFAULT_WINDSWEPT_PARAMS;
  const params = parseParams(args, defaults);

  const timestamp = Date.now();
  const outputPath = path.join(OUTPUT_DIR, `pine-${algorithm}-${timestamp}.png`);

  renderTreeGrid(algorithm, seeds, params, outputPath);

  console.log(`\nAlgorithm: ${algorithm}`);
  console.log(`Seeds: ${seeds.join(', ')}`);
  console.log(`Parameters:`, params);
  console.log(`\nUsage: node scripts/render-pine-trees.cjs [algorithm] [--param=value]`);
  console.log(`  Tiered params: tierCount, tierSpacing, spread, uplift, gapVisibility`);
  console.log(`  Windswept params: windAngle, windStrength, tierCount, asymmetry, branchCurve`);
}

main();
