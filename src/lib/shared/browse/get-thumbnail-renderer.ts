import { browser } from '$app/environment';
import { ThumbnailRenderer } from './services/thumbnail-renderer';
import { getCompositionDispatcher } from '$lib/shared/render/get-composition-dispatcher';
import { startPositionDeriver } from '$lib/shared/pictograph/shared/services/start-position-deriver';
import { getBrowseLoader } from '$lib/shared/browse/get-browse-loader';
import { loopDetector } from '$lib/shared/create/services/loop-detector';

let instance: ThumbnailRenderer | null = null;

export function getThumbnailRenderer(): ThumbnailRenderer {
	if (!browser) throw new Error('getThumbnailRenderer() is browser-only');
	return instance ??= new ThumbnailRenderer(
		getCompositionDispatcher(),
		startPositionDeriver,
		getBrowseLoader(),
		loopDetector,
	);
}
