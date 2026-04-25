import { browser } from '$app/environment';
import type { IPromoAnimationController } from './services/contracts/IPromoAnimationController';
import { PromoAnimationController } from './services/implementations/PromoAnimationController';

let instance: IPromoAnimationController | null = null;

export function getPromoAnimationController(): IPromoAnimationController {
	if (!browser) throw new Error('getPromoAnimationController() is browser-only');
	return instance ??= new PromoAnimationController();
}
