/**
 * Tree Lab Renderer Service Contract
 *
 * Renders tree silhouettes for the Tree Lab UI in FireflyForestLab.
 * Handles multiple tree types and spruce algorithm variations.
 */

import type { TreeType } from "$lib/shared/background/firefly-forest/services/TreeSilhouetteSystem";

/** Parameters for the smooth spruce algorithm */
export interface SmoothParams {
  spread: number; // 0.45-0.65 - crown width relative to height
  taperPower: number; // 0.45-0.75 - how sharply it narrows (lower = wider at top)
  waveFreq: number; // 4-10 - frequency of edge waviness
  waveAmp: number; // 2-8 - amplitude of edge waviness
  jitter: number; // 0-4 - random edge variation
}

/** Parameters for the whorl spruce algorithm */
export interface WhorlParams {
  spread: number; // 0.40-0.65 - crown width relative to height
  taperExponent: number; // 1.2-2.0 - how quickly it narrows toward top
  layers: number; // 6-12 - number of branch whorls
  droop: number; // 0.05-0.35 - how much lower branches droop
  jaggedness: number; // 0.5-2.0 - intensity of bottom-edge jagged points
}

/** Spruce algorithm type */
export type SpruceAlgorithm = "smooth" | "whorl";

/** Pine algorithm type */
export type PineAlgorithm = "tiered" | "windswept";

/** Parameters for the tiered pine algorithm (classic structure) */
export interface TieredParams {
  tierCount: number; // 5-10 - number of visible branch whorls
  tierSpacing: number; // 0.7-1.3 - spacing regularity (1.0 = even, <1 = compressed top, >1 = compressed bottom)
  spread: number; // 0.35-0.55 - maximum tier width relative to height
  uplift: number; // 0.05-0.25 - branch tip upward curve (candle effect)
  gapVisibility: number; // 0.15-0.4 - trunk visibility between tiers
}

/** Parameters for the windswept pine algorithm (environmental influence) */
export interface WindsweptParams {
  windAngle: number; // -0.8 to 0.8 - direction of wind influence (-1 left, 1 right)
  windStrength: number; // 0.15-0.5 - how much branches bend
  tierCount: number; // 4-8 - fewer, more spread tiers
  asymmetry: number; // 0.2-0.6 - difference between windward/leeward sides
  branchCurve: number; // 0.1-0.4 - curvature of individual branches
}

/** Tree colors for rendering */
export interface TreeColors {
  foliage: { r: number; g: number; b: number };
  trunk: { r: number; g: number; b: number };
}

/** Combined algorithm parameters for all tree types */
export interface TreeAlgorithmParams {
  spruce: {
    algorithm: SpruceAlgorithm;
    smooth: SmoothParams;
    whorl: WhorlParams;
  };
  pine: {
    algorithm: PineAlgorithm;
    tiered: TieredParams;
    windswept: WindsweptParams;
  };
}

export interface ITreeLabRenderer {
  /**
   * Draw a complete tree sample on a canvas
   * Handles canvas clearing and tree positioning
   */
  drawTreeSample(
    canvas: HTMLCanvasElement,
    treeType: TreeType,
    seed: number,
    params: TreeAlgorithmParams
  ): void;

  /**
   * Draw a single tree at a specific position
   * Lower-level method for custom positioning
   */
  drawSingleTree(
    ctx: CanvasRenderingContext2D,
    type: TreeType,
    x: number,
    baseY: number,
    width: number,
    height: number,
    seed: number,
    params: TreeAlgorithmParams
  ): void;

  /**
   * Generate an SVG string for a spruce tree
   * Used for exporting tree designs
   */
  generateSpruceSVG(seed: number): string;

  /**
   * Generate an SVG string for a pine tree
   * Used for exporting tree designs
   */
  generatePineSVG(seed: number, params: TreeAlgorithmParams): string;
}
