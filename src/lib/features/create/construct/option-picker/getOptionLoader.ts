import { browser } from '$app/environment';
import type { IOptionLoader } from './services/contracts/IOptionLoader';
import { OptionLoader } from './services/implementations/OptionLoader';
import { gridPositionDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver';
import { motionQueryHandler } from '$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler';
import { getPositionAnalyzer } from './getPositionAnalyzer';

let instance: IOptionLoader | null = null;

export function getOptionLoader(): IOptionLoader {
	if (!browser) throw new Error('getOptionLoader() is browser-only');
	return instance ??= new OptionLoader(gridPositionDeriver, motionQueryHandler, getPositionAnalyzer());
}
