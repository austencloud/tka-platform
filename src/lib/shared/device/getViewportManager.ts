import { viewportManager } from './services/implementations/ViewportManager.svelte';
import type { IViewportManager } from './services/contracts/IViewportManager';

/** Returns the module-level ViewportManager singleton. */
export function getViewportManager(): IViewportManager {
	return viewportManager;
}
