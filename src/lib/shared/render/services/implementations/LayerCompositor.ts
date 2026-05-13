import type { LayerType, LayerRenderOptions, LayerVisibility, LayerRenderResult, CompositionResult, LayerCacheStats, RenderCanvas, RenderContext2D } from "../contracts/types";
import type { PreparedPictographData } from "../../../pictograph/shared/domain/models/PreparedPictographData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import { deriveBaseLayerKey, deriveGridPointsLayerKey, deriveTKALayerKey, deriveReversalLayerKey } from "../layer-key-deriver";
import { turnsTupleGenerator } from "../../../pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator";
import type { Letter } from "../../../foundation/domain/models/Letter";
import { GridMode } from "../../../pictograph/grid/domain/enums/grid-enums";
import { interpretTurnColors, BLUE_HEX, RED_HEX } from "../../../pictograph/tka-glyph/services/turn-color-interpreter";
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
import type { Canvas2DDirectRenderer } from './Canvas2DDirectRenderer';

const VIEWBOX_SIZE = 950;
const TKA_GLYPH_X = 50;
const TKA_GLYPH_Y = 800;
const STEP_NUMBER_X = 50;
const STEP_NUMBER_Y = 50;
const BEAT_NUMBER_FONT_SIZE = 100;
const BEAT_NUMBER_START_FONT_SIZE = 80;
const TURN_NUMBER_HEIGHT = 45;
const DOT_PADDING = 10;
const DOT_SIZE = 25;

const DASH_WIDTH = 70;
const DASH_HEIGHT = 20;
const DASH_GAP = 10;
const DASH_RADIUS = 9.5;
const DASH_FILL_DARK = "#231f20"; 
const DASH_FILL_LIGHT = "#ffffff"; 

const DIAMOND_GRID_POINTS = {
  handPoints: {
    n: { x: 475, y: 331.9, r: 4.7 },
    e: { x: 618.1, y: 475, r: 4.7 },
    s: { x: 475, y: 618.1, r: 4.7 },
    w: { x: 331.9, y: 475, r: 4.7 },
  },
  layer2Points: {
    ne: { x: 618.1, y: 331.9, r: 8.8 },
    se: { x: 618.1, y: 618.1, r: 8.8 },
    sw: { x: 331.9, y: 618.1, r: 8.8 },
    nw: { x: 331.9, y: 331.9, r: 8.8 },
  },
};

const BOX_GRID_POINTS = {
  handPoints: {
    ne: { x: 618.1, y: 331.9, r: 4.7 },
    se: { x: 618.1, y: 618.1, r: 4.7 },
    sw: { x: 331.9, y: 618.1, r: 4.7 },
    nw: { x: 331.9, y: 331.9, r: 4.7 },
  },
  layer2Points: {
    n: { x: 475, y: 331.9, r: 8.8 },
    e: { x: 618.1, y: 475, r: 8.8 },
    s: { x: 475, y: 618.1, r: 8.8 },
    w: { x: 331.9, y: 475, r: 8.8 },
  },
};

const GRID_POINT_COLOR_LIGHT = "#000000";
const GRID_POINT_COLOR_DARK = "#ffffff";

const BASE_CACHE_LIMIT = 2000;
const GRID_POINTS_CACHE_LIMIT = 500;
const TKA_CACHE_LIMIT = 500;
const REVERSAL_CACHE_LIMIT = 10;

function createCanvas(width: number, height: number): RenderCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export class LayerCompositor {

  private baseCache = new Map<string, RenderCanvas>();
  private gridPointsCache = new Map<string, RenderCanvas>();
  private tkaCache = new Map<string, RenderCanvas>();
  private reversalCache = new Map<string, RenderCanvas>();

  private canvas2DRenderer: InstanceType<typeof Canvas2DDirectRenderer> | null = null;
  private canvas2DInitPromise: Promise<void> | null = null;

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

    const baseStart = performance.now();
    const baseResult = await this.renderBaseLayer(pictograph, options);
    timing.baseLayerMs = performance.now() - baseStart;
    cacheStats.baseFromCache = baseResult.fromCache;

    const gridPointsStart = performance.now();
    const gridPointsResult = await this.renderGridPointsOverlay(pictograph, options);
    timing.gridPointsLayerMs = performance.now() - gridPointsStart;
    cacheStats.gridPointsFromCache = gridPointsResult.fromCache;

    const motionVisibility = {
      showBlueMotion: options.showBlueMotion,
      showRedMotion: options.showRedMotion,
    };

    let tkaResult: LayerRenderResult | null = null;
    if (visibility.showTKA && pictograph.letter) {
      const tkaStart = performance.now();
      tkaResult = await this.renderTKAOverlay(pictograph, {
        size: options.size,
        darkMode: options.darkMode,
      }, motionVisibility);
      timing.tkaLayerMs = performance.now() - tkaStart;
      if (tkaResult) {
        cacheStats.tkaFromCache = tkaResult.fromCache;
      }
    }

    let reversalResult: LayerRenderResult | null = null;
    const stepData = pictograph as StepData;
    if (visibility.showReversals && this.isStepData(pictograph)) {
      const reversalStart = performance.now();
      reversalResult = await this.renderReversalOverlay(stepData, options.size, options.darkMode, motionVisibility);
      timing.reversalLayerMs = performance.now() - reversalStart;
      if (reversalResult) {
        cacheStats.reversalFromCache = reversalResult.fromCache;
      }
    }

    const compositeStart = performance.now();
    const wm = options.widthMultiplier ?? 1;
    const canvasWidth = Math.round(options.size * wm);
    const canvas = createCanvas(canvasWidth, options.size);
    const ctx = canvas.getContext("2d")! as RenderContext2D as RenderContext2D;

    const coreOffset = Math.round((canvasWidth - options.size) / 2);
    if (wm > 1) {
      ctx.fillStyle = options.darkMode ? "#0a0a0f" : "#d8d8d2";
      ctx.fillRect(0, 0, canvasWidth, options.size);
    }

    ctx.drawImage(baseResult.canvas, coreOffset, 0);
    ctx.drawImage(gridPointsResult.canvas, coreOffset, 0);
    if (tkaResult) {
      ctx.drawImage(tkaResult.canvas, 0, 0);
    }
    if (reversalResult) {
      ctx.drawImage(reversalResult.canvas, coreOffset, 0);
    }

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
    const cacheKey = deriveBaseLayerKey(pictograph, options);

    const cached = this.baseCache.get(cacheKey);
    if (cached) {
      this.stats.baseCacheHits++;
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

    const canvas = await this.renderBaseLayerInternal(pictograph, options);

    if (this.baseCache.size >= BASE_CACHE_LIMIT) {
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
    const cacheKey = deriveGridPointsLayerKey(pictograph, options);

    const cached = this.gridPointsCache.get(cacheKey);
    if (cached) {
      this.stats.gridPointsCacheHits++;
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

    const canvas = await this.renderGridPointsOverlayInternal(pictograph, options);

    if (this.gridPointsCache.size >= GRID_POINTS_CACHE_LIMIT) {
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
    options: Pick<LayerRenderOptions, "size" | "darkMode">,
    motionVisibility?: { showBlueMotion?: boolean; showRedMotion?: boolean }
  ): Promise<LayerRenderResult | null> {
    if (!pictograph.letter) return null;

    const startTime = performance.now();

    const turnsTuple = this.getTurnsTuple(pictograph);
    const visKeySuffix = motionVisibility
      ? `:b${motionVisibility.showBlueMotion ?? true}:r${motionVisibility.showRedMotion ?? true}`
      : "";
    const cacheKey = deriveTKALayerKey(pictograph, turnsTuple, options) + visKeySuffix;

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

    const canvas = await this.renderTKAOverlayInternal(pictograph, options, motionVisibility);

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
    darkMode: boolean = false,
    motionVisibility?: { showBlueMotion?: boolean; showRedMotion?: boolean }
  ): Promise<LayerRenderResult | null> {
    if (!stepData.blueReversal && !stepData.redReversal) return null;

    const startTime = performance.now();
    const visKey = motionVisibility
      ? `:b${motionVisibility.showBlueMotion ?? true}:r${motionVisibility.showRedMotion ?? true}`
      : "";
    const cacheKey = `${deriveReversalLayerKey(stepData, size)}:${darkMode ? "dark" : "light"}${visKey}`;

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

    const canvas = this.renderReversalOverlayInternal(stepData, size, darkMode, motionVisibility);

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
        break;
    }
  }

  private async ensureCanvas2DRenderer(): Promise<InstanceType<typeof Canvas2DDirectRenderer>> {
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

  private async renderBaseLayerInternal(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions
  ): Promise<RenderCanvas> {
    const renderer = await this.ensureCanvas2DRenderer();

    const canvas = await renderer.renderPictograph(pictograph, {
      size: options.size,
      visibility: {
        darkMode: options.darkMode,
        showTKA: false, 
        showReversals: false, 
        baseGridOnly: true,
        bluePropType: options.bluePropType,
        redPropType: options.redPropType,
        showBlueMotion: options.showBlueMotion,
        showRedMotion: options.showRedMotion,
        showVTG: options.showVTG,
        showElemental: options.showElemental,
        showPositions: options.showPositions,
        handPathMode: options.handPathMode,
      },
    });

    return canvas;
  }

  private async renderTKAOverlayInternal(
    pictograph: PreparedPictographData,
    options: Pick<LayerRenderOptions, "size" | "darkMode">,
    motionVisibility?: { showBlueMotion?: boolean; showRedMotion?: boolean }
  ): Promise<RenderCanvas> {
    const canvas = createCanvas(options.size, options.size);
    const ctx = canvas.getContext("2d")! as RenderContext2D;

    ctx.clearRect(0, 0, options.size, options.size);

    const scale = options.size / VIEWBOX_SIZE;

    let letterDimensions = { width: 100, height: 100 };
    if (pictograph.letter) {
      letterDimensions = await this.drawTKAGlyph(ctx, pictograph.letter as Letter, options.size, options.darkMode);

      if (isDashLetter(pictograph.letter)) {
        this.drawDash(ctx, letterDimensions, scale, options.darkMode);
      }
    }

    if (pictograph.motions) {
      await this.drawTurnsColumn(ctx, pictograph, letterDimensions, scale, options.darkMode, motionVisibility);
    }

    if (pictograph.letter && pictograph.motions) {
      this.drawDirectionDot(ctx, pictograph, letterDimensions, scale, options.darkMode);
    }

    return canvas;
  }

  private async renderGridPointsOverlayInternal(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions
  ): Promise<RenderCanvas> {
    const canvas = createCanvas(options.size, options.size);
    const ctx = canvas.getContext("2d")! as RenderContext2D;

    ctx.clearRect(0, 0, options.size, options.size);

    const scale = options.size / VIEWBOX_SIZE;
    const pointColor = options.darkMode ? GRID_POINT_COLOR_DARK : GRID_POINT_COLOR_LIGHT;

    ctx.globalAlpha = options.darkMode ? 0.85 : 1.0;
    ctx.fillStyle = pointColor;

    const gridMode = pictograph._prepared?.gridMode ?? GridMode.DIAMOND;
    const gridPoints = gridMode === GridMode.BOX ? BOX_GRID_POINTS : DIAMOND_GRID_POINTS;

    const activeLocations = this.getActiveHandLocations(pictograph, options.handPointVisibility, gridMode);

    for (const [location, point] of Object.entries(gridPoints.handPoints)) {
      if (options.handPointVisibility === "active" && !activeLocations.has(location)) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(point.x * scale, point.y * scale, point.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }

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

  private getActiveHandLocations(
    pictograph: PreparedPictographData,
    handPointVisibility: "all" | "active",
    gridMode: GridMode = GridMode.DIAMOND
  ): Set<string> {
    if (handPointVisibility === "all") {
      return gridMode === GridMode.BOX
        ? new Set(["ne", "se", "sw", "nw"]) 
        : new Set(["n", "e", "s", "w"]);   
    }

    const activeLocations = new Set<string>();

    const blueMotion = pictograph.motions?.blue;
    if (blueMotion) {
      if (blueMotion.startLocation) activeLocations.add(blueMotion.startLocation.toLowerCase());
      if (blueMotion.endLocation) activeLocations.add(blueMotion.endLocation.toLowerCase());
    }

    const redMotion = pictograph.motions?.red;
    if (redMotion) {
      if (redMotion.startLocation) activeLocations.add(redMotion.startLocation.toLowerCase());
      if (redMotion.endLocation) activeLocations.add(redMotion.endLocation.toLowerCase());
    }

    return activeLocations;
  }

  private renderReversalOverlayInternal(
    stepData: StepData,
    size: number,
    darkMode: boolean,
    motionVisibility?: { showBlueMotion?: boolean; showRedMotion?: boolean }
  ): RenderCanvas {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d")! as RenderContext2D;

    ctx.clearRect(0, 0, size, size);

    const blueReversal = (stepData.blueReversal ?? false) && (motionVisibility?.showBlueMotion ?? true);
    const redReversal = (stepData.redReversal ?? false) && (motionVisibility?.showRedMotion ?? true);

    const { dots } = calculateReversalPositions(
      blueReversal,
      redReversal,
      darkMode
    );

    const scale = size / VIEWBOX_SIZE;

    for (const dot of dots) {
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(dot.cx * scale, dot.cy * scale, dot.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas;
  }

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

  private async drawTKAGlyph(
    ctx: RenderContext2D,
    letter: Letter,
    size: number,
    darkMode: boolean
  ): Promise<{ width: number; height: number }> {
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

    const fontSize = 100 * scale;
    ctx.font = `bold ${fontSize}px Georgia, serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = darkMode ? "#ffffff" : "#000000";
    ctx.fillText(String(letter), x, y);

    return { width: 100, height: 100 };
  }

  private drawDash(
    ctx: RenderContext2D,
    letterDimensions: { width: number; height: number },
    scale: number,
    darkMode: boolean
  ): void {
    const TKA_GLYPH_SCALE = 1.0; 
    const baseX = TKA_GLYPH_X * scale;
    const baseY = TKA_GLYPH_Y * scale;

    const letterWidth = letterDimensions.width * TKA_GLYPH_SCALE * scale;
    const letterHeight = letterDimensions.height * TKA_GLYPH_SCALE * scale;
    const dashWidth = DASH_WIDTH * scale;
    const dashHeight = DASH_HEIGHT * scale;
    const dashGap = DASH_GAP * scale;
    const dashRadius = DASH_RADIUS * scale;

    const dashX = baseX + letterWidth + dashGap;
    const dashY = baseY + (letterHeight - dashHeight) / 2;

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
    _darkMode: boolean,
    motionVisibility?: { showBlueMotion?: boolean; showRedMotion?: boolean }
  ): Promise<void> {
    const turnsTuple = this.getTurnsTuple(pictograph);

    const parsed = parseTurnsTuple(turnsTuple);
    const showTop = shouldDisplayTurn(parsed.top);
    const showBottom = shouldDisplayTurn(parsed.bottom);

    if (!showTop && !showBottom) return;

    const turnColors = interpretTurnColors(
      pictograph.letter,
      pictograph
    );

    const isColorHidden = (color: string) => {
      if (color === BLUE_HEX && motionVisibility?.showBlueMotion === false) return true;
      if (color === RED_HEX && motionVisibility?.showRedMotion === false) return true;
      return false;
    };

    const hasDash = isDashLetter(pictograph.letter);

    const positions = calculateTurnPositions(letterDimensions, TURN_NUMBER_HEIGHT, hasDash);

    const columnWidth = Math.max(
      getTurnNumberWidth(parsed.top),
      getTurnNumberWidth(parsed.bottom)
    );

    const baseX = TKA_GLYPH_X * scale;
    const baseY = TKA_GLYPH_Y * scale;

    const { getSvgAssetLoader } = await import("./SvgAssetLoader");
    const assetLoader = getSvgAssetLoader();

    if (showTop && !isColorHidden(turnColors.top)) {
      const topPath = getTurnNumberImagePath(parsed.top);
      if (topPath) {
        try {
          const topImg = await assetLoader.getTurnNumberImage(parsed.top);
          if (topImg) {
            const topNaturalWidth = getTurnNumberWidth(parsed.top);
            const centerOffset = ((columnWidth - topNaturalWidth) / 2) * scale;
            const drawX = baseX + positions.top.x * scale + centerOffset;
            const drawY = baseY + positions.top.y * scale;
            const drawWidth = topNaturalWidth * scale;
            const drawHeight = TURN_NUMBER_HEIGHT * scale;

            this.drawColoredImage(ctx, topImg, drawX, drawY, drawWidth, drawHeight, turnColors.top);
          }
        } catch (error) {
          console.warn("[LayerCompositor] Failed to load top turn number:", error);
        }
      }
    }

    if (showBottom && !isColorHidden(turnColors.bottom)) {
      const bottomPath = getTurnNumberImagePath(parsed.bottom);
      if (bottomPath) {
        try {
          const bottomImg = await assetLoader.getTurnNumberImage(parsed.bottom);
          if (bottomImg) {
            const bottomNaturalWidth = getTurnNumberWidth(parsed.bottom);
            const centerOffset = ((columnWidth - bottomNaturalWidth) / 2) * scale;
            const drawX = baseX + positions.bottom.x * scale + centerOffset;
            const drawY = baseY + positions.bottom.y * scale;
            const drawWidth = bottomNaturalWidth * scale;
            const drawHeight = TURN_NUMBER_HEIGHT * scale;

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
    const turnsTuple = this.getTurnsTuple(pictograph);
    const parsed = parseTurnsTuple(turnsTuple);
    const direction = parsed.direction;

    if (direction !== "s" && direction !== "o") return;

    const baseX = TKA_GLYPH_X * scale;
    const baseY = TKA_GLYPH_Y * scale;

    const dotCenterX = letterDimensions.width / 2;

    let dotY: number;
    if (direction === "s") {
      dotY = -DOT_PADDING - DOT_SIZE;
    } else {
      dotY = letterDimensions.height + DOT_PADDING;
    }

    const drawX = baseX + (dotCenterX - DOT_SIZE / 2) * scale;
    const drawY = baseY + dotY * scale;
    const radius = (DOT_SIZE / 2) * scale;

    ctx.fillStyle = darkMode ? "#ffffff" : "#231f20";
    ctx.beginPath();
    ctx.arc(drawX + radius, drawY + radius, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawColoredImage(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    img: DrawableImage,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ): void {
    const offscreen = new OffscreenCanvas(Math.ceil(width), Math.ceil(height));
    const offCtx = offscreen.getContext("2d");

    if (!offCtx) {
      ctx.drawImage(img, x, y, width, height);
      return;
    }

    offCtx.drawImage(img, 0, 0, width, height);

    offCtx.globalCompositeOperation = "source-in";
    offCtx.fillStyle = color;
    offCtx.fillRect(0, 0, width, height);

    ctx.drawImage(offscreen, x, y);
  }

  private getTurnsTuple(pictograph: PreparedPictographData): string {
    try {
      return turnsTupleGenerator.generateTurnsTuple(pictograph);
    } catch {
      // ignore
    }
    return "(s, 0, 0)";
  }

  private isStepData(pictograph: PreparedPictographData): pictograph is StepData & PreparedPictographData {
    return "blueReversal" in pictograph || "redReversal" in pictograph;
  }
}

export const layerCompositor = new LayerCompositor();
