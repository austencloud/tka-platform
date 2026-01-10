/**
 * TreeSilhouetteSystem
 *
 * Renders stylized cherry tree silhouettes along edges.
 * Uses cached OffscreenCanvas for performance.
 */

import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";

interface TreeParams {
  x: number;           // Base x position (fraction of width)
  baseY: number;       // Base y position (fraction of height, from bottom)
  height: number;      // Tree height (fraction of viewport height)
  width: number;       // Canopy width (fraction of viewport width)
  trunkWidth: number;  // Trunk width as fraction of canopy
  branches: number;    // Number of main branch layers
  lean: number;        // Lean direction (-1 left, 0 straight, 1 right)
}

// Predefined tree templates for consistent, hand-crafted look
const TREE_TEMPLATES: TreeParams[] = [
  // Left side tree - tall, leaning slightly right
  { x: 0.05, baseY: 0.1, height: 0.7, width: 0.35, trunkWidth: 0.08, branches: 4, lean: 0.3 },
  // Right side tree - medium, leaning slightly left
  { x: 0.88, baseY: 0.08, height: 0.55, width: 0.3, trunkWidth: 0.07, branches: 3, lean: -0.2 },
  // Far left small tree
  { x: -0.05, baseY: 0.05, height: 0.4, width: 0.25, trunkWidth: 0.06, branches: 2, lean: 0.1 },
];

export class TreeSilhouetteSystem {
  private cachedCanvas: OffscreenCanvas | null = null;
  private lastDimensions: Dimensions | null = null;
  private silhouetteColor = "#0a0808"; // Near-black with slight warmth
  private isInitialized = false;

  constructor() {
    // Support for OffscreenCanvas
    if (typeof OffscreenCanvas === "undefined") {
      console.warn("OffscreenCanvas not supported, trees will be drawn directly");
    }
  }

  initialize(dimensions: Dimensions): void {
    this.renderToCache(dimensions);
    this.lastDimensions = dimensions;
    this.isInitialized = true;
  }

  private renderToCache(dimensions: Dimensions): void {
    const { width, height } = dimensions;

    // Use OffscreenCanvas if available, otherwise use regular canvas
    if (typeof OffscreenCanvas !== "undefined") {
      this.cachedCanvas = new OffscreenCanvas(width, height);
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      this.cachedCanvas = canvas as unknown as OffscreenCanvas;
    }

    const ctx = this.cachedCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Render each tree template
    for (const template of TREE_TEMPLATES) {
      this.drawTree(ctx, dimensions, template);
    }
  }

  private drawTree(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    params: TreeParams
  ): void {
    const { width, height } = dimensions;

    const baseX = width * params.x;
    const baseY = height * (1 - params.baseY);
    const treeHeight = height * params.height;
    const canopyWidth = width * params.width;
    const trunkW = canopyWidth * params.trunkWidth;

    ctx.save();
    ctx.fillStyle = this.silhouetteColor;

    // Draw trunk
    const trunkTop = baseY - treeHeight * 0.3;
    const lean = params.lean * canopyWidth * 0.3;

    ctx.beginPath();
    ctx.moveTo(baseX - trunkW / 2, baseY);
    ctx.lineTo(baseX + trunkW / 2, baseY);
    ctx.lineTo(baseX + lean + trunkW / 4, trunkTop);
    ctx.lineTo(baseX + lean - trunkW / 4, trunkTop);
    ctx.closePath();
    ctx.fill();

    // Draw canopy (layered cloud-like shapes for cherry blossom style)
    const canopyBase = baseY - treeHeight * 0.25;
    const canopyCenterX = baseX + lean;

    // Multiple overlapping circles to create organic canopy shape
    const layers = params.branches;
    for (let layer = 0; layer < layers; layer++) {
      const layerProgress = layer / (layers - 1);
      const layerY = canopyBase - treeHeight * 0.6 * layerProgress;
      const layerWidth = canopyWidth * (1 - layerProgress * 0.4);

      // Create 3-5 overlapping circles per layer
      const circlesInLayer = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < circlesInLayer; i++) {
        const circleProgress = i / (circlesInLayer - 1);
        const offsetX = (circleProgress - 0.5) * layerWidth * 0.8;
        const radius = layerWidth * (0.2 + Math.random() * 0.15);

        ctx.beginPath();
        ctx.arc(
          canopyCenterX + offsetX,
          layerY + Math.random() * treeHeight * 0.1,
          radius,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    // Add some hanging branches
    const branchCount = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < branchCount; i++) {
      const branchX = canopyCenterX + (Math.random() - 0.5) * canopyWidth * 0.9;
      const branchStartY = canopyBase - treeHeight * 0.3 - Math.random() * treeHeight * 0.4;
      const branchLength = treeHeight * 0.1 + Math.random() * treeHeight * 0.15;
      const branchCurve = (Math.random() - 0.5) * 0.3;

      ctx.beginPath();
      ctx.moveTo(branchX, branchStartY);
      ctx.quadraticCurveTo(
        branchX + branchCurve * canopyWidth * 0.1,
        branchStartY + branchLength * 0.5,
        branchX + branchCurve * canopyWidth * 0.15,
        branchStartY + branchLength
      );
      ctx.strokeStyle = this.silhouetteColor;
      ctx.lineWidth = 2 + Math.random() * 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  update(_dimensions: Dimensions, _frameMultiplier: number = 1.0): void {
    // Trees are static - no animation needed
    // Could add subtle sway in future
  }

  draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    // Check if we need to re-render cache
    if (
      !this.isInitialized ||
      !this.lastDimensions ||
      dimensions.width !== this.lastDimensions.width ||
      dimensions.height !== this.lastDimensions.height
    ) {
      this.initialize(dimensions);
    }

    if (!this.cachedCanvas) return;

    // Draw cached silhouettes
    ctx.drawImage(this.cachedCanvas as unknown as CanvasImageSource, 0, 0);
  }

  handleResize(newDimensions: Dimensions): void {
    // Re-render cache for new dimensions
    this.initialize(newDimensions);
  }

  /**
   * Set silhouette color (for different time-of-day modes)
   */
  setSilhouetteColor(color: string): void {
    this.silhouetteColor = color;
    if (this.lastDimensions) {
      this.renderToCache(this.lastDimensions);
    }
  }

  cleanup(): void {
    this.cachedCanvas = null;
    this.lastDimensions = null;
    this.isInitialized = false;
  }
}
