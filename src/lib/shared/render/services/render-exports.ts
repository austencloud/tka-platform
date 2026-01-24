/**
 * Centralized Render Service Exports
 *
 * All render service singleton exports in one file to avoid circular dependencies.
 * Uses lazy initialization to prevent temporal dead zone issues.
 */

// ============================================================================
// Layer 1: Leaf services (no dependencies on other render services)
// ============================================================================
import { LayoutCalculator } from "./implementations/LayoutCalculator";
import { DimensionCalculator } from "./implementations/DimensionCalculator";
import { FilenameGenerator } from "./implementations/FilenameGenerator";
import { Canvas2DDirectRenderer } from "./implementations/Canvas2DDirectRenderer";
import { LayerCompositor } from "./implementations/LayerCompositor";
import { LOOPGlyphRenderer } from "./implementations/LOOPGlyphRenderer";
import { LOOPIconStripRenderer } from "./implementations/LOOPIconStripRenderer";
import { PictographKeyHasher } from "./implementations/PictographKeyHasher";
import { StepNumberRenderer } from "./implementations/StepNumberRenderer";
import { getPictographMemoryCache } from "./implementations/PictographMemoryCache";
import { getPictographBlobCache } from "./implementations/PictographBlobCache";

let _layoutCalculator: LayoutCalculator | null = null;
let _dimensionCalculator: DimensionCalculator | null = null;
let _filenameGenerator: FilenameGenerator | null = null;
let _canvas2DDirectRenderer: Canvas2DDirectRenderer | null = null;
let _layerCompositor: LayerCompositor | null = null;
let _loopGlyphRenderer: LOOPGlyphRenderer | null = null;
let _loopIconStripRenderer: LOOPIconStripRenderer | null = null;
let _pictographKeyHasher: PictographKeyHasher | null = null;
let _stepNumberRenderer: StepNumberRenderer | null = null;
let _pictographMemoryCache: ReturnType<typeof getPictographMemoryCache> | null = null;
let _pictographBlobCache: ReturnType<typeof getPictographBlobCache> | null = null;

export const layoutCalculator: LayoutCalculator = new Proxy({} as LayoutCalculator, {
  get(_, prop) {
    if (!_layoutCalculator) _layoutCalculator = new LayoutCalculator();
    return (_layoutCalculator as any)[prop];
  }
});

export const dimensionCalculator: DimensionCalculator = new Proxy({} as DimensionCalculator, {
  get(_, prop) {
    if (!_dimensionCalculator) _dimensionCalculator = new DimensionCalculator();
    return (_dimensionCalculator as any)[prop];
  }
});

export const filenameGenerator: FilenameGenerator = new Proxy({} as FilenameGenerator, {
  get(_, prop) {
    if (!_filenameGenerator) _filenameGenerator = new FilenameGenerator();
    return (_filenameGenerator as any)[prop];
  }
});

export const canvas2DDirectRenderer: Canvas2DDirectRenderer = new Proxy({} as Canvas2DDirectRenderer, {
  get(_, prop) {
    if (!_canvas2DDirectRenderer) _canvas2DDirectRenderer = new Canvas2DDirectRenderer();
    return (_canvas2DDirectRenderer as any)[prop];
  }
});

export const layerCompositor: LayerCompositor = new Proxy({} as LayerCompositor, {
  get(_, prop) {
    if (!_layerCompositor) _layerCompositor = new LayerCompositor();
    return (_layerCompositor as any)[prop];
  }
});

export const loopGlyphRenderer: LOOPGlyphRenderer = new Proxy({} as LOOPGlyphRenderer, {
  get(_, prop) {
    if (!_loopGlyphRenderer) _loopGlyphRenderer = new LOOPGlyphRenderer();
    return (_loopGlyphRenderer as any)[prop];
  }
});

export const loopIconStripRenderer: LOOPIconStripRenderer = new Proxy({} as LOOPIconStripRenderer, {
  get(_, prop) {
    if (!_loopIconStripRenderer) _loopIconStripRenderer = new LOOPIconStripRenderer();
    return (_loopIconStripRenderer as any)[prop];
  }
});

export const pictographKeyHasher: PictographKeyHasher = new Proxy({} as PictographKeyHasher, {
  get(_, prop) {
    if (!_pictographKeyHasher) _pictographKeyHasher = new PictographKeyHasher();
    return (_pictographKeyHasher as any)[prop];
  }
});

export const stepNumberRenderer: StepNumberRenderer = new Proxy({} as StepNumberRenderer, {
  get(_, prop) {
    if (!_stepNumberRenderer) _stepNumberRenderer = new StepNumberRenderer();
    return (_stepNumberRenderer as any)[prop];
  }
});

export const pictographMemoryCache = new Proxy({} as ReturnType<typeof getPictographMemoryCache>, {
  get(_, prop) {
    if (!_pictographMemoryCache) _pictographMemoryCache = getPictographMemoryCache();
    return (_pictographMemoryCache as any)[prop];
  }
});

export const pictographBlobCache = new Proxy({} as ReturnType<typeof getPictographBlobCache>, {
  get(_, prop) {
    if (!_pictographBlobCache) _pictographBlobCache = getPictographBlobCache();
    return (_pictographBlobCache as any)[prop];
  }
});

// ============================================================================
// Layer 2: Services that depend on Layer 1
// ============================================================================
import { TextRenderer } from "./implementations/TextRenderer";
import { ImageFormatConverter } from "./implementations/ImageFormatConverter";
import { fileDownloader } from "$lib/shared/foundation/services/implementations/FileDownloader";

let _textRenderer: TextRenderer | null = null;
let _imageFormatConverter: ImageFormatConverter | null = null;

export const textRenderer: TextRenderer = new Proxy({} as TextRenderer, {
  get(_, prop) {
    if (!_textRenderer) {
      _textRenderer = new TextRenderer(
        dimensionCalculator,
        loopGlyphRenderer,
        loopIconStripRenderer
      );
    }
    return (_textRenderer as any)[prop];
  }
});

export const imageFormatConverter: ImageFormatConverter = new Proxy({} as ImageFormatConverter, {
  get(_, prop) {
    if (!_imageFormatConverter) _imageFormatConverter = new ImageFormatConverter(fileDownloader);
    return (_imageFormatConverter as any)[prop];
  }
});

// ============================================================================
// Layer 3: ImageComposer depends on Layer 1 & 2
// ============================================================================
import { ImageComposer } from "./implementations/ImageComposer";

let _imageComposer: ImageComposer | null = null;

export const imageComposer: ImageComposer = new Proxy({} as ImageComposer, {
  get(_, prop) {
    if (!_imageComposer) {
      _imageComposer = new ImageComposer(
        layoutCalculator,
        textRenderer,
        dimensionCalculator,
        pictographBlobCache,
        pictographKeyHasher,
        pictographMemoryCache,
        stepNumberRenderer,
        canvas2DDirectRenderer,
        layerCompositor
      );
    }
    return (_imageComposer as any)[prop];
  }
});

// ============================================================================
// Layer 4: SequenceRenderer depends on Layer 3
// ============================================================================
import { SequenceRenderer } from "./implementations/SequenceRenderer";

let _sequenceRenderer: SequenceRenderer | null = null;

export const sequenceRenderer: SequenceRenderer = new Proxy({} as SequenceRenderer, {
  get(_, prop) {
    if (!_sequenceRenderer) {
      _sequenceRenderer = new SequenceRenderer(
        imageComposer,
        imageFormatConverter
      );
    }
    return (_sequenceRenderer as any)[prop];
  }
});
