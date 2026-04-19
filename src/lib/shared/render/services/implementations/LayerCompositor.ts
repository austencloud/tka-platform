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
  RenderCanvas,
  RenderContext2D,
} from "../contracts/ILayerCompositor";
import type { PreparedPictographData } from "../../../pictograph/shared/domain/models/PreparedPictographData";
import type { StepData } from "../../../../features/create/shared/domain/models/StepData";
import { LayerKeyDeriver } from "./LayerKeyDeriver";
import { turnsTupleGenerator } from "../../../pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator";
import type { Letter } from "../../../foundation/domain/models/Letter";
import { GridMode } from "../../../pictograph/grid/domain/enums/grid-enums";
import { TurnColorInterpreter } from "../../../pictograph/tka-glyph/services/implementations/TurnColorInterpreter";
import {
  parseTurnsTuple,
  shouldDisplayTurn,
  getTurnNumberImagePath,
  getTurnNumberWidth,
} from "../../../pictograph/tka-glyph/utils/turn-tuple-parser";
import { calculateTurnPositions } from "../../../pictograph/tka-glyph/utils/turn-position-calculator";
import { isDashLetter } from "../../../pictograph/tka-glyph/utils/letter-image-getter";
import { calculateReversalPositions } from "../../core";
import type { DrawableImage } from "./SvgImageCache";

// Constants matching Canvas2DDirectRenderer
const VIEWBOX_SIZE = 950;
const TKA_GLYPH_X = 50;
const TKA_GLYPH_Y = 800;
const STEP_NUMBER_X = 50;
const STEP_NUMBER_Y = 50;
const BEAT_NUMBER_FONT_SIZE = 100;
const BEAT_NUMBER_START_FONT_SIZE = 80;
// Motion colors - must match CSS variables in app.css
const BLUE_COLOR_LIGHT = "#3D44B8"; // Darker blue - visible on light backgrounds
const BLUE_COLOR_DARK = "#3575E2"; // Bright blue - visible on dark backgrounds
const RED_COLOR_LIGHT = "#DC2626"; // Darker red - visible on light backgrounds
const RED_COLOR_DARK = "#ED1C24"; // Bright red - visible on dark backgrounds
const TURN_NUMBER_HEIGHT = 45;
const DOT_PADDING = 10;
const DOT_SIZE = 25;

// Dash constants (from Dash.svelte)
const DASH_WIDTH = 70;
const DASH_HEIGHT = 20;
const DASH_GAP = 10;
const DASH_RADIUS = 9.5;
const DASH_FILL_DARK = "#231f20"; // Near black - for light mode
const DASH_FILL_LIGHT = "#ffffff"; // White - for dark mode (inverted)

// Grid point positions (from diamond_grid.svg, viewBox 0 0 950 950)
// These are the TOGGLEABLE points - hand points and layer 2 points

// DIAMOND mode: hands at cardinal (N/E/S/W), layer2 at intercardinal (NE/SE/SW/NW)
const DIAMOND_GRID_POINTS = {
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

// BOX mode: hands at intercardinal (NE/SE/SW/NW), layer2 at cardinal (N/E/S/W)
const BOX_GRID_POINTS = {
  // Hand points (r=4.7) - at intercardinal positions for box mode
  handPoints: {
    ne: { x: 618.1, y: 331.9, r: 4.7 },
    se: { x: 618.1, y: 618.1, r: 4.7 },
    sw: { x: 331.9, y: 618.1, r: 4.7 },
    nw: { x: 331.9, y: 331.9, r: 4.7 },
  },
  // Layer 2 / non-radial points (r=8.8) - at cardinal positions for box mode
  layer2Points: {
    n: { x: 475, y: 331.9, r: 8.8 },
    e: { x: 618.1, y: 475, r: 8.8 },
    s: { x: 475, y: 618.1, r: 8.8 },
    w: { x: 331.9, y: 475, r: 8.8 },
  },
};

// Grid point colors - match Canvas2DDirectRenderer for consistency
const GRID_POINT_COLOR_LIGHT = "#000000"; // Black in light mode
const GRID_POINT_COLOR_DARK = "#ffffff";  // White in dark mode

// LRU cache size limits
const BASE_CACHE_LIMIT = 2000;
const GRID_POINTS_CACHE_LIMIT = 500; // Varies by handPointVisibility/showNonRadialPoints
const TKA_CACHE_LIMIT = 500; // Shared across pictographs, smaller needed
const REVERSAL_CACHE_LIMIT = 10; // Only 4 states per size

/**
 * Create a canvas that works in both main thread and Web Workers.
 * Prefers OffscreenCanvas for worker compatibility.
 */
function createCanvas(width: number, height: number): RenderCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export class LayerCompositor implements ILayerCompositor {
  private keyDeriver = new LayerKeyDeriver();
  private turnColorInterpreter = new TurnColorInterpreter();

  // Layer caches (LRU maps) - uses OffscreenCanvas for worker compatibility
  private baseCache = new Map<string, RenderCanvas>();
  private gridPointsCache = new Map<string, RenderCanvas>();
  private tkaCache = new Map<string, RenderCanvas>();
  private reversalCache = new Map<string, RenderCanvas>();

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
    stepNumber?: number
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
    const stepData = pictograph as StepData;
    if (visibility.showReversals && this.isStepData(pictograph)) {
      const reversalStart = performance.now();
      reversalResult = await this.renderReversalOverlay(stepData, options.size, options.darkMode);
      timing.reversalLayerMs = performance.now() - reversalStart;
      if (reversalResult) {
        cacheStats.reversalFromCache = reversalResult.fromCache;
      }
    }

    // 5. Composite all layers
    const compositeStart = performance.now();
    const wm = options.widthMultiplier ?? 1;
    const canvasWidth = Math.round(options.size * wm);
    const canvas = createCanvas(canvasWidth, options.size);
    const ctx = canvas.getContext("2d")!;

    // For expanded cells, center the square content and fill background on sides
    const coreOffset = Math.round((canvasWidth - options.size) / 2);
    if (wm > 1) {
      ctx.fillStyle = options.darkMode ? "#0a0a0f" : "#d8d8d2";
      ctx.fillRect(0, 0, canvasWidth, options.size);
    }

    // Draw base layer (props + arrows) — centered
    ctx.drawImage(baseResult.canvas, coreOffset, 0);

    // Draw grid points overlay — centered
    ctx.drawImage(gridPointsResult.canvas, coreOffset, 0);

    // Draw TKA overlay — positioned at left edge of expanded canvas
    if (tkaResult) {
      ctx.drawImage(tkaResult.canvas, wm > 1 ? 0 : 0, 0);
    }

    // Draw reversal overlay — centered with core content
    if (reversalResult) {
      ctx.drawImage(reversalResult.canvas, coreOffset, 0);
    }

    // 6. Draw beat number (not cached - simple text)
    // For expanded cells, draw at left edge (not centered with core)
    if (typeof stepNumber === "number" && stepNumber !== -1) {
      const beatStart = performance.now();
      this.drawStepNumber(ctx, stepNumber, options.size, options.darkMode);
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
    stepData: StepData,
    size: number,
    darkMode: boolean = false
  ): Promise<LayerRenderResult | null> {
    if (!stepData.blueReversal && !stepData.redReversal) return null;

    const startTime = performance.now();
    // Include darkMode in cache key since colors differ
    const cacheKey = `${this.keyDeriver.deriveReversalLayerKey(stepData, size)}:${darkMode ? "dark" : "light"}`;

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
    const canvas = this.renderReversalOverlayInternal(stepData, size, darkMode);

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
  ): Promise<RenderCanvas> {
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
        showBlueMotion: options.showBlueMotion,
        showRedMotion: options.showRedMotion,
        // VTG/elemental/positions are baked here (no separate overlay yet).
        // Base layer cache key includes these, so toggles correctly invalidate.
        showVTG: options.showVTG,
        showElemental: options.showElemental,
        showPositions: options.showPositions,
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
  ): Promise<RenderCanvas> {
    const canvas = createCanvas(options.size, options.size);
    const ctx = canvas.getContext("2d")!;

    // Transparent background (overlay only)
    ctx.clearRect(0, 0, options.size, options.size);

    const scale = options.size / VIEWBOX_SIZE;

    // Draw letter glyph and capture dimensions
    let letterDimensions = { width: 100, height: 100 };
    if (pictograph.letter) {
      letterDimensions = await this.drawTKAGlyph(ctx, pictograph.letter as Letter, options.size, options.darkMode);

      // Draw dash for Type 3/5 letters (e.g., "X-", "Φ-")
      if (isDashLetter(pictograph.letter)) {
        this.drawDash(ctx, letterDimensions, scale, options.darkMode);
      }
    }

    // Draw turns column (to the right of letter)
    if (pictograph.motions) {
      await this.drawTurnsColumn(ctx, pictograph, letterDimensions, scale, options.darkMode);
    }

    // Draw direction dot
    if (pictograph.letter && pictograph.motions) {
      this.drawDirectionDot(ctx, pictograph, letterDimensions, scale, options.darkMode);
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
  ): Promise<RenderCanvas> {
    const canvas = createCanvas(options.size, options.size);
    const ctx = canvas.getContext("2d")!;

    // Transparent background
    ctx.clearRect(0, 0, options.size, options.size);

    const scale = options.size / VIEWBOX_SIZE;
    const pointColor = options.darkMode ? GRID_POINT_COLOR_DARK : GRID_POINT_COLOR_LIGHT;

    // Set opacity for grid points
    // Dark mode: slightly transparent white (avoids harsh pure white)
    // Light mode: solid black for maximum clarity
    ctx.globalAlpha = options.darkMode ? 0.85 : 1.0;
    ctx.fillStyle = pointColor;

    // Select grid points based on grid mode (box vs diamond)
    const gridMode = pictograph._prepared?.gridMode ?? GridMode.DIAMOND;
    const gridPoints = gridMode === GridMode.BOX ? BOX_GRID_POINTS : DIAMOND_GRID_POINTS;

    // Determine which hand points to show based on handPointVisibility
    const activeLocations = this.getActiveHandLocations(pictograph, options.handPointVisibility, gridMode);

    // Draw hand points
    for (const [location, point] of Object.entries(gridPoints.handPoints)) {
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
      for (const point of Object.values(gridPoints.layer2Points)) {
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
    handPointVisibility: "all" | "active",
    gridMode: GridMode = GridMode.DIAMOND
  ): Set<string> {
    if (handPointVisibility === "all") {
      // Return all hand point locations for the current grid mode
      return gridMode === GridMode.BOX
        ? new Set(["ne", "se", "sw", "nw"]) // Box mode hand points
        : new Set(["n", "e", "s", "w"]);   // Diamond mode hand points
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
   *
   * Uses the shared core calculateReversalPositions for consistent positioning
   * across all renderers (Svelte, Canvas2D, LayerCompositor, MCP).
   *
   * Positioning (from unified core, matching ReversalIndicators.svelte):
   * - Single reversal: dot is centered vertically at CENTER_Y (475)
   * - Both reversals: RED on top, BLUE on bottom, spaced by DOT_SPACING
   * - All dots are at X_POSITION (71.5) on the left edge
   */
  private renderReversalOverlayInternal(stepData: StepData, size: number, darkMode: boolean): RenderCanvas {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d")!;

    // Transparent background
    ctx.clearRect(0, 0, size, size);

    // Use shared core calculation for positioning
    const { dots } = calculateReversalPositions(
      stepData.blueReversal ?? false,
      stepData.redReversal ?? false,
      darkMode
    );

    // Scale from viewbox coordinates (950x950) to canvas size
    const scale = size / VIEWBOX_SIZE;

    // Draw each dot at its calculated position
    for (const dot of dots) {
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(dot.cx * scale, dot.cy * scale, dot.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas;
  }

  /**
   * Draw beat number (not cached, simple text)
   */
  private drawStepNumber(
    ctx: RenderContext2D,
    stepNumber: number,
    size: number,
    darkMode: boolean
  ): void {
    if (stepNumber === -1) return;

    const scale = size / VIEWBOX_SIZE;
    const text = stepNumber === 0 ? "Start" : String(stepNumber);
    const fontSize = (stepNumber === 0 ? BEAT_NUMBER_START_FONT_SIZE : BEAT_NUMBER_FONT_SIZE) * scale;

    ctx.font = `bold ${fontSize}px Georgia, serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = darkMode ? "#ffffff" : "#231f20";

    const x = STEP_NUMBER_X * scale;
    const y = STEP_NUMBER_Y * scale;
    ctx.fillText(text, x, y);
  }

  // ========== Helper methods (simplified from Canvas2DDirectRenderer) ==========

  private async drawTKAGlyph(
    ctx: RenderContext2D,
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

  /**
   * Draw the dash suffix for Type 3/5 letters (e.g., "X-", "Φ-")
   * Positioned to the right of the letter, vertically centered
   */
  private drawDash(
    ctx: RenderContext2D,
    letterDimensions: { width: number; height: number },
    scale: number,
    darkMode: boolean
  ): void {
    const TKA_GLYPH_SCALE = 1.0; // Match TKAGlyph.svelte
    const baseX = TKA_GLYPH_X * scale;
    const baseY = TKA_GLYPH_Y * scale;

    // Calculate dash position (to the right of letter, vertically centered)
    const letterWidth = letterDimensions.width * TKA_GLYPH_SCALE * scale;
    const letterHeight = letterDimensions.height * TKA_GLYPH_SCALE * scale;
    const dashWidth = DASH_WIDTH * scale;
    const dashHeight = DASH_HEIGHT * scale;
    const dashGap = DASH_GAP * scale;
    const dashRadius = DASH_RADIUS * scale;

    const dashX = baseX + letterWidth + dashGap;
    const dashY = baseY + (letterHeight - dashHeight) / 2;

    // Draw rounded rectangle
    ctx.save();
    ctx.fillStyle = darkMode ? DASH_FILL_LIGHT : DASH_FILL_DARK;
    ctx.beginPath();
    ctx.roundRect(dashX, dashY, dashWidth, dashHeight, dashRadius);
    ctx.fill();
    ctx.restore();
  }

  private async drawTurnsColumn(
    ctx: RenderContext2D,
    pictograph: PreparedPictographData,
    letterDimensions: { width: number; height: number },
    scale: number,
    darkMode: boolean
  ): Promise<void> {
    // Generate turnsTuple using the same service as SVG
    const turnsTuple = this.getTurnsTuple(pictograph);

    // Parse the tuple
    const parsed = parseTurnsTuple(turnsTuple);
    const showTop = shouldDisplayTurn(parsed.top);
    const showBottom = shouldDisplayTurn(parsed.bottom);

    if (!showTop && !showBottom) return;

    // Get turn colors (based on letter type)
    const turnColors = this.turnColorInterpreter.interpretTurnColors(
      pictograph.letter,
      pictograph
    );

    // Check if letter has a dash
    const hasDash = isDashLetter(pictograph.letter);

    // Calculate positions using the same function as SVG
    const positions = calculateTurnPositions(letterDimensions, TURN_NUMBER_HEIGHT, hasDash);

    // Calculate column width (max of top and bottom)
    const columnWidth = Math.max(
      getTurnNumberWidth(parsed.top),
      getTurnNumberWidth(parsed.bottom)
    );

    // Base position (same as TKA glyph)
    const baseX = TKA_GLYPH_X * scale;
    const baseY = TKA_GLYPH_Y * scale;

    const { getSvgAssetLoader } = await import("./SvgAssetLoader");
    const assetLoader = getSvgAssetLoader();

    // Draw top turn number
    if (showTop) {
      const topPath = getTurnNumberImagePath(parsed.top);
      if (topPath) {
        try {
          const topImg = await assetLoader.getTurnNumberImage(parsed.top);
          if (topImg) {
            // Use natural width, centered within column width
            // Matches SVG's preserveAspectRatio="xMidYMin meet" behavior
            const topNaturalWidth = getTurnNumberWidth(parsed.top);
            const centerOffset = ((columnWidth - topNaturalWidth) / 2) * scale;
            const drawX = baseX + positions.top.x * scale + centerOffset;
            const drawY = baseY + positions.top.y * scale;
            const drawWidth = topNaturalWidth * scale;
            const drawHeight = TURN_NUMBER_HEIGHT * scale;

            // Draw with color tint
            this.drawColoredImage(ctx, topImg, drawX, drawY, drawWidth, drawHeight, turnColors.top);
          }
        } catch (error) {
          console.warn("[LayerCompositor] Failed to load top turn number:", error);
        }
      }
    }

    // Draw bottom turn number
    if (showBottom) {
      const bottomPath = getTurnNumberImagePath(parsed.bottom);
      if (bottomPath) {
        try {
          const bottomImg = await assetLoader.getTurnNumberImage(parsed.bottom);
          if (bottomImg) {
            // Use natural width, centered within column width
            // Matches SVG's preserveAspectRatio="xMidYMin meet" behavior
            const bottomNaturalWidth = getTurnNumberWidth(parsed.bottom);
            const centerOffset = ((columnWidth - bottomNaturalWidth) / 2) * scale;
            const drawX = baseX + positions.bottom.x * scale + centerOffset;
            const drawY = baseY + positions.bottom.y * scale;
            const drawWidth = bottomNaturalWidth * scale;
            const drawHeight = TURN_NUMBER_HEIGHT * scale;

            // Draw with color tint
            this.drawColoredImage(ctx, bottomImg, drawX, drawY, drawWidth, drawHeight, turnColors.bottom);
          }
        } catch (error) {
          console.warn("[LayerCompositor] Failed to load bottom turn number:", error);
        }
      }
    }
  }

  private drawDirectionDot(
    ctx: RenderContext2D,
    pictograph: PreparedPictographData,
    letterDimensions: { width: number; height: number },
    scale: number,
    darkMode: boolean
  ): void {
    // Generate turnsTuple to get direction
    const turnsTuple = this.getTurnsTuple(pictograph);
    const parsed = parseTurnsTuple(turnsTuple);
    const direction = parsed.direction;

    // Only draw for "s" (same) or "o" (opp)
    if (direction !== "s" && direction !== "o") return;

    // Base position (same as TKA glyph)
    const baseX = TKA_GLYPH_X * scale;
    const baseY = TKA_GLYPH_Y * scale;

    // Calculate dot position relative to letter
    // X: centered on letter
    const dotCenterX = letterDimensions.width / 2;

    let dotY: number;
    if (direction === "s") {
      // SAME: above letter
      dotY = -DOT_PADDING - DOT_SIZE;
    } else {
      // OPP: below letter
      dotY = letterDimensions.height + DOT_PADDING;
    }

    // Draw the dot
    const drawX = baseX + (dotCenterX - DOT_SIZE / 2) * scale;
    const drawY = baseY + dotY * scale;
    const radius = (DOT_SIZE / 2) * scale;

    ctx.fillStyle = darkMode ? "#ffffff" : "#231f20";
    ctx.beginPath();
    ctx.arc(drawX + radius, drawY + radius, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw an image with a color tint (for turn numbers)
   */
  private drawColoredImage(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    img: DrawableImage,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ): void {
    // Create offscreen canvas to apply color (works in both main thread and workers)
    const offscreen = new OffscreenCanvas(Math.ceil(width), Math.ceil(height));
    const offCtx = offscreen.getContext("2d");

    if (!offCtx) {
      ctx.drawImage(img, x, y, width, height);
      return;
    }

    // Draw image
    offCtx.drawImage(img, 0, 0, width, height);

    // Apply color using composite operation
    offCtx.globalCompositeOperation = "source-in";
    offCtx.fillStyle = color;
    offCtx.fillRect(0, 0, width, height);

    // Draw to main canvas
    ctx.drawImage(offscreen, x, y);
  }

  private getTurnsTuple(pictograph: PreparedPictographData): string {
    try {
      return turnsTupleGenerator.generateTurnsTuple(pictograph);
    } catch {
      // Fallback
    }
    return "(s, 0, 0)";
  }

  private isStepData(pictograph: PreparedPictographData): pictograph is StepData & PreparedPictographData {
    return "blueReversal" in pictograph || "redReversal" in pictograph;
  }
}

// DIRECT EXPORT - Use this instead of container.items.layerCompositor
// This avoids DI container rebuilds when this file changes
export const layerCompositor = new LayerCompositor();
