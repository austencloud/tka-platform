import { browser } from '$app/environment';

import { LayerCompositor } from './services/implementations/LayerCompositor';

let instance: LayerCompositor | null = null;

export function getLayerCompositor(): LayerCompositor {
	if (!browser) throw new Error('getLayerCompositor() is browser-only');
	return instance ??= new LayerCompositor();
}
