import { browser } from '$app/environment';

import { PreviewAnimationController } from './services/PreviewAnimationController';

let instance: PreviewAnimationController | null = null;

export function getPreviewAnimationController(): PreviewAnimationController {
	if (!browser) throw new Error('getPreviewAnimationController() is browser-only');
	return instance ??= new PreviewAnimationController();
}
