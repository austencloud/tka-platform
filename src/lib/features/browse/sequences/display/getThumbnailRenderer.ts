import { browser } from '$app/environment';
import { ThumbnailRenderer } from './services/implementations/ThumbnailRenderer';
import { getSequenceRenderer } from '$lib/shared/render/getSequenceRenderer';
import { startPositionDeriver } from '$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver';
import { getBrowseLoader } from '$lib/shared/browse/getBrowseLoader';
import { loopDetector } from '$lib/features/create/generate/circular/services/implementations/LOOPDetector';

let instance: ThumbnailRenderer | null = null;

export function getThumbnailRenderer(): ThumbnailRenderer {
	if (!browser) throw new Error('getThumbnailRenderer() is browser-only');
	return instance ??= new ThumbnailRenderer(
		getSequenceRenderer(),
		startPositionDeriver,
		getBrowseLoader(),
		loopDetector,
	);
}
