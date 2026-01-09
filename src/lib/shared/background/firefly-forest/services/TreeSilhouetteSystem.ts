import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";

export type TreeType = "pine" | "fir" | "spruce" | "oak" | "maple" | "poplar" | "bare";

export interface TreeTypeVisibility {
  pine: boolean;
  fir: boolean;
  spruce: boolean;
  oak: boolean;
  maple: boolean;
  poplar: boolean;
  bare: boolean;
}

interface Tree {
  x: number;
  height: number;
  width: number;
  type: TreeType;
}

/**
 * Creates forest silhouettes rising from the bottom of the screen
 * Trees are dark shapes against the sky - no ground layers needed
 */
export function createTreeSilhouetteSystem() {
  let cachedCanvas: OffscreenCanvas | null = null;
  let cachedDimensions: Dimensions | null = null;
  let currentVisibility: TreeTypeVisibility = {
    pine: true,
    fir: true,
    spruce: true,
    oak: true,
    maple: true,
    poplar: true,
    bare: true,
  };

  type RenderContext =
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;

  // ===================
  // CONIFER TREES
  // ===================

  /**
   * Pine tree - classic layered Christmas tree shape
   */
  function drawPine(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number
  ): void {
    const trunkW = width * 0.12;
    const trunkH = height * 0.15;

    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);

    const bodyStart = baseY - trunkH;

    // Layered branches - 4 tiers
    ctx.lineTo(x - width * 0.45, bodyStart);
    ctx.lineTo(x - width * 0.08, bodyStart - height * 0.25);
    ctx.lineTo(x - width * 0.38, bodyStart - height * 0.22);
    ctx.lineTo(x - width * 0.06, bodyStart - height * 0.48);
    ctx.lineTo(x - width * 0.28, bodyStart - height * 0.45);
    ctx.lineTo(x - width * 0.04, bodyStart - height * 0.68);
    ctx.lineTo(x - width * 0.18, bodyStart - height * 0.65);
    ctx.lineTo(x, baseY - height);

    // Right side (mirror)
    ctx.lineTo(x + width * 0.18, bodyStart - height * 0.65);
    ctx.lineTo(x + width * 0.04, bodyStart - height * 0.68);
    ctx.lineTo(x + width * 0.28, bodyStart - height * 0.45);
    ctx.lineTo(x + width * 0.06, bodyStart - height * 0.48);
    ctx.lineTo(x + width * 0.38, bodyStart - height * 0.22);
    ctx.lineTo(x + width * 0.08, bodyStart - height * 0.25);
    ctx.lineTo(x + width * 0.45, bodyStart);

    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Fir tree - dense triangular shape with subtle texture
   */
  function drawFir(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number
  ): void {
    const trunkW = width * 0.1;
    const trunkH = height * 0.12;

    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);

    const bodyStart = baseY - trunkH;

    // Dense layered texture
    ctx.lineTo(x - width * 0.48, bodyStart);
    ctx.lineTo(x - width * 0.42, bodyStart - height * 0.12);
    ctx.lineTo(x - width * 0.44, bodyStart - height * 0.15);
    ctx.lineTo(x - width * 0.36, bodyStart - height * 0.3);
    ctx.lineTo(x - width * 0.38, bodyStart - height * 0.33);
    ctx.lineTo(x - width * 0.28, bodyStart - height * 0.5);
    ctx.lineTo(x - width * 0.3, bodyStart - height * 0.53);
    ctx.lineTo(x - width * 0.18, bodyStart - height * 0.72);
    ctx.lineTo(x - width * 0.12, bodyStart - height * 0.78);
    ctx.lineTo(x, baseY - height);

    // Right side (mirror)
    ctx.lineTo(x + width * 0.12, bodyStart - height * 0.78);
    ctx.lineTo(x + width * 0.18, bodyStart - height * 0.72);
    ctx.lineTo(x + width * 0.3, bodyStart - height * 0.53);
    ctx.lineTo(x + width * 0.28, bodyStart - height * 0.5);
    ctx.lineTo(x + width * 0.38, bodyStart - height * 0.33);
    ctx.lineTo(x + width * 0.36, bodyStart - height * 0.3);
    ctx.lineTo(x + width * 0.44, bodyStart - height * 0.15);
    ctx.lineTo(x + width * 0.42, bodyStart - height * 0.12);
    ctx.lineTo(x + width * 0.48, bodyStart);

    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Spruce - tall and narrow conifer
   */
  function drawSpruce(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number
  ): void {
    const trunkW = width * 0.15;
    const trunkH = height * 0.1;

    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);

    const bodyStart = baseY - trunkH;

    // Narrow profile with many small tiers
    ctx.lineTo(x - width * 0.35, bodyStart);
    ctx.lineTo(x - width * 0.25, bodyStart - height * 0.15);
    ctx.lineTo(x - width * 0.3, bodyStart - height * 0.18);
    ctx.lineTo(x - width * 0.2, bodyStart - height * 0.35);
    ctx.lineTo(x - width * 0.24, bodyStart - height * 0.38);
    ctx.lineTo(x - width * 0.15, bodyStart - height * 0.55);
    ctx.lineTo(x - width * 0.18, bodyStart - height * 0.58);
    ctx.lineTo(x - width * 0.1, bodyStart - height * 0.75);
    ctx.lineTo(x - width * 0.08, bodyStart - height * 0.85);
    ctx.lineTo(x, baseY - height);

    // Right side (mirror)
    ctx.lineTo(x + width * 0.08, bodyStart - height * 0.85);
    ctx.lineTo(x + width * 0.1, bodyStart - height * 0.75);
    ctx.lineTo(x + width * 0.18, bodyStart - height * 0.58);
    ctx.lineTo(x + width * 0.15, bodyStart - height * 0.55);
    ctx.lineTo(x + width * 0.24, bodyStart - height * 0.38);
    ctx.lineTo(x + width * 0.2, bodyStart - height * 0.35);
    ctx.lineTo(x + width * 0.3, bodyStart - height * 0.18);
    ctx.lineTo(x + width * 0.25, bodyStart - height * 0.15);
    ctx.lineTo(x + width * 0.35, bodyStart);

    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();
  }

  // ===================
  // DECIDUOUS TREES
  // ===================

  /**
   * Oak tree - rounded, full crown
   */
  function drawOak(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number
  ): void {
    const trunkW = width * 0.18;
    const trunkH = height * 0.35;

    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);

    const crownStart = baseY - trunkH;
    const crownHeight = height - trunkH;

    // Rounded crown with subtle bumps (cloud-like shape)
    ctx.lineTo(x - width * 0.35, crownStart);
    ctx.quadraticCurveTo(
      x - width * 0.5,
      crownStart - crownHeight * 0.2,
      x - width * 0.48,
      crownStart - crownHeight * 0.4
    );
    ctx.quadraticCurveTo(
      x - width * 0.52,
      crownStart - crownHeight * 0.6,
      x - width * 0.4,
      crownStart - crownHeight * 0.75
    );
    ctx.quadraticCurveTo(
      x - width * 0.3,
      crownStart - crownHeight * 0.95,
      x - width * 0.15,
      crownStart - crownHeight * 0.98
    );
    ctx.quadraticCurveTo(x, crownStart - crownHeight * 1.05, x + width * 0.15, crownStart - crownHeight * 0.98);
    ctx.quadraticCurveTo(
      x + width * 0.3,
      crownStart - crownHeight * 0.95,
      x + width * 0.4,
      crownStart - crownHeight * 0.75
    );
    ctx.quadraticCurveTo(
      x + width * 0.52,
      crownStart - crownHeight * 0.6,
      x + width * 0.48,
      crownStart - crownHeight * 0.4
    );
    ctx.quadraticCurveTo(
      x + width * 0.5,
      crownStart - crownHeight * 0.2,
      x + width * 0.35,
      crownStart
    );

    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Maple tree - wide spreading crown with lobed silhouette
   */
  function drawMaple(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number
  ): void {
    const trunkW = width * 0.12;
    const trunkH = height * 0.3;

    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);

    const crownStart = baseY - trunkH;
    const crownHeight = height - trunkH;

    // Wide spreading crown with lobed edges
    ctx.lineTo(x - width * 0.25, crownStart);
    ctx.quadraticCurveTo(x - width * 0.55, crownStart - crownHeight * 0.1, x - width * 0.5, crownStart - crownHeight * 0.3);
    ctx.lineTo(x - width * 0.55, crownStart - crownHeight * 0.35);
    ctx.quadraticCurveTo(x - width * 0.5, crownStart - crownHeight * 0.5, x - width * 0.45, crownStart - crownHeight * 0.55);
    ctx.lineTo(x - width * 0.48, crownStart - crownHeight * 0.6);
    ctx.quadraticCurveTo(x - width * 0.4, crownStart - crownHeight * 0.8, x - width * 0.25, crownStart - crownHeight * 0.9);
    ctx.lineTo(x - width * 0.2, crownStart - crownHeight * 0.95);
    ctx.quadraticCurveTo(x, crownStart - crownHeight * 1.02, x + width * 0.2, crownStart - crownHeight * 0.95);
    ctx.lineTo(x + width * 0.25, crownStart - crownHeight * 0.9);
    ctx.quadraticCurveTo(x + width * 0.4, crownStart - crownHeight * 0.8, x + width * 0.48, crownStart - crownHeight * 0.6);
    ctx.lineTo(x + width * 0.45, crownStart - crownHeight * 0.55);
    ctx.quadraticCurveTo(x + width * 0.5, crownStart - crownHeight * 0.5, x + width * 0.55, crownStart - crownHeight * 0.35);
    ctx.lineTo(x + width * 0.5, crownStart - crownHeight * 0.3);
    ctx.quadraticCurveTo(x + width * 0.55, crownStart - crownHeight * 0.1, x + width * 0.25, crownStart);

    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Poplar tree - tall columnar deciduous
   */
  function drawPoplar(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number
  ): void {
    const trunkW = width * 0.2;
    const trunkH = height * 0.25;

    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW / 2, baseY - trunkH);

    const crownStart = baseY - trunkH;
    const crownHeight = height - trunkH;

    // Tall narrow columnar shape
    ctx.lineTo(x - width * 0.25, crownStart);
    ctx.quadraticCurveTo(x - width * 0.35, crownStart - crownHeight * 0.15, x - width * 0.3, crownStart - crownHeight * 0.3);
    ctx.quadraticCurveTo(x - width * 0.32, crownStart - crownHeight * 0.5, x - width * 0.25, crownStart - crownHeight * 0.7);
    ctx.quadraticCurveTo(x - width * 0.2, crownStart - crownHeight * 0.85, x - width * 0.1, crownStart - crownHeight * 0.95);
    ctx.quadraticCurveTo(x, crownStart - crownHeight * 1.02, x + width * 0.1, crownStart - crownHeight * 0.95);
    ctx.quadraticCurveTo(x + width * 0.2, crownStart - crownHeight * 0.85, x + width * 0.25, crownStart - crownHeight * 0.7);
    ctx.quadraticCurveTo(x + width * 0.32, crownStart - crownHeight * 0.5, x + width * 0.3, crownStart - crownHeight * 0.3);
    ctx.quadraticCurveTo(x + width * 0.35, crownStart - crownHeight * 0.15, x + width * 0.25, crownStart);

    ctx.lineTo(x + trunkW / 2, baseY - trunkH);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();
  }

  // ===================
  // BARE/WINTER TREES
  // ===================

  /**
   * Bare tree - leafless winter silhouette with branches
   */
  function drawBare(
    ctx: RenderContext,
    x: number,
    baseY: number,
    width: number,
    height: number
  ): void {
    const trunkW = width * 0.15;

    ctx.beginPath();

    // Main trunk tapers upward
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x - trunkW * 0.3, baseY - height * 0.6);

    // Left major branch
    ctx.lineTo(x - width * 0.35, baseY - height * 0.55);
    ctx.lineTo(x - width * 0.45, baseY - height * 0.7);
    ctx.lineTo(x - width * 0.38, baseY - height * 0.68);
    ctx.lineTo(x - width * 0.42, baseY - height * 0.82);
    ctx.lineTo(x - width * 0.35, baseY - height * 0.75);
    ctx.lineTo(x - width * 0.3, baseY - height * 0.85);
    ctx.lineTo(x - width * 0.25, baseY - height * 0.72);

    // Back to trunk, continue up
    ctx.lineTo(x - trunkW * 0.2, baseY - height * 0.65);
    ctx.lineTo(x - width * 0.15, baseY - height * 0.78);
    ctx.lineTo(x - width * 0.2, baseY - height * 0.88);
    ctx.lineTo(x - width * 0.12, baseY - height * 0.85);
    ctx.lineTo(x - width * 0.08, baseY - height * 0.95);

    // Top
    ctx.lineTo(x, baseY - height);

    // Right side branches (mirror-ish)
    ctx.lineTo(x + width * 0.08, baseY - height * 0.95);
    ctx.lineTo(x + width * 0.12, baseY - height * 0.85);
    ctx.lineTo(x + width * 0.2, baseY - height * 0.88);
    ctx.lineTo(x + width * 0.15, baseY - height * 0.78);
    ctx.lineTo(x + trunkW * 0.2, baseY - height * 0.65);

    ctx.lineTo(x + width * 0.25, baseY - height * 0.72);
    ctx.lineTo(x + width * 0.3, baseY - height * 0.85);
    ctx.lineTo(x + width * 0.35, baseY - height * 0.75);
    ctx.lineTo(x + width * 0.42, baseY - height * 0.82);
    ctx.lineTo(x + width * 0.38, baseY - height * 0.68);
    ctx.lineTo(x + width * 0.45, baseY - height * 0.7);
    ctx.lineTo(x + width * 0.35, baseY - height * 0.55);

    ctx.lineTo(x + trunkW * 0.3, baseY - height * 0.6);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.closePath();
    ctx.fill();
  }

  // ===================
  // TREE GENERATION
  // ===================

  function getEnabledTypes(): TreeType[] {
    const types: TreeType[] = [];
    if (currentVisibility.pine) types.push("pine");
    if (currentVisibility.fir) types.push("fir");
    if (currentVisibility.spruce) types.push("spruce");
    if (currentVisibility.oak) types.push("oak");
    if (currentVisibility.maple) types.push("maple");
    if (currentVisibility.poplar) types.push("poplar");
    if (currentVisibility.bare) types.push("bare");
    return types;
  }

  function createTrees(dimensions: Dimensions): Tree[] {
    const trees: Tree[] = [];
    const { width, height } = dimensions;
    const enabledTypes = getEnabledTypes();

    if (enabledTypes.length === 0) return trees;

    const pickType = (): TreeType => enabledTypes[Math.floor(Math.random() * enabledTypes.length)]!;

    // Large foreground trees (fewer, bigger)
    const foregroundPositions = [0.08, 0.25, 0.52, 0.78, 0.95];
    for (const xRatio of foregroundPositions) {
      trees.push({
        x: width * xRatio + (Math.random() - 0.5) * width * 0.05,
        height: height * (0.45 + Math.random() * 0.2),
        width: height * (0.12 + Math.random() * 0.06),
        type: pickType(),
      });
    }

    // Medium background trees (fill gaps)
    const midPositions = [0.15, 0.38, 0.62, 0.85];
    for (const xRatio of midPositions) {
      trees.push({
        x: width * xRatio + (Math.random() - 0.5) * width * 0.08,
        height: height * (0.3 + Math.random() * 0.15),
        width: height * (0.08 + Math.random() * 0.04),
        type: pickType(),
      });
    }

    // Small distant trees (peek between larger ones)
    const farPositions = [0.12, 0.32, 0.48, 0.68, 0.88];
    for (const xRatio of farPositions) {
      trees.push({
        x: width * xRatio + (Math.random() - 0.5) * width * 0.06,
        height: height * (0.18 + Math.random() * 0.1),
        width: height * (0.05 + Math.random() * 0.03),
        type: pickType(),
      });
    }

    // Sort by height (tallest last so they draw on top)
    return trees.sort((a, b) => a.height - b.height);
  }

  function initialize(dimensions: Dimensions): void {
    renderToCache(dimensions);
  }

  function renderToCache(dimensions: Dimensions): void {
    cachedCanvas = new OffscreenCanvas(dimensions.width, dimensions.height);
    cachedDimensions = dimensions;
    const ctx = cachedCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const trees = createTrees(dimensions);
    const baseY = dimensions.height + dimensions.height * 0.05;

    for (const tree of trees) {
      const heightRatio = tree.height / (dimensions.height * 0.65);
      const r = Math.floor(2 + heightRatio * 4);
      const g = Math.floor(6 + heightRatio * 8);
      const b = Math.floor(3 + heightRatio * 4);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

      switch (tree.type) {
        case "pine":
          drawPine(ctx, tree.x, baseY, tree.width, tree.height);
          break;
        case "fir":
          drawFir(ctx, tree.x, baseY, tree.width, tree.height);
          break;
        case "spruce":
          drawSpruce(ctx, tree.x, baseY, tree.width, tree.height);
          break;
        case "oak":
          drawOak(ctx, tree.x, baseY, tree.width, tree.height);
          break;
        case "maple":
          drawMaple(ctx, tree.x, baseY, tree.width, tree.height);
          break;
        case "poplar":
          drawPoplar(ctx, tree.x, baseY, tree.width, tree.height);
          break;
        case "bare":
          drawBare(ctx, tree.x, baseY, tree.width, tree.height);
          break;
      }
    }
  }

  function draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    if (!cachedCanvas || !cachedDimensions) {
      initialize(dimensions);
    }

    if (cachedCanvas) {
      ctx.drawImage(cachedCanvas as unknown as CanvasImageSource, 0, 0);
    }
  }

  function handleResize(
    _oldDimensions: Dimensions,
    newDimensions: Dimensions
  ): void {
    initialize(newDimensions);
  }

  function setTreeVisibility(visibility: Partial<TreeTypeVisibility>): void {
    currentVisibility = { ...currentVisibility, ...visibility };
  }

  function getTreeVisibility(): TreeTypeVisibility {
    return { ...currentVisibility };
  }

  function regenerate(dimensions: Dimensions): void {
    renderToCache(dimensions);
  }

  function cleanup(): void {
    cachedCanvas = null;
    cachedDimensions = null;
  }

  return {
    initialize,
    draw,
    handleResize,
    setTreeVisibility,
    getTreeVisibility,
    regenerate,
    cleanup,
  };
}
