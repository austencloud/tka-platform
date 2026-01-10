/**
 * Render Container - ITI Dependency Injection
 *
 * Contains all rendering-related services:
 * - SequenceRenderer (main render service)
 * - CanvasManager, ImageComposer, LayoutCalculator
 * - DimensionCalculator, ImageFormatConverter
 * - SVGToCanvasConverter, TextRenderer
 * - GlyphCache, FilenameGenerator
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
import { SequenceRenderer } from "$lib/shared/render/services/implementations/SequenceRenderer";
import { SVGToCanvasConverter } from "$lib/shared/render/services/implementations/SVGToCanvasConverter";
import { TextRenderer } from "$lib/shared/render/services/implementations/TextRenderer";

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
  });

  // Layer 2: Services that depend on Layer 1
  const layer2Container = baseContainer.add((ctx) => ({
    textRenderer: () => new TextRenderer(ctx.dimensionCalculator),
    imageFormatConverter: () => new ImageFormatConverter(fileDownloader),
  }));

  // Layer 3: ImageComposer depends on layoutCalculator, textRenderer, dimensionCalculator
  const layer3Container = layer2Container.add((ctx) => ({
    imageComposer: () =>
      new ImageComposer(
        ctx.layoutCalculator,
        ctx.textRenderer,
        ctx.dimensionCalculator
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
