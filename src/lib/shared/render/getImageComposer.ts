import { browser } from '$app/environment';
import type { IImageComposer } from './services/contracts/IImageComposer';
import { ImageComposer } from './services/implementations/ImageComposer';
import { getLayoutCalculator } from './getLayoutCalculator';
import { getTextRenderer } from './getTextRenderer';
import { getDimensionCalculator } from './getDimensionCalculator';
import { getPictographBlobCache } from './getPictographBlobCache';
import { getPictographKeyHasher } from './getPictographKeyHasher';
import { getPictographMemoryCache } from './getPictographMemoryCache';
import { getBeatNumberRenderer } from './getBeatNumberRenderer';
import { getCanvas2DRenderer } from './getCanvas2DRenderer';
import { getLayerCompositor } from './getLayerCompositor';
import type { Canvas2DDirectRenderer } from './services/implementations/Canvas2DDirectRenderer';

let instance: IImageComposer | null = null;

export function getImageComposer(): IImageComposer {
	if (!browser) throw new Error('getImageComposer() is browser-only');
	return instance ??= new ImageComposer(
		getLayoutCalculator(),
		getTextRenderer(),
		getDimensionCalculator(),
		getPictographBlobCache(),
		getPictographKeyHasher(),
		getPictographMemoryCache(),
		getBeatNumberRenderer(),
		getCanvas2DRenderer() as Canvas2DDirectRenderer,
		getLayerCompositor()
	);
}
