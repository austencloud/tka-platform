import { browser } from '$app/environment';
import { PromoVideoExporter } from './services/promo-video-exporter';

let instance: PromoVideoExporter | null = null;

export function getPromoVideoExporter(): PromoVideoExporter {
	if (!browser) throw new Error('getPromoVideoExporter() is browser-only');
	return instance ??= new PromoVideoExporter();
}
