import { browser } from '$app/environment';
import { Phase1OverlayRenderer } from './services/implementations/Phase1OverlayRenderer';

let instance: Phase1OverlayRenderer | null = null;

export function getPhase1OverlayRenderer(): Phase1OverlayRenderer {
	if (!browser) throw new Error('getPhase1OverlayRenderer() is browser-only');
	return instance ??= new Phase1OverlayRenderer();
}
