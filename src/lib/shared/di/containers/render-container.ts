/**
 * Render Container - ITI Dependency Injection
 *
 * Contains all rendering-related services:
 * - SequenceRenderer (main render service)
 * - CanvasManager, ImageComposer, LayoutCalculator
 * - DimensionCalculator, ImageFormatConverter
 * - SVGToCanvasConverter, TextRenderer
 * - GlyphCache, FilenameGenerator
 * - PictographBlobCache, PictographKeyHasher, PictographMemoryCache, StepNumberRenderer
 */

import { createContainer } from "iti";
import type { IFileDownloader } from "$lib/shared/foundation/services/contracts/IFileDownloader";
import { CanvasManager } from "$lib/shared/render/services/implementations/CanvasManager";
import { DimensionCalculator } from "$lib/shared/render/services/implementations/DimensionCalculator";
import { FilenameGenerator } from "$lib/shared/render/services/implementations/FilenameGenerator";
import { GlyphCache } from "$lib/shared/render/services/implementations/GlyphCache";
import { ImageComposer } from "$lib/shared/render/services/implementations/ImageComposer";
import { ImageFormatConverter } from "$lib/shared/render/services/implementations/ImageFormatConverter";
import { LayoutCalculator } from "$lib/shared/render/services/implementations/LayoutCalculator";
import { LOOPIconStripRenderer } from "$lib/shared/render/services/implementations/LOOPIconStripRenderer";
import { SequenceRenderer } from "$lib/shared/render/services/implementations/SequenceRenderer";
import { SVGToCanvasConverter } from "$lib/shared/render/services/implementations/SVGToCanvasConverter";
import { TextRenderer } from "$lib/shared/render/services/implementations/TextRenderer";
import { PictographBlobCache } from "$lib/shared/render/services/implementations/PictographBlobCache";
import { PictographKeyHasher } from "$lib/shared/render/services/implementations/PictographKeyHasher";
import { PictographMemoryCache } from "$lib/shared/render/services/implementations/PictographMemoryCache";
import { StepNumberRenderer } from "$lib/shared/render/services/implementations/StepNumberRenderer";
import { Canvas2DDirectRenderer } from "$lib/shared/render/services/implementations/Canvas2DDirectRenderer";
import { LayerCompositor } from "$lib/shared/render/services/implementations/LayerCompositor";

/**
 * Create the render container with external dependencies
 *
 * @param fileDownloader - Required dependency from UI/foundation module
 */
export function createRenderContainer(fileDownloader: IFileDownloader) {
  // Layer 1: Leaf services with no internal dependencies
  const baseContainer = createContainer().add({
    canvasManager: () => new CanvasManager(),
    layoutCalculator: () => new LayoutCalculator(),
    dimensionCalculator: () => new DimensionCalculator(),
    svgToCanvasConverter: () => new SVGToCanvasConverter(),
    glyphCache: () => new GlyphCache(),
    filenameGenerator: () => new FilenameGenerator(),
    // Two-layer pictograph caching system
    // L1: Blob cache (IndexedDB) - stores rasterized PNG blobs for instant image creation
    // L2: Memory cache - stores HTMLImageElements for direct canvas drawing
    pictographBlobCache: () => new PictographBlobCache(),
    pictographKeyHasher: () => new PictographKeyHasher(),
    pictographMemoryCache: () => new PictographMemoryCache(),
    beatNumberRenderer: () => new StepNumberRenderer(),
    // Canvas 2D direct renderer - bypasses SVG for 1000x faster fresh renders
    canvas2DRenderer: () => new Canvas2DDirectRenderer(),
    // Layer compositor - composes cached layers for fast visibility toggles
    layerCompositor: () => new LayerCompositor(),
    // LOOP icon strip renderer - renders horizontal icon strip via SVG paths
    loopIconStripRenderer: () => new LOOPIconStripRenderer(),
  });

  // Layer 2: Services that depend on Layer 1
  const layer2Container = baseContainer.add((ctx) => ({
    textRenderer: () =>
      new TextRenderer(
        ctx.dimensionCalculator,
        ctx.loopIconStripRenderer
      ),
    imageFormatConverter: () => new ImageFormatConverter(fileDownloader),
  }));

  // Layer 3: ImageComposer depends on layoutCalculator, textRenderer, dimensionCalculator,
  // plus two-layer caching services, Canvas 2D renderer, and LayerCompositor for fast visibility toggles
  const layer3Container = layer2Container.add((ctx) => ({
    imageComposer: () =>
      new ImageComposer(
        ctx.layoutCalculator,
        ctx.textRenderer,
        ctx.dimensionCalculator,
        ctx.pictographBlobCache,
        ctx.pictographKeyHasher,
        ctx.pictographMemoryCache,
        ctx.beatNumberRenderer,
        ctx.canvas2DRenderer,
        ctx.layerCompositor
      ),
  }));

  // Layer 4: SequenceRenderer depends on imageComposer and imageFormatConverter
  const fullContainer = layer3Container.add((ctx) => ({
    sequenceRenderer: () =>
      new SequenceRenderer(ctx.imageComposer, ctx.imageFormatConverter),
  }));

  return fullContainer;
}

// Type for the render container
export type RenderContainer = ReturnType<typeof createRenderContainer>;
