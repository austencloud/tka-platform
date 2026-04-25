import { browser } from '$app/environment';
import type { IPromoVideoExporter } from './services/contracts/IPromoVideoExporter';
import { PromoVideoExporter } from './services/implementations/PromoVideoExporter';

let instance: IPromoVideoExporter | null = null;

export function getPromoVideoExporter(): IPromoVideoExporter {
	if (!browser) throw new Error('getPromoVideoExporter() is browser-only');
	return instance ??= new PromoVideoExporter();
}
