/**
 * CoralSceneRenderer
 *
 * Places coral silhouettes along the ocean floor with three depth layers,
 * animates a gentle sway, and draws them per-frame. Respects
 * prefers-reduced-motion by disabling sway when the user requests it.
 */

import type { CoralAssetLoader } from "./coral-asset-loader";
import type {
  CoralDepthLayer,
  PlacedCoral,
  TintedCoralAsset,
} from "../domain/coral-types";
import type { CoralSceneConfig } from "./types";

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

/** Depth layer rendering properties: [minScale, maxScale, minOpacity, maxOpacity] */
const LAYER_PROPERTIES: Record<CoralDepthLayer, [number, number, number, number]> = {
  back:  [0.4, 0.6, 0.3, 0.5],
  mid:   [0.6, 0.85, 0.5, 0.7],
  front: [0.85, 1.1, 0.7, 0.9],
};

/** Sway parameters: [minAmplitudeDeg, maxAmplitudeDeg, minSpeedRad, maxSpeedRad] */
const SWAY_PARAMS: [number, number, number, number] = [2, 6, 0.3, 0.8];

const DEG_TO_RAD = Math.PI / 180;

const DEFAULT_LAYER_COUNTS: [number, number, number] = [6, 8, 6];

const LAYERS_ORDER: CoralDepthLayer[] = ["back", "mid", "front"];

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// --------------------------------------------------------------------------
// Implementation
// --------------------------------------------------------------------------

export class CoralSceneRenderer {
  private readonly loader: CoralAssetLoader;
  private placed: Map<CoralDepthLayer, PlacedCoral[]> = new Map();
  private ready = false;
  private elapsedTime = 0;
  private reducedMotion = false;
  private layerCounts: [number, number, number] = DEFAULT_LAYER_COUNTS;

  constructor(loader: CoralAssetLoader) {
    this.loader = loader;
  }

  async initialize(
    width: number,
    height: number,
    config?: CoralSceneConfig
  ): Promise<void> {
    if (this.ready) return;

    this.reducedMotion = prefersReducedMotion();

    if (config?.layerCounts) {
      this.layerCounts = config.layerCounts;
    }

    const assetsByLayer = await this.loader.loadAndTint();
    this.placeCoral(assetsByLayer, width, height);
    this.ready = true;
  }

  update(frameMultiplier: number): void {
    if (!this.ready || this.reducedMotion) return;

    // Advance clock (~60fps normalized)
    const dt = (frameMultiplier * 16.67) / 1000;
    this.elapsedTime += dt;

    for (const corals of this.placed.values()) {
      for (const coral of corals) {
        coral.currentSwayAngle =
          Math.sin(this.elapsedTime * coral.swaySpeed + coral.swayPhase) *
          coral.swayAmplitude;
      }
    }
  }

  drawLayer(
    ctx: CanvasRenderingContext2D,
    layer: CoralDepthLayer,
    _width: number,
    _height: number
  ): void {
    const corals = this.placed.get(layer);
    if (!corals) return;

    for (const coral of corals) {
      const { asset, x, y, scale, flipX, opacity, currentSwayAngle } = coral;
      const drawWidth = asset.width * scale;
      const drawHeight = asset.height * scale;

      ctx.save();
      ctx.globalAlpha = opacity;

      // Translate to the base center (bottom-center anchor point)
      ctx.translate(x, y);

      // Rotate around the base (sway pivot)
      if (currentSwayAngle !== 0) {
        ctx.rotate(currentSwayAngle);
      }

      // Optional horizontal flip
      if (flipX) {
        ctx.scale(-1, 1);
      }

      // Draw from bottom-center: offset so bottom edge is at origin
      ctx.drawImage(
        asset.canvas,
        -drawWidth / 2,
        -drawHeight,
        drawWidth,
        drawHeight
      );

      ctx.restore();
    }
  }

  handleResize(
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number
  ): void {
    if (!this.ready) return;

    const scaleX = newWidth / oldWidth;
    const scaleY = newHeight / oldHeight;

    for (const corals of this.placed.values()) {
      for (const coral of corals) {
        coral.x *= scaleX;
        coral.y *= scaleY;
      }
    }
  }

  async regenerate(width: number, height: number): Promise<void> {
    this.ready = false;
    this.elapsedTime = 0;

    // Re-tint with fresh random colors
    this.loader.cleanup();
    const assetsByLayer = await this.loader.loadAndTint();
    this.placeCoral(assetsByLayer, width, height);
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  getCoralCount(): number {
    let count = 0;
    for (const corals of this.placed.values()) {
      count += corals.length;
    }
    return count;
  }

  cleanup(): void {
    this.placed.clear();
    this.ready = false;
    this.elapsedTime = 0;
    this.loader.cleanup();
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private placeCoral(
    assetsByLayer: Map<CoralDepthLayer, TintedCoralAsset[]>,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    this.placed = new Map();

    const layerCountMap: Record<CoralDepthLayer, number> = {
      back: this.layerCounts[0],
      mid: this.layerCounts[1],
      front: this.layerCounts[2],
    };

    for (const layer of LAYERS_ORDER) {
      const count = layerCountMap[layer];
      const assets = assetsByLayer.get(layer);

      if (!assets || assets.length === 0) {
        this.placed.set(layer, []);
        continue;
      }

      const [minScale, maxScale, minOpacity, maxOpacity] = LAYER_PROPERTIES[layer];
      const [minAmpDeg, maxAmpDeg, minSpeed, maxSpeed] = SWAY_PARAMS;

      const placedInLayer: PlacedCoral[] = [];

      // Divide canvas width into zones for even distribution with jitter
      const zoneWidth = canvasWidth / count;

      for (let j = 0; j < count; j++) {
        const asset = pickRandom(assets);
        const scale = rand(minScale, maxScale);

        // X: center of zone + random jitter within half a zone
        const zoneCenter = zoneWidth * (j + 0.5);
        const jitter = rand(-zoneWidth * 0.35, zoneWidth * 0.35);
        const x = Math.max(0, Math.min(canvasWidth, zoneCenter + jitter));

        // Y: anchor at canvas bottom with slight variation
        // Back layer sits slightly higher, front slightly lower for depth
        const baseY = canvasHeight;
        const yOffset = layer === "back" ? rand(-10, -5) : layer === "front" ? rand(5, 15) : 0;
        const y = baseY + yOffset;

        const swayAmplitude = rand(minAmpDeg, maxAmpDeg) * DEG_TO_RAD;
        // Rocks sway less than fans
        const categoryMultiplier =
          asset.definition.category === "rock" ? 0.3 :
          asset.definition.category === "reef" ? 0.6 : 1.0;

        placedInLayer.push({
          asset,
          layer,
          x,
          y,
          scale,
          flipX: Math.random() > 0.5,
          opacity: rand(minOpacity, maxOpacity),
          swayAmplitude: swayAmplitude * categoryMultiplier,
          swaySpeed: rand(minSpeed, maxSpeed),
          swayPhase: rand(0, Math.PI * 2),
          currentSwayAngle: 0,
        });
      }

      this.placed.set(layer, placedInLayer);
    }
  }
}
