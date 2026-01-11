/**
 * Tree Lab Renderer Implementation
 *
 * Renders tree silhouettes for the Tree Lab UI.
 * Extracted from FireflyForestLab.svelte to follow single-responsibility principle.
 */

import type { TreeType } from "$lib/shared/background/firefly-forest/services/TreeSilhouetteSystem";
import type {
  ITreeLabRenderer,
  SmoothParams,
  WhorlParams,
  TieredParams,
  WindsweptParams,
  TreeAlgorithmParams,
  TreeColors,
} from "../contracts/ITreeLabRenderer";

/** Default colors for tree lab rendering (mid-layer colors for visibility) */
const DEFAULT_COLORS: TreeColors = {
  foliage: { r: 6, g: 12, b: 10 },
  trunk: { r: 10, g: 8, b: 6 },
};

/** Background color for tree sample canvases */
const SAMPLE_BACKGROUND = "#4a5568";

export class TreeLabRenderer implements ITreeLabRenderer {
  // ============================================================================
  // PUBLIC API
  // ============================================================================

  drawTreeSample(
    canvas: HTMLCanvasElement,
    treeType: TreeType,
    seed: number,
    params: TreeAlgorithmParams
  ): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Light gray background for contrast against dark tree silhouettes
    ctx.fillStyle = SAMPLE_BACKGROUND;
    ctx.fillRect(0, 0, width, height);

    // Draw tree centered
    const treeWidth = width * 0.6;
    const treeHeight = height * 0.85;
    const x = width / 2;
    const baseY = height * 0.95;

    this.drawSingleTree(ctx, treeType, x, baseY, treeWidth, treeHeight, seed, params);
  }

  drawSingleTree(
    ctx: CanvasRenderingContext2D,
    type: TreeType,
    x: number,
    baseY: number,
    width: number,
    height: number,
    seed: number,
    params: TreeAlgorithmParams
  ): void {
    const gradient = this.createFoliageGradient(ctx, x, baseY, height);

    switch (type) {
      case "spruce":
        if (params.spruce.algorithm === "smooth") {
          this.drawSpruceSmooth(ctx, x, baseY, width, height, gradient, seed, params.spruce.smooth);
        } else {
          this.drawSpruceWhorl(ctx, x, baseY, width, height, gradient, seed, params.spruce.whorl);
        }
        break;
      case "pine":
        if (params.pine.algorithm === "tiered") {
          this.drawPineTiered(ctx, x, baseY, width, height, gradient, seed, params.pine.tiered);
        } else {
          this.drawPineWindswept(ctx, x, baseY, width, height, gradient, seed, params.pine.windswept);
        }
        break;
      case "fir":
        this.drawFir(ctx, x, baseY, width, height, gradient);
        break;
      case "oak":
        this.drawOak(ctx, x, baseY, width, height, gradient);
        break;
      case "maple":
        this.drawMaple(ctx, x, baseY, width, height, gradient);
        break;
      case "poplar":
        this.drawPoplar(ctx, x, baseY, width, height, gradient);
        break;
    }
  }

  generateSpruceSVG(seed: number): string {
    const width = 150;
    const height = 225;
    const treeWidth = width * 0.6;
    const treeHeight = height * 0.85;
    const x = width / 2;
    const baseY = height * 0.95;

    const trunkW = treeWidth * 0.14;
    const trunkH = treeHeight * 0.12;
    const bodyStart = baseY - trunkH;
    const bodyHeight = treeHeight - trunkH;

    // Seeded random
    const rand = this.createSeededRandom(seed);

    // Spruce shape parameters
    const baseWidthRatio = 0.38 + rand() * 0.08;
    const taperPower = 1.8 + rand() * 0.4;
    const bumpCount = 14 + Math.floor(rand() * 8);

    // Generate edge points with organic variation
    const leftEdge: Array<{ y: number; width: number }> = [];
    const rightEdge: Array<{ y: number; width: number }> = [];

    for (let i = 0; i <= bumpCount; i++) {
      const t = i / bumpCount;
      const baseTaper = 1 - Math.pow(t, taperPower);
      const baseWidth = baseWidthRatio * baseTaper;

      const lowFreq = Math.sin(t * Math.PI * 2 + rand() * Math.PI) * 0.03;
      const midFreq = Math.sin(t * Math.PI * 5 + rand() * Math.PI * 2) * 0.02;
      const highFreq = (rand() - 0.5) * 0.025;

      const variationStrength = Math.sin(t * Math.PI) * 0.8 + 0.2;
      const variation = (lowFreq + midFreq + highFreq) * variationStrength;

      const leftVar = variation + (rand() - 0.5) * 0.015;
      const rightVar = variation + (rand() - 0.5) * 0.015;

      const y = bodyStart - bodyHeight * t;

      leftEdge.push({ y, width: Math.max(0.02, baseWidth + leftVar) });
      rightEdge.push({ y, width: Math.max(0.02, baseWidth + rightVar) });
    }

    // Build SVG path for foliage
    let foliagePath = `M ${(x - treeWidth * leftEdge[0]!.width).toFixed(1)} ${bodyStart.toFixed(1)}`;

    for (let i = 1; i < leftEdge.length; i++) {
      const pt = leftEdge[i]!;
      foliagePath += ` L ${(x - treeWidth * pt.width).toFixed(1)} ${pt.y.toFixed(1)}`;
    }

    foliagePath += ` L ${x.toFixed(1)} ${(baseY - treeHeight).toFixed(1)}`;

    for (let i = rightEdge.length - 1; i >= 0; i--) {
      const pt = rightEdge[i]!;
      foliagePath += ` L ${(x + treeWidth * pt.width).toFixed(1)} ${pt.y.toFixed(1)}`;
    }

    foliagePath += " Z";

    // Build trunk path
    const trunkPath = `M ${(x - trunkW / 2).toFixed(1)} ${baseY.toFixed(1)} L ${(x - trunkW / 2).toFixed(1)} ${(baseY - trunkH).toFixed(1)} L ${(x + trunkW / 2).toFixed(1)} ${(baseY - trunkH).toFixed(1)} L ${(x + trunkW / 2).toFixed(1)} ${baseY.toFixed(1)} Z`;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#4a5568"/>
  <path d="${trunkPath}" fill="#0a0806"/>
  <path d="${foliagePath}" fill="#050a08"/>
  <!-- Seed: ${seed} | Bumps: ${bumpCount} | BaseWidth: ${baseWidthRatio.toFixed(3)} | Taper: ${taperPower.toFixed(2)} -->
</svg>`;
  }

  generatePineSVG(seed: number, params: TreeAlgorithmParams): string {
    const width = 150;
    const height = 225;
    const treeWidth = width * 0.6;
    const treeHeight = height * 0.85;
    const x = width / 2;
    const baseY = height * 0.95;

    const rand = this.createSeededRandom(seed);
    const pineParams = params.pine;

    let paths: string[] = [];

    if (pineParams.algorithm === "tiered") {
      const p = pineParams.tiered;
      const trunkW = treeWidth * 0.1;
      const trunkH = treeHeight * 0.15;
      const treeTop = baseY - treeHeight;
      const bodyHeight = treeHeight - trunkH;

      // Trunk path
      const trunkPath = `M ${(x - trunkW / 2).toFixed(1)} ${baseY.toFixed(1)} L ${(x - trunkW / 2).toFixed(1)} ${(baseY - trunkH).toFixed(1)} L ${(x + trunkW / 2).toFixed(1)} ${(baseY - trunkH).toFixed(1)} L ${(x + trunkW / 2).toFixed(1)} ${baseY.toFixed(1)} Z`;
      paths.push(`<path d="${trunkPath}" fill="#0a0806"/>`);

      const numTiers = Math.round(p.tierCount + (rand() - 0.5) * 2);
      const spacingFactor = p.tierSpacing + (rand() - 0.5) * 0.15;
      const maxSpread = p.spread + (rand() - 0.5) * 0.06;

      // Calculate tier positions
      const tierPositions: number[] = [];
      for (let i = 0; i <= numTiers; i++) {
        const baseT = i / numTiers;
        const adjustedT = Math.pow(baseT, spacingFactor);
        tierPositions.push(adjustedT);
      }

      // Build each tier as SVG path
      for (let tier = 0; tier < numTiers; tier++) {
        const t = tierPositions[tier + 1]!;
        const tierY = treeTop + bodyHeight * t;
        const tierWidth = treeWidth * maxSpread * Math.pow(t, 0.6);

        const leftExtend = 1 + (rand() - 0.5) * 0.2;
        const rightExtend = 1 + (rand() - 0.5) * 0.2;

        const leftTipX = x - tierWidth * leftExtend;
        const rightTipX = x + tierWidth * rightExtend;
        const tipY = tierY - bodyHeight / numTiers * 0.4;

        const tierPath = `M ${x.toFixed(1)} ${tipY.toFixed(1)} L ${leftTipX.toFixed(1)} ${tierY.toFixed(1)} L ${rightTipX.toFixed(1)} ${tierY.toFixed(1)} Z`;
        paths.push(`<path d="${tierPath}" fill="#050a08"/>`);
      }

      // Apex
      const apexPath = `M ${x.toFixed(1)} ${treeTop.toFixed(1)} L ${(x + treeWidth * 0.1).toFixed(1)} ${(treeTop + bodyHeight * 0.12).toFixed(1)} L ${(x - treeWidth * 0.1).toFixed(1)} ${(treeTop + bodyHeight * 0.12).toFixed(1)} Z`;
      paths.push(`<path d="${apexPath}" fill="#050a08"/>`);
    } else {
      // Windswept - simplified for SVG export
      const p = pineParams.windswept;
      const trunkW = treeWidth * 0.1;
      const trunkH = treeHeight * 0.18;
      const treeTop = baseY - treeHeight;
      const bodyHeight = treeHeight - trunkH;
      const windDir = p.windAngle;
      const windPower = p.windStrength;

      // Curved trunk
      const trunkCurve = windDir * windPower * treeWidth * 0.15;
      const trunkPath = `M ${(x - trunkW / 2).toFixed(1)} ${baseY.toFixed(1)} L ${(x - trunkW / 3 + trunkCurve * 0.5).toFixed(1)} ${(baseY - trunkH).toFixed(1)} L ${(x + trunkW / 3 + trunkCurve * 0.5).toFixed(1)} ${(baseY - trunkH).toFixed(1)} L ${(x + trunkW / 2).toFixed(1)} ${baseY.toFixed(1)} Z`;
      paths.push(`<path d="${trunkPath}" fill="#0a0806"/>`);

      const numTiers = Math.round(p.tierCount + (rand() - 0.5) * 1.5);

      for (let tier = 0; tier < numTiers; tier++) {
        const t = (tier + 1) / numTiers;
        const tierY = treeTop + bodyHeight * t;
        const windBend = windDir * windPower * treeWidth * t * 0.4;
        const tierCenterX = x + windBend;
        const baseWidth = treeWidth * 0.45 * Math.pow(t, 0.55);

        const leftWidth = windDir < 0 ? baseWidth * 0.6 : baseWidth * 1.3;
        const rightWidth = windDir > 0 ? baseWidth * 0.6 : baseWidth * 1.3;

        const tipY = tierY - bodyHeight / numTiers * 0.35;
        const tierPath = `M ${tierCenterX.toFixed(1)} ${tipY.toFixed(1)} L ${(tierCenterX - leftWidth).toFixed(1)} ${tierY.toFixed(1)} L ${(tierCenterX + rightWidth).toFixed(1)} ${tierY.toFixed(1)} Z`;
        paths.push(`<path d="${tierPath}" fill="#050a08"/>`);
      }

      // Windswept apex
      const apexBend = windDir * windPower * treeWidth * 0.25;
      const apexPath = `M ${(x + apexBend * 0.8).toFixed(1)} ${treeTop.toFixed(1)} L ${(x + treeWidth * 0.15 + apexBend).toFixed(1)} ${(treeTop + bodyHeight * 0.1).toFixed(1)} L ${(x - treeWidth * 0.08 + apexBend * 0.5).toFixed(1)} ${(treeTop + bodyHeight * 0.1).toFixed(1)} Z`;
      paths.push(`<path d="${apexPath}" fill="#050a08"/>`);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#4a5568"/>
  ${paths.join("\n  ")}
  <!-- Seed: ${seed} | Algorithm: ${pineParams.algorithm} -->
</svg>`;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private createSeededRandom(seed: number): () => number {
    let localSeed = seed;
    return () => {
      localSeed = (localSeed * 1103515245 + 12345) & 0x7fffffff;
      return localSeed / 0x7fffffff;
    };
  }

  private rgbToString(c: { r: number; g: number; b: number }): string {
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }

  private createFoliageGradient(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    height: number
  ): CanvasGradient {
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

    gradient.addColorStop(0, this.rgbToString(lighter));
    gradient.addColorStop(0.6, this.rgbToString(DEFAULT_COLORS.foliage));
    gradient.addColorStop(1, this.rgbToString(darker));

    return gradient;
  }

  private drawTrunk(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    trunkW: number,
    trunkH: number
  ): void {
    ctx.fillStyle = this.rgbToString(DEFAULT_COLORS.trunk);
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 3, baseY - trunkH);
    ctx.lineTo(x + trunkW / 3, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();
  }

  // ============================================================================
  // SPRUCE ALGORITHMS
  // ============================================================================

  /**
   * Smooth algorithm: tapered cone with organic waviness
   * Key: wide spread, controlled waviness that decreases toward bottom for stability
   */
  private drawSpruceSmooth(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    gradient: CanvasGradient,
    seed: number,
    params: SmoothParams
  ): void {
    const trunkW = width * 0.08;
    const trunkH = height * 0.05;
    const treeTop = baseY - height;
    const bodyStart = baseY - trunkH;
    const bodyHeight = height - trunkH;

    const rand = this.createSeededRandom(seed);

    // Draw trunk
    this.drawTrunk(ctx, x, baseY, trunkW, trunkH);

    // Apply parameters with per-tree variation
    const maxWidth = width * (params.spread + (rand() - 0.5) * 0.06);
    const taperPower = params.taperPower + (rand() - 0.5) * 0.08;
    const waveFreq = params.waveFreq + (rand() - 0.5) * 2;
    const waveAmp = params.waveAmp + (rand() - 0.5) * 1.5;
    const jitter = params.jitter;
    const numPoints = 30;

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x, treeTop);

    // Right edge (top to bottom)
    for (let i = 1; i <= numPoints; i++) {
      const t = i / numPoints;
      const y = treeTop + bodyHeight * t;

      // Base width at this height (tapered)
      const baseWidth = maxWidth * Math.pow(t, taperPower);

      // Waviness decreases toward bottom for stability
      const ampScale = 0.4 + (1 - t) * 0.6;
      const wave = Math.sin(t * Math.PI * waveFreq + seed) * waveAmp * ampScale;
      const jitterVal = (rand() - 0.5) * jitter * ampScale;

      ctx.lineTo(x + baseWidth + wave + jitterVal, y);
    }

    // Bottom
    ctx.lineTo(x, bodyStart);

    // Left edge (bottom to top)
    for (let i = numPoints; i >= 1; i--) {
      const t = i / numPoints;
      const y = treeTop + bodyHeight * t;
      const baseWidth = maxWidth * Math.pow(t, taperPower);
      const ampScale = 0.4 + (1 - t) * 0.6;
      const wave = Math.sin(t * Math.PI * waveFreq + seed + 2) * waveAmp * ampScale;
      const jitterVal = (rand() - 0.5) * jitter * ampScale;

      ctx.lineTo(x - baseWidth - wave - jitterVal, y);
    }

    ctx.closePath();
    ctx.fill();
  }

  /**
   * Whorl algorithm: structured branch layers with jagged bottom edges
   * Key insight: spruce silhouettes are built from LAYERS, with jaggedness
   * only at the BOTTOM edge of each layer, not random chaos everywhere
   */
  private drawSpruceWhorl(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    gradient: CanvasGradient,
    seed: number,
    params: WhorlParams
  ): void {
    const trunkW = width * 0.08;
    const trunkH = height * 0.05;
    const treeTop = baseY - height;
    const treeBodyStart = baseY - trunkH;
    const bodyHeight = height - trunkH;

    const rand = this.createSeededRandom(seed);

    // Draw trunk
    this.drawTrunk(ctx, x, baseY, trunkW, trunkH);

    // Apply parameters with per-tree variation
    const numLayers = Math.round(params.layers + (rand() - 0.5) * 3);
    const widthMultiplier = params.spread + (rand() - 0.5) * 0.08;
    const taperExponent = params.taperExponent + (rand() - 0.5) * 0.3;
    const droopStrength = params.droop + (rand() - 0.5) * 0.08;
    const jagIntensity = params.jaggedness;

    // Pre-calculate layer positions with slight irregularity
    const layerPositions: number[] = [];
    for (let i = 0; i <= numLayers; i++) {
      const baseT = i / numLayers;
      const jitterVal = i > 0 && i < numLayers ? (rand() - 0.5) * 0.06 : 0;
      layerPositions.push(Math.max(0, Math.min(1, baseT + jitterVal)));
    }

    // Build the silhouette as a single path
    ctx.fillStyle = gradient;
    ctx.beginPath();

    // Start at the apex
    ctx.moveTo(x, treeTop);

    // Build RIGHT side going DOWN (top to bottom)
    for (let layer = 0; layer < numLayers; layer++) {
      const t = layerPositions[layer + 1]!;
      const prevT = layerPositions[layer]!;

      const layerY = treeTop + bodyHeight * t;
      const prevY = treeTop + bodyHeight * prevT;

      // Width at this layer (increases toward bottom)
      const layerWidth = width * widthMultiplier * Math.pow(t, 1 / taperExponent);
      const prevWidth = layer === 0 ? 0 : width * widthMultiplier * Math.pow(prevT, 1 / taperExponent);

      // Droop increases toward bottom
      const droop = droopStrength * t * (layerY - prevY);

      // Slight inward curve at start of layer
      const insetFactor = 0.7 + rand() * 0.2;
      const insetX = x + prevWidth * insetFactor + rand() * 3;
      const insetY = prevY + (layerY - prevY) * (0.15 + rand() * 0.1);
      ctx.lineTo(insetX, insetY);

      // Outward to the branch tip
      const tipExtend = 1 + (rand() - 0.5) * 0.15;
      const tipX = x + layerWidth * tipExtend + (rand() - 0.5) * 5;
      const tipY = layerY - (layerY - prevY) * (0.25 + rand() * 0.15) + droop;
      ctx.lineTo(tipX, tipY);

      // Small jagged points along the bottom edge of this layer
      const numPoints = Math.floor((1 + t * 2 + rand() * 1.5) * jagIntensity);
      for (let p = 0; p < numPoints; p++) {
        const frac = (p + 1) / (numPoints + 1);
        const ptX = tipX - (tipX - x) * frac * (0.2 + rand() * 0.08);
        const ptY = tipY + (rand() * 4 + 3) * jagIntensity + droop * 0.3;
        ctx.lineTo(ptX, ptY);

        // Small upward spike (needle cluster)
        const spikeX = ptX - (rand() * 3 + 1.5) * jagIntensity;
        const spikeY = ptY - (rand() * 4 + 2) * jagIntensity;
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

    // Build LEFT side going UP (bottom to top)
    for (let layer = numLayers - 1; layer >= 0; layer--) {
      const t = layerPositions[layer + 1]!;
      const prevT = layerPositions[layer]!;

      const layerY = treeTop + bodyHeight * t;
      const prevY = treeTop + bodyHeight * prevT;

      const layerWidth = width * widthMultiplier * Math.pow(t, 1 / taperExponent);
      const prevWidth = layer === 0 ? 0 : width * widthMultiplier * Math.pow(prevT, 1 / taperExponent);

      const droop = droopStrength * t * (layerY - prevY);

      // Small jagged points first (going up)
      const numPoints = Math.floor((1 + t * 2 + rand() * 1.5) * jagIntensity);
      const tipExtend = 1 + (rand() - 0.5) * 0.15;
      const tipX = x - layerWidth * tipExtend - (rand() - 0.5) * 5;
      const tipY = layerY - (layerY - prevY) * (0.25 + rand() * 0.15) + droop;

      for (let p = numPoints - 1; p >= 0; p--) {
        const frac = (p + 1) / (numPoints + 1);
        const ptX = tipX + (x - tipX) * frac * (0.2 + rand() * 0.08);
        const ptY = tipY + (rand() * 4 + 3) * jagIntensity + droop * 0.3;

        // Spike then point
        const spikeX = ptX + (rand() * 3 + 1.5) * jagIntensity;
        const spikeY = ptY - (rand() * 4 + 2) * jagIntensity;
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

  // ============================================================================
  // PINE ALGORITHMS
  // ============================================================================

  /**
   * Tiered algorithm: Classic pine with overlapping curved branch tiers
   * Uses quadratic curves for natural drooping arcs, drawn bottom-to-top for overlap
   */
  private drawPineTiered(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    gradient: CanvasGradient,
    seed: number,
    params: TieredParams
  ): void {
    const trunkW = width * 0.1;
    const trunkH = height * 0.12;
    const treeTop = baseY - height;
    const bodyHeight = height - trunkH;

    const rand = this.createSeededRandom(seed);

    // Draw trunk first
    this.drawTrunk(ctx, x, baseY, trunkW, trunkH);

    // Apply parameters with per-tree variation
    const numTiers = Math.round(params.tierCount + (rand() - 0.5) * 2);
    const spacingFactor = params.tierSpacing + (rand() - 0.5) * 0.15;
    const maxSpread = params.spread + (rand() - 0.5) * 0.06;
    const droopStrength = params.uplift; // Higher = more droop at tips
    const overlapAmount = 1 - params.gapVisibility;

    // Calculate tier positions (bottom to top)
    const tierPositions: number[] = [];
    for (let i = 0; i <= numTiers; i++) {
      const baseT = i / numTiers;
      const adjustedT = Math.pow(baseT, spacingFactor);
      tierPositions.push(adjustedT);
    }

    ctx.fillStyle = gradient;

    // Draw tiers from bottom to top (upper tiers overlap lower)
    for (let tier = numTiers - 1; tier >= 0; tier--) {
      const t = tierPositions[tier + 1]!;
      const prevT = tierPositions[tier]!;

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

      // Curve from apex to left tip
      const leftCtrlX = x - tierWidth * 0.5;
      const leftCtrlY = apexY + (leftTipY - apexY) * 0.3;
      ctx.quadraticCurveTo(leftCtrlX, leftCtrlY, leftTipX, leftTipY);

      // Irregular bottom edge from left tip back toward center
      const numLeftJags = 3 + Math.floor(rand() * 3);
      for (let j = 0; j < numLeftJags; j++) {
        const frac = (j + 1) / (numLeftJags + 1);
        const jagX = leftTipX + (x - leftTipX) * frac;
        const jagY = tierBottomY + rand() * 4 - 2;
        ctx.lineTo(jagX, jagY);

        if (j < numLeftJags - 1) {
          const notchX = jagX + (rand() * 6 + 4);
          const notchY = jagY - (rand() * 6 + 4);
          ctx.lineTo(notchX, notchY);
        }
      }

      // Center bottom
      const bottomCenterY = tierBottomY + (tierBottomY - tierTopY) * overlapAmount * 0.3;
      ctx.lineTo(x, bottomCenterY);

      // RIGHT SIDE: bottom -> tip -> apex
      const rightTipX = x + tierWidth * rightExtend;
      const rightTipY = tierMidY + rightDroop;

      const numRightJags = 3 + Math.floor(rand() * 3);
      for (let j = numRightJags - 1; j >= 0; j--) {
        const frac = (j + 1) / (numRightJags + 1);
        if (j < numRightJags - 1) {
          const notchX = x + (rightTipX - x) * frac - (rand() * 6 + 4);
          const notchY = tierBottomY - (rand() * 6 + 4);
          ctx.lineTo(notchX, notchY);
        }
        const jagX = x + (rightTipX - x) * frac;
        const jagY = tierBottomY + rand() * 4 - 2;
        ctx.lineTo(jagX, jagY);
      }

      // Curve from right tip back to apex
      ctx.lineTo(rightTipX, rightTipY);
      const rightCtrlX = x + tierWidth * 0.5;
      const rightCtrlY = apexY + (rightTipY - apexY) * 0.3;
      ctx.quadraticCurveTo(rightCtrlX, rightCtrlY, x, apexY);

      ctx.closePath();
      ctx.fill();
    }

    // Top apex (small pointed top)
    const topApexHeight = bodyHeight * tierPositions[1]! * 0.6;
    const topApexWidth = width * maxSpread * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, treeTop);
    ctx.lineTo(x + topApexWidth, treeTop + topApexHeight * 0.8);
    ctx.lineTo(x, treeTop + topApexHeight);
    ctx.lineTo(x - topApexWidth, treeTop + topApexHeight * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Windswept algorithm: Asymmetric pine shaped by environmental forces
   * Creates trees that look like they've grown on an exposed ridge or coastline
   * Windward side (into wind) shorter, leeward side (away from wind) longer
   */
  private drawPineWindswept(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    gradient: CanvasGradient,
    seed: number,
    params: WindsweptParams
  ): void {
    const trunkW = width * 0.1;
    const trunkH = height * 0.12;
    const treeTop = baseY - height;
    const bodyStart = baseY - trunkH;
    const bodyHeight = height - trunkH;

    const rand = this.createSeededRandom(seed);

    const numTiers = Math.round(params.tierCount + (rand() - 0.5) * 1.5);
    const windDir = params.windAngle + (rand() - 0.5) * 0.15; // positive = wind from left
    const windPower = params.windStrength + (rand() - 0.5) * 0.08;
    const asymmetryFactor = params.asymmetry + (rand() - 0.5) * 0.1;
    const curveFactor = params.branchCurve + (rand() - 0.5) * 0.08;

    // Curved trunk bent by wind
    const trunkCurve = windDir * windPower * width * 0.2;
    ctx.fillStyle = this.rgbToString(DEFAULT_COLORS.trunk);
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.quadraticCurveTo(x - trunkW / 3 + trunkCurve * 0.5, baseY - trunkH * 0.5, x - trunkW / 3 + trunkCurve, bodyStart);
    ctx.lineTo(x + trunkW / 3 + trunkCurve, bodyStart);
    ctx.quadraticCurveTo(x + trunkW / 3 + trunkCurve * 0.5, baseY - trunkH * 0.5, x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Calculate tier positions
    const tierPositions: number[] = [];
    for (let i = 0; i <= numTiers; i++) {
      tierPositions.push(i / numTiers);
    }

    ctx.fillStyle = gradient;

    // Draw tiers from bottom to top
    for (let tier = numTiers - 1; tier >= 0; tier--) {
      const t = tierPositions[tier + 1]!;
      const prevT = tierPositions[tier]!;

      // Progressive wind bend (stronger toward top)
      const windBend = windDir * windPower * width * (1 - t) * 0.3;
      const tierCenterX = x + trunkCurve * t + windBend;

      const tierBottomY = treeTop + bodyHeight * t;
      const tierTopY = treeTop + bodyHeight * prevT;
      const tierMidY = (tierBottomY + tierTopY) / 2;

      // Base width tapers toward top
      const baseWidth = width * 0.5 * Math.pow(t, 0.5);

      // Windward side shorter, leeward longer
      const windwardMult = 1 - asymmetryFactor * 0.6;
      const leewardMult = 1 + asymmetryFactor * 0.4;

      const leftWidth = windDir > 0 ? baseWidth * windwardMult : baseWidth * leewardMult;
      const rightWidth = windDir > 0 ? baseWidth * leewardMult : baseWidth * windwardMult;

      // Droop + wind curve
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

      // RIGHT SIDE
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

    // Windswept apex
    const apexBend = windDir * windPower * width * 0.15;
    const topApexHeight = bodyHeight * tierPositions[1]! * 0.5;
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
  // OTHER TREE TYPES (simplified for lab preview)
  // ============================================================================

  private drawFir(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    gradient: CanvasGradient
  ): void {
    const trunkW = width * 0.12;
    const trunkH = height * 0.18;
    const bodyStart = baseY - trunkH;

    ctx.fillStyle = this.rgbToString(DEFAULT_COLORS.trunk);
    ctx.beginPath();
    ctx.rect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
    ctx.fill();

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.48, bodyStart);
    ctx.lineTo(x, baseY - height);
    ctx.lineTo(x + width * 0.48, bodyStart);
    ctx.closePath();
    ctx.fill();
  }

  private drawOak(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    gradient: CanvasGradient
  ): void {
    const trunkW = width * 0.18;
    const trunkH = height * 0.35;
    const crownStart = baseY - trunkH;
    const crownHeight = height - trunkH;

    ctx.fillStyle = this.rgbToString(DEFAULT_COLORS.trunk);
    ctx.beginPath();
    ctx.rect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
    ctx.fill();

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, crownStart - crownHeight * 0.5, width * 0.48, crownHeight * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMaple(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    gradient: CanvasGradient
  ): void {
    const trunkW = width * 0.12;
    const trunkH = height * 0.3;
    const crownStart = baseY - trunkH;
    const crownHeight = height - trunkH;

    ctx.fillStyle = this.rgbToString(DEFAULT_COLORS.trunk);
    ctx.beginPath();
    ctx.rect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
    ctx.fill();

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, crownStart - crownHeight * 0.45, width * 0.52, crownHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPoplar(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    width: number,
    height: number,
    gradient: CanvasGradient
  ): void {
    const trunkW = width * 0.2;
    const trunkH = height * 0.25;
    const crownStart = baseY - trunkH;
    const crownHeight = height - trunkH;

    ctx.fillStyle = this.rgbToString(DEFAULT_COLORS.trunk);
    ctx.beginPath();
    ctx.rect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
    ctx.fill();

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, crownStart - crownHeight * 0.5, width * 0.28, crownHeight * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
