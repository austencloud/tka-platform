import { browser } from '$app/environment';

import { PositionAnalyzer } from './services/position-analyzer';
import { gridPositionDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver';

let instance: PositionAnalyzer | null = null;

export function getPositionAnalyzer(): PositionAnalyzer {
	if (!browser) throw new Error('getPositionAnalyzer() is browser-only');
	return instance ??= new PositionAnalyzer(gridPositionDeriver);
}
