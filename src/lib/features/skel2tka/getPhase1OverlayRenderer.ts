import { browser } from '$app/environment';
import type { IOverlayRenderer } from './services/contracts/IOverlayRenderer';
import { Phase1OverlayRenderer } from './services/implementations/Phase1OverlayRenderer';

let instance: IOverlayRenderer | null = null;

export function getPhase1OverlayRenderer(): IOverlayRenderer {
	if (!browser) throw new Error('getPhase1OverlayRenderer() is browser-only');
	return instance ??= new Phase1OverlayRenderer();
}
