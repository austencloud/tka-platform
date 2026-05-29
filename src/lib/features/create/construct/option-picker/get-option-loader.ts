import { browser } from '$app/environment';
import { OptionLoader } from './services/option-loader';
import { motionQueryHandler } from '$lib/shared/pictograph/shared/services/motion-query-handler';
import { getPositionAnalyzer } from './get-position-analyzer';

let instance: OptionLoader | null = null;

export function getOptionLoader(): OptionLoader {
	if (!browser) throw new Error('getOptionLoader() is browser-only');
	return instance ??= new OptionLoader(motionQueryHandler, getPositionAnalyzer());
}
