/**
 * LayerCompositor
 *
 * Composes pictographs from independently cached layers.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    LayerCompositor                          │
 * ├─────────────────────────────────────────────────────────────┤
 * │  1. Get/render BASE layer                                   │
 * │     - Background, center point, outer corners               │
 * │     - Props + Arrows                                        │
 * │     - Cached by: motions + props + darkMode + size          │
 * │  2. Get/render GRID POINTS layer                            │
 * │     - Hand points (4) + Layer 2 points (4)                  │
 * │     - Cached by: handPointVisibility + showNonRadial + size │
 * │  3. If showTKA: Get/render TKA overlay                      │
 * │  4. If showReversals: Get/render Reversal overlay           │
 * │  5. Draw beat number (no cache - simple text)               │
 * │  6. Composite all layers onto final canvas                  │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Result: ALL visibility toggles are instant (base layer cache HIT)
 * - TKA toggle: base HIT, TKA overlay re-composites
 * - Reversal toggle: base HIT, reversal overlay re-composites
 * - Hand point toggle: base HIT, grid points layer re-renders (fast, just dots)
 * - Layer 2 toggle: base HIT, grid points layer re-renders (fast, just dots)
 * - Composition is ~1-2ms vs ~300ms full render
 */

import type {
  ILayerCompositor,
  LayerType,
  LayerRenderOptions,
  LayerVisibility,
  LayerRenderResult,
  CompositionResult,
  LayerCacheStats,
} from "../contracts/ILayerCompositor";
import type { PreparedPictographData } from "../../../pictograph/shared/domain/models/PreparedPictographData";
import type { BeatData } from "../../../../features/create/shared/domain/models/BeatData";
import { LayerKeyDeriver } from "./LayerKeyDeriver";
import { container } from "../../../di";
import type { ITurnsTupleGenerator } from "../../../pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
import type { Letter } from "../../../foundation/domain/models/Letter";

// Constants matching Canvas2DDirectRenderer
const VIEWBOX_SIZE = 950;
const TKA_GLYPH_X = 50;
const TKA_GLYPH_Y = 800;
const BEAT_NUMBER_X = 50;
const BEAT_NUMBER_Y = 50;
const BEAT_NUMBER_FONT_SIZE = 100;
const BEAT_NUMBER_START_FONT_SIZE = 80;
const BLUE_COLOR = "#2E77AE";
const RED_COLOR = "#ED1C24";

// Grid point positions (from diamond_grid.svg, viewBox 0 0 950 950)
// These are the TOGGLEABLE points - hand points and layer 2 points
const GRID_POINTS = {
  // Hand points (r=4.7) - controlled by handPointVisibility
  handPoints: {
    n: { x: 475, y: 331.9, r: 4.7 },
    e: { x: 618.1, y: 475, r: 4.7 },
    s: { x: 475, y: 618.1, r: 4.7 },
    w: { x: 331.9, y: 475, r: 4.7 },
  },
  // Layer 2 / non-radial points (r=8.8) - controlled by showNonRadialPoints
  layer2Points: {
    ne: { x: 618.1, y: 331.9, r: 8.8 },
    se: { x: 618.1, y: 618.1, r: 8.8 },
    sw: { x: 331.9, y: 618.1, r: 8.8 },
    nw: { x: 331.9, y: 331.9, r: 8.8 },
  },
};

// Grid point color (matches GridSvg.svelte #d0d0d0 in light mode)
const GRID_POINT_COLOR_LIGHT = "#d0d0d0";
const GRID_POINT_COLOR_DARK = "#ffffff";

// LRU cache size limits
const BASE_CACHE_LIMIT = 2000;
const GRID_POINTS_CACHE_LIMIT = 500; // Varies by handPointVisibility/showNonRadialPoints
const TKA_CACHE_LIMIT = 500; // Shared across pictographs, smaller needed
const REVERSAL_CACHE_LIMIT = 10; // Only 4 states per size

export class LayerCompositor implements ILayerCompositor {
  private keyDeriver = new LayerKeyDeriver();

  // Layer caches (LRU maps)
  private baseCache = new Map<string, HTMLCanvasElement>();
  private gridPointsCache = new Map<string, HTMLCanvasElement>();
  private tkaCache = new Map<string, HTMLCanvasElement>();
  private reversalCache = new Map<string, HTMLCanvasElement>();

  // Shared Canvas2D renderer (initialized once)
  private canvas2DRenderer: InstanceType<typeof import("./Canvas2DDirectRenderer").Canvas2DDirectRenderer> | null = null;
  private canvas2DInitPromise: Promise<void> | null = null;

  // Cache statistics
  private stats = {
    baseCacheHits: 0,
    baseCacheMisses: 0,
    gridPointsCacheHits: 0,
    gridPointsCacheMisses: 0,
    tkaCacheHits: 0,
    tkaCacheMisses: 0,
    totalCompositions: 0,
  };

  async compose(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions,
    visibility: LayerVisibility,
    beatNumber?: number
  ): Promise<CompositionResult> {
    const totalStart = performance.now();
    this.stats.totalCompositions++;

    const timing = {
      totalMs: 0,
      baseLayerMs: 0,
      gridPointsLayerMs: 0,
      tkaLayerMs: 0,
      reversalLayerMs: 0,
      beatLayerMs: 0,
      compositeMs: 0,
    };

    const cacheStats = {
      baseFromCache: false,
      gridPointsFromCache: false,
      tkaFromCache: false,
      reversalFromCache: false,
    };

    // 1. Get/render base layer (props + arrows, no grid dots)
    const baseStart = performance.now();
    const baseResult = await this.renderBaseLayer(pictograph, options);
    timing.baseLayerMs = performance.now() - baseStart;
    cacheStats.baseFromCache = baseResult.fromCache;

    // 2. Get/render grid points overlay (dots only)
    const gridPointsStart = performance.now();
    const gridPointsResult = await this.renderGridPointsOverlay(pictograph, options);
    timing.gridPointsLayerMs = performance.now() - gridPointsStart;
    cacheStats.gridPointsFromCache = gridPointsResult.fromCache;

    // 3. Get/render TKA overlay (if enabled)
    let tkaResult: LayerRenderResult | null = null;
    if (visibility.showTKA && pictograph.letter) {
      const tkaStart = performance.now();
      tkaResult = await this.renderTKAOverlay(pictograph, {
        size: options.size,
        darkMode: options.darkMode,
      });
      timing.tkaLayerMs = performance.now() - tkaStart;
      if (tkaResult) {
        cacheStats.tkaFromCache = tkaResult.fromCache;
      }
    }

    // 4. Get/render reversal overlay (if enabled and applicable)
    let reversalResult: LayerRenderResult | null = null;
    const beatData = pictograph as BeatData;
    if (visibility.showReversals && this.isBeatData(pictograph)) {
      const reversalStart = performance.now();
      reversalResult = await this.renderReversalOverlay(beatData, options.size);
      timing.reversalLayerMs = performance.now() - reversalStart;
      if (reversalResult) {
        cacheStats.reversalFromCache = reversalResult.fromCache;
      }
    }

    // 5. Composite all layers
    const compositeStart = performance.now();
    const canvas = document.createElement("canvas");
    canvas.width = options.size;
    canvas.height = options.size;
    const ctx = canvas.getContext("2d")!;

    // Draw base layer (props + arrows)
    ctx.drawImage(baseResult.canvas, 0, 0);

    // Draw grid points overlay
    ctx.drawImage(gridPointsResult.canvas, 0, 0);

    // Draw TKA overlay
    if (tkaResult) {
      ctx.drawImage(tkaResult.canvas, 0, 0);
    }

    // Draw reversal overlay
    if (reversalResult) {
      ctx.drawImage(reversalResult.canvas, 0, 0);
    }

    // 6. Draw beat number (not cached - simple text)
    if (typeof beatNumber === "number" && beatNumber !== -1) {
      const beatStart = performance.now();
      this.drawBeatNumber(ctx, beatNumber, options.size, options.darkMode);
      timing.beatLayerMs = performance.now() - beatStart;
    }

    timing.compositeMs = performance.now() - compositeStart;
    timing.totalMs = performance.now() - totalStart;

    return { canvas, timing, cacheStats };
  }

  async renderBaseLayer(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions
  ): Promise<LayerRenderResult> {
    const startTime = performance.now();
    const cacheKey = this.keyDeriver.deriveBaseLayerKey(pictograph, options);

    // Check cache
    const cached = this.baseCache.get(cacheKey);
    if (cached) {
      this.stats.baseCacheHits++;
      // Move to end (LRU refresh)
      this.baseCache.delete(cacheKey);
      this.baseCache.set(cacheKey, cached);
      return {
        canvas: cached,
        cacheKey,
        fromCache: true,
        renderTimeMs: performance.now() - startTime,
      };
    }

    this.stats.baseCacheMisses++;

    // Render base layer (grid + props + arrows only)
    const canvas = await this.renderBaseLayerInternal(pictograph, options);

    // Add to cache with LRU eviction
    if (this.baseCache.size >= BASE_CACHE_LIMIT) {
      // Remove oldest entry
      const firstKey = this.baseCache.keys().next().value;
      if (firstKey) this.baseCache.delete(firstKey);
    }
    this.baseCache.set(cacheKey, canvas);

    return {
      canvas,
      cacheKey,
      fromCache: false,
      renderTimeMs: performance.now() - startTime,
    };
  }

  async renderGridPointsOverlay(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions
  ): Promise<LayerRenderResult> {
    const startTime = performance.now();
    const cacheKey = this.keyDeriver.deriveGridPointsLayerKey(pictograph, options);

    // Check cache
    const cached = this.gridPointsCache.get(cacheKey);
    if (cached) {
      this.stats.gridPointsCacheHits++;
      // Move to end (LRU refresh)
      this.gridPointsCache.delete(cacheKey);
      this.gridPointsCache.set(cacheKey, cached);
      return {
        canvas: cached,
        cacheKey,
        fromCache: true,
        renderTimeMs: performance.now() - startTime,
      };
    }

    this.stats.gridPointsCacheMisses++;

    // Render grid points layer (dots only, transparent background)
    const canvas = await this.renderGridPointsOverlayInternal(pictograph, options);

    // Add to cache with LRU eviction
    if (this.gridPointsCache.size >= GRID_POINTS_CACHE_LIMIT) {
      // Remove oldest entry
      const firstKey = this.gridPointsCache.keys().next().value;
      if (firstKey) this.gridPointsCache.delete(firstKey);
    }
    this.gridPointsCache.set(cacheKey, canvas);

    return {
      canvas,
      cacheKey,
      fromCache: false,
      renderTimeMs: performance.now() - startTime,
    };
  }

  async renderTKAOverlay(
    pictograph: PreparedPictographData,
    options: Pick<LayerRenderOptions, "size" | "darkMode">
  ): Promise<LayerRenderResult | null> {
    if (!pictograph.letter) return null;

    const startTime = performance.now();

    // Generate turnsTuple for cache key
    const turnsTuple = this.getTurnsTuple(pictograph);
    const cacheKey = this.keyDeriver.deriveTKALayerKey(pictograph, turnsTuple, options);

    // Check cache
    const cached = this.tkaCache.get(cacheKey);
    if (cached) {
      this.stats.tkaCacheHits++;
      this.tkaCache.delete(cacheKey);
      this.tkaCache.set(cacheKey, cached);
      return {
        canvas: cached,
        cacheKey,
        fromCache: true,
        renderTimeMs: performance.now() - startTime,
      };
    }

    this.stats.tkaCacheMisses++;

    // Render TKA overlay (transparent background)
    const canvas = await this.renderTKAOverlayInternal(pictograph, options);

    // Add to cache
    if (this.tkaCache.size >= TKA_CACHE_LIMIT) {
      const firstKey = this.tkaCache.keys().next().value;
      if (firstKey) this.tkaCache.delete(firstKey);
    }
    this.tkaCache.set(cacheKey, canvas);

    return {
      canvas,
      cacheKey,
      fromCache: false,
      renderTimeMs: performance.now() - startTime,
    };
  }

  async renderReversalOverlay(
    beatData: BeatData,
    size: number
  ): Promise<LayerRenderResult | null> {
    if (!beatData.blueReversal && !beatData.redReversal) return null;

    const startTime = performance.now();
    const cacheKey = this.keyDeriver.deriveReversalLayerKey(beatData, size);

    // Check cache
    const cached = this.reversalCache.get(cacheKey);
    if (cached) {
      this.reversalCache.delete(cacheKey);
      this.reversalCache.set(cacheKey, cached);
      return {
        canvas: cached,
        cacheKey,
        fromCache: true,
        renderTimeMs: performance.now() - startTime,
      };
    }

    // Render reversal overlay (transparent background)
    const canvas = this.renderReversalOverlayInternal(beatData, size);

    // Add to cache
    if (this.reversalCache.size >= REVERSAL_CACHE_LIMIT) {
      const firstKey = this.reversalCache.keys().next().value;
      if (firstKey) this.reversalCache.delete(firstKey);
    }
    this.reversalCache.set(cacheKey, canvas);

    return {
      canvas,
      cacheKey,
      fromCache: false,
      renderTimeMs: performance.now() - startTime,
    };
  }

  getCacheStats(): LayerCacheStats {
    return {
      baseCacheSize: this.baseCache.size,
      gridPointsCacheSize: this.gridPointsCache.size,
      tkaCacheSize: this.tkaCache.size,
      reversalCacheSize: this.reversalCache.size,
      baseCacheHits: this.stats.baseCacheHits,
      baseCacheMisses: this.stats.baseCacheMisses,
      gridPointsCacheHits: this.stats.gridPointsCacheHits,
      gridPointsCacheMisses: this.stats.gridPointsCacheMisses,
      tkaCacheHits: this.stats.tkaCacheHits,
      tkaCacheMisses: this.stats.tkaCacheMisses,
      totalCompositions: this.stats.totalCompositions,
    };
  }

  clearCache(): void {
    this.baseCache.clear();
    this.gridPointsCache.clear();
    this.tkaCache.clear();
    this.reversalCache.clear();
    this.stats = {
      baseCacheHits: 0,
      baseCacheMisses: 0,
      gridPointsCacheHits: 0,
      gridPointsCacheMisses: 0,
      tkaCacheHits: 0,
      tkaCacheMisses: 0,
      totalCompositions: 0,
    };
  }

  clearLayerCache(layer: LayerType): void {
    switch (layer) {
      case "base":
        this.baseCache.clear();
        break;
      case "gridPoints":
        this.gridPointsCache.clear();
        break;
      case "tka":
        this.tkaCache.clear();
        break;
      case "reversal":
        this.reversalCache.clear();
        break;
      case "beat":
        // Beat numbers aren't cached
        break;
    }
  }

  // ========== Internal rendering methods ==========

  /**
   * Ensure the shared Canvas2D renderer is initialized (once per LayerCompositor instance)
   */
  private async ensureCanvas2DRenderer(): Promise<InstanceType<typeof import("./Canvas2DDirectRenderer").Canvas2DDirectRenderer>> {
    if (this.canvas2DRenderer) {
      return this.canvas2DRenderer;
    }

    if (!this.canvas2DInitPromise) {
      this.canvas2DInitPromise = (async () => {
        const { Canvas2DDirectRenderer } = await import("./Canvas2DDirectRenderer");
        this.canvas2DRenderer = new Canvas2DDirectRenderer();
        await this.canvas2DRenderer.initialize();
      })();
    }

    await this.canvas2DInitPromise;
    return this.canvas2DRenderer!;
  }

  /**
   * Render base layer: background + base grid + props + arrows
   *
   * Base layer contains:
   * - Background
   * - Base grid (center point + outer corner points ONLY)
   * - Props
   * - Arrows
   *
   * Excluded from base layer (rendered as separate overlays):
   * - Hand points → gridPoints layer
   * - Layer 2 / non-radial points → gridPoints layer
   * - TKA glyph → TKA overlay
   * - Reversals → reversal overlay
   *
   * This allows the base layer cache to survive ALL visibility toggles.
   */
  private async renderBaseLayerInternal(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions
  ): Promise<HTMLCanvasElement> {
    // Use shared renderer instance (initialized once)
    const renderer = await this.ensureCanvas2DRenderer();

    const canvas = await renderer.renderPictograph(pictograph, {
      size: options.size,
      visibility: {
        darkMode: options.darkMode,
        showTKA: false, // Exclude from base layer - separate overlay
        showReversals: false, // Exclude from base layer - separate overlay
        // Base grid only - hand points and layer 2 are in gridPoints layer
        baseGridOnly: true,
        bluePropType: options.bluePropType,
        redPropType: options.redPropType,
      },
    });

    return canvas;
  }

  /**
   * Render TKA overlay: letter + turns + direction dot
   * Returns canvas with transparent background.
   */
  private async renderTKAOverlayInternal(
    pictograph: PreparedPictographData,
    options: Pick<LayerRenderOptions, "size" | "darkMode">
  ): Promise<HTMLCanvasElement> {
    const canvas = document.createElement("canvas");
    canvas.width = options.size;
    canvas.height = options.size;
    const ctx = canvas.getContext("2d")!;

    // Transparent background (overlay only)
    ctx.clearRect(0, 0, options.size, options.size);

    const scale = options.size / VIEWBOX_SIZE;

    // Draw letter glyph
    if (pictograph.letter) {
      await this.drawTKAGlyph(ctx, pictograph.letter as Letter, options.size, options.darkMode);
    }

    // Draw turns column (to the right of letter)
    if (pictograph.motions) {
      await this.drawTurnsColumn(ctx, pictograph, scale, options.darkMode);
    }

    // Draw direction dot
    if (pictograph.letter && pictograph.motions) {
      this.drawDirectionDot(ctx, pictograph, scale, options.darkMode);
    }

    return canvas;
  }

  /**
   * Render grid points overlay
   *
   * Renders the TOGGLEABLE grid points:
   * - Hand points (4): controlled by handPointVisibility
   * - Layer 2 points (4): controlled by showNonRadialPoints
   *
   * Base layer contains ONLY:
   * - Center point
   * - Outer corner points
   *
   * This separation allows instant toggles without invalidating base cache.
   */
  private async renderGridPointsOverlayInternal(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions
  ): Promise<HTMLCanvasElement> {
    const canvas = document.createElement("canvas");
    canvas.width = options.size;
    canvas.height = options.size;
    const ctx = canvas.getContext("2d")!;

    // Transparent background
    ctx.clearRect(0, 0, options.size, options.size);

    const scale = options.size / VIEWBOX_SIZE;
    const pointColor = options.darkMode ? GRID_POINT_COLOR_DARK : GRID_POINT_COLOR_LIGHT;

    // Set opacity to match grid SVG rendering
    ctx.globalAlpha = options.darkMode ? 0.85 : 0.7;
    ctx.fillStyle = pointColor;

    // Determine which hand points to show based on handPointVisibility
    const activeLocations = this.getActiveHandLocations(pictograph, options.handPointVisibility);

    // Draw hand points
    for (const [location, point] of Object.entries(GRID_POINTS.handPoints)) {
      // If handPointVisibility is "active", only draw points where props are positioned
      if (options.handPointVisibility === "active" && !activeLocations.has(location)) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(point.x * scale, point.y * scale, point.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw layer 2 / non-radial points (only if enabled)
    if (options.showNonRadialPoints) {
      for (const point of Object.values(GRID_POINTS.layer2Points)) {
        ctx.beginPath();
        ctx.arc(point.x * scale, point.y * scale, point.r * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1.0;
    return canvas;
  }

  /**
   * Get the set of hand point locations that are "active" (have props positioned there)
   */
  private getActiveHandLocations(
    pictograph: PreparedPictographData,
    handPointVisibility: "all" | "active"
  ): Set<string> {
    if (handPointVisibility === "all") {
      return new Set(["n", "e", "s", "w"]); // All locations
    }

    const activeLocations = new Set<string>();

    // Check blue motion start/end locations
    const blueMotion = pictograph.motions?.blue;
    if (blueMotion) {
      if (blueMotion.startLocation) activeLocations.add(blueMotion.startLocation.toLowerCase());
      if (blueMotion.endLocation) activeLocations.add(blueMotion.endLocation.toLowerCase());
    }

    // Check red motion start/end locations
    const redMotion = pictograph.motions?.red;
    if (redMotion) {
      if (redMotion.startLocation) activeLocations.add(redMotion.startLocation.toLowerCase());
      if (redMotion.endLocation) activeLocations.add(redMotion.endLocation.toLowerCase());
    }

    return activeLocations;
  }

  /**
   * Render reversal overlay: blue/red dots
   */
  private renderReversalOverlayInternal(beatData: BeatData, size: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Transparent background
    ctx.clearRect(0, 0, size, size);

    // Draw reversal indicators
    const indicatorSize = size * 0.04;
    const margin = size * 0.02;
    const y = size - indicatorSize - margin;

    if (beatData.blueReversal) {
      ctx.fillStyle = BLUE_COLOR;
      ctx.beginPath();
      ctx.arc(margin + indicatorSize / 2, y + indicatorSize / 2, indicatorSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (beatData.redReversal) {
      ctx.fillStyle = RED_COLOR;
      const x = beatData.blueReversal ? margin * 2 + indicatorSize : margin;
      ctx.beginPath();
      ctx.arc(x + indicatorSize / 2, y + indicatorSize / 2, indicatorSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas;
  }

  /**
   * Draw beat number (not cached, simple text)
   */
  private drawBeatNumber(
    ctx: CanvasRenderingContext2D,
    beatNumber: number,
    size: number,
    darkMode: boolean
  ): void {
    if (beatNumber === -1) return;

    const scale = size / VIEWBOX_SIZE;
    const text = beatNumber === 0 ? "Start" : String(beatNumber);
    const fontSize = (beatNumber === 0 ? BEAT_NUMBER_START_FONT_SIZE : BEAT_NUMBER_FONT_SIZE) * scale;

    ctx.font = `bold ${fontSize}px Georgia, serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = darkMode ? "#ffffff" : "#231f20";

    const x = BEAT_NUMBER_X * scale;
    const y = BEAT_NUMBER_Y * scale;
    ctx.fillText(text, x, y);
  }

  // ========== Helper methods (simplified from Canvas2DDirectRenderer) ==========

  private async drawTKAGlyph(
    ctx: CanvasRenderingContext2D,
    letter: Letter,
    size: number,
    darkMode: boolean
  ): Promise<{ width: number; height: number }> {
    // Simplified implementation - delegate to asset loader
    const { getSvgAssetLoader } = await import("./SvgAssetLoader");
    const { getLetterImagePath } = await import("../../../pictograph/tka-glyph/utils/letter-image-getter");

    const scale = size / VIEWBOX_SIZE;
    const x = TKA_GLYPH_X * scale;
    const y = TKA_GLYPH_Y * scale;

    try {
      const letterPath = getLetterImagePath(letter);
      const assetLoader = getSvgAssetLoader();
      const letterAsset = await assetLoader.getLetterAsset(letterPath);

      if (letterAsset) {
        const { image: letterImg, dimensions: letterDimensions } = letterAsset;
        const drawWidth = letterDimensions.width * scale;
        const drawHeight = letterDimensions.height * scale;

        ctx.save();
        if (darkMode) {
          ctx.filter = "invert(0.9)";
        }
        ctx.drawImage(letterImg, x, y, drawWidth, drawHeight);
        ctx.restore();

        return letterDimensions;
      }
    } catch (error) {
      console.warn("[LayerCompositor] Failed to load letter image:", error);
    }

    // Fallback to text
    const fontSize = 100 * scale;
    ctx.font = `bold ${fontSize}px Georgia, serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = darkMode ? "#ffffff" : "#000000";
    ctx.fillText(String(letter), x, y);

    return { width: 100, height: 100 };
  }

  private async drawTurnsColumn(
    ctx: CanvasRenderingContext2D,
    pictograph: PreparedPictographData,
    scale: number,
    darkMode: boolean
  ): Promise<void> {
    // Simplified - full implementation would match Canvas2DDirectRenderer
    // For now, this is a placeholder that will be filled in during integration
  }

  private drawDirectionDot(
    ctx: CanvasRenderingContext2D,
    pictograph: PreparedPictographData,
    scale: number,
    darkMode: boolean
  ): void {
    // Simplified - full implementation would match Canvas2DDirectRenderer
    // For now, this is a placeholder that will be filled in during integration
  }

  private getTurnsTuple(pictograph: PreparedPictographData): string {
    try {
      const generator = container.items.turnsTupleGenerator as ITurnsTupleGenerator;
      if (generator) {
        return generator.generateTurnsTuple(pictograph);
      }
    } catch {
      // Fallback
    }
    return "(s, 0, 0)";
  }

  private isBeatData(pictograph: PreparedPictographData): pictograph is BeatData & PreparedPictographData {
    return "blueReversal" in pictograph || "redReversal" in pictograph;
  }
}
