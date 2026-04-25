import { browser } from '$app/environment';
import type { IPreviewAnimationController } from './services/contracts/IPreviewAnimationController';
import { PreviewAnimationController } from './services/implementations/PreviewAnimationController';

let instance: IPreviewAnimationController | null = null;

export function getPreviewAnimationController(): IPreviewAnimationController {
	if (!browser) throw new Error('getPreviewAnimationController() is browser-only');
	return instance ??= new PreviewAnimationController();
}
