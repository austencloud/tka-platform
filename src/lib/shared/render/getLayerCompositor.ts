import { browser } from '$app/environment';
import type { ILayerCompositor } from './services/contracts/ILayerCompositor';
import { LayerCompositor } from './services/implementations/LayerCompositor';

let instance: ILayerCompositor | null = null;

export function getLayerCompositor(): ILayerCompositor {
	if (!browser) throw new Error('getLayerCompositor() is browser-only');
	return instance ??= new LayerCompositor();
}
