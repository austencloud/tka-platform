import { browser } from '$app/environment';
import type { IPromoOrchestrator } from './services/contracts/IPromoOrchestrator';
import { PromoOrchestrator } from './services/implementations/PromoOrchestrator';
import { getPromoSceneManager } from './getPromoSceneManager';
import { getScreenshotInjector } from './getScreenshotInjector';
import { getPromoAnimationController } from './getPromoAnimationController';
import { getPromoVideoExporter } from './getPromoVideoExporter';

let instance: IPromoOrchestrator | null = null;

export function getPromoOrchestrator(): IPromoOrchestrator {
	if (!browser) throw new Error('getPromoOrchestrator() is browser-only');
	return instance ??= new PromoOrchestrator(
		getPromoSceneManager(),
		getScreenshotInjector(),
		getPromoAnimationController(),
		getPromoVideoExporter(),
	);
}
