import { browser } from '$app/environment';
import { PromoOrchestrator } from './services/implementations/PromoOrchestrator';
import { getPromoSceneManager } from './getPromoSceneManager';
import { getScreenshotInjector } from './getScreenshotInjector';
import { getPromoAnimationController } from './getPromoAnimationController';
import { getPromoVideoExporter } from './getPromoVideoExporter';

let instance: PromoOrchestrator | null = null;

export function getPromoOrchestrator(): PromoOrchestrator {
	if (!browser) throw new Error('getPromoOrchestrator() is browser-only');
	return instance ??= new PromoOrchestrator(
		getPromoSceneManager(),
		getScreenshotInjector(),
		getPromoAnimationController(),
		getPromoVideoExporter(),
	);
}
