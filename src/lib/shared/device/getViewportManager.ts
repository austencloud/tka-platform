import { viewportManager } from './services/implementations/ViewportManager.svelte';
import type { ViewportManager } from '$lib/shared/device/services/implementations/ViewportManager.svelte'

/** Returns the module-level ViewportManager singleton. */
export function getViewportManager(): ViewportManager {
	return viewportManager;
}
