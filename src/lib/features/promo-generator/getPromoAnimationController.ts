import { browser } from '$app/environment';
import { PromoAnimationController } from './services/implementations/PromoAnimationController';

let instance: PromoAnimationController | null = null;

export function getPromoAnimationController(): PromoAnimationController {
	if (!browser) throw new Error('getPromoAnimationController() is browser-only');
	return instance ??= new PromoAnimationController();
}
